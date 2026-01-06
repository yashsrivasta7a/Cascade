import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// =============================================================================
// EXECUTION STATUS API
// =============================================================================

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/executions/[id] - Get execution status and details
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
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
            nodeLabel: true,
            status: true,
            providerUsed: true,
            inputJson: true,
            outputJson: true,
            estimatedCost: true,
            actualCost: true,
            startedAt: true,
            completedAt: true,
            error: true,
          },
        },
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    return NextResponse.json({ execution });
  } catch (error) {
    console.error("[GET /api/executions/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch execution" },
      { status: 500 }
    );
  }
}

// DELETE /api/executions/[id] - Cancel an execution (if possible)
export async function DELETE(
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

    // Can only cancel pending or running executions
    if (!["PENDING", "RUNNING", "PAUSED"].includes(execution.status)) {
      return NextResponse.json(
        { error: "Execution cannot be cancelled in current state" },
        { status: 400 }
      );
    }

    // Update execution status to cancelled
    await db.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });

    // Note: Trigger.dev task cancellation would be handled here
    // The task will check execution status and abort if cancelled

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/executions/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to cancel execution" },
      { status: 500 }
    );
  }
}

