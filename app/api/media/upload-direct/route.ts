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
    // Create assembly params - minimal config to just store the file
    const params = {
      auth: {
        key: authKey,
        // Transloadit requires specific date format: YYYY/MM/DD HH:MM:SS+00:00
        expires: formatTransloaditDate(new Date(Date.now() + 30 * 60 * 1000)),
      },
      // Empty steps = just store the original file
      steps: {},
    };

    // Create signature - Transloadit expects "sha384:HEXDIGEST" format
    const paramsString = JSON.stringify(params);
    const signature = "sha384:" + crypto
      .createHmac("sha384", authSecret)
      .update(Buffer.from(paramsString, "utf-8"))
      .digest("hex");

    console.log("[DirectUpload] Created signature for upload");

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

// Format date as Transloadit expects: YYYY/MM/DD HH:MM:SS+00:00
function formatTransloaditDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    date.getUTCFullYear() +
    "/" +
    pad(date.getUTCMonth() + 1) +
    "/" +
    pad(date.getUTCDate()) +
    " " +
    pad(date.getUTCHours()) +
    ":" +
    pad(date.getUTCMinutes()) +
    ":" +
    pad(date.getUTCSeconds()) +
    "+00:00"
  );
}
