import { task, wait, runs } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db";
import { executeNode, type NodeExecutorPayload } from "./node-executor";
import type { AINodeType } from "@/types/nodes";
import type { Node, Edge } from "reactflow";

// NOTE: Node executors are registered inside executeNode task
// No engine import here to avoid FFmpeg bundling for Vercel

// =============================================================================
// WORKFLOW EXECUTOR TASK - True DAG Execution with Chain Parallelism
// =============================================================================
// 
// Each chain runs independently in parallel. Nodes only wait for their
// SPECIFIC dependencies, not for entire "waves" or "levels".
// 
// Example: node1 → node2 → final_node
//                              ↑
//          node3 ──────────────┘
// 
// If node1=2s, node2=5s, node3=10s:
// - t=0: node1 starts, node3 starts (parallel - no deps)
// - t=2s: node1 done → node2 starts immediately
// - t=7s: node2 done
// - t=10s: node3 done → final_node starts (both deps satisfied)
//
// =============================================================================

export interface WorkflowExecutorPayload {
  workflowExecutionId: string;
  workflowId: string;
  userId: string;
  nodes: Node[];
  edges: Edge[];
}

// Build dependency graph
function buildDependencyGraph(nodes: Node[], edges: Edge[]) {
  const dependencies = new Map<string, Set<string>>();
  const nodeIds = new Set(nodes.map(n => n.id));

  // Initialize all nodes with empty dependency sets
  for (const node of nodes) {
    dependencies.set(node.id, new Set());
  }

  // Build dependency relationships from edges
  console.log(`[DependencyGraph] Building from ${edges.length} edges:`);
  for (const edge of edges) {
    console.log(`[DependencyGraph]   Edge: ${edge.source} → ${edge.target} (sourceHandle: ${edge.sourceHandle || "none"}, targetHandle: ${edge.targetHandle || "none"})`);
    
    // Validate that both source and target exist in nodes
    if (!nodeIds.has(edge.source)) {
      console.warn(`[DependencyGraph] WARNING: Edge source "${edge.source}" not found in nodes!`);
      continue;
    }
    if (!nodeIds.has(edge.target)) {
      console.warn(`[DependencyGraph] WARNING: Edge target "${edge.target}" not found in nodes!`);
      continue;
    }
    
    // Add dependency: target depends on source
    const targetDeps = dependencies.get(edge.target);
    if (targetDeps) {
      targetDeps.add(edge.source);
      console.log(`[DependencyGraph]   Added dependency: ${edge.target} depends on ${edge.source}`);
    }
  }

  return { dependencies };
}

// Map handle IDs to schema field names
const HANDLE_TO_SCHEMA_FIELD: Record<string, string> = {
  // Merge Videos - explicit mappings for video1/video2 handles
  "video1": "video1",
  "video2": "video2",
  "inputVideo1": "video1",
  "inputVideo2": "video2",
  "Video 1": "video1",
  "Video 2": "video2",
  // Common media inputs
  "inputImage": "image",
  "inputVideo": "video",
  "inputAudio": "audio",
  "inputFrame": "frame",
  // Merge Audio + Video
  "Video*": "video",
  "Audio*": "audio",
  // Extract Audio
  "videoInput": "video",
  "Video Input": "video",
  // Lipsync
  "audioInput": "audio",
  // Generic
  "video": "video",
  "audio": "audio",
  "image": "image",
  "frame": "frame",
  // Prompt/text inputs
  "prompt": "prompt",
  "text": "text",
  "context": "context",
};

// Normalize URL string or object to AssetRef format { url: string, ... }
function normalizeAsset(value: unknown): { url: string; mimeType?: string } | undefined {
  if (!value) return undefined;
  if (
    typeof value === "string" &&
    (value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:") ||
      value.startsWith("blob:"))
  ) {
    return { url: value };
  }
  if (typeof value === "object" && value !== null && "url" in value) {
    return value as { url: string; mimeType?: string };
  }
  return undefined;
}

// Map node data fields (like inputVideo1) to schema fields (like video1)
const NODE_DATA_TO_SCHEMA: Record<string, string> = {
  "inputVideo1": "video1",
  "inputVideo2": "video2",
  "inputVideo": "video",
  "inputAudio": "audio",
  "inputImage": "image",
};

// Infer output type from node type
function inferOutputType(nodeType: string): "video" | "audio" | "image" | "text" {
  const videoNodes = ["seedance", "lipsync", "merge-videos", "merge-audio-video"];
  const audioNodes = ["elevenlabs", "extract-audio"];
  const imageNodes = ["seedream", "seedvr", "crop-image"];
  
  if (videoNodes.includes(nodeType)) return "video";
  if (audioNodes.includes(nodeType)) return "audio";
  if (imageNodes.includes(nodeType)) return "image";
  return "text";
}

// Build input for a node
function buildNodeInput(
  node: Node,
  edges: Edge[],
  outputs: Map<string, Record<string, unknown>>,
  allNodes: Node[]
): Record<string, unknown> {
  const nodeData = (node.data ?? {}) as Record<string, unknown>;
  const nodeType = node.type as string;
  const incomingEdges = edges.filter((e) => e.target === node.id);
  const input: Record<string, unknown> = { ...nodeData };

  console.log(`[BuildInput] === Building input for ${node.id} (${nodeType}) ===`);
  console.log(`[BuildInput] Incoming edges: ${incomingEdges.length}`);
  console.log(`[BuildInput] Outputs map keys: ${[...outputs.keys()].join(", ")}`);

  // =========================================================================
  // STEP 1: Normalize node data (uploaded videos/audio/images) to schema format
  // =========================================================================
  for (const [dataField, schemaField] of Object.entries(NODE_DATA_TO_SCHEMA)) {
    const value = nodeData[dataField];
    if (value) {
      const normalized = normalizeAsset(value);
      if (normalized) {
        input[schemaField] = normalized;
        console.log(`[BuildInput] Normalized ${dataField} → ${schemaField}:`, { url: normalized.url?.slice(0, 60) });
      }
    }
  }

  // Special handling for direct video/audio/image fields that might be strings OR objects
  // This handles both manual uploads (URLs as strings) and propagated outputs (AssetRef objects)
  const normalizeMediaField = (fieldName: string, data: unknown) => {
    if (!data) return;
    const normalized = normalizeAsset(data);
    if (normalized?.url) {
      input[fieldName] = normalized;
      console.log(`[BuildInput] Normalized ${fieldName} field:`, { url: normalized.url?.slice(0, 60) });
    }
  };
  
  // Normalize direct media fields (these may be strings or AssetRef objects)
  normalizeMediaField("video", nodeData.video);
  normalizeMediaField("video1", nodeData.video1);
  normalizeMediaField("video2", nodeData.video2);
  normalizeMediaField("audio", nodeData.audio);
  normalizeMediaField("image", nodeData.image);
  normalizeMediaField("frame", nodeData.frame);

  // =========================================================================
  // STEP 2: Override with outputs from connected upstream nodes
  // =========================================================================
  for (const edge of incomingEdges) {
    const upstreamOutput = outputs.get(edge.source);
    const sourceNode = allNodes.find(n => n.id === edge.source);
    const sourceNodeType = sourceNode?.type || "unknown";
    
    console.log(`[BuildInput] Edge: ${edge.source} (${sourceNodeType}) → ${edge.target}, targetHandle: "${edge.targetHandle || "(empty)"}"`);
    
    if (!upstreamOutput) {
      console.warn(`[BuildInput] No output found for upstream node ${edge.source}`);
      continue;
    }
    
    console.log(`[BuildInput] Upstream output type: ${upstreamOutput.type}`);
    
    // Get the handle name and map to schema field
    // If targetHandle is empty, infer from source node type
    let rawHandle = edge.targetHandle ?? "";
    let schemaField = HANDLE_TO_SCHEMA_FIELD[rawHandle] ?? rawHandle;
    
    // If no target handle specified, infer based on source output type and node type
    if (!rawHandle || !schemaField) {
      const inferredType = inferOutputType(sourceNodeType);
      if (nodeType === "merge-videos") {
        // For merge-videos, assign to video1 or video2 based on what's already set
        if (!input.video1) {
          schemaField = "video1";
        } else if (!input.video2) {
          schemaField = "video2";
        } else {
          schemaField = "video1"; // Override
        }
      } else if (nodeType === "merge-audio-video" || nodeType === "lipsync") {
        // Infer from source output type
        schemaField = inferredType === "audio" ? "audio" : "video";
      } else {
        schemaField = inferredType;
      }
      console.log(`[BuildInput] Inferred schemaField: ${schemaField} (from source type: ${sourceNodeType})`);
    }
    
    // Handle different output types
    let outputSet = false;
    
    if (upstreamOutput.type === "text" && "text" in upstreamOutput) {
      input.context = upstreamOutput.text;
      if (rawHandle === "prompt" || rawHandle === "Prompt" || schemaField === "prompt") {
        input.prompt = upstreamOutput.text;
      }
      console.log(`[BuildInput] Set text context from ${edge.source}`);
      outputSet = true;
    }
    
    if (upstreamOutput.type === "image" && "image" in upstreamOutput) {
      const imageAsset = upstreamOutput.image as { url?: string };
      // Only override if upstream has a valid URL - don't overwrite manual uploads with undefined
      if (imageAsset?.url) {
        input[schemaField] = upstreamOutput.image;
        if (schemaField === "image" || schemaField === "frame") {
          input.imageUrl = imageAsset.url;
          input.inputImage = imageAsset.url;
        }
        console.log(`[BuildInput] Set ${schemaField} (image) from ${edge.source}:`, { url: imageAsset.url?.slice(0, 50) });
        outputSet = true;
      } else {
        console.warn(`[BuildInput] Skipped ${schemaField} from ${edge.source} - no valid URL in image asset`);
      }
    }
    
    if (upstreamOutput.type === "video" && "video" in upstreamOutput) {
      const videoAsset = upstreamOutput.video as { url?: string; mimeType?: string };
      // Only override if upstream has a valid URL - don't overwrite manual uploads with undefined
      if (videoAsset?.url) {
        input[schemaField] = upstreamOutput.video;
        
        // Also set URL aliases
        const urlField = schemaField + "Url";
        input[urlField] = videoAsset.url;
        if (schemaField === "video") {
          input.videoUrl = videoAsset.url;
        }
        
        console.log(`[BuildInput] Set ${schemaField} (video) from ${edge.source}:`, { url: videoAsset.url?.slice(0, 50) });
        outputSet = true;
      } else {
        console.warn(`[BuildInput] Skipped ${schemaField} from ${edge.source} - no valid URL in video asset`);
      }
    }
    
    if (upstreamOutput.type === "audio" && "audio" in upstreamOutput) {
      const audioAsset = upstreamOutput.audio as { url?: string; mimeType?: string };
      // Only override if upstream has a valid URL - don't overwrite manual uploads with undefined
      if (audioAsset?.url) {
        input[schemaField] = upstreamOutput.audio;
        input.audioUrl = audioAsset.url;
        
        console.log(`[BuildInput] Set ${schemaField} (audio) from ${edge.source}:`, { url: audioAsset.url?.slice(0, 50) });
        outputSet = true;
      } else {
        console.warn(`[BuildInput] Skipped ${schemaField} from ${edge.source} - no valid URL in audio asset`);
      }
    }
    
    // Fallback: If output type wasn't matched, try to infer from source node type and set directly
    if (!outputSet) {
      const inferredType = inferOutputType(sourceNodeType);
      console.log(`[BuildInput] Output type "${upstreamOutput.type}" not matched, inferring from source node type: ${inferredType}`);
      
      // Try to extract the asset from the output based on inferred type
      const assetKey = inferredType === "text" ? "text" : inferredType;
      const asset = upstreamOutput[assetKey] as { url?: string } | string | undefined;
      
      if (asset) {
        if (typeof asset === "string") {
          // Text output
          if (schemaField === "prompt" || schemaField === "text") {
            input[schemaField] = asset;
          } else {
            input.context = asset;
          }
        } else if (asset.url) {
          // Media output
          input[schemaField] = asset;
          console.log(`[BuildInput] Set ${schemaField} (inferred ${inferredType}) from ${edge.source}:`, { url: asset.url?.slice(0, 50) });
        }
      } else {
        console.warn(`[BuildInput] Could not extract asset from upstream output for ${edge.source}`);
      }
    }
  }

  // =========================================================================
  // STEP 3: Final validation - log what we have
  // =========================================================================
  const definedKeys = Object.keys(input).filter(k => input[k] !== undefined && input[k] !== null && input[k] !== "");
  console.log(`[BuildInput] Node ${node.id} (${nodeType}) final input keys:`, definedKeys);
  
  // Log warnings for potentially missing required fields based on node type
  if (nodeType === "merge-videos") {
    if (!input.video1) console.warn(`[BuildInput] WARNING: merge-videos missing video1`);
    if (!input.video2) console.warn(`[BuildInput] WARNING: merge-videos missing video2`);
  }
  if (nodeType === "extract-audio") {
    if (!input.video) console.warn(`[BuildInput] WARNING: extract-audio missing video`);
  }
  if (nodeType === "merge-audio-video" || nodeType === "lipsync") {
    if (!input.video) console.warn(`[BuildInput] WARNING: ${nodeType} missing video`);
    if (!input.audio) console.warn(`[BuildInput] WARNING: ${nodeType} missing audio`);
  }
  
  return input;
}

export const executeWorkflow = task({
  id: "execute-workflow",
  retry: {
    maxAttempts: 1,
  },

  run: async (payload: WorkflowExecutorPayload) => {
    const { workflowExecutionId, nodes, edges } = payload;

    // Update workflow status
    await db.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    // Build dependency graph for DAG execution
    const { dependencies } = buildDependencyGraph(nodes, edges);
    
    // Log dependencies for debugging
    console.log(`[DAG] Dependency graph for ${nodes.length} nodes:`);
    for (const [nodeId, deps] of dependencies.entries()) {
      const node = nodes.find(n => n.id === nodeId);
      const depsList = [...deps].map(d => {
        const depNode = nodes.find(n => n.id === d);
        return `${d} (${depNode?.type || "unknown"})`;
      });
      console.log(`[DAG]   ${nodeId} (${node?.type || "unknown"}) depends on: [${depsList.join(", ")}]`);
    }

    // Track state for DAG execution
    const outputs = new Map<string, Record<string, unknown>>();
    const nodeExecutionIds = new Map<string, string>();
    const pendingNodes = new Set(nodes.map(n => n.id));
    const runningNodes = new Map<string, { runId: string; node: Node }>();
    const completedNodes = new Set<string>();
    const failedNodes = new Set<string>(); // Nodes that failed or have failed dependencies

    // Create all node execution records upfront
    for (const node of nodes) {
      const nodeType = node.type as AINodeType;
      const nodeLabel = (node.data as Record<string, unknown>)?.label as string | undefined;

      const nodeExecution = await db.nodeExecution.create({
        data: {
          workflowExecutionId,
          nodeId: node.id,
          nodeType,
          nodeLabel: nodeLabel ?? node.type,
          status: "QUEUED",
        },
      });
      nodeExecutionIds.set(node.id, nodeExecution.id);
    }

    // Helper: Check if a node can start (all its dependencies are completed, none failed)
    const canStart = (nodeId: string): boolean => {
      const deps = dependencies.get(nodeId) ?? new Set();
      for (const depId of deps) {
        if (failedNodes.has(depId)) {
          return false; // Dependency failed - this node can't start
        }
        if (!completedNodes.has(depId)) {
          return false; // Dependency not yet complete
        }
      }
      return true;
    };

    // Helper: Check if a node has any failed dependencies
    const hasDependencyFailed = (nodeId: string): boolean => {
      const deps = dependencies.get(nodeId) ?? new Set();
      for (const depId of deps) {
        if (failedNodes.has(depId)) {
          return true;
        }
      }
      return false;
    };

    // Helper: Mark a node and all its downstream dependents as failed
    const markNodeAndDependentsFailed = (failedNodeId: string) => {
      const toMark = [failedNodeId];
      const marked = new Set<string>();
      
      while (toMark.length > 0) {
        const nodeId = toMark.shift()!;
        if (marked.has(nodeId)) continue;
        marked.add(nodeId);
        
        failedNodes.add(nodeId);
        pendingNodes.delete(nodeId);
        
        // Find all nodes that depend on this node
        for (const [otherId, deps] of dependencies.entries()) {
          if (deps.has(nodeId) && !marked.has(otherId)) {
            toMark.push(otherId);
          }
        }
      }
      
      console.log(`[DAG] Marked ${marked.size} nodes as failed (including dependents): ${[...marked].join(", ")}`);
    };

    // Helper: Start a node (non-blocking)
    const startNode = async (node: Node) => {
      const nodeType = node.type as AINodeType;
      const nodeExecutionId = nodeExecutionIds.get(node.id)!;

      console.log(`[DAG] Starting ${node.id} (${nodeType})...`);
      const input = buildNodeInput(node, edges, outputs, nodes);

      // Update DB: mark as RUNNING and store input
      await db.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: { 
          status: "RUNNING",
          startedAt: new Date(),
          inputJson: input as object,
        },
      });

      // Trigger the node (non-blocking) - returns immediately
      const handle = await executeNode.trigger({
        nodeExecutionId,
        workflowExecutionId,
        nodeId: node.id,
        nodeType,
        input,
      });

      runningNodes.set(node.id, { runId: handle.id, node });
      pendingNodes.delete(node.id);
      console.log(`[DAG] Node ${node.id} triggered with runId: ${handle.id}`);
    };

    // Start all nodes that have no dependencies
    console.log(`[DAG] ===== Starting DAG execution for ${nodes.length} nodes =====`);
    for (const node of nodes) {
      if (canStart(node.id) && pendingNodes.has(node.id)) {
        await startNode(node);
      }
    }

    // Poll until all processable nodes are done
    const POLL_INTERVAL_SECONDS = 2;
    const MAX_ITERATIONS = 900; // 30 minutes max (900 * 2s)
    let iteration = 0;

    // Terminal states that indicate the run is done (success or failure)
    // IMPORTANT: RESCHEDULED means Trigger.dev created a NEW run for retry,
    // but we're tracking the OLD run ID which will never complete.
    // Treat as failure since we can't easily track the new run.
    const TERMINAL_FAILURE_STATES = new Set([
      "FAILED",
      "CRASHED", 
      "SYSTEM_FAILURE",
      "CANCELED",
      "TIMED_OUT",
      "EXPIRED",
      "RESCHEDULED",  // Task was rescheduled for retry - OLD run won't complete
      "INTERRUPTED",  // Task was interrupted
      "FROZEN",       // Task is frozen - treat as failure
    ]);

    // States that mean "still processing" - keep polling
    const ACTIVE_STATES = new Set([
      "PENDING",
      "QUEUED", 
      "EXECUTING",
      "WAITING",
      "WAITING_ON_SCHEDULE",
      "DELAYED",
    ]);

    while ((runningNodes.size > 0 || pendingNodes.size > 0) && iteration < MAX_ITERATIONS) {
      iteration++;
      
      // First, check pending nodes that have failed dependencies and mark them
      for (const pendingNodeId of Array.from(pendingNodes)) {
        if (hasDependencyFailed(pendingNodeId)) {
          console.log(`[DAG] Node ${pendingNodeId} has failed dependency, marking as failed`);
          markNodeAndDependentsFailed(pendingNodeId);
          
          // Update DB status
          const nodeExecutionId = nodeExecutionIds.get(pendingNodeId);
          if (nodeExecutionId) {
            await db.nodeExecution.update({
              where: { id: nodeExecutionId },
              data: { status: "FAILED", error: "Dependency failed" },
            });
          }
        }
      }
      
      // Check each running node for completion
      const nodesToCheck = Array.from(runningNodes.entries());
      
      for (const [nodeId, { runId, node }] of nodesToCheck) {
        try {
          const run = await runs.retrieve(runId);
          const nodeType = node.type as AINodeType;
          const status = run.status;

          console.log(`[DAG] Checking ${nodeId}: status=${status}`);

          // Check for completion
          if (status === "COMPLETED") {
            console.log(`[DAG] Node ${nodeId} (${nodeType}) COMPLETED`);
            
            // Extract and store output
            const taskOutput = run.output as { output?: Record<string, unknown> } | undefined;
            if (taskOutput?.output) {
              outputs.set(nodeId, taskOutput.output);
              console.log(`[DAG] Stored output for ${nodeId}:`, {
                type: taskOutput.output.type,
                hasVideo: "video" in taskOutput.output,
                hasAudio: "audio" in taskOutput.output,
                hasImage: "image" in taskOutput.output,
              });
            } else {
              console.warn(`[DAG] Node ${nodeId} completed but no output found`);
              outputs.set(nodeId, {});
            }

            completedNodes.add(nodeId);
            runningNodes.delete(nodeId);
            
            // Update nodeExecution as a FALLBACK
            // The node executor should have already saved the output, but DB connection
            // issues on Trigger.dev workers can cause silent failures.
            // We update here to ensure the output is saved.
            const nodeExecutionId = nodeExecutionIds.get(nodeId);
            if (nodeExecutionId && taskOutput?.output) {
              try {
                await db.nodeExecution.update({
                  where: { id: nodeExecutionId },
                  data: { 
                    status: "COMPLETED",
                    completedAt: new Date(),
                    outputJson: taskOutput.output as object,
                  },
                });
                console.log(`[DAG] Updated nodeExecution ${nodeExecutionId} with output (fallback save)`);
              } catch (err) {
                console.error(`[DAG] Failed to update nodeExecution ${nodeExecutionId}:`, err);
              }
            }

            // Check if any pending nodes can now start
            for (const pendingNodeId of Array.from(pendingNodes)) {
              if (canStart(pendingNodeId)) {
                const pendingNode = nodes.find(n => n.id === pendingNodeId);
                if (pendingNode) {
                  console.log(`[DAG] Dependencies satisfied for ${pendingNodeId}, starting...`);
                  await startNode(pendingNode);
                }
              }
            }
          } else if (TERMINAL_FAILURE_STATES.has(status)) {
            // Handle all terminal failure states (including RESCHEDULED, INTERRUPTED, FROZEN)
            console.error(`[DAG] Node ${nodeId} (${nodeType}) FAILED with terminal status: ${status}`);
            
            runningNodes.delete(nodeId);
            
            // Mark this node and all its dependents as failed (but DON'T cancel other chains)
            markNodeAndDependentsFailed(nodeId);
            
            // Only update the DB for non-FAILED statuses, because:
            // - For FAILED status: node executor already called markNodeFailed()
            // - For RESCHEDULED, INTERRUPTED, etc: node executor doesn't know about these
            const nodeExecutionId = nodeExecutionIds.get(nodeId);
            if (nodeExecutionId && status !== "FAILED") {
              await db.nodeExecution.update({
                where: { id: nodeExecutionId },
                data: { status: "FAILED", error: `Failed with status: ${status}` },
              });
              console.log(`[DAG] Updated nodeExecution ${nodeExecutionId} to FAILED (status was: ${status})`);
            }
          } else if (!ACTIVE_STATES.has(status)) {
            // Unknown status - log warning but treat as still running for safety
            // This prevents infinite loops if Trigger.dev adds new statuses
            console.warn(`[DAG] Node ${nodeId} has unknown status: ${status} - treating as active`);
          }
          // If PENDING, QUEUED, EXECUTING, WAITING, etc. - continue polling
        } catch (err) {
          console.error(`[DAG] Error checking run status for ${nodeId}:`, err);
          // If we can't retrieve the run (e.g., network error), keep trying
          // But if it's a "not found" error, treat as failure
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (errorMsg.includes("not found") || errorMsg.includes("404")) {
            console.error(`[DAG] Run ${runId} not found, marking node ${nodeId} as failed`);
            runningNodes.delete(nodeId);
            markNodeAndDependentsFailed(nodeId);
            
            const nodeExecutionId = nodeExecutionIds.get(nodeId);
            if (nodeExecutionId) {
              await db.nodeExecution.update({
                where: { id: nodeExecutionId },
                data: { status: "FAILED", error: "Run not found" },
              });
            }
          }
        }
      }

      // Wait before next poll if there are still nodes to process
      if (runningNodes.size > 0 || pendingNodes.size > 0) {
        const runningNodesList = [...runningNodes.keys()].join(", ");
        const pendingNodesList = [...pendingNodes].join(", ");
        console.log(`[DAG] Poll #${iteration}: Running=[${runningNodesList}], Pending=[${pendingNodesList}], Completed=${completedNodes.size}, Failed=${failedNodes.size}`);
        await wait.for({ seconds: POLL_INTERVAL_SECONDS });
      }
    }

    // Final debug log before exiting the loop
    console.log(`[DAG] Exiting poll loop after ${iteration} iterations`);
    console.log(`[DAG] Final state: Running=${runningNodes.size}, Pending=${pendingNodes.size}, Completed=${completedNodes.size}, Failed=${failedNodes.size}`);

    // Check if we timed out
    if (iteration >= MAX_ITERATIONS) {
      console.error(`[DAG] Workflow timed out after ${MAX_ITERATIONS * POLL_INTERVAL_SECONDS}s`);
      await db.workflowExecution.update({
        where: { id: workflowExecutionId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: "Workflow execution timed out",
        },
      });
      return {
        success: false,
        workflowExecutionId,
        error: "Workflow execution timed out",
        partialOutputs: Object.fromEntries(outputs),
      };
    }

    // Determine final workflow status
    const hasFailures = failedNodes.size > 0;
    const hasSuccesses = completedNodes.size > 0;
    
    let finalStatus: "COMPLETED" | "FAILED" | "PARTIAL";
    let errorMessage: string | undefined;
    
    if (hasFailures && hasSuccesses) {
      // Some succeeded, some failed - partial success
      finalStatus = "COMPLETED"; // Mark as completed but with errors noted
      errorMessage = `Partial completion: ${completedNodes.size} succeeded, ${failedNodes.size} failed`;
      console.log(`[DAG] ===== Workflow PARTIALLY completed: ${completedNodes.size} succeeded, ${failedNodes.size} failed =====`);
    } else if (hasFailures && !hasSuccesses) {
      // All failed
      finalStatus = "FAILED";
      errorMessage = `All ${failedNodes.size} nodes failed`;
      console.log(`[DAG] ===== Workflow FAILED: all ${failedNodes.size} nodes failed =====`);
    } else {
      // All succeeded
      finalStatus = "COMPLETED";
      console.log(`[DAG] ===== Workflow COMPLETED successfully with ${completedNodes.size} nodes =====`);
    }

    await db.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        error: errorMessage,
      },
    });

    return {
      success: !hasFailures || hasSuccesses, // Success if any node completed
      workflowExecutionId,
      completedNodes: [...completedNodes],
      failedNodes: [...failedNodes],
      nodeOutputs: Object.fromEntries(outputs),
    };
  },
});
