import { task, wait } from "@trigger.dev/sdk";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
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
import { persistNodeOutput, isTransloaditConfigured } from "@/lib/providers";

// NOTE: Engine imports are done dynamically inside the run() function
// This prevents FFmpeg from being bundled for Vercel API routes
// The engine module (with FFmpeg) only loads on Trigger.dev workers

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
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
    console.log(`[NodeExecutor] Updated nodeExecution ${nodeExecutionId}:`, Object.keys(data));
    return true;
  } catch (error) {
    // Log the actual error for debugging
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[NodeExecutor] Failed to update nodeExecution ${nodeExecutionId}: ${errorMsg}`);
    return false;
  }
}

export const executeNode = task({
  id: "execute-node",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },

  run: async (payload: NodeExecutorPayload) => {
    const { nodeExecutionId, workflowExecutionId, nodeId, nodeType, input } = payload;

    // Debug: Log raw input for crop-image to diagnose the issue
    if (nodeType === "crop-image") {
      console.log(`[NodeExecutor:crop-image] RAW PAYLOAD INPUT:`, JSON.stringify(input, null, 2));
      console.log(`[NodeExecutor:crop-image] xPercent: ${(input as any)?.xPercent} (${typeof (input as any)?.xPercent})`);
    }

    // Dynamic import of engine module - only loads on Trigger.dev workers
    // This prevents FFmpeg from being bundled for Vercel API routes
    const engine = await import("@/lib/engine");
    const {
      getNodeExecutor,
      validateNodeInput,
      validateNodeOutput,
      registerAllNodeExecutors,
      parseWebhookResult,
    } = engine;

    // Register all node executors (must be done before getNodeExecutor)
    registerAllNodeExecutors();

    try {
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
    // Check if caching is enabled (default true)
    const useCache = (input as { useCache?: boolean }).useCache === true;
    
    let cacheHash: string | undefined;
    if (useCache) {
      try {
        const cacheCheck = await checkCache(nodeType, input);
        cacheHash = cacheCheck.hash;

        if (cacheCheck.hit && cacheCheck.result) {
          console.log(`[NodeExecutor] CACHE HIT for ${nodeType} (hash: ${cacheHash.slice(0, 12)}...) - returning cached result`);
          
          // Mark as completed with cached result (no execution needed)
          await safeUpdateNodeExecution(nodeExecutionId, workflowExecutionId, {
            status: "COMPLETED",
            completedAt: new Date(),
            outputJson: cacheCheck.result as object,
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
    } else {
      console.log(`[NodeExecutor] Cache DISABLED for ${nodeType} - executing fresh`);
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
      }>(waitToken);

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
      const parsedOutput = parseWebhookResult(nodeType, webhookData.result);

      // Validate output
      const outputValidation = validateNodeOutput(nodeType, parsedOutput);
      if (!outputValidation.success) {
        await markNodeFailed(nodeExecutionId, workflowExecutionId, `Output validation failed: ${outputValidation.error}`);
        throw new Error(outputValidation.error);
      }

      // Persist media to CDN (upload base64 to HTTP URLs) for SSE streaming
      let persistedOutput = outputValidation.data;
      if (isTransloaditConfigured()) {
        try {
          persistedOutput = await persistNodeOutput(outputValidation.data);
          console.log(`[NodeExecutor] Persisted webhook output to CDN for ${nodeType}`);
        } catch (persistError) {
          console.warn(`[NodeExecutor] Failed to persist output to CDN:`, persistError);
          // Continue with original output - fallback will handle it
        }
      }

      // Mark as completed
      await safeUpdateNodeExecution(nodeExecutionId, workflowExecutionId, {
        status: "COMPLETED",
        completedAt: new Date(),
        outputJson: persistedOutput as object,
      });

      // Deduct credits after successful execution
      const webhookCost = calculateActualCost(nodeType, input);
      await deductCreditsForNode(nodeExecutionId, workflowExecutionId, nodeType, input);

      // Cache the successful result for future identical executions (only if caching enabled)
      // Use persistedOutput (with CDN URLs) so cache hits also get HTTP URLs
      if (useCache && cacheHash && persistedOutput) {
        try {
          await cacheResult(cacheHash, nodeType, persistedOutput as Record<string, unknown>);
          console.log(`[NodeExecutor] Cached result for ${nodeType} (hash: ${cacheHash.slice(0, 12)}...)`);
        } catch (cacheWriteError) {
          console.warn("[NodeExecutor] Failed to cache result:", cacheWriteError);
        }
      }

      return {
        success: true,
        nodeExecutionId,
        output: persistedOutput,
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

    // Persist media to CDN (upload base64 to HTTP URLs) for SSE streaming
    // This ensures the SSE stream can send HTTP URLs instead of base64 data
    let persistedOutput = outputValidation.data;
    if (isTransloaditConfigured()) {
      try {
        const outputData = outputValidation.data as { type?: string; image?: { url?: string }; video?: { url?: string }; audio?: { url?: string } };
        const mediaUrl = outputData?.image?.url || outputData?.video?.url || outputData?.audio?.url || "";
        
        // Only persist if output contains base64 data
        if (mediaUrl.startsWith("data:")) {
          console.log(`[NodeExecutor] Uploading ${nodeType} base64 output to CDN...`);
          persistedOutput = await persistNodeOutput(outputValidation.data);
          const persistedData = persistedOutput as { image?: { url?: string }; video?: { url?: string }; audio?: { url?: string } };
          const newUrl = persistedData?.image?.url || persistedData?.video?.url || persistedData?.audio?.url || "";
          console.log(`[NodeExecutor] Uploaded to CDN: ${newUrl.slice(0, 80)}...`);
        }
      } catch (persistError) {
        console.warn(`[NodeExecutor] Failed to persist output to CDN:`, persistError);
        // Continue with original output - fallback will handle it
      }
    }

    // Log the validated output for debugging
    console.log(`[NodeExecutor] ${nodeType} output validated:`, {
      type: (persistedOutput as Record<string, unknown>)?.type,
      keys: Object.keys(persistedOutput as object),
      preview: JSON.stringify(persistedOutput).slice(0, 300),
    });

    // Mark as completed
    const updateResult = await safeUpdateNodeExecution(nodeExecutionId, workflowExecutionId, {
      status: "COMPLETED",
      completedAt: new Date(),
      outputJson: persistedOutput as object,
      providerUsed: result.providerUsed,
      actualCost: result.actualCost ?? 0,
    });
    console.log(`[NodeExecutor] safeUpdateNodeExecution result: ${updateResult}`);

    // Deduct credits after successful execution
    // Use result.actualCost if provided (> 0), otherwise calculate
    const syncCost = (result.actualCost && result.actualCost > 0) 
      ? result.actualCost 
      : calculateActualCost(nodeType, input);
    await deductCreditsForNode(nodeExecutionId, workflowExecutionId, nodeType, input, syncCost);

    // Cache the successful result for future identical executions (only if caching enabled)
    // Use persistedOutput (with CDN URLs) so cache hits also get HTTP URLs
    if (useCache && cacheHash && persistedOutput) {
      try {
        await cacheResult(cacheHash, nodeType, persistedOutput as Record<string, unknown>);
        console.log(`[NodeExecutor] Cached result for ${nodeType} (hash: ${cacheHash.slice(0, 12)}...)`);
      } catch (cacheWriteError) {
        console.warn("[NodeExecutor] Failed to cache result:", cacheWriteError);
      }
    }

    return {
      success: true,
      nodeExecutionId,
      output: persistedOutput,
      providerUsed: result.providerUsed,
      actualCost: syncCost,
    };

    } catch (error) {
      // Re-throw to let Trigger.dev handle retries
      // Parent task (workflow executor) will receive the error via batchTriggerAndWait
      throw error;
    }
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
    // Use longer timeout (30s) since node execution can take a while and 
    // the default 5s timeout causes "Transaction not found" errors
    await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
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
      },
      {
        timeout: 30000, // 30 second timeout (default is 5s)
        maxWait: 10000, // Max 10s wait to acquire transaction
      }
    );
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

    // NOTE: We do NOT mark the workflow as FAILED here!
    // The workflow executor is responsible for determining the final workflow status
    // after all chains have completed/failed. This allows partial completion
    // (some chains succeed, some fail) without blocking other chains.
  } catch (dbError) {
    // Record doesn't exist - this is OK for single node runs
    console.log(`[NodeExecutor] nodeExecution ${nodeExecutionId} not found (single node run?)`);
  }
}

// parseProviderResult is now defined inline where it's used
// since it needs access to dynamically imported functions

