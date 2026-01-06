import { task } from "@trigger.dev/sdk";
import { db } from "@/lib/db";
import { executeNode, type NodeExecutorPayload } from "./node-executor";
import type { AINodeType } from "@/types/nodes";
import type { Node, Edge } from "reactflow";
import { registerAllNodeExecutors, getNodeExecutor, DEFAULT_NODE_CONFIG } from "@/lib/engine";

// Register all node executors
registerAllNodeExecutors();

// =============================================================================
// WORKFLOW EXECUTOR TASK - DAG Orchestration
// =============================================================================

export interface WorkflowExecutorPayload {
  workflowExecutionId: string;
  workflowId: string;
  userId: string;
  nodes: Node[];
  edges: Edge[];
}

// Topological sort for DAG execution order
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

  const queue: string[] = [];
  for (const [id, deg] of inDeg.entries()) {
    if (deg === 0) queue.push(id);
  }

  const result: Node[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (node) result.push(node);

    for (const nextId of adj.get(id) ?? []) {
      inDeg.set(nextId, (inDeg.get(nextId) ?? 0) - 1);
      if (inDeg.get(nextId) === 0) queue.push(nextId);
    }
  }

  return result;
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

    // Topologically sort nodes for execution order
    const sortedNodes = topoSort(nodes, edges);

    // Track outputs by node ID
    const outputs = new Map<string, Record<string, unknown>>();

    // Execute nodes in order
    for (const node of sortedNodes) {
      const nodeType = node.type as AINodeType;
      const nodeLabel = (node.data as Record<string, unknown>)?.label as string | undefined;

      // Create node execution record
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

      // Get node config for timeout
      const executor = getNodeExecutor(nodeType);
      const nodeConfig = executor?.config ?? DEFAULT_NODE_CONFIG;

      // Execute the node as a child task
      const nodePayload: NodeExecutorPayload = {
        nodeExecutionId: nodeExecution.id,
        workflowExecutionId,
        nodeId: node.id,
        nodeType,
        input,
      };

      try {
        // triggerAndWait: Parent task PAUSES (no billing) while waiting
        // This is cost-efficient for long-running AI jobs
        const result = await executeNode.triggerAndWait(nodePayload, {
          // Use the node's configured timeout
          timeout: nodeConfig.timeout,
        });

        if (result.ok && result.output) {
          // Store output for downstream nodes
          const output = result.output as { output?: Record<string, unknown> };
          if (output.output) {
            outputs.set(node.id, output.output);
          }
        } else {
          // Node failed - mark workflow as failed
          const errorMsg = !result.ok 
            ? `Node timeout or error` 
            : `Node ${node.id} (${nodeType}) failed`;
            
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
          };
        }
      } catch (error) {
        // Execution error
        await db.workflowExecution.update({
          where: { id: workflowExecutionId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            error: error instanceof Error ? error.message : String(error),
          },
        });

        return {
          success: false,
          workflowExecutionId,
          error: error instanceof Error ? error.message : String(error),
        };
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

