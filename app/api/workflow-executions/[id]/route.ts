import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureCurrentUser } from "@/lib/user";

// =============================================================================
// SINGLE WORKFLOW EXECUTION API
// =============================================================================

const UpdateExecutionSchema = z.object({
  status: z.enum(["PENDING", "RUNNING", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  actualCost: z.number().optional(),
  error: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workflow-executions/[id] - Get a single execution
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await ensureCurrentUser();
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const execution = await db.workflowExecution.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        nodeExecutions: {
          orderBy: { createdAt: "asc" },
        },
        workflow: {
          select: {
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
    console.error("[GET /api/workflow-executions/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch execution" },
      { status: 500 }
    );
  }
}

// PATCH /api/workflow-executions/[id] - Update execution status
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await ensureCurrentUser();
    const { id } = await context.params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await db.workflowExecution.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateExecutionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
      
      // Set completedAt when status becomes terminal
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(parsed.data.status)) {
        updateData.completedAt = new Date();
      }
    }
    
    if (parsed.data.actualCost !== undefined) {
      updateData.actualCost = parsed.data.actualCost;
    }
    
    if (parsed.data.error !== undefined) {
      updateData.error = parsed.data.error;
    }

    const execution = await db.workflowExecution.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ execution });
  } catch (error) {
    console.error("[PATCH /api/workflow-executions/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to update execution" },
      { status: 500 }
    );
  }
}


