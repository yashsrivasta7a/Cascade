import type { NodeInfo, NodeDetail } from "../schemas/index.js";

// =============================================================================
// NODE DEFINITIONS
// Copied from Cascade types/nodes.ts for MCP server use
// =============================================================================

// Data types for inputs/outputs
type DataType = "text" | "image" | "video" | "audio" | "any" | "prompt" | "negative" | "seed" | "aspectRatio" | "duration" | "model" | "temperature" | "number" | "boolean";

interface NodeDefinition {
  type: string;
  category: string;
  label: string;
  description: string;
  provider: string;
  action: string;
  inputs: { type: DataType; label: string }[];
  outputs: { type: DataType; label: string }[];
  estimatedCost: number;
  isUtility: boolean;
  estimatedTime?: string;
  features?: string[];
  models?: string[];
}

// =============================================================================
// NODE DEFINITIONS DATA
// =============================================================================

export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
  // ───────────────────────────────────────────────────────────────────────────
  // IMAGE NODES
  // ───────────────────────────────────────────────────────────────────────────
  "seedream": {
    type: "seedream",
    category: "image",
    label: "Seedream 4.5",
    description: "High-quality text-to-image generation with advanced prompt understanding",
    provider: "fal.ai",
    action: "Text → Image",
    inputs: [
      { type: "prompt", label: "Prompt" },
      { type: "negative", label: "Negative Prompt" },
      { type: "aspectRatio", label: "Aspect Ratio" },
      { type: "image", label: "Reference Images" },
      { type: "seed", label: "Seed" },
      { type: "number", label: "Steps" },
      { type: "number", label: "Guidance" },
      { type: "boolean", label: "Prompt Enhancer" },
    ],
    outputs: [{ type: "image", label: "Generated Image" }],
    estimatedCost: 40000,
    isUtility: false,
    estimatedTime: "~10s",
    features: ["Negative Prompt", "Prompt Enhancer", "Multi-Reference (up to 14)"],
  },

  "seedvr": {
    type: "seedvr",
    category: "image",
    label: "SeedVR 2",
    description: "AI-powered image upscaling with face enhancement",
    provider: "fal.ai",
    action: "Image → Image",
    inputs: [
      { type: "image", label: "Input Image" },
      { type: "aspectRatio", label: "Scale" },
      { type: "boolean", label: "Enhance Faces" },
    ],
    outputs: [{ type: "image", label: "Upscaled Image" }],
    estimatedCost: 2000,
    isUtility: false,
    estimatedTime: "~5s",
    features: ["2x/4x Scale", "Face Enhancement"],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // VIDEO NODES
  // ───────────────────────────────────────────────────────────────────────────
  "seedance": {
    type: "seedance",
    category: "video",
    label: "Seedance 1.5",
    description: "Generate cinematic videos from text prompts or animate still images",
    provider: "fal.ai",
    action: "Text → Video",
    inputs: [
      { type: "prompt", label: "Prompt" },
      { type: "image", label: "Start Frame" },
      { type: "duration", label: "Duration" },
      { type: "aspectRatio", label: "Aspect Ratio" },
      { type: "seed", label: "Seed" },
    ],
    outputs: [{ type: "video", label: "Generated Video" }],
    estimatedCost: 260000,
    isUtility: false,
    estimatedTime: "~45s",
    features: ["4s/8s/16s Duration", "Image-to-Video", "Motion Control"],
  },

  "lipsync": {
    type: "lipsync",
    category: "video",
    label: "Sync Lipsync",
    description: "AI-powered lip synchronization for video with audio",
    provider: "fal.ai",
    action: "Video + Audio → Video",
    inputs: [
      { type: "video", label: "Input Video" },
      { type: "audio", label: "Input Audio" },
      { type: "model", label: "Model" },
    ],
    outputs: [{ type: "video", label: "Synced Video" }],
    estimatedCost: 100000,
    isUtility: false,
    estimatedTime: "~30s",
    features: ["sync-1.5", "sync-1.6-beta"],
    models: ["sync-1.5", "sync-1.6-beta"],
  },

  "merge-audio-video": {
    type: "merge-audio-video",
    category: "video",
    label: "Merge Audio + Video",
    description: "Combine audio and video tracks into a single file",
    provider: "transloadit",
    action: "Video + Audio → Video",
    inputs: [
      { type: "video", label: "Video" },
      { type: "audio", label: "Audio" },
      { type: "boolean", label: "Replace Audio" },
    ],
    outputs: [{ type: "video", label: "Combined Video" }],
    estimatedCost: 5000,
    isUtility: true,
    estimatedTime: "~5s",
    features: ["Replace Audio", "Mix Audio"],
  },

  "merge-videos": {
    type: "merge-videos",
    category: "video",
    label: "Merge Videos",
    description: "Concatenate two video clips with optional transitions",
    provider: "transloadit",
    action: "Video + Video → Video",
    inputs: [
      { type: "video", label: "Video 1" },
      { type: "video", label: "Video 2" },
      { type: "model", label: "Transition" },
      { type: "duration", label: "Transition Duration" },
    ],
    outputs: [{ type: "video", label: "Merged Video" }],
    estimatedCost: 10000,
    isUtility: true,
    estimatedTime: "~10s",
    features: ["None", "Fade", "Dissolve"],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // AUDIO NODES
  // ───────────────────────────────────────────────────────────────────────────
  "elevenlabs": {
    type: "elevenlabs",
    category: "audio",
    label: "ElevenLabs V3",
    description: "Ultra-realistic text-to-speech with emotion control",
    provider: "fal.ai",
    action: "Text → Audio",
    inputs: [
      { type: "text", label: "Script" },
      { type: "model", label: "Voice" },
      { type: "number", label: "Stability" },
      { type: "number", label: "Clarity" },
    ],
    outputs: [{ type: "audio", label: "Voice Audio" }],
    estimatedCost: 50000,
    isUtility: false,
    estimatedTime: "~3s",
    features: ["50+ Voices", "Stability Control", "Clarity Control"],
    models: ["Rachel", "Domi", "Bella", "Antoni", "Elli", "Josh", "Arnold", "Adam", "Sam"],
  },

  "extract-audio": {
    type: "extract-audio",
    category: "audio",
    label: "Extract Audio",
    description: "Extract audio track from video file",
    provider: "transloadit",
    action: "Video → Audio",
    inputs: [
      { type: "video", label: "Video" },
      { type: "model", label: "Format" },
      { type: "model", label: "Bitrate" },
      { type: "model", label: "Sample Rate" },
      { type: "model", label: "Channels" },
      { type: "boolean", label: "Normalize" },
    ],
    outputs: [{ type: "audio", label: "Extracted Audio" }],
    estimatedCost: 5000,
    isUtility: true,
    estimatedTime: "~5s",
    features: ["MP3", "WAV", "AAC", "OGG"],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // LLM NODES
  // ───────────────────────────────────────────────────────────────────────────
  "openrouter": {
    type: "openrouter",
    category: "llm",
    label: "OpenRouter LLM",
    description: "Access GPT-4, Claude, Gemini and more through a unified API",
    provider: "OpenRouter",
    action: "Text → Text",
    inputs: [
      { type: "prompt", label: "Prompt" },
      { type: "prompt", label: "System Prompt" },
      { type: "model", label: "Model" },
      { type: "image", label: "Image (Vision)" },
      { type: "temperature", label: "Temperature" },
      { type: "number", label: "Max Tokens" },
    ],
    outputs: [{ type: "text", label: "Response" }],
    estimatedCost: 50000,
    isUtility: false,
    estimatedTime: "~2s",
    features: ["Vision Input", "Streaming", "System Prompts"],
    models: ["GPT-4o Mini", "GPT-4o", "Claude 3.5 Sonnet", "Claude 3 Opus", "Gemini Pro 1.5", "Llama 3.1 70B"],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // UTILITY NODES
  // ───────────────────────────────────────────────────────────────────────────
  "crop-image": {
    type: "crop-image",
    category: "utility",
    label: "Crop Image",
    description: "Crop images using percentage-based coordinates",
    provider: "local",
    action: "Image → Image",
    inputs: [
      { type: "image", label: "Input Image" },
      { type: "number", label: "X %" },
      { type: "number", label: "Y %" },
      { type: "number", label: "Width %" },
      { type: "number", label: "Height %" },
    ],
    outputs: [{ type: "image", label: "Cropped Image" }],
    estimatedCost: 1000,
    isUtility: true,
    estimatedTime: "~1s",
    features: ["Percentage-based", "Preview"],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // I/O NODES
  // ───────────────────────────────────────────────────────────────────────────
  "input": {
    type: "input",
    category: "io",
    label: "Input",
    description: "Add input (text, image, video, or audio) to use in your workflow",
    provider: "local",
    action: "Input",
    inputs: [],
    outputs: [{ type: "any", label: "Output" }],
    estimatedCost: 0,
    isUtility: true,
    features: ["Text Input", "Upload", "Drag & Drop", "Preview", "Type Selection"],
  },

  "output": {
    type: "output",
    category: "io",
    label: "Output",
    description: "Display and download workflow output",
    provider: "local",
    action: "Output",
    inputs: [{ type: "any", label: "Input" }],
    outputs: [],
    estimatedCost: 0,
    isUtility: true,
    features: ["Auto-detect Type", "Preview", "Download"],
  },

  "image-input": {
    type: "image-input",
    category: "io",
    label: "Image Input",
    description: "Upload an image to use as workflow input",
    provider: "local",
    action: "Input",
    inputs: [],
    outputs: [{ type: "image", label: "Image" }],
    estimatedCost: 0,
    isUtility: true,
    features: ["Upload", "Drag & Drop", "Preview"],
  },

  "video-input": {
    type: "video-input",
    category: "io",
    label: "Video Input",
    description: "Upload a video to use as workflow input",
    provider: "local",
    action: "Input",
    inputs: [],
    outputs: [{ type: "video", label: "Video" }],
    estimatedCost: 0,
    isUtility: true,
    features: ["Upload", "Drag & Drop", "Preview"],
  },

  "audio-input": {
    type: "audio-input",
    category: "io",
    label: "Audio Input",
    description: "Upload audio to use as workflow input",
    provider: "local",
    action: "Input",
    inputs: [],
    outputs: [{ type: "audio", label: "Audio" }],
    estimatedCost: 0,
    isUtility: true,
    features: ["Upload", "Drag & Drop", "Playback"],
  },
};

// =============================================================================
// CATEGORY METADATA
// =============================================================================

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  image: { label: "Image", color: "emerald" },
  video: { label: "Video", color: "violet" },
  audio: { label: "Audio", color: "teal" },
  llm: { label: "LLM / Vision", color: "blue" },
  utility: { label: "Utility", color: "amber" },
  io: { label: "I/O", color: "zinc" },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all node info list
 */
export function getNodeInfoList(category?: string): NodeInfo[] {
  let nodes = Object.values(NODE_DEFINITIONS);
  
  if (category) {
    nodes = nodes.filter((node) => node.category === category);
  }
  
  return nodes.map((node) => ({
    type: node.type,
    label: node.label,
    description: node.description,
    category: node.category,
    provider: node.provider,
    action: node.action,
    estimatedCost: node.estimatedCost,
    inputs: node.inputs,
    outputs: node.outputs,
  }));
}

/**
 * Get detailed node info by type
 */
export function getNodeDetail(nodeType: string): NodeDetail | undefined {
  const node = NODE_DEFINITIONS[nodeType];
  if (!node) return undefined;
  
  return {
    type: node.type,
    label: node.label,
    description: node.description,
    category: node.category,
    provider: node.provider,
    action: node.action,
    estimatedCost: node.estimatedCost,
    inputs: node.inputs,
    outputs: node.outputs,
    estimatedTime: node.estimatedTime,
    features: node.features,
    models: node.models,
  };
}

/**
 * Get all categories
 */
export function getCategories(): string[] {
  return Object.keys(CATEGORY_META);
}

/**
 * Check if a node type exists
 */
export function isValidNodeType(nodeType: string): boolean {
  return nodeType in NODE_DEFINITIONS;
}

// =============================================================================
// OPTIMIZED LOOKUPS (for 1000+ node workflows)
// =============================================================================

// Pre-computed lookups for O(1) access
const NODE_BY_TYPE = new Map(Object.entries(NODE_DEFINITIONS));
const NODES_BY_CATEGORY = new Map<string, string[]>();
const NODE_OUTPUT_TYPES = new Map<string, string>();
const NODE_INPUT_TYPES = new Map<string, Set<string>>();

// Initialize lookup tables once at module load
(function initializeLookups() {
  for (const [type, def] of Object.entries(NODE_DEFINITIONS)) {
    // Group by category
    const catNodes = NODES_BY_CATEGORY.get(def.category) || [];
    catNodes.push(type);
    NODES_BY_CATEGORY.set(def.category, catNodes);
    
    // Output types
    if (def.outputs.length > 0) {
      NODE_OUTPUT_TYPES.set(type, def.outputs[0].type);
    }
    
    // Input types
    const inputTypes = new Set(def.inputs.map(i => i.type));
    NODE_INPUT_TYPES.set(type, inputTypes);
  }
})();

/**
 * O(1) lookup for node definition
 */
export function getNodeDef(nodeType: string): NodeDefinition | undefined {
  return NODE_BY_TYPE.get(nodeType);
}

/**
 * O(1) lookup for nodes in a category
 */
export function getNodesByCategory(category: string): string[] {
  return NODES_BY_CATEGORY.get(category) || [];
}

/**
 * O(1) lookup for node output type
 */
export function getNodeOutputType(nodeType: string): string {
  return NODE_OUTPUT_TYPES.get(nodeType) || "any";
}

/**
 * O(1) check if node accepts input type
 */
export function nodeAcceptsType(nodeType: string, inputType: string): boolean {
  const types = NODE_INPUT_TYPES.get(nodeType);
  if (!types) return false;
  return types.has(inputType) || types.has("any") || inputType === "any";
}

// =============================================================================
// REQUIRED CONFIGURATION PARAMETERS
// Define which parameters must be provided by the user for each node type
// =============================================================================

export interface RequiredConfigParam {
  name: string;
  type: "number" | "string" | "boolean";
  description: string;
  default?: number | string | boolean;
  min?: number;
  max?: number;
  options?: string[];
}

/**
 * Configuration parameters that MUST be provided by the user (no assumptions)
 * These are parameters where making assumptions would likely produce wrong results
 */
export const NODE_REQUIRED_CONFIG: Record<string, RequiredConfigParam[]> = {
  "crop-image": [
    { name: "xPercent", type: "number", description: "X position (% from left edge, 0-100)", min: 0, max: 100 },
    { name: "yPercent", type: "number", description: "Y position (% from top edge, 0-100)", min: 0, max: 100 },
    { name: "widthPercent", type: "number", description: "Width of crop area (% of original, 1-100)", min: 1, max: 100 },
    { name: "heightPercent", type: "number", description: "Height of crop area (% of original, 1-100)", min: 1, max: 100 },
  ],
  "seedvr": [
    { name: "scale", type: "string", description: "Upscale factor", options: ["2x", "4x"], default: "2x" },
  ],
  "merge-videos": [
    { name: "transition", type: "string", description: "Transition effect between videos", options: ["none", "fade", "dissolve"], default: "none" },
  ],
  "elevenlabs": [
    { name: "voice", type: "string", description: "Voice to use for speech", options: ["Rachel", "Domi", "Bella", "Antoni", "Elli", "Josh", "Arnold", "Adam", "Sam"] },
  ],
  "lipsync": [
    { name: "model", type: "string", description: "Lipsync model version", options: ["sync-1.5", "sync-1.6-beta"], default: "sync-1.5" },
  ],
};

/**
 * Get required configuration parameters for a node type
 * Returns empty array if no required config
 */
export function getRequiredConfig(nodeType: string): RequiredConfigParam[] {
  return NODE_REQUIRED_CONFIG[nodeType] || [];
}

/**
 * Check if a node type has required configuration that must be user-provided
 */
export function hasRequiredConfig(nodeType: string): boolean {
  const config = NODE_REQUIRED_CONFIG[nodeType];
  return config !== undefined && config.length > 0;
}

/**
 * Validate that all required config parameters are provided
 * Returns missing parameters or empty array if all provided
 */
export function getMissingConfig(
  nodeType: string, 
  providedConfig?: Record<string, unknown>
): RequiredConfigParam[] {
  const required = getRequiredConfig(nodeType);
  if (required.length === 0) return [];
  
  const missing: RequiredConfigParam[] = [];
  for (const param of required) {
    // Parameter is missing if:
    // 1. No config provided at all
    // 2. Parameter not in config
    // 3. Parameter has no default value (required from user)
    const hasValue = providedConfig && providedConfig[param.name] !== undefined;
    const hasDefault = param.default !== undefined;
    
    if (!hasValue && !hasDefault) {
      missing.push(param);
    }
  }
  
  return missing;
}
