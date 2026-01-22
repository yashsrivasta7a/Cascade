import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  getWorkflowNodes,
  addNode,
  deleteNode,
} from "@/lib/services/workflow-nodes";
import type { Node } from "reactflow";

// =============================================================================
// PAGINATED NODES API
// Enables efficient loading of workflows with 1000+ nodes
// =============================================================================

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workflows/[id]/nodes - Get paginated nodes
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    const { id: workflowId } = await context.params;

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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
    const type = searchParams.get("type") ?? undefined;

    const result = await getWorkflowNodes(workflowId, { cursor, limit, type });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/workflows/[id]/nodes] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch nodes" },
      { status: 500 }
    );
  }
}

// POST /api/workflows/[id]/nodes - Add a new node
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    const { id: workflowId } = await context.params;

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
    const node = body as Node;

    if (!node.id || !node.type) {
      return NextResponse.json(
        { error: "Node must have id and type" },
        { status: 400 }
      );
    }

    await addNode(workflowId, node);

    return NextResponse.json({ success: true, nodeId: node.id }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/workflows/[id]/nodes] Error:", error);
    return NextResponse.json(
      { error: "Failed to add node" },
      { status: 500 }
    );
  }
}

// DELETE /api/workflows/[id]/nodes - Delete a node
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    const { id: workflowId } = await context.params;

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

    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get("nodeId");

    if (!nodeId) {
      return NextResponse.json(
        { error: "nodeId query parameter required" },
        { status: 400 }
      );
    }

    await deleteNode(workflowId, nodeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/workflows/[id]/nodes] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete node" },
      { status: 500 }
    );
  }
}
