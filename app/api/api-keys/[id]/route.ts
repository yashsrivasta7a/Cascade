import { NextRequest, NextResponse } from "next/server";
import { ensureCurrentUser } from "@/lib/user";
import { revokeApiKey } from "@/lib/api-keys";

// =============================================================================
// API KEY MANAGEMENT ROUTES - Single Key Operations
// Requires Clerk authentication (not API key auth)
// =============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/api-keys/[id] - Revoke an API key
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await ensureCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "API key ID is required" },
        { status: 400 }
      );
    }

    const revoked = await revokeApiKey(user.id, id);

    if (!revoked) {
      return NextResponse.json(
        { error: "API key not found or already revoked" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error) {
    console.error("[DELETE /api/api-keys/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
