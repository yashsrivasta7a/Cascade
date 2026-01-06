import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// =============================================================================
// CANCEL STUCK EXECUTIONS API
// =============================================================================

export async function POST() {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    // Cancel stuck workflow executions
    const workflowResult = await db.workflowExecution.updateMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: twoMinutesAgo },
      },
      data: {
        status: "FAILED",
        error: "Cancelled - execution timed out",
        completedAt: new Date(),
      },
    });

    // Cancel stuck quick executions
    const quickResult = await db.quickExecution.updateMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: twoMinutesAgo },
      },
      data: {
        status: "FAILED",
        error: "Cancelled - execution timed out",
        completedAt: new Date(),
      },
    });

    // Also cancel any stuck node executions
    const nodeResult = await db.nodeExecution.updateMany({
      where: {
        status: { in: ["RUNNING", "WAITING", "QUEUED"] },
        startedAt: { lt: twoMinutesAgo },
      },
      data: {
        status: "FAILED",
        error: "Cancelled - execution timed out",
        completedAt: new Date(),
      },
    });

    const totalCancelled = workflowResult.count + quickResult.count + nodeResult.count;

    return NextResponse.json({
      success: true,
      cancelled: {
        workflows: workflowResult.count,
        quickExecutions: quickResult.count,
        nodeExecutions: nodeResult.count,
        total: totalCancelled,
      },
    });
  } catch (error) {
    console.error("[Cancel Stuck] Error:", error);
    return NextResponse.json(
      { error: "Failed to cancel stuck executions" },
      { status: 500 }
    );
  }
}

