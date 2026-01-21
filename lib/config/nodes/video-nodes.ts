import { z } from "zod";
import type { NodeConfig } from "../types";
import { AssetRefSchema, VideoOutSchema, FAL_MODELS } from "../schemas";

// =============================================================================
// VIDEO NODES
// Nodes for video generation and processing
// =============================================================================

export const seedanceConfig: NodeConfig = {
  type: "seedance",
  version: "1.0.0",
  category: "video",
  label: "Seedance 1.5",
  description: "Generate cinematic videos from text prompts or animate still images",
  color: "violet",
  
  providers: [
    {
      id: "fal",
      model: FAL_MODELS.seedance,
      inputMapping: {
        prompt: "prompt",
        duration: { field: "duration", transform: "durationToSeconds" },
        aspectRatio: "aspect_ratio",
        seed: "seed",
        "frame.url": "image_url",
      },
      outputMapping: {
        "video.url": "video.url",
        "video.mimeType": "video.content_type",
      },
    },
  ],
  
  inputSchema: z.object({
    prompt: z.string().min(1).max(6000),
    frame: AssetRefSchema.optional(),
    duration: z.enum(["4s", "8s", "16s"]).default("4s"),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
    seed: z.number().int().optional(),
    context: z.string().optional(),
  }),
  
  outputSchema: VideoOutSchema,
  
  execution: {
    timeout: "10m",
    retryPerProvider: 2,
    maxRetries: 3,
  },
  
  ui: {
    inputs: [
      { id: "prompt", type: "textarea", label: "Prompt", required: true, rows: 2, placeholder: "Describe the video..." },
      { id: "frame", type: "file", label: "Start Frame (optional)", accept: "image/*", preview: true },
      { id: "duration", type: "select", label: "Duration", options: [
        { value: "4s", label: "4 seconds" },
        { value: "8s", label: "8 seconds" },
        { value: "16s", label: "16 seconds" },
      ], defaultValue: "4s" },
      { id: "aspectRatio", type: "select", label: "Aspect Ratio", options: ["16:9", "9:16", "1:1"], defaultValue: "16:9" },
      { id: "seed", type: "number", label: "Seed", placeholder: "Random", advanced: true },
    ],
    outputs: [
      { id: "video", type: "video", label: "Generated Video" },
    ],
    layout: "vertical",
  },
  
  estimatedCost: 260_000,
  estimatedTime: "~45s",
  features: ["4s/8s/16s Duration", "Image-to-Video", "Motion Control"],
  
  mockResponse: () => ({
    type: "video",
    video: {
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      mimeType: "video/mp4",
      durationMs: 4000,
    },
  }),
};

export const lipsyncConfig: NodeConfig = {
  type: "lipsync",
  version: "1.0.0",
  category: "video",
  label: "Sync Lipsync",
  description: "AI-powered lip synchronization for video with audio",
  color: "violet",
  
  providers: [
    {
      id: "fal",
      model: FAL_MODELS.lipsync,
      inputMapping: {
        "video.url": "video_url",
        "audio.url": "audio_url",
        model: "model",
      },
      outputMapping: {
        "video.url": "video.url",
        "video.mimeType": "video.content_type",
      },
    },
  ],
  
  inputSchema: z.object({
    video: AssetRefSchema,
    audio: AssetRefSchema,
    model: z.enum(["sync-1.5", "sync-1.6-beta"]).default("sync-1.5"),
    context: z.string().optional(),
  }),
  
  outputSchema: VideoOutSchema,
  
  execution: {
    timeout: "10m",
    retryPerProvider: 2,
    maxRetries: 3,
  },
  
  ui: {
    inputs: [
      { id: "video", type: "file", label: "Video", accept: "video/*", required: true, preview: true },
      { id: "audio", type: "file", label: "Audio", accept: "audio/*", required: true },
      { id: "model", type: "select", label: "Model", options: [
        { value: "sync-1.5", label: "Sync 1.5" },
        { value: "sync-1.6-beta", label: "Sync 1.6 Beta" },
      ], defaultValue: "sync-1.5", advanced: true },
    ],
    outputs: [
      { id: "video", type: "video", label: "Synced Video" },
    ],
  },
  
  estimatedCost: 350_000,
  estimatedTime: "~30s",
  features: ["HD Output", "Multi-language"],
  
  mockResponse: (input: unknown) => {
    const inp = input as { video: { url: string } };
    return {
      type: "video",
      video: {
        url: inp.video.url,
        mimeType: "video/mp4",
      },
    };
  },
};

// Export all video node configs
export const videoNodes = {
  seedance: seedanceConfig,
  lipsync: lipsyncConfig,
};
