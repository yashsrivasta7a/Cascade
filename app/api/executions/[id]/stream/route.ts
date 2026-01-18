import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Vercel function config
export const maxDuration = 300; // 5 minutes for streaming

// =============================================================================
// EXECUTION STREAM API - Real-time updates via Trigger.dev
// =============================================================================

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/executions/[id]/stream - Get execution run ID for polling
// Note: Trigger.dev v4 doesn't have generateToken - use polling via /api/executions/[id]
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
    });

    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    if (!execution.triggerRunId) {
      return NextResponse.json(
        { error: "Execution has no Trigger.dev run ID" },
        { status: 400 }
      );
    }

    // Return run ID for frontend polling
    // Real-time updates happen via the useExecutionStream hook polling /api/executions/[id]
    return NextResponse.json({
      executionId: execution.id,
      runId: execution.triggerRunId,
      status: execution.status,
    });
  } catch (error) {
    console.error("[GET /api/executions/[id]/stream] Error:", error);
    return NextResponse.json(
      { error: "Failed to get execution info" },
      { status: 500 }
    );
  }
}

