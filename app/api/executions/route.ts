import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// =============================================================================
// EXECUTIONS LIST API
// =============================================================================

// GET /api/executions - List all executions for the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = request.nextUrl;
    const workflowId = searchParams.get("workflowId");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    // Build where clause
    const where: Record<string, unknown> = { userId };
    if (workflowId) where.workflowId = workflowId;
    if (status) where.status = status.toUpperCase();

    const [executions, total] = await Promise.all([
      db.workflowExecution.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
            },
          },
          nodeExecutions: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      db.workflowExecution.count({ where }),
    ]);

    // Transform executions to include node status summary
    const transformed = executions.map((exec) => {
      const nodeStatuses = exec.nodeExecutions.reduce(
        (acc, node) => {
          acc[node.status] = (acc[node.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        id: exec.id,
        workflowId: exec.workflowId,
        workflowName: exec.workflow?.name,
        status: exec.status,
        estimatedCost: exec.estimatedCost,
        actualCost: exec.actualCost,
        nodeCount: exec.nodeExecutions.length,
        nodeStatuses,
        startedAt: exec.startedAt,
        completedAt: exec.completedAt,
        error: exec.error,
        createdAt: exec.createdAt,
      };
    });

    return NextResponse.json({
      executions: transformed,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[GET /api/executions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch executions" },
      { status: 500 }
    );
  }
}

