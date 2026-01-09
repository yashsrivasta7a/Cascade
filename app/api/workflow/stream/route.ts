import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { executeNode } from "@/app/trigger/node-executor";
import { 
  getNodeExecutor, 
  validateNodeInput, 
  registerAllNodeExecutors,
  type NodeExecutionContext 
} from "@/lib/engine";
import type { Edge, Node } from "reactflow";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { estimateNodeCost } from "@/lib/credits";

// Register executors for local utility node execution
registerAllNodeExecutors();

// =============================================================================
// SSE WORKFLOW STREAMING ENDPOINT
// =============================================================================
// 
// Execution strategy:
// - AI nodes (seedream, seedvr, seedance, elevenlabs, lipsync, openrouter): Trigger.dev
// - Utility nodes (crop-image, merge-videos, etc.): Run locally in this API route
//
// This avoids sending large base64 data over the network for utility operations.

// Node types that run through Trigger.dev (external APIs)
const TRIGGER_NODE_TYPES = ["seedream", "seedvr", "seedance", "elevenlabs", "lipsync", "openrouter"];

// Node types that run locally (internal processing)
const LOCAL_NODE_TYPES = ["crop-image", "merge-videos", "merge-audio-video", "extract-audio"];

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

// Build dependency graph
function buildDependencyGraph(nodes: Node[], edges: Edge[]) {
  const nodeById = new Map<string, Node>(nodes.map(n => [n.id, n]));
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const node of nodes) {
    dependencies.set(node.id, new Set());
    dependents.set(node.id, new Set());
  }

  for (const edge of edges) {
    if (nodeById.has(edge.source) && nodeById.has(edge.target)) {
      dependencies.get(edge.target)!.add(edge.source);
      dependents.get(edge.source)!.add(edge.target);
    }
  }

  return { nodeById, dependencies, dependents };
}

// Topological sort
function topoSort(nodes: Node[], edges: Edge[]): Node[] {
  const inDeg = new Map<string, number>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();

  for (const n of nodes) inDeg.set(n.id, 0);
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }

  const q: string[] = [];
  for (const [id, deg] of inDeg.entries()) if (deg === 0) q.push(id);

  const out: Node[] = [];
  while (q.length) {
    const id = q.shift()!;
    const n = byId.get(id);
    if (n) out.push(n);
    for (const nxt of adj.get(id) ?? []) {
      inDeg.set(nxt, (inDeg.get(nxt) ?? 0) - 1);
      if (inDeg.get(nxt) === 0) q.push(nxt);
    }
  }

  return out;
}

// Build input for a node based on outputs from dependencies
function buildNodeInput(
  node: Node,
  edges: Edge[],
  outputs: Map<string, unknown>,
  nodes: Node[]
) {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const incomingEdges = edges.filter(e => e.target === node.id);
  
  let context: string | undefined;
  let prompt: string | undefined;
  
  for (const edge of incomingEdges) {
    const sourceOutput = outputs.get(edge.source) as { type?: string; text?: string } | undefined;
    
    if (sourceOutput?.type === "text" && sourceOutput.text) {
      if (edge.targetHandle === "prompt") {
        prompt = sourceOutput.text;
      } else if (edge.targetHandle === "context") {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const sourcePrompt = (sourceNode?.data as { prompt?: string })?.prompt;
        context = sourcePrompt 
          ? `[Previous: "${sourcePrompt}"]\n[Response: "${sourceOutput.text}"]`
          : sourceOutput.text;
      }
    }
  }
  
  const getMediaFromEdge = (handleId: string) => {
    const edge = incomingEdges.find(e => e.targetHandle === handleId);
    if (!edge) return undefined;
    
    const output = outputs.get(edge.source) as { 
      type?: string; 
      image?: { url: string };
      video?: { url: string };
      audio?: { url: string };
    } | undefined;
    
    if (output?.type === "image" && output.image?.url) return { url: output.image.url };
    if (output?.type === "video" && output.video?.url) return { url: output.video.url };
    if (output?.type === "audio" && output.audio?.url) return { url: output.audio.url };
    return undefined;
  };

  // Map frontend field names to schema field names
  // Frontend uses inputVideo1/inputVideo2, schema expects video1/video2 as { url: string }
  const normalizeAsset = (value: unknown): { url: string } | undefined => {
    if (!value) return undefined;
    if (typeof value === "string") return { url: value };
    if (typeof value === "object" && value !== null && "url" in value) {
      return value as { url: string };
    }
    return undefined;
  };

  return {
    ...data,
    prompt: prompt || data.prompt,
    context: context || data.context,
    // Single media inputs
    image: getMediaFromEdge("image") || getMediaFromEdge("inputImage") || normalizeAsset(data.image) || normalizeAsset(data.inputImage),
    video: getMediaFromEdge("video") || getMediaFromEdge("inputVideo") || normalizeAsset(data.video) || normalizeAsset(data.inputVideo),
    audio: getMediaFromEdge("audio") || getMediaFromEdge("inputAudio") || normalizeAsset(data.audio) || normalizeAsset(data.inputAudio),
    frame: getMediaFromEdge("frame") || normalizeAsset(data.frame),
    // Merge-videos specific: map inputVideo1/inputVideo2 to video1/video2
    video1: getMediaFromEdge("inputVideo1") || normalizeAsset(data.video1) || normalizeAsset(data.inputVideo1),
    video2: getMediaFromEdge("inputVideo2") || normalizeAsset(data.video2) || normalizeAsset(data.inputVideo2),
  };
}

// Execute a utility node locally
async function executeLocalNode(
  nodeType: string,
  input: Record<string, unknown>,
  context: NodeExecutionContext
): Promise<{ success: boolean; output?: unknown; error?: string }> {
  const executor = getNodeExecutor(nodeType);
  if (!executor) {
    return { success: false, error: `Unknown node type: ${nodeType}` };
  }

  const validation = validateNodeInput(nodeType, input);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  try {
    const result = await executor.execute(validation.data, context);
    if (result.success) {
      return { success: true, output: result.output };
    }
    return { success: false, error: result.error || "Execution failed" };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

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

        // Estimate total cost
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

        // Create workflow execution
        const workflowExecution = await db.workflowExecution.create({
          data: {
            workflowId: workflow.id,
            userId: user.id,
            status: "RUNNING",
            startedAt: new Date(),
            workflowSnapshot: { 
              nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position })),
              edges: edges.map(e => ({ source: e.source, target: e.target })),
            },
            estimatedCost: totalEstimatedCost,
          },
        });

        sendEvent(controller, "workflow-started", { 
          workflowExecutionId: workflowExecution.id,
          estimatedCost: totalEstimatedCost,
        });

        // Build dependency graph
        console.log(`[WorkflowStream] Edges:`, edges.map(e => `${e.source} → ${e.target} (${e.sourceHandle} → ${e.targetHandle})`));
        
        const sortedNodes = topoSort(nodes, edges);
        const { dependencies } = buildDependencyGraph(sortedNodes, edges);
        
        console.log(`[WorkflowStream] Topological order:`);
        sortedNodes.forEach((n, i) => {
          const deps = dependencies.get(n.id) || new Set();
          console.log(`  ${i + 1}. ${n.id} (${n.type}) - depends on: [${[...deps].join(", ") || "none"}]`);
        });
        
        // Track state
        const outputs = new Map<string, unknown>();
        const completed = new Set<string>();
        const failed = new Set<string>();
        const nodeExecutionIds = new Map<string, string>();

        // Create node execution records
        for (const node of sortedNodes) {
          const nodeData = (node.data ?? {}) as Record<string, unknown>;
          const nodeLabel = (nodeData.label as string) || NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS]?.label || node.type;
          
          const nodeExecution = await db.nodeExecution.create({
            data: {
              workflowExecutionId: workflowExecution.id,
              nodeId: node.id,
              nodeType: node.type as string,
              nodeLabel: nodeLabel,
              status: "PENDING",
              inputJson: {},
            },
          });
          nodeExecutionIds.set(node.id, nodeExecution.id);
          sendEvent(controller, "node-queued", { nodeId: node.id, nodeType: node.type, nodeLabel });
        }

        // Execute nodes SEQUENTIALLY in topological order
        // Each node waits for ALL its dependencies to complete before starting
        for (const node of sortedNodes) {
          // Check if any dependency failed
          const deps = dependencies.get(node.id) || new Set();
          const anyDepFailed = [...deps].some(d => failed.has(d));
          
          if (anyDepFailed) {
            failed.add(node.id);
            await db.nodeExecution.update({
              where: { id: nodeExecutionIds.get(node.id)! },
              data: { status: "FAILED", error: "Dependency failed", completedAt: new Date() },
            });
            sendEvent(controller, "node-failed", { 
              nodeId: node.id, 
              nodeType: node.type,
              error: "Dependency failed - a required upstream node failed" 
            });
            continue;
          }

          // All dependencies must be complete (topological order ensures this)
          const allDepsComplete = [...deps].every(d => completed.has(d));
          if (!allDepsComplete) {
            console.error(`[WorkflowStream] Node ${node.id} has incomplete deps - this shouldn't happen!`);
            failed.add(node.id);
            sendEvent(controller, "node-failed", { 
              nodeId: node.id, 
              nodeType: node.type,
              error: "Internal error: dependencies not complete" 
            });
            continue;
          }

          // Mark as started
          await db.nodeExecution.update({
            where: { id: nodeExecutionIds.get(node.id)! },
            data: { status: "RUNNING", startedAt: new Date() },
          });
          sendEvent(controller, "node-started", { nodeId: node.id, nodeType: node.type });
          console.log(`[WorkflowStream] Executing node: ${node.id} (${node.type})`);

          // Build input from completed dependency outputs
          const input = buildNodeInput(node, edges, outputs, sortedNodes);
          const nodeType = node.type as string;

          try {
            let result: { success: boolean; output?: unknown; error?: string };

            if (LOCAL_NODE_TYPES.includes(nodeType)) {
              // Execute locally
              const context: NodeExecutionContext = {
                nodeExecutionId: nodeExecutionIds.get(node.id)!,
                workflowExecutionId: workflowExecution.id,
                nodeId: node.id,
                nodeType,
                webhookBaseUrl: process.env.WEBHOOK_BASE_URL ?? "http://localhost:3000",
                attempt: 1,
              };
              result = await executeLocalNode(nodeType, input as Record<string, unknown>, context);
            } else if (TRIGGER_NODE_TYPES.includes(nodeType)) {
              // Execute via Trigger.dev (one at a time for sequential execution)
              const payload = {
                payload: {
                  nodeExecutionId: nodeExecutionIds.get(node.id)!,
                  workflowExecutionId: workflowExecution.id,
                  nodeId: node.id,
                  nodeType: nodeType as AINodeType,
                  input: input as Record<string, unknown>,
                },
              };

              console.log(`[WorkflowStream] Triggering ${nodeType} via Trigger.dev...`);
              const triggerResult = await executeNode.triggerAndWait(payload.payload);

              if (triggerResult.ok && triggerResult.output) {
                result = { success: true, output: triggerResult.output.output };
              } else {
                result = { 
                  success: false, 
                  error: triggerResult.error?.message || "Trigger.dev execution failed" 
                };
              }
            } else {
              result = { success: false, error: `Unknown node type: ${nodeType}` };
            }

            // Process result
            if (result.success && result.output) {
              completed.add(node.id);
              outputs.set(node.id, result.output);
              
              await db.nodeExecution.update({
                where: { id: nodeExecutionIds.get(node.id)! },
                data: { 
                  status: "COMPLETED", 
                  completedAt: new Date(),
                  providerUsed: LOCAL_NODE_TYPES.includes(nodeType) ? "internal" : "trigger.dev",
                },
              });

              sendEvent(controller, "node-completed", {
                nodeId: node.id,
                nodeType: node.type,
                output: result.output,
              });
              
              console.log(`[WorkflowStream] ✓ Node ${node.id} completed successfully`);
            } else {
              failed.add(node.id);
              await db.nodeExecution.update({
                where: { id: nodeExecutionIds.get(node.id)! },
                data: { status: "FAILED", error: result.error, completedAt: new Date() },
              });
              sendEvent(controller, "node-failed", {
                nodeId: node.id,
                nodeType: node.type,
                error: result.error || "Unknown error",
              });
              
              console.log(`[WorkflowStream] ✗ Node ${node.id} failed: ${result.error}`);
            }
          } catch (error) {
            failed.add(node.id);
            const errorMsg = error instanceof Error ? error.message : String(error);
            await db.nodeExecution.update({
              where: { id: nodeExecutionIds.get(node.id)! },
              data: { status: "FAILED", error: errorMsg, completedAt: new Date() },
            });
            sendEvent(controller, "node-failed", {
              nodeId: node.id,
              nodeType: node.type,
              error: errorMsg,
            });
            
            console.error(`[WorkflowStream] ✗ Node ${node.id} threw error:`, error);
          }
        }

        // Update workflow execution status
        const finalStatus = failed.size === 0 ? "COMPLETED" : "FAILED";
        await db.workflowExecution.update({
          where: { id: workflowExecution.id },
          data: {
            status: finalStatus,
            completedAt: new Date(),
          },
        });

        sendEvent(controller, "workflow-completed", {
          workflowExecutionId: workflowExecution.id,
          successCount: completed.size,
          failCount: failed.size,
          status: finalStatus,
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
