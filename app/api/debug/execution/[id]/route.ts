import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// =============================================================================
// DEBUG ENDPOINT - Check execution and outputJson in database
// =============================================================================

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { userId } = await auth();
    const { id: executionId } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const execution = await db.workflowExecution.findFirst({
      where: {
        id: executionId,
        userId,
      },
      include: {
        nodeExecutions: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    // Debug output: show what's in the database
    const debugInfo = {
      workflowExecution: {
        id: execution.id,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        error: execution.error,
      },
      nodeExecutions: execution.nodeExecutions.map(ne => ({
        nodeId: ne.nodeId,
        nodeType: ne.nodeType,
        status: ne.status,
        hasOutputJson: !!ne.outputJson,
        outputJsonKeys: ne.outputJson ? Object.keys(ne.outputJson as object) : [],
        outputJsonPreview: ne.outputJson ? JSON.stringify(ne.outputJson).slice(0, 500) : null,
        error: ne.error,
        startedAt: ne.startedAt,
        completedAt: ne.completedAt,
      })),
    };

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error) {
    console.error("[DEBUG] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug info" },
      { status: 500 }
    );
  }
}
