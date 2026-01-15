import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { falProvider, FAL_MODELS } from "@/lib/providers";
import { AssetRefSchema, VideoOutSchema } from "@/lib/workflow/node-schemas";

// =============================================================================
// SEEDANCE 1.5 - Video Generation Node
// =============================================================================

export const SeedanceInputSchema = z.object({
  prompt: z.string().min(1).max(6000),
  frame: AssetRefSchema.optional(), // Optional start frame image
  duration: z.enum(["4s", "8s", "16s"]).default("4s"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  seed: z.number().int().optional(),
  context: z.string().optional(),
});

export type SeedanceInput = z.infer<typeof SeedanceInputSchema>;

export const SeedanceOutputSchema = VideoOutSchema;
export type SeedanceOutput = z.infer<typeof SeedanceOutputSchema>;

interface FalSeedanceResponse {
  video: {
    url: string;
    content_type: string;
  };
  seed: number;
}

function getDurationSeconds(duration: string): number {
  const map: Record<string, number> = { "4s": 4, "8s": 8, "16s": 16 };
  return map[duration] ?? 4;
}

export const seedanceExecutor: NodeExecutor<SeedanceInput, SeedanceOutput> = {
  type: "seedance",
  version: "1.0.0",
  inputSchema: SeedanceInputSchema,
  outputSchema: SeedanceOutputSchema,
  providers: ["fal"],  // Future: ["fal", "replicate"]
  config: {
    timeout: "10m", // Video generation takes longer
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: SeedanceInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    if (!falProvider.isConfigured()) {
      return executeMock(input);
    }

    try {
      const falInput: Record<string, unknown> = {
        prompt: input.context
          ? `${input.prompt}\n\nContext: ${input.context}`
          : input.prompt,
        duration: getDurationSeconds(input.duration),
        aspect_ratio: input.aspectRatio,
        seed: input.seed,
      };

      if (input.frame) {
        falInput.image_url = input.frame.url;
      }

      const webhookUrl = `${context.webhookBaseUrl}/api/webhooks/fal?nodeExecutionId=${context.nodeExecutionId}`;
      
      const submission = await falProvider.submitJob({
        model: FAL_MODELS.seedance,
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

export function parseSeedanceResult(falResult: unknown): SeedanceOutput {
  const result = falResult as FalSeedanceResponse;
  
  return {
    type: "video",
    video: AssetRefSchema.parse({
      url: result.video.url,
      mimeType: result.video.content_type,
    }),
  };
}

function executeMock(_input: SeedanceInput): NodeExecutionResult {
  return {
    success: true,
    output: {
      type: "video",
      video: {
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        mimeType: "video/mp4",
        durationMs: 4000,
      },
    },
    providerUsed: "mock",
    actualCost: 0,
  };
}

export default seedanceExecutor;

