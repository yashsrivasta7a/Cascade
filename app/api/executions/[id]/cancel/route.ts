import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { runs } from "@trigger.dev/sdk";

// =============================================================================
// CANCEL EXECUTION API
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { triggerRunId, type = "workflow" } = body as { 
      triggerRunId?: string; 
      type?: "workflow" | "node" | "quick" 
    };

    console.log(`[Cancel] Cancelling ${type} execution ${id}, triggerRunId: ${triggerRunId}`);

    // Cancel the Trigger.dev run if we have one
    if (triggerRunId) {
      try {
        await runs.cancel(triggerRunId);
        console.log(`[Cancel] Trigger.dev run ${triggerRunId} cancelled`);
      } catch (triggerError) {
        // Run may have already completed or doesn't exist
        console.warn(`[Cancel] Failed to cancel Trigger.dev run:`, triggerError);
      }
    }

    // Update database records based on type
    if (type === "workflow") {
      // Cancel workflow execution
      const execution = await db.workflowExecution.findUnique({
        where: { id },
        select: { userId: true, status: true },
      });

      if (!execution) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }

      if (execution.userId !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Only cancel if still running
      if (!["RUNNING", "PENDING", "QUEUED"].includes(execution.status)) {
        return NextResponse.json({ 
          success: true, 
          message: "Execution already completed",
          status: execution.status 
        });
      }

      // Update workflow execution
      await db.workflowExecution.update({
        where: { id },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
          error: "Cancelled by user",
        },
      });

      // Cancel all pending/running node executions
      await db.nodeExecution.updateMany({
        where: {
          workflowExecutionId: id,
          status: { in: ["RUNNING", "WAITING", "QUEUED", "PENDING"] },
        },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: "Cancelled by user",
        },
      });

      console.log(`[Cancel] Workflow execution ${id} cancelled`);

    } else if (type === "quick") {
      // Cancel quick execution (single node run)
      const execution = await db.quickExecution.findUnique({
        where: { id },
        select: { userId: true, status: true },
      });

      if (!execution) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }

      if (execution.userId && execution.userId !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      if (!["RUNNING", "PENDING"].includes(execution.status)) {
        return NextResponse.json({ 
          success: true, 
          message: "Execution already completed",
          status: execution.status 
        });
      }

      await db.quickExecution.update({
        where: { id },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
          error: "Cancelled by user",
        },
      });

      console.log(`[Cancel] Quick execution ${id} cancelled`);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Execution cancelled",
      executionId: id 
    });

  } catch (error) {
    console.error("[Cancel] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel execution" },
      { status: 500 }
    );
  }
}
