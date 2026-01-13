import { task, wait, runs } from "@trigger.dev/sdk";
import { db } from "@/lib/db";
import { executeNode, type NodeExecutorPayload } from "./node-executor";
import type { AINodeType } from "@/types/nodes";
import type { Node, Edge } from "reactflow";
import { registerAllNodeExecutors } from "@/lib/engine";

// Register all node executors
registerAllNodeExecutors();

// =============================================================================
// WORKFLOW EXECUTOR TASK - DAG Orchestration with Polling-based Parallelism
// =============================================================================
// 
// Uses trigger() (non-blocking) + polling for true parallel execution:
// - ALL nodes with satisfied dependencies run in parallel
// - Multiple chains execute independently
// - wait.for() during polling = NO BILLING (checkpointed)
// - As soon as ANY node completes, its dependents can start
//
// =============================================================================

export interface WorkflowExecutorPayload {
  workflowExecutionId: string;
  workflowId: string;
  userId: string;
  nodes: Node[];
  edges: Edge[];
}

interface RunningNodeInfo {
  nodeId: string;
  runId: string;
  nodeType: AINodeType;
  nodeExecutionId: string;
}

// Build dependency graph
function buildDependencyGraph(nodes: Node[], edges: Edge[]) {
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const node of nodes) {
    dependencies.set(node.id, new Set());
    dependents.set(node.id, new Set());
  }

  for (const edge of edges) {
    dependencies.get(edge.target)?.add(edge.source);
    dependents.get(edge.source)?.add(edge.target);
  }

  return { nodeById, dependencies, dependents };
}

// Check if a node is ready to run
function isNodeReady(
  nodeId: string,
  dependencies: Map<string, Set<string>>,
  completedNodes: Set<string>
): boolean {
  const deps = dependencies.get(nodeId);
  if (!deps || deps.size === 0) return true;
  for (const depId of deps) {
    if (!completedNodes.has(depId)) return false;
  }
  return true;
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

    // Build dependency graph
    const { nodeById, dependencies, dependents } = buildDependencyGraph(nodes, edges);

    // Track state
    const outputs = new Map<string, Record<string, unknown>>();
    const completedNodes = new Set<string>();
    const failedNodes = new Set<string>();
    const triggeredNodes = new Set<string>();
    const runningRuns = new Map<string, RunningNodeInfo>();
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

    // Function to trigger a node (non-blocking)
    async function triggerNode(nodeId: string): Promise<void> {
      if (triggeredNodes.has(nodeId) || failedNodes.size > 0) return;

      const node = nodeById.get(nodeId);
      if (!node) return;

      const nodeType = node.type as AINodeType;
      const nodeExecutionId = nodeExecutionIds.get(nodeId)!;
      const input = buildNodeInput(node, edges, outputs);

      // Store input in DB
      await db.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: { inputJson: input as object },
      });

      const nodePayload: NodeExecutorPayload = {
        nodeExecutionId,
        workflowExecutionId,
        nodeId,
        nodeType,
        input,
      };

      // Trigger (non-blocking) - allows true parallelism across chains
      const handle = await executeNode.trigger(nodePayload);
      
      triggeredNodes.add(nodeId);
      runningRuns.set(handle.id, {
        nodeId,
        runId: handle.id,
        nodeType,
        nodeExecutionId,
      });

      console.log(`[Workflow] Triggered node ${nodeId} (${nodeType}), runId: ${handle.id}`);
    }

    // Function to trigger ALL ready nodes (supports multiple parallel chains)
    async function triggerAllReadyNodes(): Promise<number> {
      let count = 0;
      for (const node of nodes) {
        if (
          !triggeredNodes.has(node.id) &&
          !completedNodes.has(node.id) &&
          !failedNodes.has(node.id) &&
          isNodeReady(node.id, dependencies, completedNodes)
        ) {
          await triggerNode(node.id);
          count++;
        }
      }
      return count;
    }

    // Trigger all initially ready nodes (multiple chains can start in parallel!)
    await triggerAllReadyNodes();
    console.log(`[Workflow] Initial trigger: ${runningRuns.size} nodes started`);

    // Polling loop - checks ALL running nodes each iteration
    // This ensures any chain that completes first gets its dependents triggered
    const maxPollIterations = 1800; // 30 minutes max (1800 * 1s)
    let pollIteration = 0;

    while (runningRuns.size > 0 && pollIteration < maxPollIterations) {
      // Check ALL running nodes (not just one!)
      const completedThisRound: string[] = [];

      for (const [runId, info] of runningRuns) {
        try {
          const run = await runs.retrieve(runId);

          if (run.status === "COMPLETED") {
            console.log(`[Workflow] Node ${info.nodeId} (${info.nodeType}) completed`);

            // Get output from the run
            const output = run.output as { output?: Record<string, unknown> } | undefined;
            if (output?.output) {
              outputs.set(info.nodeId, output.output);
            }

            completedNodes.add(info.nodeId);
            completedThisRound.push(runId);

          } else if (run.status === "FAILED" || run.status === "CANCELED" || run.status === "CRASHED") {
            console.error(`[Workflow] Node ${info.nodeId} failed with status: ${run.status}`);

            failedNodes.add(info.nodeId);
            runningRuns.delete(runId);

            // Mark workflow as failed
            await db.workflowExecution.update({
              where: { id: workflowExecutionId },
              data: {
                status: "FAILED",
                completedAt: new Date(),
                error: `Node ${info.nodeId} (${info.nodeType}) failed`,
              },
            });

            return {
              success: false,
              workflowExecutionId,
              failedNodeId: info.nodeId,
              partialOutputs: Object.fromEntries(outputs),
            };
          }
          // If still running, continue to next node
        } catch (error) {
          console.error(`[Workflow] Error checking run ${runId}:`, error);
        }
      }

      // Remove completed runs and trigger their dependents
      for (const runId of completedThisRound) {
        const info = runningRuns.get(runId);
        runningRuns.delete(runId);

        if (info) {
          // Trigger any nodes that are now ready (from ANY chain!)
          const deps = dependents.get(info.nodeId) ?? new Set();
          for (const depNodeId of deps) {
            if (isNodeReady(depNodeId, dependencies, completedNodes)) {
              await triggerNode(depNodeId);
            }
          }
        }
      }

      // If there are still running nodes, wait before next poll
      // wait.for() is checkpointed - NO BILLING during this time!
      if (runningRuns.size > 0) {
        await wait.for({ seconds: 1 });
        pollIteration++;
      }
    }

    // Check if we timed out
    if (runningRuns.size > 0) {
      await db.workflowExecution.update({
        where: { id: workflowExecutionId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: "Workflow timed out waiting for nodes to complete",
        },
      });

      return {
        success: false,
        workflowExecutionId,
        error: "Timeout",
        partialOutputs: Object.fromEntries(outputs),
      };
    }

    // All nodes completed successfully
    await db.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    console.log(`[Workflow] Completed successfully with ${completedNodes.size} nodes`);

    return {
      success: true,
      workflowExecutionId,
      nodeOutputs: Object.fromEntries(outputs),
    };
  },
});
