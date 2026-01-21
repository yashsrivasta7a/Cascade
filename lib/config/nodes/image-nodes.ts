import { z } from "zod";
import type { NodeConfig } from "../types";
import { AssetRefSchema, ImageOutSchema, FAL_MODELS } from "../schemas";

// =============================================================================
// IMAGE NODES
// Nodes for image generation and processing
// =============================================================================

export const seedreamConfig: NodeConfig = {
  type: "seedream",
  version: "1.0.0",
  category: "image",
  label: "Seedream 4.5",
  description: "High-quality text-to-image generation with advanced prompt understanding",
  color: "emerald",
  
  providers: [
    {
      id: "fal",
      model: FAL_MODELS.seedream,
      inputMapping: {
        prompt: "prompt",
        negativePrompt: "negative_prompt",
        aspectRatio: "image_size",
        seed: "seed",
        numInferenceSteps: "num_inference_steps",
        guidanceScale: "guidance_scale",
        truncatePrompt: "truncate_prompt",
        promptEnhancer: "prompt_enhancer",
        syncMode: "sync_mode",
        referenceImages: "image_urls",
      },
      outputMapping: {
        "image.url": "images[0].url",
        "image.mimeType": "images[0].content_type",
        "image.width": "images[0].width",
        "image.height": "images[0].height",
      },
    },
  ],
  
  inputSchema: z.object({
    prompt: z.string().min(1).max(6000),
    negativePrompt: z.string().optional(),
    aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).default("1:1"),
    seed: z.number().int().optional(),
    numInferenceSteps: z.number().int().min(1).max(60).optional(),
    guidanceScale: z.number().min(0).max(30).optional(),
    truncatePrompt: z.boolean().optional(),
    promptEnhancer: z.boolean().optional(),
    syncMode: z.boolean().optional(),
    context: z.string().optional(),
    referenceImages: z.array(z.string().url()).max(14).optional(),
  }),
  
  outputSchema: ImageOutSchema,
  
  execution: {
    timeout: "5m",
    retryPerProvider: 2,
    maxRetries: 3,
  },
  
  ui: {
    inputs: [
      { id: "prompt", type: "textarea", label: "Prompt", required: true, rows: 3, placeholder: "Describe the image you want to create..." },
      { id: "negativePrompt", type: "textarea", label: "Negative Prompt", rows: 2, placeholder: "What to avoid...", advanced: true },
      { id: "aspectRatio", type: "select", label: "Aspect Ratio", options: ["1:1", "16:9", "9:16", "4:3", "3:4"], defaultValue: "1:1" },
      { id: "referenceImages", type: "file", label: "Reference Images (up to 14)", accept: "image/*", preview: true },
      { id: "seed", type: "number", label: "Seed", placeholder: "Random", advanced: true },
      { id: "numInferenceSteps", type: "slider", label: "Steps", min: 1, max: 60, defaultValue: 30, advanced: true },
      { id: "guidanceScale", type: "slider", label: "Guidance", min: 0, max: 30, step: 0.5, defaultValue: 7.5, advanced: true },
      { id: "promptEnhancer", type: "toggle", label: "Prompt Enhancer", advanced: true },
    ],
    outputs: [
      { id: "image", type: "image", label: "Generated Image" },
    ],
    layout: "vertical",
  },
  
  estimatedCost: 40_000,
  estimatedTime: "~10s",
  features: ["Negative Prompt", "Prompt Enhancer", "Multi-Reference (up to 14)"],
  
  mockResponse: () => ({
    type: "image",
    image: {
      url: "https://picsum.photos/1024/1024",
      mimeType: "image/jpeg",
      width: 1024,
      height: 1024,
    },
  }),
};

export const seedvrConfig: NodeConfig = {
  type: "seedvr",
  version: "1.0.0",
  category: "image",
  label: "SeedVR 2",
  description: "AI-powered image upscaling with face enhancement",
  color: "emerald",
  
  providers: [
    {
      id: "fal",
      model: FAL_MODELS.seedvr,
      inputMapping: {
        "image.url": "image_url",
        scale: { field: "upscale_factor", transform: "scaleToNumber" },
        enhanceFaces: "enable_face_enhancement",
      },
      outputMapping: {
        "image.url": "image.url",
        "image.mimeType": "image.content_type",
        "image.width": "image.width",
        "image.height": "image.height",
      },
    },
  ],
  
  inputSchema: z.object({
    image: AssetRefSchema,
    scale: z.enum(["2x", "4x"]).default("2x"),
    enhanceFaces: z.boolean().default(false),
    context: z.string().optional(),
  }),
  
  outputSchema: ImageOutSchema,
  
  execution: {
    timeout: "5m",
    retryPerProvider: 2,
    maxRetries: 3,
  },
  
  ui: {
    inputs: [
      { id: "image", type: "file", label: "Input Image", accept: "image/*", required: true, preview: true },
      { id: "scale", type: "select", label: "Scale", options: ["2x", "4x"], defaultValue: "2x" },
      { id: "enhanceFaces", type: "toggle", label: "Enhance Faces" },
    ],
    outputs: [
      { id: "image", type: "image", label: "Upscaled Image" },
    ],
  },
  
  estimatedCost: 2_000,
  estimatedTime: "~5s",
  features: ["2x/4x Upscale", "Face Enhancement"],
  
  mockResponse: (input: unknown) => {
    const inp = input as { image: { url: string }; scale: string };
    const scale = inp.scale === "4x" ? 4 : 2;
    return {
      type: "image",
      image: {
        url: inp.image.url,
        mimeType: "image/jpeg",
        width: 512 * scale,
        height: 512 * scale,
      },
    };
  },
};

// Export all image node configs
export const imageNodes = {
  seedream: seedreamConfig,
  seedvr: seedvrConfig,
};
