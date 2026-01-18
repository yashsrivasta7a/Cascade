import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// =============================================================================
// GET NODE STATUS - Direct database lookup by nodeId
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nodeId = searchParams.get("nodeId");

    if (!nodeId) {
      return NextResponse.json(
        { error: "nodeId is required" },
        { status: 400 }
      );
    }

    // Find the most recent node execution for this nodeId
    // Order by createdAt (always set) instead of startedAt (can be NULL for new executions)
    // This ensures we get the newest execution even if it hasn't started yet
    const nodeExecution = await db.nodeExecution.findFirst({
      where: { nodeId },
      orderBy: { createdAt: "desc" },
      include: {
        workflowExecution: {
          select: {
            id: true,
            triggerRunId: true,
          },
        },
      },
    });

    if (!nodeExecution) {
      return NextResponse.json({ status: "not_found", nodeId });
    }

    // Calculate duration
    const duration = nodeExecution.startedAt && nodeExecution.completedAt
      ? new Date(nodeExecution.completedAt).getTime() - new Date(nodeExecution.startedAt).getTime()
      : nodeExecution.startedAt
        ? Date.now() - new Date(nodeExecution.startedAt).getTime()
        : undefined;

    return NextResponse.json({
      status: nodeExecution.status.toLowerCase(),
      nodeId: nodeExecution.nodeId,
      nodeType: nodeExecution.nodeType,
      nodeLabel: nodeExecution.nodeLabel,
      error: nodeExecution.error,
      providerUsed: nodeExecution.providerUsed,
      output: nodeExecution.outputJson,
      inputs: nodeExecution.inputJson,
      startedAt: nodeExecution.startedAt,
      completedAt: nodeExecution.completedAt,
      duration,
      executionId: nodeExecution.id,
      workflowExecutionId: nodeExecution.workflowExecution?.id,
      triggerRunId: nodeExecution.workflowExecution?.triggerRunId,
    });
  } catch (error) {
    console.error("[Node Status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
