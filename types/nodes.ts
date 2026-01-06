import { z } from "zod";

// ============================================================================
// NODE CATEGORIES & TYPES
// ============================================================================

export type NodeCategory = "input" | "image" | "video" | "audio" | "llm" | "utility";

export type AINodeType =
  // Input Nodes
  | "text-input"
  | "image-input"
  | "video-input"
  | "audio-input"
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

export type DataType = "text" | "image" | "video" | "audio" | "any" | "negative";

export const dataTypeColors: Record<DataType, { bg: string; border: string; text: string }> = {
  text: { bg: "bg-blue-500/20", border: "border-blue-500/50", text: "text-blue-300" },
  image: { bg: "bg-emerald-500/20", border: "border-emerald-500/50", text: "text-emerald-300" },
  video: { bg: "bg-violet-500/20", border: "border-violet-500/50", text: "text-violet-300" },
  audio: { bg: "bg-amber-500/20", border: "border-amber-500/50", text: "text-amber-300" },
  any: { bg: "bg-zinc-500/20", border: "border-zinc-500/50", text: "text-zinc-300" },
  negative: { bg: "bg-red-500/20", border: "border-red-500/50", text: "text-red-300" },
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
  inputs: { type: DataType; label: string }[];
  outputs: { type: DataType; label: string }[];
  estimatedCost: number; // in credits
  isUtility: boolean;
  color: string;
}

export const NODE_DEFINITIONS: Record<AINodeType, NodeDefinition> = {
  // ─────────────────────────────────────────────────────────────────────────
  // INPUT NODES
  // ─────────────────────────────────────────────────────────────────────────
  "text-input": {
    type: "text-input",
    category: "input",
    label: "Text Input",
    description: "Enter text to pass to other nodes",
    provider: "Input",
    inputs: [],
    outputs: [{ type: "text", label: "Text" }],
    estimatedCost: 0,
    isUtility: true,
    color: "zinc",
  },
  "image-input": {
    type: "image-input",
    category: "input",
    label: "Image Input",
    description: "Upload or paste an image",
    provider: "Input",
    inputs: [],
    outputs: [{ type: "image", label: "Image" }],
    estimatedCost: 0,
    isUtility: true,
    color: "emerald",
  },
  "video-input": {
    type: "video-input",
    category: "input",
    label: "Video Input",
    description: "Upload a video file",
    provider: "Input",
    inputs: [],
    outputs: [{ type: "video", label: "Video" }],
    estimatedCost: 0,
    isUtility: true,
    color: "violet",
  },
  "audio-input": {
    type: "audio-input",
    category: "input",
    label: "Audio Input",
    description: "Upload an audio file",
    provider: "Input",
    inputs: [],
    outputs: [{ type: "audio", label: "Audio" }],
    estimatedCost: 0,
    isUtility: true,
    color: "amber",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IMAGE NODES
  // ─────────────────────────────────────────────────────────────────────────
  seedream: {
    type: "seedream",
    category: "image",
    label: "Seedream 4.5",
    description: "Text-to-image & image editing",
    provider: "ByteDance",
    inputs: [
      { type: "text", label: "Prompt" },
      { type: "text", label: "Negative Prompt (optional)" },
    ],
    outputs: [{ type: "image", label: "Generated Image" }],
    estimatedCost: 5,
    isUtility: false,
    color: "emerald",
  },
  seedvr: {
    type: "seedvr",
    category: "image",
    label: "SeedVR 2",
    description: "Image upscaling & enhancement",
    provider: "ByteDance",
    inputs: [{ type: "image", label: "Input Image" }],
    outputs: [{ type: "image", label: "Upscaled Image" }],
    estimatedCost: 3,
    isUtility: false,
    color: "emerald",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VIDEO NODES
  // ─────────────────────────────────────────────────────────────────────────
  seedance: {
    type: "seedance",
    category: "video",
    label: "Seedance 1.5",
    description: "Text-to-video & image-to-video",
    provider: "ByteDance",
    inputs: [
      { type: "text", label: "Prompt" },
      { type: "image", label: "Start Frame (optional)" },
    ],
    outputs: [{ type: "video", label: "Generated Video" }],
    estimatedCost: 25,
    isUtility: false,
    color: "violet",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AUDIO NODES
  // ─────────────────────────────────────────────────────────────────────────
  elevenlabs: {
    type: "elevenlabs",
    category: "audio",
    label: "ElevenLabs V3",
    description: "Text-to-speech generation",
    provider: "ElevenLabs",
    inputs: [{ type: "text", label: "Script" }],
    outputs: [{ type: "audio", label: "Voice Audio" }],
    estimatedCost: 8,
    isUtility: false,
    color: "amber",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LLM / VISION NODES
  // ─────────────────────────────────────────────────────────────────────────
  openrouter: {
    type: "openrouter",
    category: "llm",
    label: "OpenRouter LLM",
    description: "Text & multimodal (GPT, Claude, Gemini)",
    provider: "OpenRouter",
    inputs: [
      { type: "text", label: "Prompt" },
      { type: "any", label: "Context (optional)" },
    ],
    outputs: [{ type: "text", label: "Response" }],
    estimatedCost: 2,
    isUtility: false,
    color: "blue",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VIDEO + AUDIO NODES
  // ─────────────────────────────────────────────────────────────────────────
  lipsync: {
    type: "lipsync",
    category: "video",
    label: "Sync Lipsync",
    description: "Lip-sync audio with video",
    provider: "Sync Labs",
    inputs: [
      { type: "video", label: "Source Video" },
      { type: "audio", label: "Voice Audio" },
    ],
    outputs: [{ type: "video", label: "Synced Video" }],
    estimatedCost: 15,
    isUtility: false,
    color: "violet",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY NODES (Internal - FFmpeg / Transloadit)
  // ─────────────────────────────────────────────────────────────────────────
  "crop-image": {
    type: "crop-image",
    category: "utility",
    label: "Crop Image",
    description: "Percentage-based image cropping",
    provider: "Internal",
    inputs: [{ type: "image", label: "Input Image" }],
    outputs: [{ type: "image", label: "Cropped Image" }],
    estimatedCost: 0,
    isUtility: true,
    color: "zinc",
  },
  "merge-audio-video": {
    type: "merge-audio-video",
    category: "utility",
    label: "Merge Audio + Video",
    description: "Combine audio track with video",
    provider: "Internal",
    inputs: [
      { type: "video", label: "Video" },
      { type: "audio", label: "Audio" },
    ],
    outputs: [{ type: "video", label: "Combined Video" }],
    estimatedCost: 0,
    isUtility: true,
    color: "zinc",
  },
  "merge-videos": {
    type: "merge-videos",
    category: "utility",
    label: "Merge Videos",
    description: "Concatenate multiple videos",
    provider: "Internal",
    inputs: [
      { type: "video", label: "Video 1" },
      { type: "video", label: "Video 2" },
    ],
    outputs: [{ type: "video", label: "Merged Video" }],
    estimatedCost: 0,
    isUtility: true,
    color: "zinc",
  },
  "extract-audio": {
    type: "extract-audio",
    category: "utility",
    label: "Extract Audio",
    description: "Extract audio track from video",
    provider: "Internal",
    inputs: [{ type: "video", label: "Video" }],
    outputs: [{ type: "audio", label: "Audio Track" }],
    estimatedCost: 0,
    isUtility: true,
    color: "zinc",
  },
};

// ============================================================================
// CATEGORY METADATA
// ============================================================================

export const CATEGORY_META: Record<NodeCategory, { label: string; icon: string; color: string }> = {
  input: { label: "Input", icon: "Upload", color: "cyan" },
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
  format: z.enum(["mp3", "wav", "aac"]).default("mp3"),
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


