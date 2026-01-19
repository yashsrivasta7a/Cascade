import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { executeWorkflow } from "@/app/trigger/workflow-executor";
import { runs } from "@trigger.dev/sdk/v3";
import type { Edge, Node } from "reactflow";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { estimateNodeCost } from "@/lib/credits";
import { uploadFromBase64, isTransloaditConfigured } from "@/lib/providers/transloadit";

// NOTE: Node executors run on Trigger.dev only - not imported here to avoid FFmpeg bundling

// Vercel function config - SSE streaming needs longer timeout for complex workflows
export const maxDuration = 300; // 5 minutes

// =============================================================================
// SSE WORKFLOW STREAMING ENDPOINT
// =============================================================================
// 
// Execution strategy:
// - Delegates to executeWorkflow task for parent-child hierarchy in dashboard
// - Uses runs.subscribeToRun() to stream updates back to client
// - Workflow task uses batchTriggerAndWait() for parallel node execution
// - All nodes from same workflow grouped under parent task
//
// =============================================================================

// Sanitize data for SSE - remove large base64 data
function sanitizeForSSE(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  
  if (typeof data === "string") {
    if (data.startsWith("data:") && data.length > 500) {
      return `[base64:${data.length}]`;
    }
    if (data.length > 5000) {
      return data.slice(0, 200) + `...[${data.length}]`;
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.slice(0, 10).map(item => sanitizeForSSE(item));
  }
  
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeForSSE(value);
    }
    return sanitized;
  }
  
  return data;
}

interface WorkflowStreamRequest {
  workflowId: string;
  nodes: Node[];
  edges: Edge[];
}

// Helper to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// =============================================================================
// PRE-PROCESS NODES: Upload base64 data to CDN before triggering workflow
// =============================================================================
// Trigger.dev has a 3MB payload limit. Base64 media can be 10+ MB.
// We upload base64 data to CDN first, replacing with HTTP URLs.
// =============================================================================

async function preprocessNodesForTrigger(nodes: Node[]): Promise<Node[]> {
  console.log(`[WorkflowStream] Preprocessing ${nodes.length} nodes for Trigger.dev`);
  
  // Log node types and media fields for debugging
  for (const node of nodes) {
    const nodeData = (node.data ?? {}) as Record<string, unknown>;
    const mediaFields = ["video", "audio", "image", "frame", "inputVideo", "inputAudio", "inputImage", "video1", "video2"];
    const foundMedia: string[] = [];
    for (const f of mediaFields) {
      const val = nodeData[f];
      if (val) {
        if (typeof val === "string") {
          const preview = val.startsWith("data:") ? `[base64:${val.length}]` : val.slice(0, 80);
          foundMedia.push(`${f}=${preview}`);
        } else if (typeof val === "object" && val !== null && "url" in val) {
          const url = (val as { url: string }).url;
          const preview = url.startsWith("data:") ? `[base64:${url.length}]` : url.slice(0, 80);
          foundMedia.push(`${f}.url=${preview}`);
        }
      }
    }
    if (foundMedia.length > 0) {
      console.log(`[WorkflowStream] Node ${node.id} (${node.type}): ${foundMedia.join(", ")}`);
    }
  }
  
  const transloaditConfigured = isTransloaditConfigured();
  if (!transloaditConfigured) {
    console.log("[WorkflowStream] Transloadit not configured - base64 data will NOT be uploaded to CDN");
    console.log("[WorkflowStream] WARNING: Large base64 payloads may exceed Trigger.dev 3MB limit!");
  }

  const processedNodes: Node[] = [];
  const uploadPromises: Promise<void>[] = [];

  for (const node of nodes) {
    const nodeData = { ...(node.data ?? {}) } as Record<string, unknown>;

    // Check all data fields for base64 URLs
    const fieldsToCheck = [
      "video", "audio", "image", "frame",
      "video1", "video2",
      "inputVideo", "inputAudio", "inputImage",
      "inputVideo1", "inputVideo2",
    ];

    for (const field of fieldsToCheck) {
      const value = nodeData[field];
      
      // Check if it's a string URL
      if (typeof value === "string" && value.startsWith("data:") && value.length > 1000) {
        if (transloaditConfigured) {
          console.log(`[WorkflowStream] Uploading base64 from ${node.id}.${field} (${value.length} bytes)`);
          
          // Upload to CDN
          const fieldCopy = field;
          const nodeCopy = node;
          uploadPromises.push(
            uploadFromBase64(value).then(result => {
              if (result.url !== value) {
                nodeData[fieldCopy] = { url: result.url, mimeType: result.mimeType };
                console.log(`[WorkflowStream] Uploaded ${nodeCopy.id}.${fieldCopy} → ${result.url.slice(0, 60)}...`);
              }
            }).catch(err => {
              console.error(`[WorkflowStream] Failed to upload ${nodeCopy.id}.${fieldCopy}:`, err);
              // Keep original value on failure - may cause payload issues
            })
          );
        } else {
          console.warn(`[WorkflowStream] SKIPPING ${node.id}.${field} base64 upload - Transloadit not configured`);
        }
      }
      
      // Check if it's an object with a base64 url field
      if (typeof value === "object" && value !== null) {
        const obj = value as { url?: string; mimeType?: string };
        if (typeof obj.url === "string" && obj.url.startsWith("data:") && obj.url.length > 1000) {
          if (transloaditConfigured) {
            console.log(`[WorkflowStream] Uploading base64 from ${node.id}.${field}.url (${obj.url.length} bytes)`);
            
            const fieldCopy = field;
            const nodeCopy = node;
            uploadPromises.push(
              uploadFromBase64(obj.url).then(result => {
                if (result.url !== obj.url) {
                  nodeData[fieldCopy] = { url: result.url, mimeType: result.mimeType || obj.mimeType };
                  console.log(`[WorkflowStream] Uploaded ${nodeCopy.id}.${fieldCopy}.url → ${result.url.slice(0, 60)}...`);
                }
              }).catch(err => {
                console.error(`[WorkflowStream] Failed to upload ${nodeCopy.id}.${fieldCopy}.url:`, err);
                // Keep original value on failure - may cause payload issues
              })
            );
          } else {
            console.warn(`[WorkflowStream] SKIPPING ${node.id}.${field}.url base64 upload - Transloadit not configured`);
          }
        }
      }
    }

    // Create updated node with processed data
    processedNodes.push({
      ...node,
      data: nodeData,
    });
  }

  // Wait for all uploads to complete
  if (uploadPromises.length > 0) {
    console.log(`[WorkflowStream] Waiting for ${uploadPromises.length} base64 uploads...`);
    await Promise.all(uploadPromises);
    console.log(`[WorkflowStream] All base64 uploads completed`);
  }
  
  // Calculate approximate payload size
  const payloadStr = JSON.stringify(processedNodes);
  const payloadSizeMB = (payloadStr.length / (1024 * 1024)).toFixed(2);
  console.log(`[WorkflowStream] Final payload size: ${payloadSizeMB}MB (${processedNodes.length} nodes)`);
  
  if (parseFloat(payloadSizeMB) > 2.5) {
    console.error(`[WorkflowStream] CRITICAL: Payload size ${payloadSizeMB}MB exceeds safe limit (2.5MB)!`);
    console.error(`[WorkflowStream] This WILL cause workflow execution to fail.`);
    console.error(`[WorkflowStream] Please ensure TRANSLOADIT_AUTH_KEY and TRANSLOADIT_AUTH_SECRET are set.`);
    // Throw error to prevent execution with oversized payload
    throw new Error(`Payload too large (${payloadSizeMB}MB). Configure Transloadit CDN to fix this.`);
  }

  return processedNodes;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // Track last flush time for heartbeat mechanism
  let lastFlushTime = Date.now();
  const HEARTBEAT_INTERVAL = 3000; // Send heartbeat every 3 seconds to prevent buffering
  
  const sendEvent = (controller: ReadableStreamDefaultController, event: string, data: unknown) => {
    try {
      const sanitized = sanitizeForSSE(data);
      const message = `event: ${event}\ndata: ${JSON.stringify(sanitized)}\n\n`;
      controller.enqueue(encoder.encode(message));
      lastFlushTime = Date.now();
    } catch (e) {
      console.error("[SSE] Failed to send event:", e);
    }
  };
  
  // Send SSE comment to flush the buffer (keeps connection alive on Vercel)
  const sendHeartbeat = (controller: ReadableStreamDefaultController) => {
    try {
      // SSE comment (starts with :) - doesn't trigger event handlers but flushes buffer
      controller.enqueue(encoder.encode(": heartbeat\n\n"));
      lastFlushTime = Date.now();
    } catch (e) {
      // Ignore errors during heartbeat
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial comment immediately to kick the stream on Vercel
      // This forces the response to start streaming right away
      controller.enqueue(encoder.encode(": stream started\n\n"));
      lastFlushTime = Date.now();
      
      try {
        const { userId: clerkUserId } = await auth();
        if (!clerkUserId) {
          sendEvent(controller, "error", { message: "Unauthorized" });
          controller.close();
          return;
        }

        const body: WorkflowStreamRequest = await request.json();
        const { workflowId, nodes, edges } = body;

        if (!nodes?.length) {
          sendEvent(controller, "error", { message: "No nodes to execute" });
          controller.close();
          return;
        }

        console.log(`[WorkflowStream] Starting workflow with ${nodes.length} nodes`);

        // Get or create user (User.id IS the Clerk ID)
        let user = await db.user.findUnique({
          where: { id: clerkUserId },
          select: { id: true, credits: true },
        });

        if (!user) {
          user = await db.user.create({
            data: {
              id: clerkUserId,
              email: `${clerkUserId}@temp.local`,
              credits: 1_000_000,
            },
            select: { id: true, credits: true },
          });
        }

        // Estimate total cost for ALL nodes
        let totalEstimatedCost = 0;
        for (const node of nodes) {
          const nodeData = (node.data ?? {}) as Record<string, unknown>;
          totalEstimatedCost += estimateNodeCost(node.type as string, nodeData);
        }

        if (user.credits < totalEstimatedCost) {
          sendEvent(controller, "error", { 
            message: `Insufficient credits. Required: ${totalEstimatedCost.toLocaleString()}, Available: ${user.credits.toLocaleString()}` 
          });
          controller.close();
          return;
        }

        // Get or create workflow
        let workflow = await db.workflow.findFirst({
          where: { id: workflowId, userId: user.id },
        });

        if (!workflow) {
          workflow = await db.workflow.upsert({
            where: { id: workflowId },
            create: {
              id: workflowId,
              name: "Workflow",
              userId: user.id,
              nodesJson: [],
              edgesJson: [],
            },
            update: {},
          });
        }

        // Create workflow execution record
        const workflowExecution = await db.workflowExecution.create({
          data: {
            workflowId: workflow.id,
            userId: user.id,
            status: "PENDING",
            workflowSnapshot: { 
              nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
              edges: edges.map(e => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
            },
            estimatedCost: totalEstimatedCost,
          },
        });

        sendEvent(controller, "workflow-started", { 
          workflowExecutionId: workflowExecution.id,
          estimatedCost: totalEstimatedCost,
        });

        // Send initial queued events for all nodes
        for (const node of nodes) {
          const nodeData = (node.data ?? {}) as Record<string, unknown>;
          const nodeLabel = (nodeData.label as string) || NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS]?.label || node.type;
          sendEvent(controller, "node-queued", { nodeId: node.id, nodeType: node.type, nodeLabel });
        }

        // Pre-process nodes: upload base64 data to CDN to reduce payload size
        // Trigger.dev has a 3MB payload limit - base64 media can exceed this
        console.log(`[WorkflowStream] Pre-processing nodes to upload base64 data...`);
        const processedNodes = await preprocessNodesForTrigger(nodes);

        // Trigger the workflow executor task (creates parent-child hierarchy)
        console.log(`[WorkflowStream] Triggering executeWorkflow task...`);
        console.log(`[WorkflowStream] TRIGGER_SECRET_KEY present: ${!!process.env.TRIGGER_SECRET_KEY}`);
        
        let handle;
        try {
          handle = await executeWorkflow.trigger({
            workflowExecutionId: workflowExecution.id,
            workflowId: workflow.id,
            userId: user.id,
            nodes: processedNodes,
            edges,
          });
          console.log(`[WorkflowStream] Workflow task started with run ID: ${handle.id}`);
          
          // Store the Trigger.dev run ID for realtime subscriptions
          await db.workflowExecution.update({
            where: { id: workflowExecution.id },
            data: { triggerRunId: handle.id },
          });
        } catch (triggerError) {
          console.error(`[WorkflowStream] Failed to trigger workflow task:`, triggerError);
          sendEvent(controller, "error", { 
            message: `Failed to start workflow: ${triggerError instanceof Error ? triggerError.message : 'Unknown error'}` 
          });
          
          // Mark workflow as failed
          await db.workflowExecution.update({
            where: { id: workflowExecution.id },
            data: { status: "FAILED", error: "Failed to trigger workflow task" },
          });
          
          controller.close();
          return;
        }

        // =======================================================================
        // REALTIME METADATA SUBSCRIPTION - No polling!
        // =======================================================================
        // The workflow-executor updates metadata when nodes change status.
        // We subscribe to the run and receive instant updates via metadata.
        // Falls back to DB polling if subscription fails.
        // =======================================================================
        
        console.log(`[WorkflowStream] Starting realtime subscription for run ${handle.id}`);
        
        let workflowDone = false;
        const maxTime = 10 * 60 * 1000; // 10 minutes max
        const startTime = Date.now();
        
        // Track sent events to avoid duplicates
        const sentStarted = new Set<string>();
        const sentCompleted = new Set<string>();
        const sentFailed = new Set<string>();
        
        // Terminal states for the Trigger.dev run
        const TERMINAL_STATES = new Set([
          "COMPLETED", "FAILED", "CRASHED", "SYSTEM_FAILURE",
          "CANCELED", "TIMED_OUT", "EXPIRED", "INTERRUPTED",
        ]);
        
        // Interface for node status in metadata
        interface NodeStatus {
          status: "queued" | "started" | "completed" | "failed";
          nodeType: string;
          nodeLabel?: string;
          output?: unknown;
          error?: string;
          timestamp: number;
        }
        
        // Start heartbeat interval to prevent Vercel buffering
        // Declared with let so it can be accessed in catch block
        let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
        heartbeatInterval = setInterval(() => {
          if (Date.now() - lastFlushTime > HEARTBEAT_INTERVAL) {
            sendHeartbeat(controller);
          }
        }, HEARTBEAT_INTERVAL);
        
        try {
          // Subscribe to the run - receives updates on status AND metadata changes
          for await (const run of runs.subscribeToRun(handle.id)) {
            // Timeout check
            if (Date.now() - startTime > maxTime) {
              console.log(`[WorkflowStream] Subscription timeout reached`);
              sendEvent(controller, "error", { message: "Workflow execution timeout" });
              break;
            }
            
            // Send heartbeat if no events for a while (forces Vercel buffer flush)
            if (Date.now() - lastFlushTime > HEARTBEAT_INTERVAL) {
              sendHeartbeat(controller);
            }
            
            console.log(`[WorkflowStream] Run update: status=${run.status}, metadata keys=${Object.keys(run.metadata || {}).join(",")}`);
            
            // Process metadata for node updates
            const meta = run.metadata as Record<string, unknown> | undefined;
            if (meta) {
              for (const [key, value] of Object.entries(meta)) {
                // Node status keys are like "node:nodeId"
                if (key.startsWith("node:")) {
                  const nodeId = key.replace("node:", "");
                  const nodeStatus = value as NodeStatus;
                  
                  if (nodeStatus.status === "started" && !sentStarted.has(nodeId)) {
                    sendEvent(controller, "node-started", {
                      nodeId,
                      nodeType: nodeStatus.nodeType,
                    });
                    sentStarted.add(nodeId);
                  } else if (nodeStatus.status === "completed" && !sentCompleted.has(nodeId)) {
                    console.log(`[WorkflowStream] Node ${nodeId} completed via metadata`);
                    sendEvent(controller, "node-completed", {
                      nodeId,
                      nodeType: nodeStatus.nodeType,
                      output: nodeStatus.output,
                    });
                    sentCompleted.add(nodeId);
                  } else if (nodeStatus.status === "failed" && !sentFailed.has(nodeId)) {
                    sendEvent(controller, "node-failed", {
                      nodeId,
                      nodeType: nodeStatus.nodeType,
                      error: nodeStatus.error || "Unknown error",
                    });
                    sentFailed.add(nodeId);
                  }
                }
                
                // Workflow completion status
                if (key === "workflow") {
                  const workflowStatus = value as { status: string; successCount: number; failCount: number };
                  if (workflowStatus.status === "completed") {
                    console.log(`[WorkflowStream] Workflow completed via metadata: ${workflowStatus.successCount} succeeded, ${workflowStatus.failCount} failed`);
                    workflowDone = true;
                  }
                }
              }
            }
            
            // Check if run reached terminal state
            if (TERMINAL_STATES.has(run.status)) {
              console.log(`[WorkflowStream] Run reached terminal state: ${run.status}`);
              workflowDone = true;
              break;
            }
          }
          
          console.log(`[WorkflowStream] Subscription ended, workflowDone=${workflowDone}`);
          
        } catch (subscriptionError) {
          console.warn(`[WorkflowStream] Subscription error, falling back to DB polling:`, subscriptionError);
          
          // Fallback to DB polling if subscription fails
          while (!workflowDone) {
            // Send heartbeat during polling to prevent buffering
            if (Date.now() - lastFlushTime > HEARTBEAT_INTERVAL) {
              sendHeartbeat(controller);
            }
            if (Date.now() - startTime > maxTime) {
              console.log(`[WorkflowStream] Polling timeout reached`);
              sendEvent(controller, "error", { message: "Workflow execution timeout" });
              break;
            }

            // Check workflow status
            const currentWorkflow = await db.workflowExecution.findUnique({
              where: { id: workflowExecution.id },
              select: { status: true },
            });

            if (currentWorkflow?.status === "COMPLETED" || currentWorkflow?.status === "FAILED") {
              workflowDone = true;
            }

            // Get node updates from DB
            const nodeExecutions = await db.nodeExecution.findMany({
              where: { workflowExecutionId: workflowExecution.id },
              select: {
                nodeId: true,
                nodeType: true,
                status: true,
                outputJson: true,
                error: true,
              },
            });

            for (const nodeExec of nodeExecutions) {
              if ((nodeExec.status === "RUNNING" || nodeExec.status === "WAITING") && !sentStarted.has(nodeExec.nodeId)) {
                sendEvent(controller, "node-started", { nodeId: nodeExec.nodeId, nodeType: nodeExec.nodeType });
                sentStarted.add(nodeExec.nodeId);
              }
              if (nodeExec.status === "COMPLETED" && !sentCompleted.has(nodeExec.nodeId)) {
                const outputJson = nodeExec.outputJson as object | null;
                if (outputJson && Object.keys(outputJson).length > 0) {
                  sendEvent(controller, "node-completed", { nodeId: nodeExec.nodeId, nodeType: nodeExec.nodeType, output: nodeExec.outputJson });
                  sentCompleted.add(nodeExec.nodeId);
                }
              }
              if (nodeExec.status === "FAILED" && !sentFailed.has(nodeExec.nodeId)) {
                sendEvent(controller, "node-failed", { nodeId: nodeExec.nodeId, nodeType: nodeExec.nodeType, error: nodeExec.error || "Unknown error" });
                sentFailed.add(nodeExec.nodeId);
              }
            }

            if (!workflowDone) {
              await sleep(500);
            }
          }
        }

        // IMPORTANT: After workflow is done, poll multiple times to ensure all outputs are captured
        // This handles race conditions where DB updates weren't visible in the last poll
        console.log(`[WorkflowStream] Workflow done, doing final polls for any missed events...`);
        
        // Poll a few more times to catch any late outputJson updates
        const maxFinalPolls = 5;
        for (let pollAttempt = 0; pollAttempt < maxFinalPolls; pollAttempt++) {
          // Check if all completed nodes have been sent
          const pendingCompletedNodes = nodes.filter(n => 
            !sentCompleted.has(n.id) && !sentFailed.has(n.id)
          );
          
          if (pendingCompletedNodes.length === 0) {
            console.log(`[WorkflowStream] All node events sent, finishing`);
            break;
          }
          
          await sleep(500); // Wait for DB writes to complete
          
          const finalNodeExecutions = await db.nodeExecution.findMany({
            where: { workflowExecutionId: workflowExecution.id },
            select: {
              nodeId: true,
              nodeType: true,
              nodeLabel: true,
              status: true,
              outputJson: true,
              error: true,
            },
          });

          for (const nodeExec of finalNodeExecutions) {
            // Send completed event if not already sent AND has output
            if (nodeExec.status === "COMPLETED" && !sentCompleted.has(nodeExec.nodeId)) {
              const outputJson = nodeExec.outputJson as object | null;
              const hasOutput = outputJson && Object.keys(outputJson).length > 0;
              console.log(`[WorkflowStream] Final poll ${pollAttempt + 1}: ${nodeExec.nodeId} check:`, {
                hasOutput,
                outputJsonKeys: outputJson ? Object.keys(outputJson) : [],
              });
              if (hasOutput) {
                console.log(`[WorkflowStream] Final poll ${pollAttempt + 1}: sending node-completed for ${nodeExec.nodeId}`);
                sendEvent(controller, "node-completed", {
                  nodeId: nodeExec.nodeId,
                  nodeType: nodeExec.nodeType,
                  output: nodeExec.outputJson,
                });
                sentCompleted.add(nodeExec.nodeId);
              } else {
                console.log(`[WorkflowStream] Final poll ${pollAttempt + 1}: ${nodeExec.nodeId} still has no outputJson`);
              }
            }

            // Send failed event if not already sent
            if (nodeExec.status === "FAILED" && !sentFailed.has(nodeExec.nodeId)) {
              console.log(`[WorkflowStream] Final poll ${pollAttempt + 1}: sending node-failed for ${nodeExec.nodeId}`);
              sendEvent(controller, "node-failed", {
                nodeId: nodeExec.nodeId,
                nodeType: nodeExec.nodeType,
                error: nodeExec.error || "Unknown error",
              });
              sentFailed.add(nodeExec.nodeId);
            }
          }
        }
        
        // Log warning if any nodes didn't get their events sent
        const missedNodes = nodes.filter(n => !sentCompleted.has(n.id) && !sentFailed.has(n.id));
        if (missedNodes.length > 0) {
          console.warn(`[WorkflowStream] WARNING: ${missedNodes.length} nodes never sent completion events:`, 
            missedNodes.map(n => n.id));
        }

        // Final workflow status
        const finalWorkflow = await db.workflowExecution.findUnique({
          where: { id: workflowExecution.id },
          select: { status: true },
        });

        sendEvent(controller, "workflow-completed", {
          workflowExecutionId: workflowExecution.id,
          successCount: sentCompleted.size,
          failCount: sentFailed.size,
          status: finalWorkflow?.status || "UNKNOWN",
        });

        // Clean up heartbeat interval
        clearInterval(heartbeatInterval);
        controller.close();

      } catch (error) {
        console.error("[WorkflowStream] Error:", error);
        // Clean up heartbeat interval on error (if it was created)
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        sendEvent(controller, "error", { 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Critical for Vercel/nginx proxy - disable response buffering
      "X-Accel-Buffering": "no",
      // Ensure no compression which can cause buffering
      "Content-Encoding": "none",
    },
  });
}
