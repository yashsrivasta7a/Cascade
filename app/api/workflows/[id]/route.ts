import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";

// =============================================================================
// SINGLE WORKFLOW API ROUTES
// =============================================================================

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  nodesJson: z.array(z.unknown()).optional(),
  edgesJson: z.array(z.unknown()).optional(),
  viewportJson: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
  isPublished: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workflows/[id] - Get a single workflow
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { userId } = await auth();
    const { id } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflow = await db.workflow.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        executions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            actualCost: true,
            createdAt: true,
          },
        },
      },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error("[GET /api/workflows/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow" },
      { status: 500 }
    );
  }
}

// PATCH /api/workflows/[id] - Update a workflow
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { userId } = await auth();
    const { id } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existing = await db.workflow.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Check for duplicate name if name is being changed
    if (parsed.data.name !== undefined && parsed.data.name !== existing.name) {
      const existingWithName = await db.workflow.findFirst({
        where: {
          userId,
          name: parsed.data.name,
          id: { not: id },
        },
        select: { id: true },
      });

      if (existingWithName) {
        return NextResponse.json(
          { error: `A workflow named "${parsed.data.name}" already exists. Please choose a different name.` },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.nodesJson !== undefined) updateData.nodesJson = parsed.data.nodesJson;
    if (parsed.data.edgesJson !== undefined) updateData.edgesJson = parsed.data.edgesJson;
    if (parsed.data.viewportJson !== undefined) updateData.viewportJson = parsed.data.viewportJson;
    if (parsed.data.isPublished !== undefined) updateData.isPublished = parsed.data.isPublished;

    // Increment version if nodes or edges changed
    if (parsed.data.nodesJson || parsed.data.edgesJson) {
      updateData.version = existing.version + 1;
    }

    const workflow = await db.workflow.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error("[PATCH /api/workflows/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}

// DELETE /api/workflows/[id] - Delete a workflow
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { userId } = await auth();
    const { id } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existing = await db.workflow.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    await db.workflow.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/workflows/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete workflow" },
      { status: 500 }
    );
  }
}

