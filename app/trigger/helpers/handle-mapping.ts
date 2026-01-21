// Map handle IDs to schema field names
export const HANDLE_TO_SCHEMA_FIELD: Record<string, string> = {
  // Merge Videos - explicit mappings for video1/video2 handles
  "video1": "video1",
  "video2": "video2",
  "inputVideo1": "video1",
  "inputVideo2": "video2",
  "Video 1": "video1",
  "Video 2": "video2",
  // Common media inputs
  "inputImage": "image",
  "inputVideo": "video",
  "inputAudio": "audio",
  "inputFrame": "frame",
  // Merge Audio + Video
  "Video*": "video",
  "Audio*": "audio",
  // Extract Audio
  "videoInput": "video",
  "Video Input": "video",
  // Lipsync
  "audioInput": "audio",
  // Generic
  "video": "video",
  "audio": "audio",
  "image": "image",
  "frame": "frame",
  // Prompt/text inputs
  "prompt": "prompt",
  "text": "text",
  "context": "context",
};

// Map node data fields (like inputVideo1) to schema fields (like video1)
export const NODE_DATA_TO_SCHEMA: Record<string, string> = {
  "inputVideo1": "video1",
  "inputVideo2": "video2",
  "inputVideo": "video",
  "inputAudio": "audio",
  "inputImage": "image",
};

// Normalize URL string or object to AssetRef format { url: string, ... }
export function normalizeAsset(value: unknown): { url: string; mimeType?: string } | undefined {
  if (!value) return undefined;
  if (
    typeof value === "string" &&
    (value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:") ||
      value.startsWith("blob:"))
  ) {
    return { url: value };
  }
  if (typeof value === "object" && value !== null && "url" in value) {
    return value as { url: string; mimeType?: string };
  }
  return undefined;
}

// Infer output type from node type
export function inferOutputType(nodeType: string, nodeData?: Record<string, unknown>): "video" | "audio" | "image" | "text" {
  const videoNodes = ["seedance", "lipsync", "merge-videos", "merge-audio-video"];
  const audioNodes = ["elevenlabs", "extract-audio"];
  const imageNodes = ["seedream", "seedvr", "crop-image"];
  
  // Handle unified input node
  if (nodeType === "input" && nodeData?.mediaType) {
    return nodeData.mediaType as "video" | "audio" | "image";
  }
  
  if (videoNodes.includes(nodeType)) return "video";
  if (audioNodes.includes(nodeType)) return "audio";
  if (imageNodes.includes(nodeType)) return "image";
  return "text";
}
