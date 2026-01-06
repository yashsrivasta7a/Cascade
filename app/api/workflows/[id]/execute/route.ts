import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { executeWorkflow } from "@/app/trigger/workflow-executor";
import type { Node, Edge } from "reactflow";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";

// =============================================================================
// WORKFLOW EXECUTION API
// =============================================================================

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/workflows/[id]/execute - Start workflow execution
export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { userId } = await auth();
    const { id: workflowId } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the workflow
    const workflow = await db.workflow.findFirst({
      where: { id: workflowId, userId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Parse nodes and edges
    const nodes = workflow.nodesJson as Node[];
    const edges = workflow.edgesJson as Edge[];

    if (!nodes || nodes.length === 0) {
      return NextResponse.json(
        { error: "Workflow has no nodes" },
        { status: 400 }
      );
    }

    // Calculate estimated cost
    const estimatedCost = nodes.reduce((sum, node) => {
      const nodeDef = NODE_DEFINITIONS[node.type as AINodeType];
      return sum + (nodeDef?.estimatedCost ?? 0);
    }, 0);

    // Check user credits
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.credits < estimatedCost) {
      return NextResponse.json(
        { error: "Insufficient credits", required: estimatedCost, available: user.credits },
        { status: 402 }
      );
    }

    // Create workflow execution record
    const workflowExecution = await db.workflowExecution.create({
      data: {
        workflowId,
        userId,
        status: "PENDING",
        workflowSnapshot: {
          nodes,
          edges,
          workflowVersion: workflow.version,
        },
        estimatedCost,
      },
    });

    // Trigger the workflow execution task
    const handle = await executeWorkflow.trigger({
      workflowExecutionId: workflowExecution.id,
      workflowId,
      userId,
      nodes,
      edges,
    });

    // Update with trigger run ID
    await db.workflowExecution.update({
      where: { id: workflowExecution.id },
      data: {
        triggerRunId: handle.id,
      },
    });

    return NextResponse.json({
      executionId: workflowExecution.id,
      triggerRunId: handle.id,
      status: "PENDING",
      estimatedCost,
    });
  } catch (error) {
    console.error("[POST /api/workflows/[id]/execute] Error:", error);
    return NextResponse.json(
      { error: "Failed to start workflow execution" },
      { status: 500 }
    );
  }
}

