import { task, wait } from "@trigger.dev/sdk";
import { db } from "@/lib/db";
import {
  getNodeExecutor,
  validateNodeInput,
  validateNodeOutput,
  type NodeExecutionContext,
  type NodeExecutionResult,
  registerAllNodeExecutors,
  parseSeedreamResult,
  parseSeedvrResult,
  parseSeedanceResult,
  parseElevenlabsResult,
  parseOpenrouterResult,
  parseLipsyncResult,
} from "@/lib/engine";
import type { AINodeType } from "@/types/nodes";
import { getNodeCost } from "@/lib/credits";

// Register all node executors at module load
registerAllNodeExecutors();

// =============================================================================
// NODE EXECUTOR TASK
// =============================================================================

export interface NodeExecutorPayload {
  nodeExecutionId: string;
  workflowExecutionId: string;
  nodeId: string;
  nodeType: AINodeType;
  input: Record<string, unknown>;
}

export const executeNode = task({
  id: "execute-node",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },

  run: async (payload: NodeExecutorPayload) => {
    const { nodeExecutionId, workflowExecutionId, nodeId, nodeType, input } = payload;

    // Check current status - don't overwrite FAILED on retry
    const currentExec = await db.nodeExecution.findUnique({
      where: { id: nodeExecutionId },
      select: { status: true },
    });

    // If already failed, don't retry (return early to avoid re-running)
    if (currentExec?.status === "FAILED") {
      console.log(`[NodeExecutor] ${nodeType} already FAILED, skipping retry`);
      throw new Error("Node already failed - not retrying");
    }

    // Update status to RUNNING
    await db.nodeExecution.update({
      where: { id: nodeExecutionId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    // Get the executor for this node type
    const executor = getNodeExecutor(nodeType);
    if (!executor) {
      await markNodeFailed(nodeExecutionId, `Unknown node type: ${nodeType}`);
      throw new Error(`Unknown node type: ${nodeType}`);
    }

    // Validate input
    const inputValidation = validateNodeInput(nodeType, input);
    if (!inputValidation.success) {
      await markNodeFailed(nodeExecutionId, inputValidation.error);
      throw new Error(inputValidation.error);
    }

    // Build execution context
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL ?? "http://localhost:3000";
    const context: NodeExecutionContext = {
      nodeExecutionId,
      workflowExecutionId,
      nodeId,
      nodeType,
      webhookBaseUrl,
      attempt: 1,
    };

    // Execute the node
    let result: NodeExecutionResult;
    try {
      result = await executor.execute(inputValidation.data, context);
    } catch (error) {
      await markNodeFailed(
        nodeExecutionId,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }

    // If the node submitted an async job (has providerJobId), wait for webhook
    if (result.providerJobId && result.success) {
      // Generate a wait token for this execution
      const waitToken = `node-${nodeExecutionId}`;

      // Update node execution with wait token and provider job ID
      await db.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: {
          status: "WAITING",
          waitToken,
          providerUsed: result.providerUsed,
          providerJobId: result.providerJobId,
        },
      });

      // Wait for the webhook to complete this token
      // This pauses the task until resumeWithToken is called
      const webhookResult = await wait.forToken<{
        success: boolean;
        result?: unknown;
        error?: string;
      }>({
        id: waitToken,
        timeout: "30m", // 30 minute timeout for long-running AI jobs
      });

      if (!webhookResult.ok) {
        await markNodeFailed(nodeExecutionId, "Webhook timeout or cancellation");
        throw new Error("Webhook timeout");
      }

      const webhookData = webhookResult.output;

      if (!webhookData.success) {
        await markNodeFailed(nodeExecutionId, webhookData.error ?? "Provider job failed");
        throw new Error(webhookData.error ?? "Provider job failed");
      }

      // Parse the provider result into our output format
      const parsedOutput = parseProviderResult(nodeType, webhookData.result);

      // Validate output
      const outputValidation = validateNodeOutput(nodeType, parsedOutput);
      if (!outputValidation.success) {
        await markNodeFailed(nodeExecutionId, `Output validation failed: ${outputValidation.error}`);
        throw new Error(outputValidation.error);
      }

      // Mark as completed
      await db.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          outputJson: outputValidation.data as Record<string, unknown>,
        },
      });

      // Deduct credits after successful execution
      await deductCreditsForNode(nodeExecutionId, workflowExecutionId, nodeType);

      return {
        success: true,
        nodeExecutionId,
        output: outputValidation.data,
      };
    }

    // Synchronous execution completed
    if (!result.success) {
      await markNodeFailed(nodeExecutionId, result.error ?? "Execution failed");
      throw new Error(result.error ?? "Execution failed");
    }

    // Validate output
    const outputValidation = validateNodeOutput(nodeType, result.output);
    if (!outputValidation.success) {
      await markNodeFailed(nodeExecutionId, `Output validation failed: ${outputValidation.error}`);
      throw new Error(outputValidation.error);
    }

    // Mark as completed
    await db.nodeExecution.update({
      where: { id: nodeExecutionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        outputJson: outputValidation.data as Record<string, unknown>,
        providerUsed: result.providerUsed,
        actualCost: result.actualCost ?? 0,
      },
    });

    // Deduct credits after successful execution
    await deductCreditsForNode(nodeExecutionId, workflowExecutionId, nodeType, result.actualCost);

    return {
      success: true,
      nodeExecutionId,
      output: outputValidation.data,
    };
  },
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Deduct credits from user's balance after successful node execution
 */
async function deductCreditsForNode(
  nodeExecutionId: string,
  workflowExecutionId: string,
  nodeType: AINodeType,
  actualCost?: number
): Promise<void> {
  try {
    // Get the workflow execution to find the user
    const workflowExec = await db.workflowExecution.findUnique({
      where: { id: workflowExecutionId },
      select: { userId: true },
    });

    if (!workflowExec?.userId) {
      console.log(`[NodeExecutor] No user found for workflow ${workflowExecutionId}, skipping credit deduction`);
      return;
    }

    // Determine cost: use actual cost if provided, otherwise use estimated cost
    const cost = actualCost ?? getNodeCost(nodeType);
    
    // Skip if no cost (free utility nodes)
    if (cost <= 0) {
      console.log(`[NodeExecutor] Node ${nodeType} is free, no credit deduction`);
      return;
    }

    // Deduct credits in a transaction
    await db.$transaction(async (tx) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: workflowExec.userId },
        select: { credits: true },
      });

      if (!user) {
        console.log(`[NodeExecutor] User ${workflowExec.userId} not found, skipping credit deduction`);
        return;
      }

      const newBalance = Math.max(0, user.credits - cost);

      // Update user balance
      await tx.user.update({
        where: { id: workflowExec.userId },
        data: { credits: newBalance },
      });

      // Create ledger entry
      await tx.creditTransaction.create({
        data: {
          userId: workflowExec.userId,
          amount: -cost,
          balanceAfter: newBalance,
          type: "EXECUTION",
          workflowExecutionId,
          nodeExecutionId,
          description: `${nodeType} node execution`,
          metadata: {
            nodeType,
            estimatedCost: getNodeCost(nodeType),
            actualCost: cost,
          },
        },
      });

      console.log(`[NodeExecutor] Deducted ${cost} credits from user ${workflowExec.userId}, new balance: ${newBalance}`);
    });
  } catch (error) {
    // Log but don't fail the node execution if credit deduction fails
    console.error(`[NodeExecutor] Failed to deduct credits:`, error);
  }
}

async function markNodeFailed(nodeExecutionId: string, error: string): Promise<void> {
  console.log(`[NodeExecutor] Marking node ${nodeExecutionId} as FAILED: ${error}`);
  
  const nodeExec = await db.nodeExecution.update({
    where: { id: nodeExecutionId },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      error,
    },
    select: { workflowExecutionId: true, nodeId: true, nodeType: true },
  });

  console.log(`[NodeExecutor] Node ${nodeExec.nodeId} (${nodeExec.nodeType}) marked FAILED in DB`);

  // Also update the workflow execution status
  if (nodeExec.workflowExecutionId) {
    await db.workflowExecution.update({
      where: { id: nodeExec.workflowExecutionId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
      },
    });
    console.log(`[NodeExecutor] Workflow ${nodeExec.workflowExecutionId} marked FAILED`);
  }
}

function parseProviderResult(nodeType: AINodeType, result: unknown): unknown {
  switch (nodeType) {
    case "seedream":
      return parseSeedreamResult(result);
    case "seedvr":
      return parseSeedvrResult(result);
    case "seedance":
      return parseSeedanceResult(result);
    case "elevenlabs":
      return parseElevenlabsResult(result);
    case "openrouter":
      return parseOpenrouterResult(result);
    case "lipsync":
      return parseLipsyncResult(result);
    default:
      // For other nodes, return result as-is
      return result;
  }
}

