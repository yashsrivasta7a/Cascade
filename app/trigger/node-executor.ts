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

async function markNodeFailed(nodeExecutionId: string, error: string): Promise<void> {
  await db.nodeExecution.update({
    where: { id: nodeExecutionId },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      error,
    },
  });
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

