import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Temporary debug endpoint - DELETE after debugging
export async function GET() {
  try {
    const authResult = await auth();
    
    return NextResponse.json({
      hasUserId: !!authResult.userId,
      hasSessionId: !!authResult.sessionId,
      hasSessionClaims: !!authResult.sessionClaims,
      // Don't expose actual IDs in production!
      debug: process.env.NODE_ENV === "development" ? {
        userId: authResult.userId,
        sessionId: authResult.sessionId,
      } : undefined,
    });
  } catch (error) {
    return NextResponse.json({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
    }, { status: 500 });
  }
}
