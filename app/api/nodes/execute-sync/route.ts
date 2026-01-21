import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdForApi } from "@/lib/user";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { executeNode } from "@/app/trigger/node-executor";
import { runs } from "@trigger.dev/sdk";
import { checkCache, cacheResult } from "@/lib/cache";
import { estimateNodeCost, formatCredits } from "@/lib/credits";
import { Prisma } from "@prisma/client";
import { apiLogger as log } from "@/lib/logger";

// NOTE: We do NOT register node executors here - they run on Trigger.dev only
// This prevents FFmpeg and other heavy dependencies from being bundled for Vercel

// Internal node types - these now run on Trigger.dev too
const SYNC_NODE_TYPES = ["crop-image", "merge-audio-video", "merge-videos", "extract-audio"];

// Route segment config to increase body size limit for large media files
export const maxDuration = 300; // 5 minutes for long FFmpeg operations

// =============================================================================
// SYNCHRONOUS NODE EXECUTION ENDPOINT - FOR INTERNAL NODES
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let executionId: string | null = null;

  try {
    // Get user ID (falls back to dev user if unauthenticated)
    const { userId } = await getUserIdForApi();

    // Read the raw body text first to handle large payloads (base64 media can be 10MB+)
    let body: { nodeType?: string; input?: Record<string, unknown>; nodeId?: string; nodeLabel?: string; workflowId?: string };
    try {
      const rawBody = await request.text();
      body = JSON.parse(rawBody);
    } catch (parseError) {
      log.error("JSON parse error", parseError);
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to parse request body. The data may be too large or malformed.",
        },
        { status: 400 }
      );
    }
    
    const nodeType = body?.nodeType;
    const input = body?.input ?? {};
    const nodeId = body?.nodeId;
    const nodeLabel = body?.nodeLabel;
    const workflowId = body?.workflowId;

    // Debug logging for crop-image
    if (nodeType === "crop-image") {
      log.debug("crop-image input received", {
        xPercent: input?.xPercent,
        yPercent: input?.yPercent,
        widthPercent: input?.widthPercent,
        heightPercent: input?.heightPercent,
      });
    }

    if (!nodeType || typeof nodeType !== "string") {
      return NextResponse.json(
        { 
          success: false,
          error: "Missing or invalid nodeType",
        },
        { status: 400 }
      );
    }

    // Only allow execution for supported node types
    if (!SYNC_NODE_TYPES.includes(nodeType)) {
      return NextResponse.json(
        { 
          success: false,
          error: `Node type "${nodeType}" is not supported by this endpoint. Use /api/nodes/execute instead.`,
        },
        { status: 400 }
      );
    }

    // Input validation happens on Trigger.dev side
    // Basic check that input is an object
    if (typeof input !== "object" || input === null) {
      return NextResponse.json(
        { 
          success: false,
          error: "Input must be an object",
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // CHECK CREDITS - Ensure user has enough credits before execution
    // =========================================================================
    const estimatedCost = estimateNodeCost(nodeType, input);
    
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (user && user.credits < estimatedCost) {
        log.info("Insufficient credits", { nodeType, balance: user.credits, required: estimatedCost });
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient credits. You have ${formatCredits(user.credits)} but need ${formatCredits(estimatedCost)} to run this node.`,
            insufficientCredits: true,
            balance: user.credits,
            required: estimatedCost,
          },
          { status: 402 } // Payment Required
        );
      }

      log.debug("Credit check passed", { balance: user?.credits ?? 0, required: estimatedCost });
    } catch (creditError) {
      log.warn("Credit check failed, proceeding", { error: creditError });
    }

    // =========================================================================
    // CHECK CACHE - Return cached result if identical inputs were run before
    // =========================================================================
    // Check if caching is enabled (default false)
    const validatedInput = input as Record<string, unknown>;
    const useCache = validatedInput.useCache === true;
    log.debug("Cache config", { nodeType, useCache });
    
    let cacheHash: string | undefined;
    if (useCache) {
      try {
        const cacheCheck = await checkCache(nodeType, validatedInput);
        cacheHash = cacheCheck.hash;

        if (cacheCheck.hit && cacheCheck.result) {
          const durationMs = Date.now() - startTime;
          log.debug("Cache HIT", { nodeType, hash: cacheHash.slice(0, 12) });
          
          return NextResponse.json({
            success: true,
            output: cacheCheck.result,
            providerUsed: "cache",
            actualCost: 0, // No cost for cached results!
            fromCache: true,
            cacheHash: cacheHash.slice(0, 12),
            durationMs,
          });
        }
        
        log.debug("Cache MISS", { nodeType, hash: cacheHash.slice(0, 12) });
      } catch (cacheError) {
        log.warn("Cache check failed, proceeding", { error: cacheError });
      }
    } else {
      log.debug("Cache disabled, executing fresh", { nodeType });
    }

    // Get node definition for label
    const nodeDef = NODE_DEFINITIONS[nodeType as AINodeType];
    const displayLabel = nodeLabel || nodeDef?.label || nodeType;

    // Create QuickExecution record to track this run
    try {
      const execution = await db.quickExecution.create({
        data: {
          userId,
          workflowId, // Link to workflow for Activity tab
          nodeId, // React Flow node ID
          nodeType,
          nodeLabel: displayLabel,
          status: "RUNNING",
          provider: "internal",
          inputJson: sanitizeInputForStorage(input),
          estimatedCost: 0,
        },
      });
      executionId = execution.id;
      log.debug("Created execution record", { executionId, nodeType });
    } catch (dbError) {
      log.warn("Failed to create execution record", { error: dbError });
    }

    log.info("Starting execution via Trigger.dev", { nodeType });

    // Execute via Trigger.dev
    const payload = {
      nodeExecutionId: executionId || `sync-${Date.now()}`,
      workflowExecutionId: `sync-workflow-${Date.now()}`,
      nodeId: nodeId || `sync-node-${Date.now()}`,
      nodeType: nodeType as AINodeType,
      input: input as Record<string, unknown>,
    };

    // Debug: Log payload before triggering for crop-image
    if (nodeType === "crop-image") {
      log.debug("Payload to Trigger.dev", payload);
    }

    let result: { success: boolean; output?: unknown; error?: string; providerUsed?: string; actualCost?: number };
    
    try {
      // Start the Trigger.dev task
      const handle = await executeNode.trigger(payload);
      log.debug("Trigger.dev task started", { handleId: handle.id });

      // Poll for completion instead of using subscribeToRun
      const maxWaitTime = 5 * 60 * 1000; // 5 minutes
      const pollInterval = 1000; // 1 second
      const pollStartTime = Date.now();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let finalRun: any = null;
      
      while (Date.now() - pollStartTime < maxWaitTime) {
        try {
          const run = await runs.retrieve(handle.id);
          log.debug("Run status", { handleId: handle.id, status: run.status });
          
          if (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELED") {
            finalRun = run;
            break;
          }
          
          // Wait before next poll
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (pollError) {
          log.error("Poll error", pollError);
          // Continue polling
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }

      // Extract result
      if (finalRun?.status === "COMPLETED" && finalRun.output) {
        const output = finalRun.output as { output?: unknown; providerUsed?: string; actualCost?: number };
        result = { 
          success: true, 
          output: output.output,
          providerUsed: output.providerUsed,
          actualCost: output.actualCost,
        };
      } else if (finalRun?.status === "FAILED") {
        result = { 
          success: false, 
          error: "Task execution failed on Trigger.dev",
        };
      } else {
        result = { 
          success: false, 
          error: finalRun ? "Task was canceled" : "Task timed out",
        };
      }
    } catch (triggerError) {
      log.error("Trigger.dev error", triggerError);
      result = {
        success: false,
        error: triggerError instanceof Error ? triggerError.message : "Failed to execute on Trigger.dev",
      };
    }

    const durationMs = Date.now() - startTime;

    log.info("Execution completed", { nodeType, success: result.success, durationMs });

    // Update execution record with result
    if (executionId) {
      try {
        await db.quickExecution.update({
          where: { id: executionId },
          data: {
            status: result.success ? "COMPLETED" : "FAILED",
            completedAt: new Date(),
            durationMs,
            outputJson: result.success ? sanitizeOutputForStorage(result.output) ?? Prisma.DbNull : Prisma.DbNull,
            actualCost: result.actualCost ?? 0,
            error: result.success ? null : (result.error || "Execution failed"),
          },
        });
        log.debug("Updated execution status", { executionId, status: result.success ? "COMPLETED" : "FAILED" });
      } catch (dbError) {
        log.warn("Failed to update execution record", { error: dbError });
      }
    }

    if (result.success) {
      // Cache successful result for future identical executions (only if caching enabled)
      if (useCache && cacheHash && result.output) {
        try {
          await cacheResult(cacheHash, nodeType, result.output as Record<string, unknown>);
          log.debug("Cached result", { nodeType, hash: cacheHash.slice(0, 12) });
        } catch (cacheWriteError) {
          log.warn("Failed to cache result", { error: cacheWriteError });
        }
      }

      return NextResponse.json({
        success: true,
        output: result.output,
        providerUsed: result.providerUsed,
        actualCost: result.actualCost,
        executionId,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || "Execution failed",
        providerUsed: result.providerUsed,
        executionId,
      });
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error("Sync execute failed", error);

    // Update execution as failed if we have one
    if (executionId) {
      try {
        await db.quickExecution.update({
          where: { id: executionId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            durationMs,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } catch (dbError) {
        log.warn("Failed to update execution as failed", { error: dbError });
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionId,
      },
      { status: 500 }
    );
  }
}

// Sanitize input for storage (remove large base64 data)
function sanitizeInputForStorage(input: Record<string, unknown>): Prisma.InputJsonValue {
  const sanitized: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.startsWith("data:")) {
      // Store just a placeholder for base64 data
      sanitized[key] = "[base64 data]";
    } else if (typeof value === "object" && value !== null && "url" in value) {
      const obj = value as { url?: string };
      if (typeof obj.url === "string" && obj.url.startsWith("data:")) {
        sanitized[key] = { ...obj, url: "[base64 data]" } as Prisma.InputJsonValue;
      } else {
        sanitized[key] = value as Prisma.InputJsonValue;
      }
    } else {
      sanitized[key] = value as Prisma.InputJsonValue | null;
    }
  }
  return sanitized as Prisma.InputJsonValue;
}

// Sanitize output for storage (remove large base64 data)
function sanitizeOutputForStorage(output: unknown): Prisma.InputJsonValue | null {
  if (!output || typeof output !== "object") return output as Prisma.InputJsonValue | null;
  
  const obj = output as Record<string, unknown>;
  const sanitized: Record<string, Prisma.InputJsonValue | null> = { type: obj.type as Prisma.InputJsonValue };
  
  // Store type info but truncate URLs
  for (const [key, value] of Object.entries(obj)) {
    if (key === "type") continue;
    if (typeof value === "object" && value !== null && "url" in value) {
      const asset = value as { url?: string; mimeType?: string };
      if (typeof asset.url === "string" && asset.url.startsWith("data:")) {
        sanitized[key] = { url: "[base64 output]", mimeType: asset.mimeType } as Prisma.InputJsonValue;
      } else {
        sanitized[key] = value as Prisma.InputJsonValue;
      }
    } else {
      sanitized[key] = value as Prisma.InputJsonValue | null;
    }
  }
  return sanitized as Prisma.InputJsonValue;
}

export async function GET() {
  return NextResponse.json({
    message: "Node Execution via Trigger.dev",
    description: "This endpoint executes utility nodes via Trigger.dev and waits for completion",
    supportedNodes: SYNC_NODE_TYPES,
    execution: "Trigger.dev (serverless)",
    usage: {
      method: "POST",
      body: {
        nodeType: "crop-image | merge-audio-video | merge-videos | extract-audio",
        input: "object (node-specific input)"
      }
    },
  });
}

