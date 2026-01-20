import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureCurrentUser } from "@/lib/user";
import { createApiKey, listApiKeys } from "@/lib/api-keys";

// =============================================================================
// API KEY MANAGEMENT ROUTES
// Requires Clerk authentication (not API key auth)
// =============================================================================

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(50),
  expiresIn: z.enum(["never", "30d", "90d", "1y"]).optional(),
});

/**
 * GET /api/api-keys - List all API keys for the current user
 */
export async function GET() {
  try {
    const user = await ensureCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const apiKeys = await listApiKeys(user.id);

    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error("[GET /api/api-keys] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/api-keys - Create a new API key
 */
export async function POST(request: NextRequest) {
  try {
    const user = await ensureCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = CreateApiKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Calculate expiration date
    let expiresAt: Date | undefined;
    if (parsed.data.expiresIn && parsed.data.expiresIn !== "never") {
      const now = new Date();
      switch (parsed.data.expiresIn) {
        case "30d":
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    const apiKey = await createApiKey(user.id, parsed.data.name, { expiresAt });

    // Return the full key - this is the ONLY time it will be shown
    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.fullKey, // Full key - only shown once!
        prefix: apiKey.prefix,
        createdAt: apiKey.createdAt,
        expiresAt: expiresAt ?? null,
      },
      message: "API key created. Copy it now - it won't be shown again!",
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/api-keys] Error:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
