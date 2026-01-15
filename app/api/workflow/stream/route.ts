import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { executeWorkflow } from "@/app/trigger/workflow-executor";
import type { Edge, Node } from "reactflow";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { estimateNodeCost } from "@/lib/credits";

// NOTE: Node executors run on Trigger.dev only - not imported here to avoid FFmpeg bundling

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

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const sendEvent = (controller: ReadableStreamDefaultController, event: string, data: unknown) => {
    try {
      const sanitized = sanitizeForSSE(data);
      const message = `event: ${event}\ndata: ${JSON.stringify(sanitized)}\n\n`;
      controller.enqueue(encoder.encode(message));
    } catch (e) {
      console.error("[SSE] Failed to send event:", e);
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
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

        // Trigger the workflow executor task (creates parent-child hierarchy)
        console.log(`[WorkflowStream] Triggering executeWorkflow task...`);
        console.log(`[WorkflowStream] TRIGGER_SECRET_KEY present: ${!!process.env.TRIGGER_SECRET_KEY}`);
        
        let handle;
        try {
          handle = await executeWorkflow.trigger({
            workflowExecutionId: workflowExecution.id,
            workflowId: workflow.id,
            userId: user.id,
            nodes,
            edges,
          });
          console.log(`[WorkflowStream] Workflow task started with run ID: ${handle.id}`);
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

        // Track which nodes we've already sent events for
        const sentStarted = new Set<string>();
        const sentCompleted = new Set<string>();
        const sentFailed = new Set<string>();

        // Poll database for node execution updates and stream them
        // This runs while the workflow task executes
        let workflowDone = false;
        const maxPollTime = 10 * 60 * 1000; // 10 minutes max
        const pollStartTime = Date.now();

        while (!workflowDone) {
          // Timeout check
          if (Date.now() - pollStartTime > maxPollTime) {
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

          // Get all node executions that have been updated
          const nodeExecutions = await db.nodeExecution.findMany({
            where: { workflowExecutionId: workflowExecution.id },
            select: {
              nodeId: true,
              nodeType: true,
              nodeLabel: true,
              status: true,
              outputJson: true,
              error: true,
              updatedAt: true,
            },
          });

          // Send events for status changes
          for (const nodeExec of nodeExecutions) {
            // Send started event
            if ((nodeExec.status === "RUNNING" || nodeExec.status === "WAITING") && !sentStarted.has(nodeExec.nodeId)) {
              sendEvent(controller, "node-started", { 
                nodeId: nodeExec.nodeId, 
                nodeType: nodeExec.nodeType 
              });
              sentStarted.add(nodeExec.nodeId);
            }

            // Send completed event - ONLY if outputJson is available
            // This prevents sending empty output due to timing issues where
            // status is COMPLETED but outputJson hasn't been saved yet
            if (nodeExec.status === "COMPLETED" && !sentCompleted.has(nodeExec.nodeId)) {
              const outputJson = nodeExec.outputJson as object | null;
              const hasOutput = outputJson && Object.keys(outputJson).length > 0;
              console.log(`[WorkflowStream] Node ${nodeExec.nodeId} COMPLETED check:`, {
                hasOutput,
                outputJsonType: typeof nodeExec.outputJson,
                outputJsonKeys: outputJson ? Object.keys(outputJson) : [],
              });
              if (hasOutput) {
                console.log(`[WorkflowStream] Sending node-completed for ${nodeExec.nodeId} with output:`, 
                  JSON.stringify(nodeExec.outputJson).slice(0, 200));
                sendEvent(controller, "node-completed", {
                  nodeId: nodeExec.nodeId,
                  nodeType: nodeExec.nodeType,
                  output: nodeExec.outputJson,
                });
                sentCompleted.add(nodeExec.nodeId);
              } else {
                // Output not available yet - will retry in next poll
                console.log(`[WorkflowStream] Node ${nodeExec.nodeId} COMPLETED but outputJson empty/null, waiting...`);
              }
            }

            // Send failed event
            if (nodeExec.status === "FAILED" && !sentFailed.has(nodeExec.nodeId)) {
              sendEvent(controller, "node-failed", {
                nodeId: nodeExec.nodeId,
                nodeType: nodeExec.nodeType,
                error: nodeExec.error || "Unknown error",
              });
              sentFailed.add(nodeExec.nodeId);
            }
          }

          // Wait before next poll (only if workflow not done)
          if (!workflowDone) {
            await sleep(500);
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

        controller.close();

      } catch (error) {
        console.error("[WorkflowStream] Error:", error);
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
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
