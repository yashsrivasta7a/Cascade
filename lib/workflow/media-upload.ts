// =============================================================================
// UPLOAD LARGE MEDIA TO CDN BEFORE API CALLS
// =============================================================================
// Vercel has a ~4MB body limit. Base64 media can be 10MB+.
// We upload to CDN first, then send only the URL to the API.

export async function uploadMediaToCDN(dataUrl: string, type: "video" | "audio" | "image"): Promise<string> {
  // Only upload base64 data URLs
  if (!dataUrl.startsWith("data:")) {
    return dataUrl;
  }
  
  // Check size - only upload if > 1MB (to avoid unnecessary API calls)
  if (dataUrl.length < 1_000_000) {
    return dataUrl;
  }
  
  console.log(`[uploadMediaToCDN] Uploading ${type} (${(dataUrl.length / 1024 / 1024).toFixed(2)}MB) to CDN...`);
  
  try {
    const response = await fetch("/api/media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, type }),
    });
    
    if (response.ok) {
      const { url } = await response.json();
      console.log(`[uploadMediaToCDN] ${type} uploaded to CDN: ${url.slice(0, 80)}...`);
      return url;
    } else {
      console.warn(`[uploadMediaToCDN] CDN upload failed (${response.status}), keeping base64`);
      return dataUrl;
    }
  } catch (error) {
    console.warn("[uploadMediaToCDN] CDN upload error:", error);
    return dataUrl;
  }
}

export async function preprocessInputForAPI(input: unknown): Promise<unknown> {
  if (!input || typeof input !== "object") return input;
  
  const obj = input as Record<string, unknown>;
  const result: Record<string, unknown> = { ...obj };
  
  // Fields that might contain large media
  const mediaFields: Record<string, "video" | "audio" | "image"> = {
    video: "video",
    audio: "audio",
    image: "image",
    inputVideo: "video",
    inputAudio: "audio",
    inputImage: "image",
    video1: "video",
    video2: "video",
  };
  
  for (const [field, type] of Object.entries(mediaFields)) {
    const value = obj[field];
    
    // Handle string URLs
    if (typeof value === "string" && value.startsWith("data:") && value.length > 1_000_000) {
      result[field] = await uploadMediaToCDN(value, type);
    }
    
    // Handle object with url property
    if (typeof value === "object" && value !== null && "url" in value) {
      const urlObj = value as { url: string; mimeType?: string };
      if (typeof urlObj.url === "string" && urlObj.url.startsWith("data:") && urlObj.url.length > 1_000_000) {
        const uploadedUrl = await uploadMediaToCDN(urlObj.url, type);
        result[field] = { ...urlObj, url: uploadedUrl };
      }
    }
  }
  
  return result;
}
