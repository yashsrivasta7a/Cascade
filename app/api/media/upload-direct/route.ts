import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";

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
    // Create assembly params - using same structure as working server-side code
    // SDK uses: new Date().toISOString() for expires
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 1); // 1 day from now (same as SDK)
    const expires = expiresDate.toISOString();
    
    const params = {
      auth: {
        key: authKey,
        expires: expires,
      },
      // Use same step structure as working server-side transloadit.ts
      steps: {
        passthrough: {
          robot: "/file/filter",
          use: ":original",
          accepts: [["${file.mime}", "regex", ".*"]],
        },
      },
    };

    // Create signature exactly like SDK: sha384:HMAC_HEX
    const paramsString = JSON.stringify(params);
    const signature = "sha384:" + crypto
      .createHmac("sha384", authSecret)
      .update(Buffer.from(paramsString, "utf-8"))
      .digest("hex");

    console.log("[DirectUpload] params:", paramsString);
    console.log("[DirectUpload] signature:", signature.slice(0, 20) + "...");

    return NextResponse.json({
      params: paramsString,
      signature,
    });
  } catch (error) {
    console.error("[DirectUpload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create upload" },
      { status: 500 }
    );
  }
}
