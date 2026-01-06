import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { falProvider, FAL_MODELS } from "@/lib/providers";
import { AssetRefSchema, VideoOutSchema } from "@/lib/workflow/node-schemas";

// =============================================================================
// SYNC LIPSYNC - Lip Sync Audio with Video Node
// =============================================================================

export const LipsyncInputSchema = z.object({
  video: AssetRefSchema,
  audio: AssetRefSchema,
  model: z.enum(["sync-1.5", "sync-1.6-beta"]).default("sync-1.5"),
  context: z.string().optional(),
});

export type LipsyncInput = z.infer<typeof LipsyncInputSchema>;

export const LipsyncOutputSchema = VideoOutSchema;
export type LipsyncOutput = z.infer<typeof LipsyncOutputSchema>;

interface FalLipsyncResponse {
  video: {
    url: string;
    content_type: string;
  };
}

export const lipsyncExecutor: NodeExecutor<LipsyncInput, LipsyncOutput> = {
  type: "lipsync",
  version: "1.0.0",
  inputSchema: LipsyncInputSchema,
  outputSchema: LipsyncOutputSchema,
  providers: ["fal"],  // Sync via fal.ai
  config: {
    timeout: "10m", // Video processing takes longer
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: LipsyncInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    if (!falProvider.isConfigured()) {
      return executeMock(input);
    }

    try {
      const falInput = {
        video_url: input.video.url,
        audio_url: input.audio.url,
        model: input.model,
      };

      const webhookUrl = `${context.webhookBaseUrl}/api/webhooks/fal?nodeExecutionId=${context.nodeExecutionId}`;
      
      const submission = await falProvider.submitJob({
        model: FAL_MODELS.lipsync,
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

export function parseLipsyncResult(falResult: unknown): LipsyncOutput {
  const result = falResult as FalLipsyncResponse;
  
  return {
    type: "video",
    video: AssetRefSchema.parse({
      url: result.video.url,
      mimeType: result.video.content_type,
    }),
  };
}

function executeMock(input: LipsyncInput): NodeExecutionResult {
  return {
    success: true,
    output: {
      type: "video",
      video: {
        url: input.video.url,
        mimeType: "video/mp4",
      },
    },
    providerUsed: "mock",
    actualCost: 0,
  };
}

export default lipsyncExecutor;

