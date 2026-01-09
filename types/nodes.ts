import { z } from "zod";

// ============================================================================
// NODE CATEGORIES & TYPES
// ============================================================================

export type NodeCategory = "image" | "video" | "audio" | "llm" | "utility";

export type AINodeType =
  // Image
  | "seedream"
  | "seedvr"
  // Video
  | "seedance"
  // Audio
  | "elevenlabs"
  // LLM / Vision
  | "openrouter"
  // Video + Audio
  | "lipsync"
  // Utility
  | "crop-image"
  | "merge-audio-video"
  | "merge-videos"
  | "extract-audio";

// ============================================================================
// DATA TYPES (What flows between nodes)
// ============================================================================

export type DataType = "text" | "image" | "video" | "audio" | "any" | "negative" | "number" | "boolean";

export const dataTypeColors: Record<DataType, { bg: string; border: string; text: string; solid: string; glow: string }> = {
  text: { bg: "bg-blue-500", border: "border-blue-400", text: "text-blue-400", solid: "#3b82f6", glow: "0 0 12px rgba(59, 130, 246, 0.6)" },
  image: { bg: "bg-emerald-500", border: "border-emerald-400", text: "text-emerald-400", solid: "#10b981", glow: "0 0 12px rgba(16, 185, 129, 0.6)" },
  video: { bg: "bg-violet-500", border: "border-violet-400", text: "text-violet-400", solid: "#8b5cf6", glow: "0 0 12px rgba(139, 92, 246, 0.6)" },
  audio: { bg: "bg-amber-500", border: "border-amber-400", text: "text-amber-400", solid: "#f59e0b", glow: "0 0 12px rgba(245, 158, 11, 0.6)" },
  any: { bg: "bg-zinc-400", border: "border-zinc-400", text: "text-zinc-400", solid: "#a1a1aa", glow: "0 0 12px rgba(161, 161, 170, 0.5)" },
  negative: { bg: "bg-red-500", border: "border-red-400", text: "text-red-400", solid: "#ef4444", glow: "0 0 12px rgba(239, 68, 68, 0.6)" },
  number: { bg: "bg-pink-500", border: "border-pink-400", text: "text-pink-400", solid: "#ec4899", glow: "0 0 12px rgba(236, 72, 153, 0.6)" },
  boolean: { bg: "bg-cyan-500", border: "border-cyan-400", text: "text-cyan-400", solid: "#06b6d4", glow: "0 0 12px rgba(6, 182, 212, 0.6)" },
};

// ============================================================================
// NODE DEFINITIONS
// ============================================================================

export interface NodeDefinition {
  type: AINodeType;
  category: NodeCategory;
  label: string;
  description: string;
  provider: string;
  /** Short action description shown in sidebar (e.g., "Text → Image") */
  action: string;
  inputs: { type: DataType; label: string }[];
  outputs: { type: DataType; label: string }[];
  estimatedCost: number; // in credits
  isUtility: boolean;
  color: string;
  // Extended metadata for hover cards
  estimatedTime?: string; // e.g. "~8s", "~30s"
  aspectRatios?: string[]; // e.g. ["1:1", "16:9", "9:16"]
  resolutions?: string[]; // e.g. ["1K", "2K", "4K"]
  features?: string[]; // e.g. ["Styles", "Negative Prompt"]
  models?: string[]; // Available models/variants
  providerIcon?: string; // Provider icon identifier
}

export const NODE_DEFINITIONS: Record<AINodeType, NodeDefinition> = {
  // ─────────────────────────────────────────────────────────────────────────
  // IMAGE NODES
  // ─────────────────────────────────────────────────────────────────────────
  seedream: {
    type: "seedream",
    category: "image",
    label: "Seedream 4.5",
    description: "High-quality text-to-image generation with advanced prompt understanding and image editing capabilities",
    provider: "ByteDance",
    action: "Text → Image",
    inputs: [
      { type: "text", label: "Prompt" },
      { type: "image", label: "Reference Image (optional)" },
    ],
    outputs: [{ type: "image", label: "Generated Image" }],
    estimatedCost: 40_000, // $0.04 per image
    isUtility: false,
    color: "emerald",
    estimatedTime: "~10s",
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    resolutions: ["1K", "2K"],
    features: ["Negative Prompt", "Prompt Enhancer", "Image Editing"],
  },
  seedvr: {
    type: "seedvr",
    category: "image",
    label: "SeedVR 2",
    description: "AI-powered image upscaling with face enhancement and detail preservation",
    provider: "ByteDance",
    action: "Image Upscaler",
    inputs: [{ type: "image", label: "Input Image" }],
    outputs: [{ type: "image", label: "Upscaled Image" }],
    estimatedCost: 2_000, // ~$0.002 per 1-2 megapixel (variable)
    isUtility: false,
    color: "emerald",
    estimatedTime: "~5s",
    features: ["2x/4x Upscale", "Face Enhancement"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VIDEO NODES
  // ─────────────────────────────────────────────────────────────────────────
  seedance: {
    type: "seedance",
    category: "video",
    label: "Seedance 1.5",
    description: "Generate cinematic videos from text prompts or animate still images with AI motion",
    provider: "ByteDance",
    action: "Text/Image → Video",
    inputs: [
      { type: "text", label: "Prompt" },
      { type: "image", label: "Start Frame (optional)" },
    ],
    outputs: [{ type: "video", label: "Generated Video" }],
    estimatedCost: 260_000, // ~$0.26 for 720p 5s with audio (variable)
    isUtility: false,
    color: "violet",
    estimatedTime: "~45s",
    aspectRatios: ["16:9", "9:16", "1:1"],
    features: ["4s/8s/16s Duration", "Image-to-Video", "Motion Control"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AUDIO NODES
  // ─────────────────────────────────────────────────────────────────────────
  elevenlabs: {
    type: "elevenlabs",
    category: "audio",
    label: "ElevenLabs V3",
    description: "Ultra-realistic text-to-speech with emotion control and voice cloning capabilities",
    provider: "ElevenLabs",
    action: "Text → Speech",
    inputs: [{ type: "text", label: "Script" }],
    outputs: [{ type: "audio", label: "Voice Audio" }],
    estimatedCost: 50_000, // ~$0.05 for ~500 characters (variable: $0.1/1000 chars)
    isUtility: false,
    color: "amber",
    estimatedTime: "~3s",
    features: ["50+ Voices", "Stability Control", "Clarity Control"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LLM / VISION NODES
  // ─────────────────────────────────────────────────────────────────────────
  openrouter: {
    type: "openrouter",
    category: "llm",
    label: "OpenRouter LLM",
    description: "Access GPT-4, Claude, Gemini and more through a unified API with vision capabilities",
    provider: "OpenRouter",
    action: "AI Chat & Vision",
    inputs: [
      { type: "text", label: "Prompt" },
      { type: "any", label: "Context (optional)" },
    ],
    outputs: [{ type: "text", label: "Response" }],
    estimatedCost: 50_000, // ~$0.05 estimate (varies by model and tokens)
    isUtility: false,
    color: "blue",
    estimatedTime: "~2s",
    models: ["GPT-4o", "Claude 3.5", "Gemini 1.5"],
    features: ["Vision Input", "Streaming", "System Prompts"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VIDEO + AUDIO NODES
  // ─────────────────────────────────────────────────────────────────────────
  lipsync: {
    type: "lipsync",
    category: "video",
    label: "Sync Lipsync",
    description: "AI-powered lip synchronization that matches any audio to video with realistic mouth movements",
    provider: "Sync Labs",
    action: "Audio + Video → Lipsync",
    inputs: [
      { type: "video", label: "Source Video" },
      { type: "audio", label: "Voice Audio" },
    ],
    outputs: [{ type: "video", label: "Synced Video" }],
    estimatedCost: 350_000, // ~$0.35 for ~30 seconds (variable: $0.7/min)
    isUtility: false,
    color: "violet",
    estimatedTime: "~30s",
    models: ["Sync 1.5", "Sync 1.6 Beta"],
    features: ["HD Output", "Multi-language"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY NODES (Internal - FFmpeg / Transloadit)
  // ─────────────────────────────────────────────────────────────────────────
  "crop-image": {
    type: "crop-image",
    category: "utility",
    label: "Crop Image",
    description: "Precisely crop images using percentage-based coordinates for consistent results",
    provider: "Internal",
    action: "Image Editor",
    inputs: [{ type: "image", label: "Input Image" }],
    outputs: [{ type: "image", label: "Cropped Image" }],
    estimatedCost: 0,
    isUtility: true,
    color: "zinc",
    estimatedTime: "<1s",
    features: ["Percentage Crop", "Preserve Quality"],
  },
  "merge-audio-video": {
    type: "merge-audio-video",
    category: "utility",
    label: "Merge Audio + Video",
    description: "Combine or replace audio tracks in video files with perfect synchronization",
    provider: "Internal",
    action: "Audio + Video Merge",
    inputs: [
      { type: "video", label: "Video" },
      { type: "audio", label: "Audio" },
    ],
    outputs: [{ type: "video", label: "Combined Video" }],
    estimatedCost: 0,
    isUtility: true,
    color: "zinc",
    estimatedTime: "~5s",
    features: ["Replace Audio", "Mix Audio"],
  },
  "merge-videos": {
    type: "merge-videos",
    category: "utility",
    label: "Merge Videos",
    description: "Seamlessly concatenate multiple videos with optional transitions",
    provider: "Internal",
    action: "Video Concatenate",
    inputs: [
      { type: "video", label: "Video 1" },
      { type: "video", label: "Video 2" },
    ],
    outputs: [{ type: "video", label: "Merged Video" }],
    estimatedCost: 0,
    isUtility: true,
    color: "zinc",
    estimatedTime: "~5s",
    features: ["Fade Transition", "Dissolve"],
  },
  "extract-audio": {
    type: "extract-audio",
    category: "utility",
    label: "Extract Audio",
    description: "Extract and convert audio tracks from video with format options",
    provider: "Internal",
    action: "Video → Audio",
    inputs: [{ type: "video", label: "Video" }],
    outputs: [{ type: "audio", label: "Audio Track" }],
    estimatedCost: 0,
    isUtility: true,
    color: "zinc",
    estimatedTime: "~3s",
    features: ["MP3/WAV/AAC", "Bitrate Control", "Normalize"],
  },
};

// ============================================================================
// CATEGORY METADATA
// ============================================================================

export const CATEGORY_META: Record<NodeCategory, { label: string; icon: string; color: string }> = {
  image: { label: "Image", icon: "Image", color: "emerald" },
  video: { label: "Video", icon: "Film", color: "violet" },
  audio: { label: "Audio", icon: "Volume2", color: "amber" },
  llm: { label: "LLM / Vision", icon: "Brain", color: "blue" },
  utility: { label: "Utility", icon: "Wrench", color: "zinc" },
};

// ============================================================================
// NODE CONFIGURATION SCHEMAS (Zod)
// ============================================================================

export const SeedreamConfigSchema = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).default("1:1"),
  seed: z.number().optional(),
});

export const SeedVRConfigSchema = z.object({
  scale: z.enum(["2x", "4x"]).default("2x"),
  enhanceFaces: z.boolean().default(false),
});

export const SeedanceConfigSchema = z.object({
  prompt: z.string().min(1),
  duration: z.enum(["4s", "8s", "16s"]).default("4s"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  seed: z.number().optional(),
});

export const ElevenLabsConfigSchema = z.object({
  text: z.string().min(1),
  voiceId: z.string().min(1),
  stability: z.number().min(0).max(1).default(0.5),
  clarity: z.number().min(0).max(1).default(0.75),
});

export const OpenRouterConfigSchema = z.object({
  model: z.enum([
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3-opus",
    "google/gemini-1.5-pro",
    "google/gemini-1.5-flash",
  ]).default("openai/gpt-4o-mini"),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
});

export const LipsyncConfigSchema = z.object({
  model: z.enum(["sync-1.5", "sync-1.6-beta"]).default("sync-1.5"),
});

export const CropImageConfigSchema = z.object({
  top: z.number().min(0).max(100).default(0),
  right: z.number().min(0).max(100).default(0),
  bottom: z.number().min(0).max(100).default(0),
  left: z.number().min(0).max(100).default(0),
});

export const MergeAudioVideoConfigSchema = z.object({
  replaceAudio: z.boolean().default(true),
});

export const MergeVideosConfigSchema = z.object({
  transition: z.enum(["none", "fade", "dissolve"]).default("none"),
  transitionDuration: z.number().min(0).max(2).default(0.5),
});

export const ExtractAudioConfigSchema = z.object({
  format: z.enum(["mp3", "wav", "aac", "ogg"]).default("mp3"),
  bitrate: z.enum(["128k", "192k", "256k", "320k"]).default("192k"),
  sampleRate: z.enum(["22050", "44100", "48000"]).default("44100"),
  channels: z.enum(["1", "2"]).default("2"),
  normalize: z.boolean().default(false),
});

// ============================================================================
// NODE STATUS TYPES
// ============================================================================

export type NodeStatus = "idle" | "queued" | "running" | "completed" | "failed";

export interface NodeExecutionState {
  status: NodeStatus;
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  output?: unknown;
  providerUsed?: string;
  actualCost?: number;
}

// ============================================================================
// INHERITED SETTINGS (When one node passes all settings to another)
// ============================================================================

/**
 * Tracks which settings are inherited from another node.
 * When a node has inherited settings, those settings are locked and
 * come from the source node instead of being editable.
 */
export interface InheritedSettings {
  /** The node ID that provides the settings */
  sourceNodeId: string;
  /** The node type of the source */
  sourceNodeType: AINodeType;
  /** Which settings are inherited (key -> value) */
  settings: Record<string, unknown>;
  /** Whether ALL settings are inherited (full inheritance) */
  fullInheritance: boolean;
}

// ============================================================================
// NODE CONTRACTS - Complete Input/Output Definitions
// ============================================================================

/**
 * Handle definition for inputs and outputs
 */
export interface HandleDefinition {
  id: string;
  type: DataType;
  label: string;
  isMedia?: boolean;     // True for media inputs (image, video, audio, text content)
  isSettings?: boolean;  // True for settings that can be inherited
  required?: boolean;
}

/**
 * Complete contract for a node's inputs and outputs
 */
export interface NodeContract {
  /** Primary output type (image, video, audio, text) */
  primaryOutputType: DataType;
  /** Primary output handle ID */
  primaryOutputId: string;
  /** All settings this node has that can be passed to other nodes */
  settings: HandleDefinition[];
  /** Media inputs this node accepts */
  mediaInputs: HandleDefinition[];
}

/**
 * Complete contracts for all node types.
 * Defines what settings each node can export and what media it accepts.
 */
export const NODE_CONTRACTS: Record<AINodeType, NodeContract> = {
  seedream: {
    primaryOutputType: "image",
    primaryOutputId: "out",
    mediaInputs: [
      { id: "image", type: "image", label: "Image", isMedia: true },
    ],
    settings: [
      { id: "prompt", type: "text", label: "Prompt", isSettings: true, required: true },
      { id: "negativePrompt", type: "negative", label: "Negative", isSettings: true },
      { id: "aspectRatio", type: "text", label: "Aspect", isSettings: true },
      { id: "seed", type: "number", label: "Seed", isSettings: true },
      { id: "numInferenceSteps", type: "number", label: "Steps", isSettings: true },
      { id: "guidanceScale", type: "number", label: "Guidance", isSettings: true },
      { id: "truncatePrompt", type: "boolean", label: "Truncate", isSettings: true },
      { id: "promptEnhancer", type: "boolean", label: "Enhancer", isSettings: true },
      { id: "syncMode", type: "boolean", label: "Sync", isSettings: true },
    ],
  },
  seedvr: {
    primaryOutputType: "image",
    primaryOutputId: "upscaled",
    mediaInputs: [
      { id: "inputImage", type: "image", label: "Image", isMedia: true, required: true },
    ],
    settings: [
      { id: "scale", type: "text", label: "Scale", isSettings: true },
      { id: "enhanceFaces", type: "boolean", label: "Faces", isSettings: true },
    ],
  },
  seedance: {
    primaryOutputType: "video",
    primaryOutputId: "video",
    mediaInputs: [
      { id: "inputFrame", type: "image", label: "Start Frame", isMedia: true },
    ],
    settings: [
      { id: "prompt", type: "text", label: "Prompt", isSettings: true, required: true },
      { id: "duration", type: "text", label: "Duration", isSettings: true },
      { id: "aspectRatio", type: "text", label: "Aspect", isSettings: true },
      { id: "seed", type: "number", label: "Seed", isSettings: true },
    ],
  },
  elevenlabs: {
    primaryOutputType: "audio",
    primaryOutputId: "audio",
    mediaInputs: [],
    settings: [
      { id: "text", type: "text", label: "Script", isSettings: true, required: true },
      { id: "voiceId", type: "text", label: "Voice", isSettings: true },
      { id: "stability", type: "number", label: "Stability", isSettings: true },
      { id: "clarity", type: "number", label: "Clarity", isSettings: true },
    ],
  },
  openrouter: {
    primaryOutputType: "text",
    primaryOutputId: "response",
    mediaInputs: [
      { id: "inputImage", type: "image", label: "Image", isMedia: true },
      { id: "context", type: "text", label: "Context", isMedia: true },
    ],
    settings: [
      { id: "prompt", type: "text", label: "Prompt", isSettings: true, required: true },
      { id: "systemPrompt", type: "text", label: "System", isSettings: true },
      { id: "model", type: "text", label: "Model", isSettings: true },
      { id: "temperature", type: "number", label: "Temp", isSettings: true },
      { id: "maxTokens", type: "number", label: "MaxTok", isSettings: true },
      { id: "negativePrompt", type: "negative", label: "Negative", isSettings: true },
    ],
  },
  lipsync: {
    primaryOutputType: "video",
    primaryOutputId: "synced",
    mediaInputs: [
      { id: "inputVideo", type: "video", label: "Video", isMedia: true, required: true },
      { id: "inputAudio", type: "audio", label: "Audio", isMedia: true, required: true },
    ],
    settings: [
      { id: "model", type: "text", label: "Model", isSettings: true },
    ],
  },
  "crop-image": {
    primaryOutputType: "image",
    primaryOutputId: "cropped",
    mediaInputs: [
      { id: "inputImage", type: "image", label: "Image", isMedia: true, required: true },
    ],
    settings: [
      { id: "xPercent", type: "number", label: "X %", isSettings: true },
      { id: "yPercent", type: "number", label: "Y %", isSettings: true },
      { id: "widthPercent", type: "number", label: "Width %", isSettings: true },
      { id: "heightPercent", type: "number", label: "Height %", isSettings: true },
    ],
  },
  "merge-audio-video": {
    primaryOutputType: "video",
    primaryOutputId: "combined",
    mediaInputs: [
      { id: "inputVideo", type: "video", label: "Video", isMedia: true, required: true },
      { id: "inputAudio", type: "audio", label: "Audio", isMedia: true, required: true },
    ],
    settings: [
      { id: "replaceAudio", type: "boolean", label: "Replace Audio", isSettings: true },
    ],
  },
  "merge-videos": {
    primaryOutputType: "video",
    primaryOutputId: "merged",
    mediaInputs: [
      { id: "inputVideo1", type: "video", label: "Video 1", isMedia: true, required: true },
      { id: "inputVideo2", type: "video", label: "Video 2", isMedia: true, required: true },
    ],
    settings: [
      { id: "transition", type: "text", label: "Transition", isSettings: true },
      { id: "transitionDuration", type: "number", label: "Duration", isSettings: true },
    ],
  },
  "extract-audio": {
    primaryOutputType: "audio",
    primaryOutputId: "audio",
    mediaInputs: [
      { id: "inputVideo", type: "video", label: "Video", isMedia: true, required: true },
    ],
    settings: [],
  },
};

/**
 * Check if a handle ID is a settings input for a given node type
 */
export function isSettingsHandle(nodeType: AINodeType, handleId: string): boolean {
  const contract = NODE_CONTRACTS[nodeType];
  if (!contract) return false;
  return contract.settings.some(s => s.id === handleId);
}

/**
 * Check if a handle ID is a media input for a given node type
 */
export function isMediaHandle(nodeType: AINodeType, handleId: string): boolean {
  const contract = NODE_CONTRACTS[nodeType];
  if (!contract) return false;
  return contract.mediaInputs.some(m => m.id === handleId);
}

/**
 * Get the setting value from source node that matches the target handle
 */
export function getSettingForHandle(
  sourceNodeType: AINodeType,
  sourceData: Record<string, unknown>,
  targetHandle: string
): unknown | undefined {
  const contract = NODE_CONTRACTS[sourceNodeType];
  if (!contract) return undefined;
  
  // Check if source has this setting
  const setting = contract.settings.find(s => s.id === targetHandle);
  if (setting) {
    return sourceData[targetHandle];
  }
  return undefined;
}

/**
 * Check if a source output can connect to a target input.
 * Returns detailed validation result.
 */
export function validateConnection(
  sourceType: DataType | undefined,
  targetType: DataType | undefined
): { valid: boolean; reason?: string } {
  if (!sourceType || !targetType) {
    return { valid: false, reason: "Missing type information" };
  }
  
  // "any" type accepts or provides anything
  if (sourceType === "any" || targetType === "any") {
    return { valid: true };
  }
  
  // Exact match
  if (sourceType === targetType) {
    return { valid: true };
  }
  
  // Negative prompts can only connect to negative inputs
  if (sourceType === "negative" && targetType !== "negative") {
    return { valid: false, reason: "Negative prompts can only connect to negative inputs" };
  }
  
  return { valid: false, reason: `Cannot connect ${sourceType} to ${targetType}` };
}

/**
 * Get the settings that a source node can export to a specific target handle.
 */
export function getExportableSettings(
  sourceNodeType: AINodeType,
  targetHandle: string
): { id: string; type: DataType; label: string } | undefined {
  const contract = NODE_CONTRACTS[sourceNodeType];
  if (!contract) return undefined;
  
  return contract.settings.find((s: HandleDefinition) => s.id === targetHandle);
}
