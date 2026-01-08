import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureCurrentUser } from "@/lib/user";

// =============================================================================
// WORKFLOW EXECUTIONS API ROUTES
// =============================================================================

const CreateExecutionSchema = z.object({
  workflowId: z.string().optional(),
  workflowSnapshot: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
  }),
  estimatedCost: z.number().default(0),
});

// GET /api/workflow-executions - List workflow executions
export async function GET(request: NextRequest) {
  try {
    const user = await ensureCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    const executions = await db.workflowExecution.findMany({
      where: {
        userId: user.id,
        ...(workflowId ? { workflowId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        workflowId: true,
        status: true,
        estimatedCost: true,
        actualCost: true,
        startedAt: true,
        completedAt: true,
        error: true,
        createdAt: true,
        workflow: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ executions });
  } catch (error) {
    console.error("[GET /api/workflow-executions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch executions" },
      { status: 500 }
    );
  }
}

// POST /api/workflow-executions - Create a new execution
export async function POST(request: NextRequest) {
  try {
    const user = await ensureCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateExecutionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid execution data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // If no workflowId provided, create a temporary workflow record
    let workflowId = parsed.data.workflowId;
    
    if (!workflowId) {
      const tempWorkflow = await db.workflow.create({
        data: {
          userId: user.id,
          name: `Temp Workflow ${new Date().toISOString()}`,
          nodesJson: parsed.data.workflowSnapshot.nodes,
          edgesJson: parsed.data.workflowSnapshot.edges,
        },
      });
      workflowId = tempWorkflow.id;
    }

    const execution = await db.workflowExecution.create({
      data: {
        workflowId,
        userId: user.id,
        status: "RUNNING",
        workflowSnapshot: parsed.data.workflowSnapshot,
        estimatedCost: parsed.data.estimatedCost,
        startedAt: new Date(),
      },
    });

    return NextResponse.json({ execution }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/workflow-executions] Error:", error);
    return NextResponse.json(
      { error: "Failed to create execution" },
      { status: 500 }
    );
  }
}


