import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureCurrentUser } from "@/lib/user";

// =============================================================================
// WORKFLOW API ROUTES
// =============================================================================

// Schema for creating/updating a workflow
const WorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  nodesJson: z.array(z.unknown()),
  edgesJson: z.array(z.unknown()),
  viewportJson: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
});

// GET /api/workflows - List all workflows for the current user
export async function GET() {
  try {
    const user = await ensureCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflows = await db.workflow.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        version: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            executions: true,
          },
        },
      },
    });

    return NextResponse.json({ workflows });
  } catch (error) {
    console.error("[GET /api/workflows] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflows" },
      { status: 500 }
    );
  }
}

// POST /api/workflows - Create a new workflow
export async function POST(request: NextRequest) {
  try {
    const user = await ensureCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = WorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid workflow data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const workflow = await db.workflow.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        description: parsed.data.description,
        nodesJson: parsed.data.nodesJson,
        edgesJson: parsed.data.edgesJson,
        viewportJson: parsed.data.viewportJson ?? null,
      },
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/workflows] Error:", error);
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 }
    );
  }
}

