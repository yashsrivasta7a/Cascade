import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// =============================================================================
// GET WORKFLOW BY NAME API ROUTE
// =============================================================================

type RouteContext = { params: Promise<{ name: string }> };

// GET /api/workflows/by-name/[name] - Get a workflow by its name
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { userId } = await auth();
    const { name } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Decode the name (it may be URL-encoded)
    const decodedName = decodeURIComponent(name);

    const workflow = await db.workflow.findFirst({
      where: {
        name: decodedName,
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
      return NextResponse.json(
        { error: `Workflow with name "${decodedName}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error("[GET /api/workflows/by-name/[name]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow" },
      { status: 500 }
    );
  }
}
