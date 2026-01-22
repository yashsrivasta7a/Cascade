import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";
import { db } from "@/lib/db";

// =============================================================================
// WORKFLOW REALTIME TOKEN ENDPOINT
// =============================================================================
// Creates a public token for subscribing to ALL executions of a workflow.
// The browser uses this to see executions triggered from MCP or other sources.
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workflowId } = await params;

    // Verify user owns this workflow
    const workflow = await db.workflow.findFirst({
      where: { id: workflowId, userId },
      select: { id: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Create tag for this workflow
    const workflowTag = `workflow:${workflowId}`;

    // Create public access token scoped to this workflow's tag
    // This allows the browser to subscribe to ALL runs for this workflow
    const publicToken = await triggerAuth.createPublicToken({
      scopes: {
        read: {
          tags: [workflowTag],
        },
      },
      expirationTime: "1h", // 1 hour - longer since page might be open a while
    });

    return NextResponse.json({
      token: publicToken,
      workflowTag,
      expiresIn: "1h",
    });
  } catch (error) {
    console.error("[GET /api/workflows/[id]/realtime-token] Error:", error);
    return NextResponse.json(
      { error: "Failed to create realtime token" },
      { status: 500 }
    );
  }
}
