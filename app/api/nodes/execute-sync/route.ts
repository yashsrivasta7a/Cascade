import { NextRequest, NextResponse } from "next/server";
import { validateNodeInput, registerAllNodeExecutors } from "@/lib/engine";
import { db } from "@/lib/db";
import { getUserIdForApi } from "@/lib/user";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { executeNode } from "@/app/trigger/node-executor";
import { runs } from "@trigger.dev/sdk/v3";

// Register all node executors at module load (needed for validation)
registerAllNodeExecutors();

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
    // Try to get user ID (optional - may not have auth in dev)
    let userId: string | null = null;
    try {
      const userResult = await getUserIdForApi();
      userId = userResult.userId;
    } catch {
      // User auth is optional for utility nodes
    }

    // Read the raw body text first to handle large payloads (base64 media can be 10MB+)
    let body: { nodeType?: string; input?: Record<string, unknown>; nodeId?: string; nodeLabel?: string; workflowId?: string };
    try {
      const rawBody = await request.text();
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("[Sync Execute] JSON parse error:", parseError);
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

    // Validate input using the node's schema
    const inputValidation = validateNodeInput(nodeType, input);
    if (!inputValidation.success) {
      return NextResponse.json(
        { 
          success: false,
          error: inputValidation.error,
        },
        { status: 400 }
      );
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
      console.log(`[Sync Execute] Created execution record ${executionId} for ${nodeType}`);
    } catch (dbError) {
      console.warn("[Sync Execute] Failed to create execution record:", dbError);
    }

    console.log(`[Sync Execute] Starting ${nodeType} execution via Trigger.dev`);

    // Execute via Trigger.dev
    const payload = {
      nodeExecutionId: executionId || `sync-${Date.now()}`,
      workflowExecutionId: `sync-workflow-${Date.now()}`,
      nodeId: nodeId || `sync-node-${Date.now()}`,
      nodeType: nodeType as AINodeType,
      input: inputValidation.data as Record<string, unknown>,
    };

    // Start the Trigger.dev task
    const handle = await executeNode.trigger(payload);
    console.log(`[Sync Execute] Trigger.dev task started: ${handle.id}`);

    // Wait for completion using SSE subscription
    let finalRun: Awaited<ReturnType<typeof runs.retrieve>> | null = null;
    for await (const run of runs.subscribeToRun(handle.id)) {
      console.log(`[Sync Execute] Run ${handle.id} status: ${run.status}`);
      if (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELED") {
        finalRun = run;
        break;
      }
    }

    const durationMs = Date.now() - startTime;

    // Extract result from Trigger.dev run
    let result: { success: boolean; output?: unknown; error?: string; providerUsed?: string; actualCost?: number };
    if (finalRun?.status === "COMPLETED" && finalRun.output) {
      const output = finalRun.output as { output?: unknown; providerUsed?: string; actualCost?: number };
      result = { 
        success: true, 
        output: output.output,
        providerUsed: output.providerUsed,
        actualCost: output.actualCost,
      };
    } else {
      result = { 
        success: false, 
        error: finalRun?.status === "FAILED" ? "Task execution failed on Trigger.dev" : "Task was canceled",
      };
    }

    console.log(`[Sync Execute] ${nodeType} completed:`, result.success ? "success" : "failed", `(${durationMs}ms)`);

    // Update execution record with result
    if (executionId) {
      try {
        await db.quickExecution.update({
          where: { id: executionId },
          data: {
            status: result.success ? "COMPLETED" : "FAILED",
            completedAt: new Date(),
            durationMs,
            outputJson: result.success ? sanitizeOutputForStorage(result.output) : null,
            actualCost: result.actualCost ?? 0,
            error: result.success ? null : (result.error || "Execution failed"),
          },
        });
        console.log(`[Sync Execute] Updated execution ${executionId} as ${result.success ? "COMPLETED" : "FAILED"}`);
      } catch (dbError) {
        console.warn("[Sync Execute] Failed to update execution record:", dbError);
      }
    }

    if (result.success) {
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
    console.error("[Sync Execute] Error:", error);

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
        console.warn("[Sync Execute] Failed to update execution as failed:", dbError);
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
function sanitizeInputForStorage(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.startsWith("data:")) {
      // Store just a placeholder for base64 data
      sanitized[key] = "[base64 data]";
    } else if (typeof value === "object" && value !== null && "url" in value) {
      const obj = value as { url?: string };
      if (typeof obj.url === "string" && obj.url.startsWith("data:")) {
        sanitized[key] = { ...obj, url: "[base64 data]" };
      } else {
        sanitized[key] = value;
      }
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Sanitize output for storage (remove large base64 data)
function sanitizeOutputForStorage(output: unknown): unknown {
  if (!output || typeof output !== "object") return output;
  
  const obj = output as Record<string, unknown>;
  const sanitized: Record<string, unknown> = { type: obj.type };
  
  // Store type info but truncate URLs
  for (const [key, value] of Object.entries(obj)) {
    if (key === "type") continue;
    if (typeof value === "object" && value !== null && "url" in value) {
      const asset = value as { url?: string; mimeType?: string };
      if (typeof asset.url === "string" && asset.url.startsWith("data:")) {
        sanitized[key] = { url: "[base64 output]", mimeType: asset.mimeType };
      } else {
        sanitized[key] = value;
      }
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
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

