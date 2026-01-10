import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadMedia, isTransloaditConfigured } from "@/lib/providers";

// Note: Next.js App Router has a default body limit of ~4MB for API routes
// For larger files, we'd need to use multipart/form-data uploads
// Current max effective file size: ~3MB (base64 encoding adds ~33% overhead)

// POST /api/media/upload - Upload base64 media to CDN
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { dataUrl, type, filename } = body as {
      dataUrl: string;
      type?: "image" | "video" | "audio";
      filename?: string;
    };

    if (!dataUrl) {
      return NextResponse.json({ error: "Missing dataUrl" }, { status: 400 });
    }

    // If already an HTTP URL, return as-is
    if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
      return NextResponse.json({ url: dataUrl });
    }

    // Check if Transloadit is configured
    if (!isTransloaditConfigured()) {
      console.warn("[MediaUpload] Transloadit not configured, returning original");
      return NextResponse.json({ url: dataUrl });
    }

    // Upload to Transloadit
    console.log(`[MediaUpload] Uploading ${type || "media"} to Transloadit...`);
    const result = await uploadMedia(dataUrl, { type, filename });
    
    console.log(`[MediaUpload] Upload complete: ${result.url.slice(0, 80)}...`);
    return NextResponse.json({ url: result.url, mimeType: result.mimeType });
  } catch (error) {
    console.error("[MediaUpload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
