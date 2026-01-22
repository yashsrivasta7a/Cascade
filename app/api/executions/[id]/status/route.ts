import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { authenticateWithApiKeyDirect } from "@/lib/user";

// Helper to get userId from API key or Clerk
async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer sk_live_")) {
    const authResult = await authenticateWithApiKeyDirect(authHeader);
    return authResult.user?.id ?? null;
  }
  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}

// =============================================================================
// EXECUTION STATUS API (Lightweight)
// =============================================================================

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/executions/[id]/status - Get execution status only (for polling)
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getUserId(request);
    const { id: executionId } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const execution = await db.workflowExecution.findFirst({
      where: {
        id: executionId,
        userId,
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        error: true,
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            nodeExecutions: true,
          },
        },
        nodeExecutions: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    // Calculate progress
    const totalNodes = execution._count.nodeExecutions;
    const completedNodes = execution.nodeExecutions.filter(
      (n) => n.status === "COMPLETED" || n.status === "FAILED"
    ).length;
    const progress = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

    // Calculate duration
    let duration: string | null = null;
    if (execution.startedAt) {
      const endTime = execution.completedAt ?? new Date();
      const durationMs = endTime.getTime() - execution.startedAt.getTime();
      if (durationMs < 1000) {
        duration = `${durationMs}ms`;
      } else if (durationMs < 60000) {
        duration = `${(durationMs / 1000).toFixed(1)}s`;
      } else {
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.round((durationMs % 60000) / 1000);
        duration = `${minutes}m ${seconds}s`;
      }
    }

    return NextResponse.json({
      id: execution.id,
      status: execution.status.toLowerCase(),
      workflowId: execution.workflow.id,
      workflowName: execution.workflow.name,
      progress,
      completedNodes,
      totalNodes,
      startedAt: execution.startedAt?.toISOString() ?? null,
      completedAt: execution.completedAt?.toISOString() ?? null,
      duration,
      error: execution.error,
      isComplete: ["COMPLETED", "FAILED", "CANCELLED"].includes(execution.status),
    });
  } catch (error) {
    console.error("[GET /api/executions/[id]/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch execution status" },
      { status: 500 }
    );
  }
}
