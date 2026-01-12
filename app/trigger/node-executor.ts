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
import { 
  getNodeCost, 
  estimateNodeCost,
  calculateElevenlabsCost,
  calculateLipsyncCost,
  calculateSeedanceCost,
  calculateSeedvrCost,
} from "@/lib/credits";
import { checkCache, cacheResult } from "@/lib/cache";

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

// Helper to safely update nodeExecution (may not exist for single node runs)
async function safeUpdateNodeExecution(
  nodeExecutionId: string,
  workflowExecutionId: string,
  data: Parameters<typeof db.nodeExecution.update>[0]["data"]
): Promise<boolean> {
  // Skip if this is a sync execution (utility nodes run individually)
  // Sync executions have workflowExecutionId starting with "sync-"
  if (workflowExecutionId.startsWith("sync-")) {
    return false;
  }
  
  try {
    await db.nodeExecution.update({
      where: { id: nodeExecutionId },
      data,
    });
    return true;
  } catch (error) {
    // Record doesn't exist - this is OK for single node runs
    console.log(`[NodeExecutor] nodeExecution ${nodeExecutionId} not found (single node run?)`);
    return false;
  }
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

    // =========================================================================
    // CHECK CACHE - Return cached result if identical inputs were run before
    // =========================================================================
    let cacheHash: string | undefined;
    try {
      const cacheCheck = await checkCache(nodeType, input);
      cacheHash = cacheCheck.hash;

      if (cacheCheck.hit && cacheCheck.result) {
        console.log(`[NodeExecutor] CACHE HIT for ${nodeType} (hash: ${cacheHash.slice(0, 12)}...) - returning cached result`);
        
        // Mark as completed with cached result (no execution needed)
        await safeUpdateNodeExecution(nodeExecutionId, workflowExecutionId, {
          status: "COMPLETED",
          completedAt: new Date(),
          outputJson: cacheCheck.result,
          providerUsed: "cache",
          actualCost: 0, // No cost for cached results!
        });

        return {
          success: true,
          nodeExecutionId,
          output: cacheCheck.result,
          providerUsed: "cache",
          actualCost: 0,
          fromCache: true,
        };
      }

      console.log(`[NodeExecutor] Cache MISS for ${nodeType} (hash: ${cacheHash.slice(0, 12)}...) - executing`);
    } catch (cacheError) {
      console.warn("[NodeExecutor] Cache check failed, proceeding with execution:", cacheError);
    }

    // Check if user has enough credits before execution (use dynamic estimate)
    const estimatedCreditCost = estimateNodeCost(nodeType, input);
    if (estimatedCreditCost > 0) {
      const workflowExec = await db.workflowExecution.findUnique({
        where: { id: workflowExecutionId },
        select: { userId: true },
      });

      if (workflowExec?.userId) {
        const user = await db.user.findUnique({
          where: { id: workflowExec.userId },
          select: { credits: true },
        });

        if (!user || user.credits < estimatedCreditCost) {
          const errorMsg = `Insufficient credits. Required: ${estimatedCreditCost.toLocaleString()}, Available: ${(user?.credits ?? 0).toLocaleString()}`;
          await markNodeFailed(nodeExecutionId, workflowExecutionId, errorMsg);
          throw new Error(errorMsg);
        }
      }
    }

    // Update status to RUNNING (may not exist for single node runs)
    await safeUpdateNodeExecution(nodeExecutionId, workflowExecutionId, {
      status: "RUNNING",
      startedAt: new Date(),
    });

    // Get the executor for this node type
    const executor = getNodeExecutor(nodeType);
    if (!executor) {
      await markNodeFailed(nodeExecutionId, workflowExecutionId, `Unknown node type: ${nodeType}`);
      throw new Error(`Unknown node type: ${nodeType}`);
    }

    // Validate input
    const inputValidation = validateNodeInput(nodeType, input);
    if (!inputValidation.success) {
      await markNodeFailed(nodeExecutionId, workflowExecutionId, inputValidation.error);
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
        workflowExecutionId,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }

    // If the node submitted an async job (has providerJobId), wait for webhook
    if (result.providerJobId && result.success) {
      // Generate a wait token for this execution
      const waitToken = `node-${nodeExecutionId}`;

      // Update node execution with wait token and provider job ID
      await safeUpdateNodeExecution(nodeExecutionId, workflowExecutionId, {
        status: "WAITING",
        waitToken,
        providerUsed: result.providerUsed,
        providerJobId: result.providerJobId,
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
        await markNodeFailed(nodeExecutionId, workflowExecutionId, "Webhook timeout or cancellation");
        throw new Error("Webhook timeout");
      }

      const webhookData = webhookResult.output;

      if (!webhookData.success) {
        await markNodeFailed(nodeExecutionId, workflowExecutionId, webhookData.error ?? "Provider job failed");
        throw new Error(webhookData.error ?? "Provider job failed");
      }

      // Parse the provider result into our output format
      const parsedOutput = parseProviderResult(nodeType, webhookData.result);

      // Validate output
      const outputValidation = validateNodeOutput(nodeType, parsedOutput);
      if (!outputValidation.success) {
        await markNodeFailed(nodeExecutionId, workflowExecutionId, `Output validation failed: ${outputValidation.error}`);
        throw new Error(outputValidation.error);
      }

      // Mark as completed
      await safeUpdateNodeExecution(nodeExecutionId, workflowExecutionId, {
        status: "COMPLETED",
        completedAt: new Date(),
        outputJson: outputValidation.data as Record<string, unknown>,
      });

      // Deduct credits after successful execution
      const webhookCost = calculateActualCost(nodeType, input);
      await deductCreditsForNode(nodeExecutionId, workflowExecutionId, nodeType, input);

      // Cache the successful result for future identical executions
      if (cacheHash && outputValidation.data) {
        try {
          await cacheResult(cacheHash, nodeType, outputValidation.data as Record<string, unknown>);
          console.log(`[NodeExecutor] Cached result for ${nodeType} (hash: ${cacheHash.slice(0, 12)}...)`);
        } catch (cacheWriteError) {
          console.warn("[NodeExecutor] Failed to cache result:", cacheWriteError);
        }
      }

      return {
        success: true,
        nodeExecutionId,
        output: outputValidation.data,
        providerUsed: result.providerUsed,
        actualCost: webhookCost,
      };
    }

    // Synchronous execution completed
    if (!result.success) {
      await markNodeFailed(nodeExecutionId, workflowExecutionId, result.error ?? "Execution failed");
      throw new Error(result.error ?? "Execution failed");
    }

    // Validate output
    const outputValidation = validateNodeOutput(nodeType, result.output);
    if (!outputValidation.success) {
      await markNodeFailed(nodeExecutionId, workflowExecutionId, `Output validation failed: ${outputValidation.error}`);
      throw new Error(outputValidation.error);
    }

    // Mark as completed
    await safeUpdateNodeExecution(nodeExecutionId, workflowExecutionId, {
      status: "COMPLETED",
      completedAt: new Date(),
      outputJson: outputValidation.data as Record<string, unknown>,
      providerUsed: result.providerUsed,
      actualCost: result.actualCost ?? 0,
    });

    // Deduct credits after successful execution
    // Use result.actualCost if provided (> 0), otherwise calculate
    const syncCost = (result.actualCost && result.actualCost > 0) 
      ? result.actualCost 
      : calculateActualCost(nodeType, input);
    await deductCreditsForNode(nodeExecutionId, workflowExecutionId, nodeType, input, syncCost);

    // Cache the successful result for future identical executions
    if (cacheHash && outputValidation.data) {
      try {
        await cacheResult(cacheHash, nodeType, outputValidation.data as Record<string, unknown>);
        console.log(`[NodeExecutor] Cached result for ${nodeType} (hash: ${cacheHash.slice(0, 12)}...)`);
      } catch (cacheWriteError) {
        console.warn("[NodeExecutor] Failed to cache result:", cacheWriteError);
      }
    }

    return {
      success: true,
      nodeExecutionId,
      output: outputValidation.data,
      providerUsed: result.providerUsed,
      actualCost: syncCost,
    };
  },
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate actual cost based on node type and input data
 */
function calculateActualCost(
  nodeType: AINodeType,
  input: Record<string, unknown>
): number {
  switch (nodeType) {
    case "seedream":
      // Fixed cost: $0.04 per image = 40,000 credits
      return 40_000;

    case "seedvr": {
      // $0.001 per megapixel
      const width = (input.width as number) || 1024;
      const height = (input.height as number) || 1024;
      return calculateSeedvrCost(width, height);
    }

    case "seedance": {
      // Token-based pricing
      const width = (input.width as number) || 1280;
      const height = (input.height as number) || 720;
      const fps = (input.fps as number) || 24;
      const duration = (input.duration as number) || 5;
      const hasAudio = input.audio !== false;
      return calculateSeedanceCost(width, height, fps, duration, hasAudio);
    }

    case "elevenlabs": {
      // $0.1 per 1000 characters
      const text = (input.text as string) || "";
      if (text.length > 0) {
        return calculateElevenlabsCost(text.length);
      }
      return getNodeCost(nodeType);
    }

    case "lipsync": {
      // $0.7 per minute - estimate from video duration if available
      const duration = (input.duration as number) || 30;
      return calculateLipsyncCost(duration);
    }

    case "openrouter":
      // LLM costs - use base estimate (actual token costs vary)
      return getNodeCost(nodeType);

    // Utility nodes have minimal cost
    case "crop-image":
      return 1_000;  // $0.001
    case "merge-audio-video":
      return 3_000;  // $0.003
    case "merge-videos":
      return 5_000;  // $0.005
    case "extract-audio":
      return 2_000;  // $0.002

    default:
      return getNodeCost(nodeType);
  }
}

/**
 * Deduct credits from user's balance after successful node execution
 */
async function deductCreditsForNode(
  nodeExecutionId: string,
  workflowExecutionId: string,
  nodeType: AINodeType,
  input: Record<string, unknown>,
  providerActualCost?: number
): Promise<void> {
  try {
    let userId: string | null = null;
    const isSyncExecution = workflowExecutionId.startsWith("sync-");

    if (isSyncExecution) {
      // For sync executions (utility nodes), get user from QuickExecution
      const quickExec = await db.quickExecution.findUnique({
        where: { id: nodeExecutionId },
        select: { userId: true },
      });
      userId = quickExec?.userId ?? null;
      
      if (!userId) {
        console.log(`[NodeExecutor] No user found for QuickExecution ${nodeExecutionId}, skipping credit deduction`);
        return;
      }
    } else {
      // For workflow executions, get user from WorkflowExecution
      const workflowExec = await db.workflowExecution.findUnique({
        where: { id: workflowExecutionId },
        select: { userId: true },
      });
      userId = workflowExec?.userId ?? null;

      if (!userId) {
        console.log(`[NodeExecutor] No user found for workflow ${workflowExecutionId}, skipping credit deduction`);
        return;
      }
    }

    // Calculate cost: provider actual (if > 0) > dynamic calculation > base estimate
    // Use || instead of ?? so that 0 falls through to calculateActualCost
    const cost = (providerActualCost && providerActualCost > 0) 
      ? providerActualCost 
      : calculateActualCost(nodeType, input);

    // Skip if no cost (truly free nodes only)
    if (cost <= 0) {
      console.log(`[NodeExecutor] Node ${nodeType} has no cost, skipping credit deduction`);
      return;
    }
    
    console.log(`[NodeExecutor] Node ${nodeType} cost: ${cost} credits (sync: ${isSyncExecution})`);

    // Deduct credits in a transaction
    await db.$transaction(async (tx) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: userId! },
        select: { credits: true },
      });

      if (!user) {
        console.log(`[NodeExecutor] User ${userId} not found, skipping credit deduction`);
        return;
      }

      const newBalance = Math.max(0, user.credits - cost);

      // Update user balance
      await tx.user.update({
        where: { id: userId! },
        data: { credits: newBalance },
      });

      // Create ledger entry (workflowExecutionId may be null for sync executions)
      await tx.creditTransaction.create({
        data: {
          userId: userId!,
          amount: -cost,
          balanceAfter: newBalance,
          type: "EXECUTION",
          workflowExecutionId: isSyncExecution ? null : workflowExecutionId,
          nodeExecutionId: isSyncExecution ? null : nodeExecutionId,
          description: `${nodeType} node execution`,
          metadata: {
            nodeType,
            estimatedCost: getNodeCost(nodeType),
            actualCost: cost,
            quickExecutionId: isSyncExecution ? nodeExecutionId : undefined,
          },
        },
      });

      // Update execution record with actual cost
      if (isSyncExecution) {
        // Update QuickExecution for sync (utility) nodes
        await tx.quickExecution.update({
          where: { id: nodeExecutionId },
          data: { actualCost: cost },
        });
      } else {
        // Update NodeExecution for workflow nodes
        await tx.nodeExecution.update({
          where: { id: nodeExecutionId },
          data: { actualCost: cost },
        });
      }

      // Update workflowExecution actualCost (only for real workflow executions)
      if (!isSyncExecution) {
        await tx.workflowExecution.update({
          where: { id: workflowExecutionId },
          data: {
            actualCost: { increment: cost },
          },
        });
      }

      console.log(`[NodeExecutor] Deducted ${cost} credits from user ${userId}, new balance: ${newBalance}`);
    });
  } catch (error) {
    // Log but don't fail the node execution if credit deduction fails
    console.error(`[NodeExecutor] Failed to deduct credits:`, error);
  }
}

async function markNodeFailed(nodeExecutionId: string, workflowExecutionId: string, error: string): Promise<void> {
  console.log(`[NodeExecutor] Marking node ${nodeExecutionId} as FAILED: ${error}`);
  
  // Skip DB update for sync executions (utility nodes run individually)
  if (workflowExecutionId.startsWith("sync-")) {
    console.log(`[NodeExecutor] Sync execution - skipping nodeExecution DB update`);
    // Update QuickExecution instead
    try {
      await db.quickExecution.update({
        where: { id: nodeExecutionId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error,
        },
      });
      console.log(`[NodeExecutor] QuickExecution ${nodeExecutionId} marked FAILED`);
    } catch {
      console.log(`[NodeExecutor] QuickExecution ${nodeExecutionId} not found`);
    }
    return;
  }
  
  try {
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
  } catch (dbError) {
    // Record doesn't exist - this is OK for single node runs
    console.log(`[NodeExecutor] nodeExecution ${nodeExecutionId} not found (single node run?)`);
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
    // Utility nodes return output directly (no webhook parsing needed)
    case "crop-image":
    case "merge-audio-video":
    case "merge-videos":
    case "extract-audio":
      return result;
    default:
      // For other nodes, return result as-is
      return result;
  }
}

