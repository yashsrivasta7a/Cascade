import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";

// =============================================================================
// TRIGGER.DEV PUBLIC ACCESS TOKEN ENDPOINT
// =============================================================================
// Creates short-lived public tokens for frontend realtime subscriptions
// These tokens allow read-only access to specific runs or tasks
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { runId, taskId, tag, scopes } = body as {
      runId?: string;
      taskId?: string;
      tag?: string;
      scopes?: {
        read?: {
          runs?: string[];
          tasks?: string[];
          tags?: string[];
        };
      };
    };

    // Build scopes based on what's requested
    const tokenScopes: {
      read?: {
        runs?: string[];
        tasks?: string[];
        tags?: string[];
      };
    } = scopes || { read: {} };

    // Add specific run if provided
    if (runId) {
      tokenScopes.read = tokenScopes.read || {};
      tokenScopes.read.runs = tokenScopes.read.runs || [];
      if (!tokenScopes.read.runs.includes(runId)) {
        tokenScopes.read.runs.push(runId);
      }
    }

    // Add specific task if provided
    if (taskId) {
      tokenScopes.read = tokenScopes.read || {};
      tokenScopes.read.tasks = tokenScopes.read.tasks || [];
      if (!tokenScopes.read.tasks.includes(taskId)) {
        tokenScopes.read.tasks.push(taskId);
      }
    }

    // Add tag if provided (e.g., for filtering runs by user)
    if (tag) {
      tokenScopes.read = tokenScopes.read || {};
      tokenScopes.read.tags = tokenScopes.read.tags || [];
      if (!tokenScopes.read.tags.includes(tag)) {
        tokenScopes.read.tags.push(tag);
      }
    }

    // Create public access token
    // Short expiration (15 min default) for security
    const publicToken = await triggerAuth.createPublicToken({
      scopes: tokenScopes,
      expirationTime: "30m", // 30 minutes - enough for a workflow run
    });

    return NextResponse.json({ 
      token: publicToken,
      expiresIn: "30m",
    });
  } catch (error) {
    console.error("[POST /api/trigger/token] Error:", error);
    return NextResponse.json(
      { error: "Failed to create access token" },
      { status: 500 }
    );
  }
}
