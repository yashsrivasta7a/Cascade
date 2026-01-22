import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  updateNodePosition,
  updateNodeData,
  deleteNode,
} from "@/lib/services/workflow-nodes";

// =============================================================================
// SINGLE NODE API
// Enables efficient partial updates for individual nodes
// =============================================================================

type RouteContext = { params: Promise<{ id: string; nodeId: string }> };

// PATCH /api/workflows/[id]/nodes/[nodeId] - Update a single node
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    const { id: workflowId, nodeId } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const workflow = await db.workflow.findFirst({
      where: { id: workflowId, userId },
      select: { id: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const body = await request.json();
    const { position, data } = body;

    // Update position if provided
    if (position && typeof position.x === "number" && typeof position.y === "number") {
      await updateNodePosition(workflowId, nodeId, position);
    }

    // Update data if provided
    if (data && typeof data === "object") {
      await updateNodeData(workflowId, nodeId, data);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/workflows/[id]/nodes/[nodeId]] Error:", error);
    return NextResponse.json(
      { error: "Failed to update node" },
      { status: 500 }
    );
  }
}

// DELETE /api/workflows/[id]/nodes/[nodeId] - Delete a single node
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    const { id: workflowId, nodeId } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const workflow = await db.workflow.findFirst({
      where: { id: workflowId, userId },
      select: { id: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    await deleteNode(workflowId, nodeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/workflows/[id]/nodes/[nodeId]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete node" },
      { status: 500 }
    );
  }
}
