import { task } from "@trigger.dev/sdk";
import { db } from "@/lib/db";
import { executeNode, type NodeExecutorPayload } from "./node-executor";
import type { AINodeType } from "@/types/nodes";
import type { Node, Edge } from "reactflow";
import { registerAllNodeExecutors, getNodeExecutor, DEFAULT_NODE_CONFIG } from "@/lib/engine";

// Register all node executors
registerAllNodeExecutors();

// =============================================================================
// WORKFLOW EXECUTOR TASK - DAG Orchestration with Parallel Execution
// =============================================================================

export interface WorkflowExecutorPayload {
  workflowExecutionId: string;
  workflowId: string;
  userId: string;
  nodes: Node[];
  edges: Edge[];
}

// Get nodes grouped by execution level (for parallel execution)
// Level 0: no dependencies, Level 1: depends only on level 0, etc.
function getExecutionLevels(nodes: Node[], edges: Edge[]): Node[][] {
  const inDeg = new Map<string, number>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();

  for (const n of nodes) inDeg.set(n.id, 0);
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }

  const levels: Node[][] = [];
  const remaining = new Set(nodes.map((n) => n.id));

  while (remaining.size > 0) {
    // Find all nodes with in-degree 0 (ready to execute)
    const currentLevel: Node[] = [];
    for (const id of remaining) {
      if ((inDeg.get(id) ?? 0) === 0) {
        const node = byId.get(id);
        if (node) currentLevel.push(node);
      }
    }

    if (currentLevel.length === 0) {
      // Cycle detected or error - just add remaining
      for (const id of remaining) {
        const node = byId.get(id);
        if (node) currentLevel.push(node);
      }
      remaining.clear();
    } else {
      // Remove current level nodes and update in-degrees
      for (const node of currentLevel) {
        remaining.delete(node.id);
        for (const nextId of adj.get(node.id) ?? []) {
          inDeg.set(nextId, (inDeg.get(nextId) ?? 0) - 1);
        }
      }
    }

    if (currentLevel.length > 0) {
      levels.push(currentLevel);
    }
  }

  return levels;
}

// Build input for a node by collecting outputs from upstream nodes
function buildNodeInput(
  node: Node,
  edges: Edge[],
  outputs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const nodeData = (node.data ?? {}) as Record<string, unknown>;

  // Get incoming edges
  const incomingEdges = edges.filter((e) => e.target === node.id);

  // Start with node's own configuration
  const input: Record<string, unknown> = { ...nodeData };

  // Collect outputs from upstream nodes
  for (const edge of incomingEdges) {
    const upstreamOutput = outputs.get(edge.source);
    if (upstreamOutput) {
      // Map upstream output to input based on edge handles
      // For text outputs, set as context
      if (upstreamOutput.type === "text" && "text" in upstreamOutput) {
        input.context = upstreamOutput.text;
      }
      // For image outputs, set as image input
      if (upstreamOutput.type === "image" && "image" in upstreamOutput) {
        const handle = edge.targetHandle;
        if (handle === "image" || handle === "frame") {
          input[handle] = upstreamOutput.image;
        } else {
          input.image = upstreamOutput.image;
        }
      }
      // For video outputs, set as video input
      if (upstreamOutput.type === "video" && "video" in upstreamOutput) {
        const handle = edge.targetHandle ?? "video";
        input[handle] = upstreamOutput.video;
      }
      // For audio outputs, set as audio input
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
    maxAttempts: 1, // Workflow-level retries are handled by node-level retries
  },

  run: async (payload: WorkflowExecutorPayload) => {
    const { workflowExecutionId, nodes, edges } = payload;

    // Update workflow execution status to RUNNING
    await db.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    // Get execution levels for parallel processing
    const levels = getExecutionLevels(nodes, edges);

    // Track outputs by node ID
    const outputs = new Map<string, Record<string, unknown>>();

    // Execute nodes level by level (parallel within each level)
    for (const level of levels) {
      // Create node execution records for all nodes in this level
      const nodeExecutions = await Promise.all(
        level.map(async (node) => {
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

          // Build input from node data and upstream outputs
          const input = buildNodeInput(node, edges, outputs);

          // Store input
          await db.nodeExecution.update({
            where: { id: nodeExecution.id },
            data: { inputJson: input as object },
          });

          return { node, nodeExecution, input };
        })
      );

      // Execute all nodes in this level in parallel
      const results = await Promise.allSettled(
        nodeExecutions.map(async ({ node, nodeExecution, input }) => {
          const nodeType = node.type as AINodeType;

          // Get node config for timeout
          const executor = getNodeExecutor(nodeType);
          const nodeConfig = executor?.config ?? DEFAULT_NODE_CONFIG;

          const nodePayload: NodeExecutorPayload = {
            nodeExecutionId: nodeExecution.id,
            workflowExecutionId,
            nodeId: node.id,
            nodeType,
            input,
          };

          // triggerAndWait: Parent task PAUSES (no billing) while waiting
          const result = await executeNode.triggerAndWait(nodePayload, {
            timeout: nodeConfig.timeout,
          });

          return { node, result };
        })
      );

      // Process results
      for (const result of results) {
        if (result.status === "fulfilled") {
          const { node, result: execResult } = result.value;

          if (execResult.ok && execResult.output) {
            const output = execResult.output as { output?: Record<string, unknown> };
            if (output.output) {
              outputs.set(node.id, output.output);
            }
          } else {
            // Node failed - mark workflow as failed but continue to collect partial results
            const errorMsg = !execResult.ok
              ? `Node ${node.id} timeout or error`
              : `Node ${node.id} failed`;

            await db.workflowExecution.update({
              where: { id: workflowExecutionId },
              data: {
                status: "FAILED",
                completedAt: new Date(),
                error: errorMsg,
              },
            });

            return {
              success: false,
              workflowExecutionId,
              failedNodeId: node.id,
              partialOutputs: Object.fromEntries(outputs),
            };
          }
        } else {
          // Promise rejected - execution error
          await db.workflowExecution.update({
            where: { id: workflowExecutionId },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            },
          });

          return {
            success: false,
            workflowExecutionId,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            partialOutputs: Object.fromEntries(outputs),
          };
        }
      }
    }

    // All nodes completed successfully
    await db.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      workflowExecutionId,
      nodeOutputs: Object.fromEntries(outputs),
    };
  },
});
