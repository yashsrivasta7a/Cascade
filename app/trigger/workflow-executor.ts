import { task } from "@trigger.dev/sdk";
import { db } from "@/lib/db";
import { executeNode, type NodeExecutorPayload } from "./node-executor";
import type { AINodeType } from "@/types/nodes";
import type { Node, Edge } from "reactflow";

// NOTE: Node executors are registered inside executeNode task
// No engine import here to avoid FFmpeg bundling for Vercel

// =============================================================================
// WORKFLOW EXECUTOR TASK - DAG Orchestration with Parent-Child Hierarchy
// =============================================================================
// 
// Uses batchTriggerAndWait() for wave-based execution:
// - Nodes are grouped into "waves" by dependency level
// - Each wave runs in parallel using batchTriggerAndWait (creates child tasks)
// - Parent-child relationship visible in Trigger.dev dashboard
// - All nodes from same workflow are grouped under parent task
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

  for (const node of nodes) {
    dependencies.set(node.id, new Set());
  }

  for (const edge of edges) {
    dependencies.get(edge.target)?.add(edge.source);
  }

  return { dependencies };
}

/**
 * Compute execution waves using topological sort by dependency level.
 * 
 * - Wave 0: Nodes with no dependencies (entry points)
 * - Wave 1: Nodes whose dependencies are all in Wave 0
 * - Wave N: Nodes whose dependencies are all in Waves 0..N-1
 * 
 * Nodes within the same wave can execute in parallel.
 */
function computeExecutionWaves(
  nodes: Node[],
  dependencies: Map<string, Set<string>>
): Node[][] {
  const waves: Node[][] = [];
  const nodeLevel = new Map<string, number>();
  const remaining = new Set(nodes.map(n => n.id));

  // Iteratively find nodes whose dependencies are all resolved
  while (remaining.size > 0) {
    const currentWave: Node[] = [];

    for (const nodeId of remaining) {
      const deps = dependencies.get(nodeId) ?? new Set();
      
      // Check if all dependencies are in previous waves
      let allDepsResolved = true;
      for (const depId of deps) {
        if (!nodeLevel.has(depId)) {
          allDepsResolved = false;
          break;
        }
      }

      if (allDepsResolved) {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          currentWave.push(node);
          nodeLevel.set(nodeId, waves.length);
        }
      }
    }

    // If no nodes can be added, we have a cycle (shouldn't happen in valid DAG)
    if (currentWave.length === 0 && remaining.size > 0) {
      console.error("[Workflow] Cycle detected in workflow graph!");
      break;
    }

    // Remove processed nodes from remaining
    for (const node of currentWave) {
      remaining.delete(node.id);
    }

    if (currentWave.length > 0) {
      waves.push(currentWave);
    }
  }

  return waves;
}

// Map handle IDs to schema field names
const HANDLE_TO_SCHEMA_FIELD: Record<string, string> = {
  // Merge Videos
  "inputVideo1": "video1",
  "inputVideo2": "video2",
  "Video 1": "video1",
  "Video 2": "video2",
  // Merge Audio + Video
  "inputVideo": "video",
  "inputAudio": "audio",
  "Video*": "video",
  "Audio*": "audio",
  // Extract Audio
  "videoInput": "video",
  "Video Input": "video",
  // Lipsync
  "audioInput": "audio",
  "videoInput": "video",
  // Generic
  "video": "video",
  "audio": "audio",
  "image": "image",
};

// Normalize URL string or object to AssetRef format { url: string, ... }
function normalizeAsset(value: unknown): { url: string; mimeType?: string } | undefined {
  if (!value) return undefined;
  if (typeof value === "string" && value.startsWith("http")) {
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

// Build input for a node
function buildNodeInput(
  node: Node,
  edges: Edge[],
  outputs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const nodeData = (node.data ?? {}) as Record<string, unknown>;
  const nodeType = node.type as string;
  const incomingEdges = edges.filter((e) => e.target === node.id);
  const input: Record<string, unknown> = { ...nodeData };

  // =========================================================================
  // STEP 1: Normalize node data (uploaded videos/audio/images) to schema format
  // =========================================================================
  // Convert inputVideo1 → video1, inputAudio → audio, etc.
  // Also convert string URLs to { url: string } objects
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

  // Special handling for direct video/audio fields that might be strings
  if (typeof nodeData.video === "string") {
    input.video = normalizeAsset(nodeData.video);
  }
  if (typeof nodeData.audio === "string") {
    input.audio = normalizeAsset(nodeData.audio);
  }
  if (typeof nodeData.image === "string") {
    input.image = normalizeAsset(nodeData.image);
  }

  // =========================================================================
  // STEP 2: Override with outputs from connected upstream nodes
  // =========================================================================
  for (const edge of incomingEdges) {
    const upstreamOutput = outputs.get(edge.source);
    if (upstreamOutput) {
      // Get the handle name and map to schema field
      const rawHandle = edge.targetHandle ?? "";
      const schemaField = HANDLE_TO_SCHEMA_FIELD[rawHandle] ?? rawHandle;
      
      if (upstreamOutput.type === "text" && "text" in upstreamOutput) {
        // Text always goes to context for now
        input.context = upstreamOutput.text;
        // Also set prompt if it's a prompt handle
        if (rawHandle === "prompt" || rawHandle === "Prompt") {
          input.prompt = upstreamOutput.text;
        }
      }
      if (upstreamOutput.type === "image" && "image" in upstreamOutput) {
        const imageAsset = upstreamOutput.image as { url?: string };
        
        // Set the mapped field
        input[schemaField] = upstreamOutput.image;
        
        // Also set common aliases
        if (schemaField === "image" || schemaField === "frame") {
          input.imageUrl = imageAsset?.url;
          input.inputImage = imageAsset?.url;
        }
      }
      if (upstreamOutput.type === "video" && "video" in upstreamOutput) {
        const videoAsset = upstreamOutput.video as { url?: string; mimeType?: string };
        
        // Set the mapped field with full asset object
        input[schemaField] = upstreamOutput.video;
        
        // Also set URL aliases for nodes that expect just URLs
        const urlField = schemaField + "Url";
        input[urlField] = videoAsset?.url;
        
        // Set common aliases
        if (schemaField === "video") {
          input.videoUrl = videoAsset?.url;
        }
        
        console.log(`[BuildInput] Set ${schemaField} from handle ${rawHandle}:`, { url: videoAsset?.url?.slice(0, 50) });
      }
      if (upstreamOutput.type === "audio" && "audio" in upstreamOutput) {
        const audioAsset = upstreamOutput.audio as { url?: string; mimeType?: string };
        
        // Set the mapped field
        input[schemaField] = upstreamOutput.audio;
        
        // Set URL alias
        input.audioUrl = audioAsset?.url;
        
        console.log(`[BuildInput] Set ${schemaField} from handle ${rawHandle}:`, { url: audioAsset?.url?.slice(0, 50) });
      }
    }
  }

  console.log(`[BuildInput] Node ${node.id} (${node.type}) input keys:`, Object.keys(input).filter(k => input[k] !== undefined));
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

    // Build dependency graph and compute execution waves
    const { dependencies } = buildDependencyGraph(nodes, edges);
    const waves = computeExecutionWaves(nodes, dependencies);

    console.log(`[Workflow] Computed ${waves.length} execution waves for ${nodes.length} nodes`);

    // Track state
    const outputs = new Map<string, Record<string, unknown>>();
    const nodeExecutionIds = new Map<string, string>();

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

    // Execute waves sequentially, nodes within each wave run in parallel
    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
      const wave = waves[waveIndex];
      console.log(`[Workflow] Executing wave ${waveIndex + 1}/${waves.length} with ${wave.length} nodes`);

      // Build payloads for all nodes in this wave
      const batchPayloads: { payload: NodeExecutorPayload }[] = [];

      for (const node of wave) {
        const nodeType = node.type as AINodeType;
        const nodeExecutionId = nodeExecutionIds.get(node.id)!;
        const input = buildNodeInput(node, edges, outputs);

        // Store input in DB
        await db.nodeExecution.update({
          where: { id: nodeExecutionId },
          data: { inputJson: input as object },
        });

        batchPayloads.push({
          payload: {
            nodeExecutionId,
            workflowExecutionId,
            nodeId: node.id,
            nodeType,
            input,
          },
        });
      }

      // Execute all nodes in this wave in parallel as child tasks
      // batchTriggerAndWait creates parent-child relationship in Trigger.dev dashboard
      const batchResult = await executeNode.batchTriggerAndWait(batchPayloads);
      const results = batchResult.runs;

      // Process results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const node = wave[i];
        const nodeType = node.type as AINodeType;

        if (result.ok) {
          console.log(`[Workflow] Node ${node.id} (${nodeType}) completed successfully`);

          // Extract output from result
          const taskOutput = result.output as { output?: Record<string, unknown> } | undefined;
          if (taskOutput?.output) {
            outputs.set(node.id, taskOutput.output);
          }
        } else {
          // Node failed - fail the entire workflow
          console.error(`[Workflow] Node ${node.id} (${nodeType}) failed:`, result.error);

          await db.workflowExecution.update({
            where: { id: workflowExecutionId },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              error: `Node ${node.id} (${nodeType}) failed: ${result.error}`,
            },
          });

          return {
            success: false,
            workflowExecutionId,
            failedNodeId: node.id,
            error: result.error,
            partialOutputs: Object.fromEntries(outputs),
          };
        }
      }

      console.log(`[Workflow] Wave ${waveIndex + 1} completed`);
    }

    // All waves completed successfully
    await db.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    console.log(`[Workflow] Completed successfully with ${nodes.length} nodes in ${waves.length} waves`);

    return {
      success: true,
      workflowExecutionId,
      nodeOutputs: Object.fromEntries(outputs),
    };
  },
});
