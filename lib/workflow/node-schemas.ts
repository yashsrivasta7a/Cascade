import { z } from "zod";
import type { AINodeType, DataType } from "@/types/nodes";
import {
  SeedreamConfigSchema,
  SeedVRConfigSchema,
  SeedanceConfigSchema,
  ElevenLabsConfigSchema,
  OpenRouterConfigSchema,
  LipsyncConfigSchema,
  CropImageConfigSchema,
  MergeAudioVideoConfigSchema,
  MergeVideosConfigSchema,
  ExtractAudioConfigSchema,
} from "@/types/nodes";

// -----------------------------------------------------------------------------
// Shared IO primitives (what flows between nodes)
// -----------------------------------------------------------------------------

export const AssetRefSchema = z.object({
  url: z.string().min(1).refine(
    (v) =>
      v.startsWith("http://") ||
      v.startsWith("https://") ||
      v.startsWith("data:") ||
      v.startsWith("blob:"),
    { message: "Invalid URL" }
  ),
  mimeType: z.string().min(1).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export type AssetRef = z.infer<typeof AssetRefSchema>;

export const TextOutSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const ImageOutSchema = z.object({
  type: z.literal("image"),
  image: AssetRefSchema,
});

export const VideoOutSchema = z.object({
  type: z.literal("video"),
  video: AssetRefSchema,
});

export const AudioOutSchema = z.object({
  type: z.literal("audio"),
  audio: AssetRefSchema,
});

export const AnyOutSchema = z.union([TextOutSchema, ImageOutSchema, VideoOutSchema, AudioOutSchema]);
export type AnyOut = z.infer<typeof AnyOutSchema>;

// -----------------------------------------------------------------------------
// Node Input Schemas (config + incoming values)
// -----------------------------------------------------------------------------

// Limits used by Zod refinements
const LIMITS = {
  text: {
    maxPromptChars: 6000,
  },
  image: {
    maxSizeBytes: 15 * 1024 * 1024,
    maxPixels: 4096 * 4096,
  },
  video: {
    maxSizeBytes: 200 * 1024 * 1024,
    maxDurationMs: 60_000,
  },
  audio: {
    maxSizeBytes: 50 * 1024 * 1024,
    maxDurationMs: 10 * 60_000,
  },
} as const;

function withAssetLimits(kind: "image" | "video" | "audio") {
  return AssetRefSchema.superRefine((val, ctx) => {
    const maxSize = LIMITS[kind].maxSizeBytes;
    if (val.sizeBytes !== undefined && val.sizeBytes > maxSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${kind} exceeds max size`,
      });
    }
    if (kind === "image") {
      if (val.width && val.height && val.width * val.height > LIMITS.image.maxPixels) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `image exceeds max resolution`,
        });
      }
    }
    if (kind !== "image") {
      const maxDur = LIMITS[kind].maxDurationMs;
      if (val.durationMs !== undefined && val.durationMs > maxDur) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${kind} exceeds max duration`,
        });
      }
    }
  });
}

export const NodeInputSchemas: Record<AINodeType, z.ZodTypeAny> = {
  seedream: z
    .object({
      prompt: z.string().min(1).max(LIMITS.text.maxPromptChars),
      negativePrompt: z.string().optional(),
      numInferenceSteps: z.number().int().min(1).max(60).optional(),
      guidanceScale: z.number().min(0).max(30).optional(),
      seed: z.number().int().optional(),
      truncatePrompt: z.boolean().optional(),
      promptEnhancer: z.boolean().optional(),
      syncMode: z.boolean().optional(),
      aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).default("1:1"),
      // Optional text context from previous nodes
      context: z.string().optional(),
    })
    // Avoid overriding stricter input limits (e.g., prompt max length) with the
    // looser config schemas.
    .merge(
      SeedreamConfigSchema.partial().omit({
        prompt: true,
        negativePrompt: true,
        aspectRatio: true,
        seed: true,
      })
    ),

  seedvr: z
    .object({
      image: withAssetLimits("image"),
      context: z.string().optional(),
    })
    .merge(SeedVRConfigSchema.partial()),

  seedance: z
    .object({
      prompt: z.string().min(1).max(LIMITS.text.maxPromptChars),
      frame: withAssetLimits("image").optional(),
      context: z.string().optional(),
    })
    .merge(SeedanceConfigSchema.partial().omit({ prompt: true })),

  elevenlabs: z
    .object({
      text: z.string().min(1).max(LIMITS.text.maxPromptChars),
      context: z.string().optional(),
    })
    .merge(ElevenLabsConfigSchema.partial().omit({ text: true })),

  openrouter: z
    .object({
      prompt: z.string().min(1).max(LIMITS.text.maxPromptChars),
      context: z.string().optional(),
      imageUrl: z.string().optional(), // Vision input - URL or base64 data URL
    })
    .merge(OpenRouterConfigSchema.partial()),

  lipsync: z
    .object({
      video: withAssetLimits("video"),
      audio: withAssetLimits("audio"),
      context: z.string().optional(),
    })
    .merge(LipsyncConfigSchema.partial()),

  "crop-image": z
    .object({
      image: withAssetLimits("image"),
      context: z.string().optional(),
    })
    .merge(CropImageConfigSchema.partial()),

  "merge-audio-video": z
    .object({
      video: withAssetLimits("video"),
      audio: withAssetLimits("audio"),
      context: z.string().optional(),
    })
    .merge(MergeAudioVideoConfigSchema.partial()),

  "merge-videos": z
    .object({
      video1: withAssetLimits("video"),
      video2: withAssetLimits("video"),
      context: z.string().optional(),
    })
    .merge(MergeVideosConfigSchema.partial()),

  "extract-audio": z
    .object({
      video: withAssetLimits("video"),
      context: z.string().optional(),
    })
    .merge(ExtractAudioConfigSchema.partial()),
};

// -----------------------------------------------------------------------------
// Node Output Schemas (validated outputs for every node)
// -----------------------------------------------------------------------------

export const NodeOutputSchemas: Record<AINodeType, z.ZodTypeAny> = {
  seedream: ImageOutSchema,
  seedvr: ImageOutSchema,
  seedance: VideoOutSchema,
  elevenlabs: AudioOutSchema,
  openrouter: TextOutSchema,
  lipsync: VideoOutSchema,
  "crop-image": ImageOutSchema,
  "merge-audio-video": VideoOutSchema,
  "merge-videos": VideoOutSchema,
  "extract-audio": AudioOutSchema,
};

export const NodePrimaryOutputType: Record<AINodeType, DataType> = {
  seedream: "image",
  seedvr: "image",
  seedance: "video",
  elevenlabs: "audio",
  openrouter: "text",
  lipsync: "video",
  "crop-image": "image",
  "merge-audio-video": "video",
  "merge-videos": "video",
  "extract-audio": "audio",
};

// -----------------------------------------------------------------------------
// Provider fallback (always includes a safe local "mock" fallback)
// -----------------------------------------------------------------------------

export type ProviderId =
  | "mock"
  | "openrouter"
  | "bytedance"
  | "elevenlabs"
  | "internal";

export const NodeProviders: Record<AINodeType, ProviderId[]> = {
  openrouter: ["openrouter", "mock"],
  seedream: ["bytedance", "mock"],
  seedvr: ["bytedance", "mock"],
  seedance: ["bytedance", "mock"],
  elevenlabs: ["elevenlabs", "mock"],
  lipsync: ["internal", "mock"],
  "crop-image": ["internal", "mock"],
  "merge-audio-video": ["internal", "mock"],
  "merge-videos": ["internal", "mock"],
  "extract-audio": ["internal", "mock"],
};



