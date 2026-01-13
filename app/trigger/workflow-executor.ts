import { task } from "@trigger.dev/sdk";
import { db } from "@/lib/db";
import { executeNode, type NodeExecutorPayload } from "./node-executor";
import type { AINodeType } from "@/types/nodes";
import type { Node, Edge } from "reactflow";
import { registerAllNodeExecutors } from "@/lib/engine";

// Register all node executors
registerAllNodeExecutors();

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

// Build input for a node
function buildNodeInput(
  node: Node,
  edges: Edge[],
  outputs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const nodeData = (node.data ?? {}) as Record<string, unknown>;
  const incomingEdges = edges.filter((e) => e.target === node.id);
  const input: Record<string, unknown> = { ...nodeData };

  for (const edge of incomingEdges) {
    const upstreamOutput = outputs.get(edge.source);
    if (upstreamOutput) {
      if (upstreamOutput.type === "text" && "text" in upstreamOutput) {
        input.context = upstreamOutput.text;
      }
      if (upstreamOutput.type === "image" && "image" in upstreamOutput) {
        const handle = edge.targetHandle;
        const imageAsset = upstreamOutput.image as { url?: string };
        
        if (handle === "image" || handle === "frame") {
          input[handle] = upstreamOutput.image;
        } else if (handle === "inputImage") {
          input.inputImage = imageAsset?.url;
          input.image = upstreamOutput.image;
          input.imageUrl = imageAsset?.url;
        } else {
          input.image = upstreamOutput.image;
          input.imageUrl = imageAsset?.url;
        }
      }
      if (upstreamOutput.type === "video" && "video" in upstreamOutput) {
        const handle = edge.targetHandle ?? "video";
        input[handle] = upstreamOutput.video;
      }
      if (upstreamOutput.type === "audio" && "audio" in upstreamOutput) {
        input.audio = upstreamOutput.audio;
      }
    }
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
      const results = await executeNode.batchTriggerAndWait(batchPayloads);

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
