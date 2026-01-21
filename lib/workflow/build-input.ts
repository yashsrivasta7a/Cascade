import type { Edge, Node } from "reactflow";
import { type AINodeType } from "@/types/nodes";
import {
  getIncomingTextForContext,
  getIncomingTextForPrompt,
  getIncomingMedia,
  getIncomingSettingsFromLLM,
  type OutputByNode,
} from "./input-builder";
import { getNodeDefaults } from "./node-utils";

// =============================================================================
// TYPES
// =============================================================================

// Metadata fields to filter out from node data
const METADATA_FIELDS = new Set([
  "_inheritedFrom", 
  "incomingFrom", 
  "_isUploading",
  "advancedOpen",
  "status",
  "error",
  "progress",
]);

// Numeric fields that need type validation
const NUMERIC_FIELDS = new Set([
  "xPercent", "yPercent", "widthPercent", "heightPercent",
  "temperature", "maxTokens", "seed", "numInferenceSteps", "guidanceScale",
  "stability", "clarity", "transitionDuration",
  "topP", "topK", "frequencyPenalty", "presencePenalty",
]);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Normalize asset to {url: string} format
 */
function normalizeAsset(v: unknown): { url: string } | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return { url: v };
  if (typeof v === "object" && v !== null && "url" in v) {
    return v as { url: string };
  }
  return undefined;
}

/**
 * Ensure value is a number
 */
function ensureNumber(val: unknown, defaultVal: number): number {
  if (typeof val === "number") return val;
  if (typeof val === "string" && !isNaN(Number(val))) return Number(val);
  return defaultVal;
}

/**
 * Sanitize node data by removing metadata and validating types
 */
function sanitizeNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Skip metadata fields
    if (METADATA_FIELDS.has(key)) continue;
    if (key.startsWith("_")) continue;
    
    // Handle numeric fields
    if (NUMERIC_FIELDS.has(key)) {
      if (typeof value === "number") {
        result[key] = value;
      } else if (typeof value === "string" && !isNaN(Number(value))) {
        result[key] = Number(value);
      } else if (typeof value === "object" && value !== null) {
        const objValue = (value as Record<string, unknown>).value;
        if (typeof objValue === "number") {
          result[key] = objValue;
        }
      }
      continue;
    }
    
    // Skip metadata-like objects
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      if (obj.sourceNodeId !== undefined || obj.settings !== undefined || obj.fullInheritance !== undefined) {
        continue;
      }
    }
    
    result[key] = value;
  }
  
  return result;
}

// =============================================================================
// MEDIA HELPERS
// =============================================================================

/**
 * Get media from parent node results
 */
function getMediaFromParentResults(
  edges: Edge[],
  nodes: Node[],
  nodeId: string,
  mediaType: "video" | "audio" | "image"
): string | undefined {
  const incoming = edges.filter((e) => e.target === nodeId);
  
  for (const e of incoming) {
    const sourceNode = nodes.find((n) => n.id === e.source);
    if (!sourceNode) continue;
    
    const sourceData = sourceNode.data as Record<string, unknown>;
    const result = sourceData?.result as string | undefined;
    
    if (result && typeof result === "string" && result.length > 0) {
      const sourceType = sourceNode.type;
      const sourceMediaType = sourceData?.mediaType as string | undefined;
      
      if (mediaType === "video" && isVideoSource(sourceType, sourceMediaType)) {
        return result;
      }
      if (mediaType === "audio" && isAudioSource(sourceType, sourceMediaType)) {
        return result;
      }
      if (mediaType === "image" && isImageSource(sourceType, sourceMediaType)) {
        return result;
      }
    }
  }
  return undefined;
}

function isVideoSource(sourceType: string | undefined, sourceMediaType: string | undefined): boolean {
  return sourceType?.includes("video") || 
    sourceType === "merge-audio-video" || 
    sourceType === "seedance" || 
    sourceType === "lipsync" || 
    sourceType === "merge-videos" || 
    (sourceType === "input" && sourceMediaType === "video");
}

function isAudioSource(sourceType: string | undefined, sourceMediaType: string | undefined): boolean {
  return sourceType?.includes("audio") || 
    sourceType === "elevenlabs" || 
    sourceType === "extract-audio" || 
    (sourceType === "input" && sourceMediaType === "audio");
}

function isImageSource(sourceType: string | undefined, sourceMediaType: string | undefined): boolean {
  return sourceType?.includes("image") || 
    sourceType === "seedream" || 
    sourceType === "seedvr" || 
    sourceType === "crop-image" || 
    (sourceType === "input" && sourceMediaType === "image");
}

/**
 * Get media from parent nodes (alternative implementation)
 */
function getMediaFromParents(
  edges: Edge[],
  nodes: Node[],
  nodeId: string,
  mediaType: "video" | "audio" | "image"
): string | undefined {
  const incoming = edges.filter((e) => e.target === nodeId);
  
  for (const e of incoming) {
    const sourceNode = nodes.find((n) => n.id === e.source);
    const sourceData = sourceNode?.data as Record<string, unknown> | undefined;
    const result = sourceData?.result as string | undefined;
    
    if (result && typeof result === "string") {
      const sourceType = sourceNode?.type;
      const srcMediaType = sourceData?.mediaType as string | undefined;
      
      if (mediaType === "video" && (
        sourceType === "seedance" || 
        sourceType === "lipsync" || 
        sourceType === "merge-videos" || 
        sourceType === "merge-audio-video" || 
        (sourceType === "input" && srcMediaType === "video") || 
        e.targetHandle === "video" || 
        e.sourceHandle === "video"
      )) {
        return result;
      }
      
      if (mediaType === "audio" && (
        sourceType === "elevenlabs" || 
        sourceType === "extract-audio" || 
        (sourceType === "input" && srcMediaType === "audio") || 
        e.targetHandle === "audio" || 
        e.sourceHandle === "audio"
      )) {
        return result;
      }
      
      if (mediaType === "image" && (
        sourceType === "seedream" || 
        sourceType === "seedvr" || 
        sourceType === "crop-image" || 
        (sourceType === "input" && srcMediaType === "image") || 
        e.targetHandle?.includes("image") || 
        e.sourceHandle?.includes("image")
      )) {
        return result;
      }
    }
  }
  return undefined;
}

// =============================================================================
// INPUT GETTERS
// =============================================================================

function createMediaGetters(
  edges: Edge[],
  outputs: OutputByNode,
  nodes: Node[],
  nodeId: string,
  data: Record<string, unknown>
) {
  const getVideoInput = (handleId?: string, dataField: string = "inputVideo") => {
    const connected = getIncomingMedia(edges, outputs, nodeId, handleId);
    if (connected) return { url: connected };
    
    const parentResult = getMediaFromParentResults(edges, nodes, nodeId, "video");
    if (parentResult) return { url: parentResult };
    
    return normalizeAsset(data[dataField]);
  };

  const getAudioInput = (handleId?: string, dataField: string = "inputAudio") => {
    const connected = getIncomingMedia(edges, outputs, nodeId, handleId);
    if (connected) return { url: connected };
    
    const parentResult = getMediaFromParentResults(edges, nodes, nodeId, "audio");
    if (parentResult) return { url: parentResult };
    
    return normalizeAsset(data[dataField]);
  };

  const getImageInput = (handleId?: string, dataField: string = "inputImage") => {
    const connected = getIncomingMedia(edges, outputs, nodeId, handleId);
    if (connected) return { url: connected };
    
    const parentResult = getMediaFromParentResults(edges, nodes, nodeId, "image");
    if (parentResult) return { url: parentResult };
    
    return normalizeAsset(data[dataField]);
  };

  return { getVideoInput, getAudioInput, getImageInput };
}

// =============================================================================
// MAIN BUILD FUNCTION
// =============================================================================

/**
 * Build input for a node based on its type, connections, and data
 */
export function buildNodeInput(
  node: Node, 
  edges: Edge[], 
  outputs: OutputByNode, 
  nodes: Node[]
): Record<string, unknown> {
  const type = node.type as AINodeType;
  const data = (node.data ?? {}) as Record<string, unknown>;

  console.log(`[buildNodeInput] === Building input for ${node.id} (${type}) ===`);

  // Get incoming text for prompt and context
  const incomingPrompt = getIncomingTextForPrompt(edges, outputs, node.id);
  const incomingContext = getIncomingTextForContext(edges, outputs, node.id, nodes);

  const promptValue = incomingPrompt || data.prompt;
  const contextValue = incomingContext || (typeof data.context === 'string' && (data.context as string).trim() ? data.context : undefined);

  // Sanitize data
  const sanitizedData = sanitizeNodeData(data);

  // Get parsed settings from connected LLM nodes
  const llmSettings = getIncomingSettingsFromLLM(edges, outputs, nodes, node.id, type);
  
  if (llmSettings.errors.length > 0) {
    for (const err of llmSettings.errors) {
      console.error(`[buildNodeInput] LLM parse error for ${node.id}.${err.handle}: ${err.error}`);
    }
  }

  const base = {
    ...sanitizedData,
    ...llmSettings.values,
    prompt: promptValue,
    context: contextValue,
  };
  
  if (typeof base.referenceImages === "string") {
    base.referenceImages = [base.referenceImages];
  }

  // Get config defaults and merge
  const configDefaults = getNodeDefaults(type);
  const withDefaults = { ...configDefaults, ...base };

  // Create media getters
  const { getVideoInput, getAudioInput, getImageInput } = createMediaGetters(edges, outputs, nodes, node.id, data);

  // Build type-specific input
  return buildTypeSpecificInput(
    type, 
    withDefaults, 
    data, 
    edges, 
    outputs, 
    nodes, 
    node.id,
    { getVideoInput, getAudioInput, getImageInput, getMediaFromParents, getMediaFromParentResults }
  );
}

// =============================================================================
// TYPE-SPECIFIC INPUT BUILDERS
// =============================================================================

function buildTypeSpecificInput(
  type: AINodeType,
  withDefaults: Record<string, unknown>,
  data: Record<string, unknown>,
  edges: Edge[],
  outputs: OutputByNode,
  nodes: Node[],
  nodeId: string,
  helpers: {
    getVideoInput: (handleId?: string, dataField?: string) => { url: string } | undefined;
    getAudioInput: (handleId?: string, dataField?: string) => { url: string } | undefined;
    getImageInput: (handleId?: string, dataField?: string) => { url: string } | undefined;
    getMediaFromParents: typeof getMediaFromParents;
    getMediaFromParentResults: typeof getMediaFromParentResults;
  }
): Record<string, unknown> {
  const { getVideoInput, getAudioInput, getImageInput, getMediaFromParents: getParents, getMediaFromParentResults: getParentResults } = helpers;

  switch (type) {
    case "seedvr":
      return { 
        ...withDefaults, 
        image: getImageInput("image", "inputImage") || normalizeAsset(withDefaults.image),
      };

    case "crop-image":
      return buildCropImageInput(withDefaults, getImageInput);

    case "extract-audio":
      return buildExtractAudioInput(withDefaults, data, edges, outputs, nodes, nodeId, getParents, getParentResults);

    case "merge-videos":
      return buildMergeVideosInput(withDefaults, data, edges, outputs, nodes, nodeId);

    case "merge-audio-video":
    case "lipsync":
      return buildAudioVideoInput(type, withDefaults, data, edges, outputs, nodes, nodeId, getParents, getParentResults);

    case "seedance":
      return { 
        ...withDefaults, 
        frame: getImageInput("frame", "frame") || normalizeAsset(withDefaults.frame),
      };

    case "openrouter":
      return buildOpenRouterInput(withDefaults, data, edges, outputs, nodes, nodeId, getParents);

    case "seedream":
      return buildSeedreamInput(withDefaults, edges, outputs, nodes, nodeId, getParents);

    case "elevenlabs":
      return { ...withDefaults };

    default:
      return withDefaults;
  }
}

function buildCropImageInput(
  withDefaults: Record<string, unknown>,
  getImageInput: (handleId?: string, dataField?: string) => { url: string } | undefined
): Record<string, unknown> {
  return {
    ...withDefaults,
    image: getImageInput("image", "image") || normalizeAsset(withDefaults.image),
    xPercent: ensureNumber(withDefaults.xPercent, 0),
    yPercent: ensureNumber(withDefaults.yPercent, 0),
    widthPercent: ensureNumber(withDefaults.widthPercent, 100),
    heightPercent: ensureNumber(withDefaults.heightPercent, 100),
  };
}

function buildExtractAudioInput(
  withDefaults: Record<string, unknown>,
  data: Record<string, unknown>,
  edges: Edge[],
  outputs: OutputByNode,
  nodes: Node[],
  nodeId: string,
  getParents: typeof getMediaFromParents,
  getParentResults: typeof getMediaFromParentResults
): Record<string, unknown> {
  let videoUrl: string | undefined;
  
  // Try multiple strategies
  videoUrl = getIncomingMedia(edges, outputs, nodeId, "video");
  if (!videoUrl) videoUrl = getParentResults(edges, nodes, nodeId, "video");
  if (!videoUrl) videoUrl = getParents(edges, nodes, nodeId, "video");
  
  // Check all incoming edges
  if (!videoUrl) {
    const incoming = edges.filter((e) => e.target === nodeId);
    for (const e of incoming) {
      const sourceNode = nodes.find((n) => n.id === e.source);
      if (sourceNode) {
        const sourceData = sourceNode.data as Record<string, unknown>;
        const result = sourceData?.result as string | undefined;
        if (result && typeof result === "string" && result.startsWith("http")) {
          videoUrl = result;
          break;
        }
      }
    }
  }
  
  // Check node's own data
  if (!videoUrl) {
    const nodeVideo = data.video;
    if (typeof nodeVideo === "string" && nodeVideo.startsWith("http")) {
      videoUrl = nodeVideo;
    } else if (nodeVideo && typeof nodeVideo === "object" && (nodeVideo as Record<string, unknown>).url) {
      videoUrl = (nodeVideo as Record<string, unknown>).url as string;
    }
  }
  
  const validFormats = ["mp3", "wav", "aac", "ogg"];
  const format = validFormats.includes(withDefaults.format as string) 
    ? withDefaults.format 
    : (validFormats.includes(data.format as string) ? data.format : "mp3");
  
  return { 
    ...withDefaults, 
    video: videoUrl ? { url: videoUrl } : undefined,
    format,
  };
}

function buildMergeVideosInput(
  withDefaults: Record<string, unknown>,
  data: Record<string, unknown>,
  edges: Edge[],
  outputs: OutputByNode,
  nodes: Node[],
  nodeId: string
): Record<string, unknown> {
  const video1Connected = getIncomingMedia(edges, outputs, nodeId, "video1");
  const video2Connected = getIncomingMedia(edges, outputs, nodeId, "video2");
  
  let video1Result = video1Connected;
  let video2Result = video2Connected;
  
  if (!video1Result || !video2Result) {
    const incoming = edges.filter((e) => e.target === nodeId);
    for (const e of incoming) {
      const sourceNode = nodes.find((n) => n.id === e.source);
      const sourceData = sourceNode?.data as Record<string, unknown> | undefined;
      const result = sourceData?.result as string | undefined;
      if (result && typeof result === "string") {
        if (e.targetHandle === "video1" || (!video1Result && !e.targetHandle)) {
          video1Result = result;
        } else if (e.targetHandle === "video2" || (!video2Result && !e.targetHandle)) {
          video2Result = result;
        }
      }
    }
  }
  
  return {
    ...withDefaults,
    video1: video1Result ? { url: video1Result } : normalizeAsset(data.video1),
    video2: video2Result ? { url: video2Result } : normalizeAsset(data.video2),
  };
}

function buildAudioVideoInput(
  type: AINodeType,
  withDefaults: Record<string, unknown>,
  data: Record<string, unknown>,
  edges: Edge[],
  outputs: OutputByNode,
  nodes: Node[],
  nodeId: string,
  getParents: typeof getMediaFromParents,
  getParentResults: typeof getMediaFromParentResults
): Record<string, unknown> {
  let videoUrl: string | undefined;
  videoUrl = getIncomingMedia(edges, outputs, nodeId, "video");
  if (!videoUrl) videoUrl = getParentResults(edges, nodes, nodeId, "video");
  if (!videoUrl) videoUrl = getParents(edges, nodes, nodeId, "video");
  if (!videoUrl && data.video) {
    videoUrl = typeof data.video === "string" ? data.video : (data.video as Record<string, unknown>)?.url as string;
  }
  
  let audioUrl: string | undefined;
  audioUrl = getIncomingMedia(edges, outputs, nodeId, "audio");
  if (!audioUrl) audioUrl = getParentResults(edges, nodes, nodeId, "audio");
  if (!audioUrl) audioUrl = getParents(edges, nodes, nodeId, "audio");
  if (!audioUrl && data.audio) {
    audioUrl = typeof data.audio === "string" ? data.audio : (data.audio as Record<string, unknown>)?.url as string;
  }
  
  console.log(`[buildNodeInput:${type}] video: ${videoUrl?.slice(0, 50) || 'none'}, audio: ${audioUrl?.slice(0, 50) || 'none'}`);
  
  return {
    ...withDefaults,
    video: videoUrl ? { url: videoUrl } : undefined,
    audio: audioUrl ? { url: audioUrl } : undefined,
  };
}

function buildOpenRouterInput(
  withDefaults: Record<string, unknown>,
  data: Record<string, unknown>,
  edges: Edge[],
  outputs: OutputByNode,
  nodes: Node[],
  nodeId: string,
  getParents: typeof getMediaFromParents
): Record<string, unknown> {
  const imageConnected = getIncomingMedia(edges, outputs, nodeId, "inputImage") || getParents(edges, nodes, nodeId, "image");
  const imageUrl = imageConnected || data.inputImage;
  
  return {
    ...withDefaults,
    imageUrl,
  };
}

function buildSeedreamInput(
  withDefaults: Record<string, unknown>,
  edges: Edge[],
  outputs: OutputByNode,
  nodes: Node[],
  nodeId: string,
  getParents: typeof getMediaFromParents
): Record<string, unknown> {
  const refImageConnected = getIncomingMedia(edges, outputs, nodeId, "referenceImages") || getParents(edges, nodes, nodeId, "image");
  let referenceImages = withDefaults.referenceImages;
  if (refImageConnected) {
    referenceImages = [refImageConnected];
  }
  
  return {
    ...withDefaults,
    referenceImages,
  };
}
