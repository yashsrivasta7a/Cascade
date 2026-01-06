import { NextRequest, NextResponse } from "next/server";
import { runs } from "@trigger.dev/sdk";
import { db } from "@/lib/db";
import { falProvider } from "@/lib/providers";

// =============================================================================
// FAL.AI WEBHOOK HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get node execution ID from query params
    const nodeExecutionId = request.nextUrl.searchParams.get("nodeExecutionId");
    
    if (!nodeExecutionId) {
      console.error("[fal webhook] Missing nodeExecutionId");
      return NextResponse.json(
        { error: "Missing nodeExecutionId" },
        { status: 400 }
      );
    }

    // Parse the webhook payload
    const rawPayload = await request.json();
    
    // Log webhook for debugging
    await db.providerWebhook.create({
      data: {
        provider: "fal",
        providerJobId: rawPayload.request_id ?? "unknown",
        payloadJson: rawPayload,
      },
    });

    // Parse the fal.ai webhook payload
    const parsed = falProvider.parseWebhookPayload(rawPayload);

    // Find the node execution
    const nodeExecution = await db.nodeExecution.findUnique({
      where: { id: nodeExecutionId },
    });

    if (!nodeExecution) {
      console.error(`[fal webhook] Node execution not found: ${nodeExecutionId}`);
      return NextResponse.json(
        { error: "Node execution not found" },
        { status: 404 }
      );
    }

    if (!nodeExecution.waitToken) {
      console.error(`[fal webhook] No wait token for node execution: ${nodeExecutionId}`);
      return NextResponse.json(
        { error: "No wait token" },
        { status: 400 }
      );
    }

    // Resume the waiting task with the webhook result
    await runs.resumeWithToken(nodeExecution.waitToken, {
      success: parsed.status === "completed",
      result: parsed.result,
      error: parsed.error,
    });

    // Mark webhook as processed
    await db.providerWebhook.updateMany({
      where: {
        provider: "fal",
        providerJobId: parsed.requestId,
      },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[fal webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// fal.ai sends GET requests to verify the webhook endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", provider: "fal.ai" });
}

