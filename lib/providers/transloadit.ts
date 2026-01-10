import { Transloadit } from "transloadit";

// =============================================================================
// TRANSLOADIT MEDIA STORAGE PROVIDER
// =============================================================================
// Uploads generated images/videos/audio to Transloadit CDN for persistent storage
// Returns permanent URLs that won't expire (unlike fal.ai temporary URLs)
//
// Uses Transloadit's temporary storage (files available for 24h on their CDN)
// For permanent storage, configure S3/GCS credentials in Transloadit dashboard

let transloaditClient: Transloadit | null = null;

function getClient(): Transloadit {
  if (!transloaditClient) {
    const authKey = process.env.TRANSLOADIT_AUTH_KEY;
    const authSecret = process.env.TRANSLOADIT_AUTH_SECRET;
    
    if (!authKey || !authSecret) {
      throw new Error("Transloadit credentials not configured. Set TRANSLOADIT_AUTH_KEY and TRANSLOADIT_AUTH_SECRET.");
    }
    
    transloaditClient = new Transloadit({
      authKey,
      authSecret,
    });
  }
  return transloaditClient;
}

export function isTransloaditConfigured(): boolean {
  return Boolean(process.env.TRANSLOADIT_AUTH_KEY && process.env.TRANSLOADIT_AUTH_SECRET);
}

/**
 * Upload a file from URL to Transloadit CDN
 * Returns the CDN URL (temporary storage - 24h availability)
 */
export async function uploadFromUrl(
  url: string,
  options?: {
    filename?: string;
    type?: "image" | "video" | "audio";
  }
): Promise<{ url: string; mimeType?: string }> {
  // If it's already a Transloadit URL, return as-is
  if (url.includes("transloadit.com") || url.includes("tlcdn.com") || url.includes("tmp.transloadit")) {
    return { url };
  }
  
  // If Transloadit is not configured, return original URL
  if (!isTransloaditConfigured()) {
    console.warn("[Transloadit] Not configured, returning original URL");
    return { url };
  }

  try {
    const client = getClient();
    console.log(`[Transloadit] Uploading from URL: ${url.slice(0, 80)}...`);
    
    // Create assembly to import from URL (uses Transloadit's temporary storage)
    const assembly = await client.createAssembly({
      params: {
        steps: {
          // Import from URL
          imported: {
            robot: "/http/import",
            url: url,
            ignore_errors: ["meta"],
          },
          // Export to temporary storage (available on Transloadit CDN)
          exported: {
            robot: "/file/filter",
            use: "imported",
            accepts: [["\${file.mime}", "regex", ".*"]],
          },
        },
      },
      waitForCompletion: true,
    });

    console.log(`[Transloadit] Assembly completed: ${assembly.ok}`);

    // Get the result URL from imported step
    if (assembly.results?.imported?.[0]?.ssl_url) {
      const resultUrl = assembly.results.imported[0].ssl_url;
      console.log(`[Transloadit] Got URL: ${resultUrl.slice(0, 80)}...`);
      return {
        url: resultUrl,
        mimeType: assembly.results.imported[0].mime ?? undefined,
      };
    }

    // Check exported results
    if (assembly.results?.exported?.[0]?.ssl_url) {
      return {
        url: assembly.results.exported[0].ssl_url,
        mimeType: assembly.results.exported[0].mime ?? undefined,
      };
    }

    console.warn("[Transloadit] No result URL, returning original");
    return { url };
  } catch (error) {
    console.error("[Transloadit] Upload failed:", error);
    return { url }; // Return original URL on failure
  }
}

/**
 * Upload a base64 data URL to Transloadit CDN
 * Returns the CDN URL
 */
export async function uploadFromBase64(
  dataUrl: string,
  options?: {
    filename?: string;
    type?: "image" | "video" | "audio";
  }
): Promise<{ url: string; mimeType?: string }> {
  // If Transloadit is not configured, return original
  if (!isTransloaditConfigured()) {
    console.warn("[Transloadit] Not configured, returning original data URL");
    return { url: dataUrl };
  }

  // Check if it's actually a data URL
  if (!dataUrl.startsWith("data:")) {
    return uploadFromUrl(dataUrl, options);
  }

  try {
    const client = getClient();
    
    // Parse the data URL
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      console.warn("[Transloadit] Invalid data URL format");
      return { url: dataUrl };
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    
    // Detect type from mime
    const type = options?.type || (
      mimeType.startsWith("image/") ? "image" :
      mimeType.startsWith("video/") ? "video" :
      mimeType.startsWith("audio/") ? "audio" : "file"
    );
    
    // Get file extension from mime type
    const ext = mimeType.split("/")[1]?.split(";")[0] || "bin";
    const filename = options?.filename || `${Date.now()}.${ext}`;
    
    console.log(`[Transloadit] Uploading base64 ${type}: ${filename} (${buffer.length} bytes)`);
    
    // Write buffer to temp file (Transloadit SDK requires file paths)
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const { writeFile, unlink } = await import("fs/promises");
    const { randomUUID } = await import("crypto");
    
    const tempPath = join(tmpdir(), `transloadit-${randomUUID()}.${ext}`);
    await writeFile(tempPath, buffer);
    
    try {
      // Create assembly with file path
      const assembly = await client.createAssembly({
        files: {
          file: tempPath,
        },
        params: {
          steps: {
            // Just pass through - file will be available on Transloadit CDN
            passthrough: {
              robot: "/file/filter",
              use: ":original",
              accepts: [["\${file.mime}", "regex", ".*"]],
            },
          },
        },
        waitForCompletion: true,
      });

      console.log(`[Transloadit] Assembly completed: ${assembly.ok}`);

      // Get result from passthrough or uploads
      if (assembly.results?.passthrough?.[0]?.ssl_url) {
        const resultUrl = assembly.results.passthrough[0].ssl_url;
        console.log(`[Transloadit] Got URL: ${resultUrl.slice(0, 80)}...`);
        return {
          url: resultUrl,
          mimeType,
        };
      }

      // Check uploads directly
      if (assembly.uploads?.[0]?.ssl_url) {
        return {
          url: assembly.uploads[0].ssl_url,
          mimeType,
        };
      }

      console.warn("[Transloadit] No stored URL, returning original");
      return { url: dataUrl };
    } finally {
      // Clean up temp file
      await unlink(tempPath).catch(() => {});
    }
  } catch (error) {
    console.error("[Transloadit] Base64 upload failed:", error);
    return { url: dataUrl };
  }
}

/**
 * Upload media (auto-detect URL vs base64)
 */
export async function uploadMedia(
  urlOrData: string,
  options?: {
    filename?: string;
    type?: "image" | "video" | "audio";
  }
): Promise<{ url: string; mimeType?: string }> {
  if (urlOrData.startsWith("data:")) {
    return uploadFromBase64(urlOrData, options);
  }
  return uploadFromUrl(urlOrData, options);
}

/**
 * Process node output and upload any media to Transloadit
 */
export async function persistNodeOutput(output: unknown): Promise<unknown> {
  if (!output || typeof output !== "object") return output;
  
  const obj = output as Record<string, unknown>;
  const type = obj.type as string | undefined;
  
  // Handle image output
  if (type === "image" && obj.image) {
    const imageData = obj.image as { url?: string };
    if (imageData.url) {
      const uploaded = await uploadMedia(imageData.url, { type: "image" });
      return {
        ...obj,
        image: { ...imageData, url: uploaded.url },
      };
    }
  }
  
  // Handle video output
  if (type === "video" && obj.video) {
    const videoData = obj.video as { url?: string };
    if (videoData.url) {
      const uploaded = await uploadMedia(videoData.url, { type: "video" });
      return {
        ...obj,
        video: { ...videoData, url: uploaded.url },
      };
    }
  }
  
  // Handle audio output
  if (type === "audio" && obj.audio) {
    const audioData = obj.audio as { url?: string };
    if (audioData.url) {
      const uploaded = await uploadMedia(audioData.url, { type: "audio" });
      return {
        ...obj,
        audio: { ...audioData, url: uploaded.url },
      };
    }
  }
  
  return output;
}

function detectMediaType(url: string): "image" | "video" | "audio" | "file" {
  const lower = url.toLowerCase();
  if (lower.includes("image") || /\.(jpg|jpeg|png|gif|webp|svg)/.test(lower)) {
    return "image";
  }
  if (lower.includes("video") || /\.(mp4|webm|mov|avi)/.test(lower)) {
    return "video";
  }
  if (lower.includes("audio") || /\.(mp3|wav|ogg|m4a)/.test(lower)) {
    return "audio";
  }
  return "file";
}

export default {
  isConfigured: isTransloaditConfigured,
  uploadFromUrl,
  uploadFromBase64,
  uploadMedia,
  persistNodeOutput,
};
