import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { falProvider, FAL_MODELS } from "@/lib/providers";
import { AssetRefSchema, ImageOutSchema } from "@/lib/workflow/node-schemas";

// =============================================================================
// SEEDVR 2 - Image Upscaling Node
// =============================================================================

export const SeedvrInputSchema = z.object({
  image: AssetRefSchema,
  scale: z.enum(["2x", "4x"]).default("2x"),
  enhanceFaces: z.boolean().default(false),
  context: z.string().optional(),
});

export type SeedvrInput = z.infer<typeof SeedvrInputSchema>;

export const SeedvrOutputSchema = ImageOutSchema;
export type SeedvrOutput = z.infer<typeof SeedvrOutputSchema>;

interface FalSeedvrResponse {
  image: {
    url: string;
    width: number;
    height: number;
    content_type: string;
  };
}

export const seedvrExecutor: NodeExecutor<SeedvrInput, SeedvrOutput> = {
  type: "seedvr",
  version: "1.0.0",
  inputSchema: SeedvrInputSchema,
  outputSchema: SeedvrOutputSchema,
  providers: ["fal"],  // Future: ["fal", "replicate"]
  config: {
    timeout: "5m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: SeedvrInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    if (!falProvider.isConfigured()) {
      return executeMock(input);
    }

    try {
      const scale = input.scale === "4x" ? 4 : 2;
      
      const falInput = {
        image_url: input.image.url,
        upscale_factor: scale,
        enable_face_enhancement: input.enhanceFaces,
      };

      const webhookUrl = `${context.webhookBaseUrl}/api/webhooks/fal?nodeExecutionId=${context.nodeExecutionId}`;
      
      const submission = await falProvider.submitJob({
        model: FAL_MODELS.seedvr,
        input: falInput,
        webhookUrl,
      });

      return {
        success: true,
        providerUsed: "fal",
        providerJobId: submission.jobId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerUsed: "fal",
      };
    }
  },
};

export function parseSeedvrResult(falResult: unknown): SeedvrOutput {
  const result = falResult as FalSeedvrResponse;
  
  return {
    type: "image",
    image: AssetRefSchema.parse({
      url: result.image.url,
      mimeType: result.image.content_type,
      width: result.image.width,
      height: result.image.height,
    }),
  };
}

function executeMock(input: SeedvrInput): NodeExecutionResult {
  const scale = input.scale === "4x" ? 4 : 2;
  return {
    success: true,
    output: {
      type: "image",
      image: {
        url: input.image.url,
        mimeType: "image/jpeg",
        width: (input.image.width ?? 512) * scale,
        height: (input.image.height ?? 512) * scale,
      },
    },
    providerUsed: "mock",
    actualCost: 0,
  };
}

export default seedvrExecutor;

