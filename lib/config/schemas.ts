import { z } from "zod";

// =============================================================================
// SHARED SCHEMAS
// Reusable Zod schemas for node inputs and outputs
// =============================================================================

/**
 * Asset reference schema - used for images, videos, audio files
 */
export const AssetRefSchema = z.object({
  url: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export type AssetRef = z.infer<typeof AssetRefSchema>;

// =============================================================================
// OUTPUT SCHEMAS
// Standard output schemas for different media types
// =============================================================================

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

// =============================================================================
// FAL.AI MODEL IDS
// =============================================================================

export const FAL_MODELS = {
  seedream: "fal-ai/seedream-4.5",
  seedvr: "fal-ai/seed-vr-2",
  seedance: "fal-ai/seedance-1.5",
  elevenlabs: "fal-ai/elevenlabs/v3",
  lipsync: "fal-ai/sync",
} as const;

export type FalModelId = typeof FAL_MODELS[keyof typeof FAL_MODELS];
