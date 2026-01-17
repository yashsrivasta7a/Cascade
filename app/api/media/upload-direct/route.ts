import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// =============================================================================
// DIRECT UPLOAD - Returns Transloadit signature for client-side upload
// =============================================================================
// This bypasses Vercel's 4.5MB body limit by having the client upload directly
// to Transloadit instead of going through our API.

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authKey = process.env.TRANSLOADIT_AUTH_KEY;
  const authSecret = process.env.TRANSLOADIT_AUTH_SECRET;

  if (!authKey || !authSecret) {
    return NextResponse.json(
      { error: "Transloadit not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { type } = body as { type?: "image" | "video" | "audio" };

    // Create assembly params
    const params = {
      auth: {
        key: authKey,
        expires: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      },
      steps: {
        // Just store the uploaded file
        stored: {
          robot: "/file/filter",
          use: ":original",
          accepts: [["\${file.mime}", "regex", ".*"]],
        },
      },
    };

    // Create signature
    const crypto = await import("crypto");
    const paramsString = JSON.stringify(params);
    const signature = crypto
      .createHmac("sha384", authSecret)
      .update(Buffer.from(paramsString, "utf-8"))
      .digest("hex");

    return NextResponse.json({
      params: paramsString,
      signature,
      authKey,
    });
  } catch (error) {
    console.error("[DirectUpload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create upload" },
      { status: 500 }
    );
  }
}
