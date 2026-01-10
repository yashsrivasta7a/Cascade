import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { executeNode } from "@/app/trigger/node-executor";
import { runs } from "@trigger.dev/sdk/v3";
import { 
  getNodeExecutor, 
  validateNodeInput, 
  registerAllNodeExecutors,
  type NodeExecutionContext 
} from "@/lib/engine";
import { persistNodeOutput, isTransloaditConfigured } from "@/lib/providers";
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
// ALL nodes now run on Trigger.dev for consistent execution environment
// - AI nodes: External API calls (fal.ai, OpenRouter, ElevenLabs)
// - Utility nodes: FFmpeg processing (using ffmpeg-static in serverless)

// All node types run through Trigger.dev
const TRIGGER_NODE_TYPES = [
  // AI nodes
  "seedream", "seedvr", "seedance", "elevenlabs", "lipsync", "openrouter",
  // Utility nodes (now on Trigger.dev with ffmpeg-static)
  "crop-image", "merge-videos", "merge-audio-video", "extract-audio"
];

// No nodes run locally anymore - all on Trigger.dev
const LOCAL_NODE_TYPES: string[] = [];

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
  
  console.log(`[buildNodeInput] Node ${node.id} (${node.type})`);
  console.log(`[buildNodeInput] - Incoming edges: ${incomingEdges.length}`);
  console.log(`[buildNodeInput] - Available outputs: ${[...outputs.keys()].join(", ")}`);
  
  let context: string | undefined;
  let prompt: string | undefined;
  
  // Normalize any output to extract usable data
  const normalizeOutput = (output: unknown): {
    type?: string;
    text?: string;
    image?: { url: string };
    video?: { url: string };
    audio?: { url: string };
  } | undefined => {
    if (!output) return undefined;
    if (typeof output !== "object") return undefined;
    return output as any;
  };
  
  for (const edge of incomingEdges) {
    const rawOutput = outputs.get(edge.source);
    const sourceOutput = normalizeOutput(rawOutput);
    
    console.log(`[buildNodeInput] - Edge from ${edge.source} (handle: ${edge.sourceHandle}) -> ${edge.targetHandle}`);
    console.log(`[buildNodeInput]   Raw output type: ${rawOutput ? typeof rawOutput : 'undefined'}`);
    console.log(`[buildNodeInput]   Output type field: ${sourceOutput?.type || 'none'}`);
    
    // Handle text outputs (for prompt/context connections)
    if (sourceOutput?.type === "text" && sourceOutput.text) {
      if (edge.targetHandle === "prompt") {
        prompt = sourceOutput.text;
        console.log(`[buildNodeInput]   -> Mapped text to prompt (${prompt.slice(0, 50)}...)`);
      } else if (edge.targetHandle === "context") {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const sourcePrompt = (sourceNode?.data as { prompt?: string })?.prompt;
        context = sourcePrompt 
          ? `[Previous: "${sourcePrompt}"]\n[Response: "${sourceOutput.text}"]`
          : sourceOutput.text;
        console.log(`[buildNodeInput]   -> Mapped text to context`);
      }
    }
  }
  
  // Helper to get media from a connected edge
  const getMediaFromEdge = (handleId: string): { url: string } | undefined => {
    const edge = incomingEdges.find(e => e.targetHandle === handleId);
    if (!edge) return undefined;
    
    const rawOutput = outputs.get(edge.source);
    const output = normalizeOutput(rawOutput);
    
    console.log(`[buildNodeInput] getMediaFromEdge(${handleId}): source=${edge.source}, sourceHandle=${edge.sourceHandle}, outputType=${output?.type}`);
    
    // Check standard output formats
    if (output?.type === "image" && output.image?.url) {
      console.log(`[buildNodeInput]   -> Found image URL (${output.image.url.slice(0, 80)}...)`);
      return { url: output.image.url };
    }
    if (output?.type === "video" && output.video?.url) {
      console.log(`[buildNodeInput]   -> Found video URL (${output.video.url.slice(0, 80)}...)`);
      return { url: output.video.url };
    }
    if (output?.type === "audio" && output.audio?.url) {
      console.log(`[buildNodeInput]   -> Found audio URL`);
      return { url: output.audio.url };
    }
    
    // Check if output itself is a URL string (direct pass-through)
    if (typeof rawOutput === "string" && (rawOutput.startsWith("http") || rawOutput.startsWith("data:"))) {
      console.log(`[buildNodeInput]   -> Found direct URL string`);
      return { url: rawOutput };
    }
    
    // Check if output has a direct url property (some nodes output { url: "..." })
    if (output && typeof output === "object" && "url" in output) {
      const urlValue = (output as any).url;
      if (typeof urlValue === "string") {
        console.log(`[buildNodeInput]   -> Found direct url property`);
        return { url: urlValue };
      }
    }
    
    console.log(`[buildNodeInput]   -> No media found for handle ${handleId}`);
    return undefined;
  };
  
  // Helper to get ANY media from connected edges (regardless of handle name)
  // This is a fallback when specific handle matching fails
  const getAnyMediaFromEdges = (mediaType: "image" | "video" | "audio"): { url: string } | undefined => {
    for (const edge of incomingEdges) {
      const rawOutput = outputs.get(edge.source);
      const output = normalizeOutput(rawOutput);
      
      if (output?.type === mediaType) {
        const mediaObj = output[mediaType] as { url?: string } | undefined;
        if (mediaObj?.url) {
          console.log(`[buildNodeInput] getAnyMediaFromEdges(${mediaType}): found from ${edge.source}`);
          return { url: mediaObj.url };
        }
      }
    }
    return undefined;
  };

  // Map frontend field names to schema field names
  const normalizeAsset = (value: unknown): { url: string } | undefined => {
    if (!value) return undefined;
    if (typeof value === "string" && (value.startsWith("http") || value.startsWith("data:"))) {
      return { url: value };
    }
    if (typeof value === "object" && value !== null && "url" in value) {
      return value as { url: string };
    }
    return undefined;
  };

  // Helper to get video from edge by checking both handles and falling back to any video output
  const getVideoFromEdgeOrFallback = (handleIds: string[]): { url: string } | undefined => {
    // First try exact handle matches
    for (const handleId of handleIds) {
      const result = getMediaFromEdge(handleId);
      if (result) return result;
    }
    // Then try to find any connected video output for those handles
    for (const handleId of handleIds) {
      const edge = incomingEdges.find(e => e.targetHandle === handleId);
      if (edge) {
        const rawOutput = outputs.get(edge.source);
        const output = normalizeOutput(rawOutput);
        // Check if output has video
        if (output?.type === "video" && output.video?.url) {
          console.log(`[buildNodeInput] getVideoFromEdgeOrFallback found video from ${edge.source} for handle ${handleId}`);
          return { url: output.video.url };
        }
        // Check if output is directly a URL
        if (typeof rawOutput === "string" && (rawOutput.startsWith("http") || rawOutput.startsWith("data:"))) {
          return { url: rawOutput };
        }
      }
    }
    return undefined;
  };

  // Build the final input object
  const input = {
    ...data,
    prompt: prompt || data.prompt,
    context: context || data.context,
    // Single media inputs - check multiple handle names + fallback to any connected media
    image: getMediaFromEdge("image") || getMediaFromEdge("inputImage") || getAnyMediaFromEdges("image") || normalizeAsset(data.image) || normalizeAsset(data.inputImage) || normalizeAsset(data.result),
    video: getMediaFromEdge("video") || getMediaFromEdge("inputVideo") || getMediaFromEdge("merged") || getAnyMediaFromEdges("video") || normalizeAsset(data.video) || normalizeAsset(data.inputVideo) || normalizeAsset(data.result),
    audio: getMediaFromEdge("audio") || getMediaFromEdge("inputAudio") || getAnyMediaFromEdges("audio") || normalizeAsset(data.audio) || normalizeAsset(data.inputAudio),
    frame: getMediaFromEdge("frame") || normalizeAsset(data.frame),
    // Merge-videos specific - check multiple handles and data fields
    video1: getVideoFromEdgeOrFallback(["inputVideo1", "video1", "Video 1 *"]) || normalizeAsset(data.video1) || normalizeAsset(data.inputVideo1),
    video2: getVideoFromEdgeOrFallback(["inputVideo2", "video2", "Video 2 *"]) || normalizeAsset(data.video2) || normalizeAsset(data.inputVideo2),
    // Text input for TTS nodes
    text: prompt || (data.text as string) || undefined,
  };
  
  console.log(`[buildNodeInput] Final input keys: ${Object.keys(input).filter(k => input[k as keyof typeof input] !== undefined).join(", ")}`);
  console.log(`[buildNodeInput] - image: ${input.image ? "present" : "missing"}`);
  console.log(`[buildNodeInput] - video: ${input.video ? "present" : "missing"}`);
  console.log(`[buildNodeInput] - video1: ${input.video1 ? `present (${(input.video1 as any)?.url?.slice(0, 50)}...)` : "missing"}`);
  console.log(`[buildNodeInput] - video2: ${input.video2 ? `present (${(input.video2 as any)?.url?.slice(0, 50)}...)` : "missing"}`);
  console.log(`[buildNodeInput] - prompt: ${input.prompt ? "present" : "missing"}`);
  
  return input;
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

        // Filter to only connected nodes for cost estimation
        const connectedNodeIdsForCost = new Set<string>();
        for (const edge of edges) {
          connectedNodeIdsForCost.add(edge.source);
          connectedNodeIdsForCost.add(edge.target);
        }
        const nodesForExecution = edges.length === 0 
          ? nodes 
          : nodes.filter(n => connectedNodeIdsForCost.has(n.id));
        
        // Estimate total cost (only for connected nodes)
        let totalEstimatedCost = 0;
        for (const node of nodesForExecution) {
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
        
        // Filter to only include connected nodes (nodes that are part of the workflow graph)
        // A node is "connected" if it has edges (either incoming or outgoing)
        const connectedNodeIds = new Set<string>();
        for (const edge of edges) {
          connectedNodeIds.add(edge.source);
          connectedNodeIds.add(edge.target);
        }
        
        // If no edges exist (single node workflow), include all nodes
        // Otherwise, only include nodes that are part of the connected graph
        const workflowNodes = edges.length === 0 
          ? nodes 
          : nodes.filter(n => connectedNodeIds.has(n.id));
        
        console.log(`[WorkflowStream] Total nodes: ${nodes.length}, Connected nodes: ${workflowNodes.length}`);
        if (nodes.length > workflowNodes.length) {
          const disconnected = nodes.filter(n => !connectedNodeIds.has(n.id)).map(n => `${n.id} (${n.type})`);
          console.log(`[WorkflowStream] Skipping disconnected nodes: ${disconnected.join(", ")}`);
        }
        
        const sortedNodes = topoSort(workflowNodes, edges);
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

        // =======================================================================
        // CONCURRENT EXECUTION WITH DEPENDENCY AWARENESS
        // =======================================================================
        // - Nodes with no dependencies (roots) start immediately in parallel
        // - Child nodes wait for their parent(s) to complete
        // - Independent pipelines run concurrently
        // - Within a pipeline, nodes run sequentially (parent → child)
        
        const pending = new Set(sortedNodes.map(n => n.id));
        const inProgress = new Map<string, Promise<void>>();
        
        // Helper to execute a single node
        async function executeOneNode(node: Node): Promise<void> {
          const nodeType = node.type as string;
          
          // Mark as started
          await db.nodeExecution.update({
            where: { id: nodeExecutionIds.get(node.id)! },
            data: { status: "RUNNING", startedAt: new Date() },
          });
          sendEvent(controller, "node-started", { nodeId: node.id, nodeType: node.type });
          console.log(`[WorkflowStream] Executing node: ${node.id} (${node.type})`);

          // Build input from completed dependency outputs
          const input = buildNodeInput(node, edges, outputs, sortedNodes);

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
              // Execute via Trigger.dev - use trigger() + subscribeToRun() (no polling!)
              const payload = {
                nodeExecutionId: nodeExecutionIds.get(node.id)!,
                workflowExecutionId: workflowExecution.id,
                nodeId: node.id,
                nodeType: nodeType as AINodeType,
                input: input as Record<string, unknown>,
              };

              console.log(`[WorkflowStream] Triggering ${nodeType} via Trigger.dev...`);
              
              // Start the task
              const handle = await executeNode.trigger(payload);
              console.log(`[WorkflowStream] Task started with run ID: ${handle.id}`);
              
              // Subscribe to run updates (SSE-based, no polling!)
              let finalRun: Awaited<ReturnType<typeof runs.retrieve>> | null = null;
              for await (const run of runs.subscribeToRun(handle.id)) {
                console.log(`[WorkflowStream] Run ${handle.id} status: ${run.status}`);
                if (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELED") {
                  finalRun = run;
                  break;
                }
              }

              if (finalRun?.status === "COMPLETED" && finalRun.output) {
                const output = finalRun.output as { output?: unknown };
                result = { success: true, output: output.output };
              } else {
                result = { 
                  success: false, 
                  error: finalRun?.status === "FAILED" ? "Task execution failed" : "Task was canceled" 
                };
              }
            } else {
              result = { success: false, error: `Unknown node type: ${nodeType}` };
            }

            // Process result
            if (result.success && result.output) {
              // Persist media to Transloadit CDN if configured
              let persistedOutput = result.output;
              try {
                if (isTransloaditConfigured()) {
                  console.log(`[WorkflowStream] Persisting output to Transloadit...`);
                  persistedOutput = await persistNodeOutput(result.output);
                }
              } catch (persistError) {
                console.warn(`[WorkflowStream] Failed to persist to Transloadit:`, persistError);
                // Continue with original output
              }
              
              completed.add(node.id);
              outputs.set(node.id, persistedOutput);
              
              // Log what we're storing
              const outputType = typeof persistedOutput === "object" && persistedOutput !== null 
                ? (persistedOutput as any).type || "unknown"
                : typeof persistedOutput;
              console.log(`[WorkflowStream] Storing output for ${node.id}: type=${outputType}`);
              if (typeof persistedOutput === "object" && persistedOutput !== null) {
                const keys = Object.keys(persistedOutput as object);
                console.log(`[WorkflowStream]   Output keys: ${keys.join(", ")}`);
                // Log URL if present
                const outputObj = persistedOutput as Record<string, any>;
                if (outputObj.image?.url) {
                  console.log(`[WorkflowStream]   Image URL: ${outputObj.image.url.slice(0, 80)}...`);
                }
                if (outputObj.video?.url) {
                  console.log(`[WorkflowStream]   Video URL: ${outputObj.video.url.slice(0, 80)}...`);
                }
              }
              
              await db.nodeExecution.update({
                where: { id: nodeExecutionIds.get(node.id)! },
                data: { 
                  status: "COMPLETED", 
                  completedAt: new Date(),
                  providerUsed: LOCAL_NODE_TYPES.includes(nodeType) ? "internal" : "trigger.dev",
                  // Store persisted output in database
                  outputJson: persistedOutput as any,
                },
              });

              sendEvent(controller, "node-completed", {
                nodeId: node.id,
                nodeType: node.type,
                output: persistedOutput,
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
        
        // Main execution loop - process nodes as they become ready
        while (pending.size > 0) {
          // Find all ready nodes (dependencies completed, not failed, not in progress)
          const readyNodes: Node[] = [];
          
          for (const nodeId of pending) {
            const node = sortedNodes.find(n => n.id === nodeId)!;
            const deps = dependencies.get(nodeId) || new Set();
            
            // Skip if already in progress
            if (inProgress.has(nodeId)) continue;
            
            // Check if any dependency failed - if so, mark this node as failed too
            const anyDepFailed = [...deps].some(d => failed.has(d));
            if (anyDepFailed) {
              pending.delete(nodeId);
              failed.add(nodeId);
              await db.nodeExecution.update({
                where: { id: nodeExecutionIds.get(nodeId)! },
                data: { status: "FAILED", error: "Dependency failed", completedAt: new Date() },
              });
              sendEvent(controller, "node-failed", { 
                nodeId, 
                nodeType: node.type,
                error: "Dependency failed - a required upstream node failed" 
              });
              continue;
            }
            
            // Check if all dependencies are completed
            const allDepsComplete = [...deps].every(d => completed.has(d));
            if (allDepsComplete) {
              readyNodes.push(node);
            }
          }
          
          // If no ready nodes and nothing in progress, we're stuck (shouldn't happen)
          if (readyNodes.length === 0 && inProgress.size === 0) {
            console.error("[WorkflowStream] No ready nodes and nothing in progress - breaking");
            break;
          }
          
          // Start all ready nodes in parallel
          for (const node of readyNodes) {
            console.log(`[WorkflowStream] Starting node ${node.id} (${node.type}) - ${readyNodes.length} nodes ready`);
            const promise = executeOneNode(node).finally(() => {
              pending.delete(node.id);
              inProgress.delete(node.id);
            });
            inProgress.set(node.id, promise);
          }
          
          // Wait for at least one node to complete before checking for new ready nodes
          if (inProgress.size > 0) {
            await Promise.race(inProgress.values());
          }
        }
        
        // Wait for any remaining in-progress nodes
        if (inProgress.size > 0) {
          await Promise.all(inProgress.values());
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
