import { z } from "zod";
import { NODE_CONFIG } from "@/lib/config";

// ============================================================================
// NODE CATEGORIES & TYPES
// ============================================================================

export type NodeCategory = "image" | "video" | "audio" | "llm" | "utility" | "io";

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
  | "extract-audio"
  // Annotation
  | "comment"
  // I/O Nodes
  | "input"
  | "image-input"
  | "video-input"
  | "audio-input"
  | "output";

// ============================================================================
// DATA TYPES (What flows between nodes)
// ============================================================================

// Media types: Core data that flows between nodes
// Settings types: Parameters/configuration that can be shared across nodes
export type DataType = 
  // Media types (primary data)
  | "text" 
  | "image" 
  | "video" 
  | "audio" 
  | "any"
  // Settings types (parameters)
  | "prompt"       // Main instruction text
  | "negative"     // Negative/exclusion prompts
  | "seed"         // Random seed for reproducibility
  | "aspectRatio"  // Dimension settings
  | "duration"     // Time-related settings
  | "model"        // AI model selection
  | "temperature"  // Randomness/creativity control
  | "number"       // Generic numeric values
  | "boolean";     // On/off toggles

// Category for color legend grouping
export type DataTypeCategory = "media" | "settings";

export const dataTypeCategory: Record<DataType, DataTypeCategory> = {
  text: "media",
  image: "media",
  video: "media",
  audio: "media",
  any: "media",
  prompt: "settings",
  negative: "settings",
  seed: "settings",
  aspectRatio: "settings",
  duration: "settings",
  model: "settings",
  temperature: "settings",
  number: "settings",
  boolean: "settings",
};

export const dataTypeColors: Record<DataType, { bg: string; border: string; text: string; solid: string; glow: string }> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA TYPES - Bold, saturated colors for main data flowing between nodes
  // ═══════════════════════════════════════════════════════════════════════════
  text: { 
    bg: "bg-blue-500", 
    border: "border-blue-400", 
    text: "text-blue-400", 
    solid: "#3b82f6", 
    glow: "0 0 12px rgba(59, 130, 246, 0.6)" 
  },
  image: { 
    bg: "bg-emerald-500", 
    border: "border-emerald-400", 
    text: "text-emerald-400", 
    solid: "#10b981", 
    glow: "0 0 12px rgba(16, 185, 129, 0.6)" 
  },
  video: { 
    bg: "bg-violet-500", 
    border: "border-violet-400", 
    text: "text-violet-400", 
    solid: "#8b5cf6", 
    glow: "0 0 12px rgba(139, 92, 246, 0.6)" 
  },
  audio: { 
    bg: "bg-teal-500", 
    border: "border-teal-400", 
    text: "text-teal-400", 
    solid: "#14b8a6", 
    glow: "0 0 12px rgba(20, 184, 166, 0.6)" 
  },
  any: { 
    bg: "bg-zinc-400", 
    border: "border-zinc-400", 
    text: "text-zinc-400", 
    solid: "#a1a1aa", 
    glow: "0 0 12px rgba(161, 161, 170, 0.5)" 
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS TYPES - Distinct colors for parameters shared across nodes
  // ═══════════════════════════════════════════════════════════════════════════
  prompt: { 
    bg: "bg-sky-500", 
    border: "border-sky-400", 
    text: "text-sky-400", 
    solid: "#0ea5e9", 
    glow: "0 0 12px rgba(14, 165, 233, 0.6)" 
  },
  negative: { 
    bg: "bg-red-500", 
    border: "border-red-400", 
    text: "text-red-400", 
    solid: "#ef4444", 
    glow: "0 0 12px rgba(239, 68, 68, 0.6)" 
  },
  seed: { 
    bg: "bg-lime-500", 
    border: "border-lime-400", 
    text: "text-lime-400", 
    solid: "#84cc16", 
    glow: "0 0 12px rgba(132, 204, 22, 0.6)" 
  },
  aspectRatio: { 
    bg: "bg-indigo-500", 
    border: "border-indigo-400", 
    text: "text-indigo-400", 
    solid: "#6366f1", 
    glow: "0 0 12px rgba(99, 102, 241, 0.6)" 
  },
  duration: { 
    bg: "bg-teal-500", 
    border: "border-teal-400", 
    text: "text-teal-400", 
    solid: "#14b8a6", 
    glow: "0 0 12px rgba(20, 184, 166, 0.6)" 
  },
  model: { 
    bg: "bg-rose-500", 
    border: "border-rose-400", 
    text: "text-rose-400", 
    solid: "#f43f5e", 
    glow: "0 0 12px rgba(244, 63, 94, 0.6)" 
  },
  temperature: { 
    bg: "bg-orange-500", 
    border: "border-orange-400", 
    text: "text-orange-400", 
    solid: "#f97316", 
    glow: "0 0 12px rgba(249, 115, 22, 0.6)" 
  },
  number: { 
    bg: "bg-pink-500", 
    border: "border-pink-400", 
    text: "text-pink-400", 
    solid: "#ec4899", 
    glow: "0 0 12px rgba(236, 72, 153, 0.6)" 
  },
  boolean: { 
    bg: "bg-cyan-500", 
    border: "border-cyan-400", 
    text: "text-cyan-400", 
    solid: "#06b6d4", 
    glow: "0 0 12px rgba(6, 182, 212, 0.6)" 
  },
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

const DATA_TYPE_LABELS: Record<DataType, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  audio: "Audio",
  any: "Any",
  prompt: "Prompt",
  negative: "Negative",
  seed: "Seed",
  aspectRatio: "Aspect",
  duration: "Duration",
  model: "Model",
  temperature: "Temp",
  number: "Number",
  boolean: "Toggle",
};

const MEDIA_TYPES: DataType[] = ["text", "image", "video", "audio", "any"];

function inferDataTypeFromFieldId(fieldId: string, nodeType?: AINodeType): DataType | undefined {
  const id = fieldId.toLowerCase();
  if (id.includes("negative")) return "negative";
  if (id.includes("prompt")) return "prompt";
  if (id === "text" || id.includes("systemprompt") || id.includes("script")) return "prompt";
  if (id.includes("seed")) return "seed";
  if (id.includes("aspect")) return "aspectRatio";
  if (id.includes("duration")) return "duration";
  if (id.includes("model")) return "model";
  if (id.includes("temp")) return "temperature";
  if (id.includes("image") || id.includes("frame")) return "image";
  if (id.includes("video")) return "video";
  if (id.includes("audio")) return "audio";
  if (id.includes("text")) return "text";
  if (id.includes("steps") || id.includes("scale") || id.includes("tokens") || id.includes("penalty") || id.includes("bitrate") || id.includes("sample") || id.includes("channels")) return "number";
  if (id.includes("replace") || id.includes("enhance") || id.includes("normalize") || id.includes("truncate") || id.includes("sync")) return "boolean";
  return undefined;
}

function inferDataTypeFromField(
  nodeType: AINodeType,
  field: { id: string; type: string }
): DataType {
  // Prefer explicit mapping by field ID
  const mapped = inferDataTypeFromFieldId(field.id, nodeType);
  if (mapped) return mapped;

  // Fallback by field type
  if (field.type === "toggle") return "boolean";
  if (field.type === "slider" || field.type === "number") return "number";
  if (field.type === "textarea" || field.type === "text") return "text";

  if (field.type === "file") {
    // Default to category primary media type
    const config = NODE_CONFIG[nodeType];
    switch (config?.category) {
      case "image":
        return "image";
      case "video":
        return "video";
      case "audio":
        return "audio";
      case "llm":
        return "text";
      default:
        return "any";
    }
  }

  return "any";
}

function isMediaInput(field: { id: string; type: string }, dataType: DataType): boolean {
  if (field.id === "context") return true;
  if (field.type === "file") return true;
  return dataType === "image" || dataType === "video" || dataType === "audio";
}

function buildAction(inputs: { type: DataType }[], outputs: { type: DataType }[]): string {
  const inputType = inputs.find((i) => MEDIA_TYPES.includes(i.type))?.type ?? inputs[0]?.type;
  const outputType = outputs[0]?.type ?? "any";
  const inputLabel = inputType ? DATA_TYPE_LABELS[inputType] : "Input";
  const outputLabel = DATA_TYPE_LABELS[outputType] ?? "Output";
  return `${inputLabel} → ${outputLabel}`;
}

function buildNodeDefinition(nodeType: AINodeType): NodeDefinition {
  const config = NODE_CONFIG[nodeType];
  if (!config) {
    throw new Error(`Missing node config for ${nodeType}`);
  }

  const inputs = config.ui.inputs
    .filter((field) => field.type !== "hidden")
    .map((field) => ({
      type: inferDataTypeFromField(nodeType, field),
      label: field.label,
    }));

  const outputs = config.ui.outputs.map((output) => ({
    type: output.type,
    label: output.label,
  }));

  const providerOrder = config.providers.map((p) => p.id).join(" → ");
  const action = buildAction(inputs, outputs);

  // Derive model list from the model select field if present
  const modelField = config.ui.inputs.find((field) => field.id === "model" && field.type === "select");
  const models = modelField && "options" in modelField
    ? modelField.options.map((opt) => (typeof opt === "string" ? opt : opt.label))
    : undefined;

  return {
    type: nodeType,
    category: config.category,
    label: config.label,
    description: config.description,
    provider: providerOrder || "internal",
    action,
    inputs,
    outputs,
    estimatedCost: config.estimatedCost,
    isUtility: config.category === "utility",
    color: config.color,
    estimatedTime: config.estimatedTime,
    features: config.features,
    models,
  };
}

export const NODE_DEFINITIONS: Record<AINodeType, NodeDefinition> = {
  seedream: buildNodeDefinition("seedream"),
  seedvr: buildNodeDefinition("seedvr"),
  seedance: buildNodeDefinition("seedance"),
  elevenlabs: buildNodeDefinition("elevenlabs"),
  openrouter: buildNodeDefinition("openrouter"),
  lipsync: buildNodeDefinition("lipsync"),
  "crop-image": buildNodeDefinition("crop-image"),
  "merge-audio-video": buildNodeDefinition("merge-audio-video"),
  "merge-videos": buildNodeDefinition("merge-videos"),
  "extract-audio": buildNodeDefinition("extract-audio"),
  // Annotation node - special node without config (no AI processing)
  comment: {
    type: "comment",
    category: "utility",
    label: "Comment",
    description: "Add notes and annotations to your workflow",
    provider: "local",
    action: "Note",
    inputs: [],
    outputs: [],
    estimatedCost: 0,
    isUtility: true,
    color: "zinc",
  },
  // I/O Nodes
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
    color: "zinc",
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
    color: "emerald",
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
    color: "violet",
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
    color: "teal",
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
    color: "zinc",
  },
};

// ============================================================================
// CATEGORY METADATA
// ============================================================================

export const CATEGORY_META: Record<NodeCategory, { label: string; icon: string; color: string }> = {
  image: { label: "Image", icon: "Image", color: "emerald" },
  video: { label: "Video", icon: "Film", color: "violet" },
  audio: { label: "Audio", icon: "Volume2", color: "teal" },
  llm: { label: "LLM / Vision", icon: "Brain", color: "blue" },
  utility: { label: "Utility", icon: "Wrench", color: "amber" },
  io: { label: "I/O", icon: "ArrowRightLeft", color: "zinc" },
};

// ============================================================================
// NODE CONFIGURATION SCHEMAS (Zod)
// ============================================================================

export const SeedreamConfigSchema = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).default("1:1"),
  seed: z.number().optional(),
  useCache: z.boolean().default(false), // When false, always execute fresh
  skip: z.boolean().default(false), // When true, use existing output instead of re-executing
});

export const SeedVRConfigSchema = z.object({
  scale: z.enum(["2x", "4x"]).default("2x"),
  enhanceFaces: z.boolean().default(false),
  useCache: z.boolean().default(false),
  skip: z.boolean().default(false), // When true, use existing output instead of re-executing
});

export const SeedanceConfigSchema = z.object({
  prompt: z.string().min(1),
  duration: z.enum(["4s", "8s", "16s"]).default("4s"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  seed: z.number().optional(),
  useCache: z.boolean().default(false),
  skip: z.boolean().default(false), // When true, use existing output instead of re-executing
});

export const ElevenLabsConfigSchema = z.object({
  text: z.string().min(1),
  voiceId: z.string().min(1),
  stability: z.number().min(0).max(1).default(0.5),
  clarity: z.number().min(0).max(1).default(0.75),
  useCache: z.boolean().default(false),
  skip: z.boolean().default(false), // When true, use existing output instead of re-executing
});

export const OpenRouterConfigSchema = z.object({
  model: z.string().default("openai/gpt-4o-mini"), // Accept any model string for flexibility
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  topP: z.number().min(0).max(1).optional(), // Nucleus sampling
  topK: z.number().min(0).optional(), // Top-K sampling
  frequencyPenalty: z.number().min(-2).max(2).optional(), // Repetition penalty
  presencePenalty: z.number().min(-2).max(2).optional(), // Topic penalty
  imageUrl: z.string().optional(), // Vision input - URL or base64 data URL
  useCache: z.boolean().default(false),
  skip: z.boolean().default(false), // When true, use existing output instead of re-executing
});

export const LipsyncConfigSchema = z.object({
  model: z.enum(["sync-1.5", "sync-1.6-beta"]).default("sync-1.5"),
  useCache: z.boolean().default(false),
  skip: z.boolean().default(false), // When true, use existing output instead of re-executing
});

export const CropImageConfigSchema = z.object({
  // Percentage-based crop coordinates
  xPercent: z.number().min(0).max(100).default(0),
  yPercent: z.number().min(0).max(100).default(0),
  widthPercent: z.number().min(1).max(100).default(100),
  heightPercent: z.number().min(1).max(100).default(100),
  useCache: z.boolean().default(false),
  skip: z.boolean().default(false), // When true, use existing output instead of re-executing
});

export const MergeAudioVideoConfigSchema = z.object({
  replaceAudio: z.boolean().default(true),
  useCache: z.boolean().default(false),
  skip: z.boolean().default(false), // When true, use existing output instead of re-executing
});

export const MergeVideosConfigSchema = z.object({
  transition: z.enum(["none", "fade", "dissolve"]).default("none"),
  transitionDuration: z.number().min(0).max(2).default(0.5),
  useCache: z.boolean().default(false),
  skip: z.boolean().default(false), // When true, use existing output instead of re-executing
});

export const ExtractAudioConfigSchema = z.object({
  format: z.enum(["mp3", "wav", "aac", "ogg"]).default("mp3"),
  bitrate: z.enum(["128k", "192k", "256k", "320k"]).default("192k"),
  sampleRate: z.enum(["22050", "44100", "48000"]).default("44100"),
  channels: z.enum(["1", "2"]).default("2"),
  normalize: z.boolean().default(false),
  useCache: z.boolean().default(false),
  skip: z.boolean().default(false), // When true, use existing output instead of re-executing
});

// ============================================================================
// NODE STATUS TYPES
// ============================================================================

export type NodeStatus = "idle" | "queued" | "running" | "completed" | "failed" | "cancelled";

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
function buildNodeContract(nodeType: AINodeType): NodeContract {
  const config = NODE_CONFIG[nodeType];
  const outputs = config?.ui.outputs ?? [];
  const primaryOutput = outputs[0];

  const mediaInputs: HandleDefinition[] = [];
  const settings: HandleDefinition[] = [];

  for (const field of config.ui.inputs) {
    if (field.type === "hidden") continue;
    const dataType = inferDataTypeFromField(nodeType, field);
    const entry: HandleDefinition = {
      id: field.id,
      type: dataType,
      label: field.label,
      required: field.required,
    };

    if (isMediaInput(field, dataType)) {
      mediaInputs.push({ ...entry, isMedia: true });
    } else {
      settings.push({ ...entry, isSettings: true });
    }
  }

  return {
    primaryOutputType: (primaryOutput?.type ?? "any") as DataType,
    primaryOutputId: primaryOutput?.id ?? "output",
    mediaInputs,
    settings,
  };
}

export const NODE_CONTRACTS: Record<AINodeType, NodeContract> = {
  seedream: buildNodeContract("seedream"),
  seedvr: buildNodeContract("seedvr"),
  seedance: buildNodeContract("seedance"),
  elevenlabs: buildNodeContract("elevenlabs"),
  openrouter: buildNodeContract("openrouter"),
  lipsync: buildNodeContract("lipsync"),
  "crop-image": buildNodeContract("crop-image"),
  "merge-audio-video": buildNodeContract("merge-audio-video"),
  "merge-videos": buildNodeContract("merge-videos"),
  "extract-audio": buildNodeContract("extract-audio"),
  // Comment node has no inputs/outputs - pure annotation
  comment: {
    primaryOutputType: "any",
    primaryOutputId: "",
    settings: [],
    mediaInputs: [],
  },
  // I/O Nodes
  "input": {
    primaryOutputType: "any",
    primaryOutputId: "output",
    settings: [],
    mediaInputs: [],
  },
  "image-input": {
    primaryOutputType: "image",
    primaryOutputId: "output",
    settings: [],
    mediaInputs: [],
  },
  "video-input": {
    primaryOutputType: "video",
    primaryOutputId: "output",
    settings: [],
    mediaInputs: [],
  },
  "audio-input": {
    primaryOutputType: "audio",
    primaryOutputId: "output",
    settings: [],
    mediaInputs: [],
  },
  "output": {
    primaryOutputType: "any",
    primaryOutputId: "",
    settings: [],
    mediaInputs: [{ id: "input", type: "any", label: "Input" }],
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

// ============================================================================
// TYPE COMPATIBILITY - Centralized logic for connection validation
// ============================================================================

/**
 * Type compatibility groups - types in the same group can connect to each other.
 * This is the single source of truth for type compatibility.
 */
export const TYPE_COMPATIBILITY_GROUPS: Record<string, string[]> = {
  // Number types can connect to each other
  number: ["number", "seed", "duration", "temperature"],
  seed: ["number", "seed", "duration", "temperature"],
  duration: ["number", "seed", "duration", "temperature"],
  temperature: ["temperature", "number", "seed", "duration"],

  // Text types can connect to text-based fields AND settings fields (LLM outputs can be parsed)
  // LLM text output can connect to any settings handle - the llm-type-parser will convert the text
  text: ["text", "prompt", "negative", "aspectRatio", "model", "boolean", "number", "seed", "duration", "temperature"],
  prompt: ["text", "prompt", "negative"],
  negative: ["text", "prompt", "negative"],

  // Settings types: accept same type OR text (from LLM)
  boolean: ["boolean", "text"],
  aspectRatio: ["aspectRatio", "text"],
  model: ["model", "text"],
  
  // Media types: strict - only connect to same type
  image: ["image"],
  video: ["video"],
  audio: ["audio"],
  
  // Any connects to anything
  any: [],
};

/**
 * Check if two data types are compatible for connection.
 */
export function isTypeCompatible(from: DataType | string | undefined, to: DataType | string | undefined): boolean {
  if (!from || !to) return false;
  if (from === to) return true;
  if (from === "any" || to === "any") return true;

  const compatibleTypes = TYPE_COMPATIBILITY_GROUPS[from];
  if (compatibleTypes && compatibleTypes.includes(to)) {
    return true;
  }

  return false;
}

/**
 * Get the data type for a specific handle on a node.
 * Uses NODE_CONTRACTS to derive types from config.
 */
export function getHandleDataType(
  nodeType: AINodeType | undefined,
  direction: "inputs" | "outputs",
  handleId: string | null | undefined
): DataType | undefined {
  if (!nodeType) return undefined;
  
  const contract = NODE_CONTRACTS[nodeType];
  if (!contract) return undefined;

  if (direction === "outputs") {
    // For outputs, check if it matches the primary output
    if (!handleId || handleId === contract.primaryOutputId) {
      return contract.primaryOutputType;
    }
    // Settings outputs use the setting type
    const setting = contract.settings.find((s: HandleDefinition) => s.id === handleId || `${s.id}-setting` === handleId);
    if (setting) return setting.type;
    return undefined;
  }

  // For inputs, check media inputs first
  const mediaInput = contract.mediaInputs.find((m: HandleDefinition) => m.id === handleId);
  if (mediaInput) return mediaInput.type;

  // Then check settings
  const setting = contract.settings.find((s: HandleDefinition) => s.id === handleId);
  if (setting) return setting.type;

  // Default to first media input if no handleId
  if (!handleId && contract.mediaInputs.length > 0) {
    return contract.mediaInputs[0].type;
  }

  return undefined;
}
