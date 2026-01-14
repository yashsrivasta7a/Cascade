import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

// Temporary debug endpoint - DELETE after debugging
export async function GET() {
  try {
    const authResult = await auth();
    const headersList = await headers();
    
    return NextResponse.json({
      hasUserId: !!authResult.userId,
      hasSessionId: !!authResult.sessionId,
      hasSessionClaims: !!authResult.sessionClaims,
      // Check if cookies are being received
      hasCookieHeader: headersList.has("cookie"),
      cookiePreview: headersList.get("cookie")?.substring(0, 100) + "...",
    });
  } catch (error) {
    return NextResponse.json({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
    }, { status: 500 });
  }
}

// Also test POST (like tRPC uses)
export async function POST() {
  try {
    const authResult = await auth();
    const headersList = await headers();
    
    return NextResponse.json({
      method: "POST",
      hasUserId: !!authResult.userId,
      hasSessionId: !!authResult.sessionId,
      hasCookieHeader: headersList.has("cookie"),
    });
  } catch (error) {
    return NextResponse.json({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
