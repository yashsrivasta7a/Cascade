import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createApiKey } from "@/lib/api-keys";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

// =============================================================================
// MCP AUTHENTICATION CODE API
// Generates one-time codes for MCP server authentication
// =============================================================================

// In-memory store for auth codes (short-lived, 5 minutes)
// In production, consider Redis for multi-instance deployments
const authCodes = new Map<string, {
  userId: string;
  email: string;
  expiresAt: number;
  used: boolean;
}>();

// Clean up expired codes periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of authCodes.entries()) {
    if (data.expiresAt < now || data.used) {
      authCodes.delete(code);
    }
  }
}, 60000); // Every minute

/**
 * POST /api/auth/mcp-code - Generate a new auth code for the logged-in user
 */
export async function POST(req: NextRequest) {
  try {
    // Require Clerk authentication
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Ensure user exists in our database
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
    });
    
    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    // Generate a 6-character alphanumeric code (easy to type)
    const code = randomBytes(3).toString("hex").toUpperCase(); // e.g., "A1B2C3"
    
    // Store with 5-minute expiration
    authCodes.set(code, {
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress || "",
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      used: false,
    });

    console.log(`[MCP Auth] Generated code ${code} for user ${user.id}`);

    return NextResponse.json({
      code,
      expiresIn: 300, // 5 minutes in seconds
      message: "Enter this code in your MCP client to authenticate",
    });
  } catch (error) {
    console.error("[POST /api/auth/mcp-code] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate auth code" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/mcp-code?code=ABC123 - Exchange code for API key
 * GET /api/auth/mcp-code?code=ABC123&check=true - Check if code was used (for polling)
 * Called by the MCP server to complete authentication
 */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
    const checkOnly = req.nextUrl.searchParams.get("check") === "true";
    
    if (!code) {
      return NextResponse.json(
        { error: "Missing code parameter" },
        { status: 400 }
      );
    }

    const authData = authCodes.get(code);
    
    // For check-only requests (polling from browser)
    if (checkOnly) {
      if (!authData) {
        // Code not found - either expired, never existed, or was used and cleaned up
        return NextResponse.json({ used: true, status: "completed_or_expired" });
      }
      if (authData.used) {
        return NextResponse.json({ used: true, status: "completed" });
      }
      return NextResponse.json({ used: false, status: "pending" });
    }
    
    if (!authData) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 }
      );
    }

    // Check expiration
    if (authData.expiresAt < Date.now()) {
      authCodes.delete(code);
      return NextResponse.json(
        { error: "Code has expired" },
        { status: 400 }
      );
    }

    // Check if already used
    if (authData.used) {
      return NextResponse.json(
        { error: "Code has already been used" },
        { status: 400 }
      );
    }

    // Mark as used
    authData.used = true;

    // Create a new API key for MCP access
    const apiKey = await createApiKey(
      authData.userId,
      "MCP Server (auto-generated)",
      {
        scopes: ["*"],
        // No expiration for MCP keys - user can revoke manually
      }
    );

    console.log(`[MCP Auth] Code ${code} exchanged for API key by user ${authData.userId}`);

    // Don't delete immediately - keep for a short time so browser can detect success
    setTimeout(() => {
      authCodes.delete(code);
    }, 10000); // Clean up after 10 seconds

    return NextResponse.json({
      success: true,
      apiKey: apiKey.fullKey,
      email: authData.email,
      message: "Authentication successful! API key has been generated.",
    });
  } catch (error) {
    console.error("[GET /api/auth/mcp-code] Error:", error);
    return NextResponse.json(
      { error: "Failed to exchange code" },
      { status: 500 }
    );
  }
}
