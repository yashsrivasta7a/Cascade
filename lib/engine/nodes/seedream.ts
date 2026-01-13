import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import {
  falProvider,
  FAL_MODELS,
  executeWithFallback,
  createProviderMap,
} from "@/lib/providers";
import { AssetRefSchema, ImageOutSchema } from "@/lib/workflow/node-schemas";

// =============================================================================
// SEEDREAM 4.5 - Image Generation Node
// =============================================================================

// Input schema for Seedream node
export const SeedreamInputSchema = z.object({
  prompt: z.string().min(1).max(6000),
  negativePrompt: z.string().optional(),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).default("1:1"),
  seed: z.number().int().optional(),
  numInferenceSteps: z.number().int().min(1).max(60).optional(),
  guidanceScale: z.number().min(0).max(30).optional(),
  truncatePrompt: z.boolean().optional(),
  promptEnhancer: z.boolean().optional(),
  syncMode: z.boolean().optional(),
  // Context from previous nodes
  context: z.string().optional(),
  // Reference images - fal.ai supports up to 14 reference images
  referenceImages: z.array(z.string().url()).max(14).optional(),
  // Legacy single image support (converted to array)
  inputImage: z.string().optional(),
});

export type SeedreamInput = z.infer<typeof SeedreamInputSchema>;

// Output schema - standard image output
export const SeedreamOutputSchema = ImageOutSchema;
export type SeedreamOutput = z.infer<typeof SeedreamOutputSchema>;

// Map aspect ratio to image size
function getImageSize(aspectRatio: string): { width: number; height: number } {
  const sizes: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 },
    "4:3": { width: 1152, height: 864 },
    "3:4": { width: 864, height: 1152 },
  };
  return sizes[aspectRatio] ?? sizes["1:1"];
}

// fal.ai response structure for Seedream
interface FalSeedreamResponse {
  images: Array<{
    url: string;
    width: number;
    height: number;
    content_type: string;
  }>;
  seed: number;
  timings?: {
    inference: number;
  };
}

// =============================================================================
// PROVIDER IMPLEMENTATIONS
// =============================================================================

/**
 * Provider executor map for image generation
 * Each provider implements the same interface, returns same output schema
 * Designed for fallback: fal → replicate → together
 * 
 * Hackathon Scope: Implement one provider per node type only.
 * Architecture must be designed to support multiple providers with fallback in the future.
 */
const imageGenProviders = createProviderMap<SeedreamInput>({
  // fal.ai implementation (primary - currently the only one)
  fal: async (input, context): Promise<NodeExecutionResult> => {
    if (!falProvider.isConfigured()) {
      throw new Error("fal.ai not configured. Set FAL_KEY environment variable.");
    }

    // Build reference images array - support both new array format and legacy single image
    let referenceImages: string[] = [];
    if (input.referenceImages && input.referenceImages.length > 0) {
      // New multi-image format - enforce max 14 images
      referenceImages = input.referenceImages.slice(0, 14);
    } else if (input.inputImage) {
      // Legacy single image support
      referenceImages = [input.inputImage];
    }

    // Build fal.ai input
    const size = getImageSize(input.aspectRatio);
    const falInput: Record<string, unknown> = {
      prompt: input.context
        ? `${input.prompt}\n\nContext: ${input.context}`
        : input.prompt,
      negative_prompt: input.negativePrompt || undefined,
      image_size: size,
      seed: input.seed,
      num_inference_steps: input.numInferenceSteps,
      guidance_scale: input.guidanceScale,
      truncate_prompt: input.truncatePrompt,
      prompt_enhancer: input.promptEnhancer,
      sync_mode: input.syncMode,
      num_images: 1,
    };

    // Add reference images if provided (fal.ai supports up to 14)
    if (referenceImages.length > 0) {
      falInput.image_urls = referenceImages;
    }

    // Submit job with webhook
    const webhookUrl = `${context.webhookBaseUrl}/api/webhooks/fal?nodeExecutionId=${context.nodeExecutionId}`;

    const submission = await falProvider.submitJob({
      model: FAL_MODELS.seedream,
      input: falInput,
      webhookUrl,
    });

    // Return waiting state - execution will resume via webhook
    return {
      success: true,
      providerUsed: "fal",
      providerJobId: submission.jobId,
      // Output will be set when webhook arrives
    };
  },

  // Replicate implementation (future)
  // replicate: async (input, context): Promise<NodeExecutionResult> => {
  //   // TODO: Implement Replicate provider for SDXL, Flux, etc.
  //   throw new Error("Replicate provider not implemented");
  // },

  // Together.ai implementation (future)
  // together: async (input, context): Promise<NodeExecutionResult> => {
  //   // TODO: Implement Together.ai provider
  //   throw new Error("Together provider not implemented");
  // },
});

// =============================================================================
// NODE EXECUTOR
// =============================================================================

export const seedreamExecutor: NodeExecutor<SeedreamInput, SeedreamOutput> = {
  type: "seedream",
  version: "1.0.0",
  inputSchema: SeedreamInputSchema,
  outputSchema: SeedreamOutputSchema,
  
  // Provider fallback order (in priority)
  // Currently: fal only
  // Future: ["fal", "replicate", "together"]
  providers: ["fal"],
  
  config: {
    timeout: "5m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: SeedreamInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // Execute with fallback chain
    // Will try fal first, if it fails all retries, try mock
    const result = await executeWithFallback(input, {
      config: this.config,
      providerOrder: this.providers,
      providers: imageGenProviders,
      context,
      log: (msg) => console.log(`[Seedream:${context.nodeExecutionId.slice(0, 8)}] ${msg}`),
    });

    return result;
  },
};

// Parse fal.ai webhook result into our output format
export function parseSeedreamResult(falResult: unknown): SeedreamOutput {
  const result = falResult as FalSeedreamResponse;

  if (!result.images || result.images.length === 0) {
    throw new Error("No images in fal.ai response");
  }

  const image = result.images[0];

  return {
    type: "image",
    image: AssetRefSchema.parse({
      url: image.url,
      mimeType: image.content_type,
      width: image.width,
      height: image.height,
    }),
  };
}

export default seedreamExecutor;
