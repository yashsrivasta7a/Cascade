import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { falProvider, FAL_MODELS } from "@/lib/providers";
import { AssetRefSchema, AudioOutSchema } from "@/lib/workflow/node-schemas";

// =============================================================================
// ELEVENLABS V3 - Text-to-Speech Node (via fal.ai)
// =============================================================================

export const ElevenlabsInputSchema = z.object({
  text: z.string().min(1).max(6000),
  voiceId: z.string().min(1).default("21m00Tcm4TlvDq8ikWAM"), // Rachel voice
  stability: z.number().min(0).max(1).default(0.5),
  clarity: z.number().min(0).max(1).default(0.75),
  context: z.string().optional(),
});

export type ElevenlabsInput = z.infer<typeof ElevenlabsInputSchema>;

export const ElevenlabsOutputSchema = AudioOutSchema;
export type ElevenlabsOutput = z.infer<typeof ElevenlabsOutputSchema>;

interface FalElevenlabsResponse {
  audio: {
    url: string;
    content_type: string;
    duration?: number;
  };
}

export const elevenlabsExecutor: NodeExecutor<ElevenlabsInput, ElevenlabsOutput> = {
  type: "elevenlabs",
  version: "1.0.0",
  inputSchema: ElevenlabsInputSchema,
  outputSchema: ElevenlabsOutputSchema,
  providers: ["fal"],  // ElevenLabs via fal.ai
  config: {
    timeout: "2m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: ElevenlabsInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    if (!falProvider.isConfigured()) {
      return executeMock(input);
    }

    try {
      const falInput = {
        text: input.context
          ? `${input.text}`
          : input.text,
        voice_id: input.voiceId,
        voice_settings: {
          stability: input.stability,
          similarity_boost: input.clarity,
        },
      };

      const webhookUrl = `${context.webhookBaseUrl}/api/webhooks/fal?nodeExecutionId=${context.nodeExecutionId}`;
      
      const submission = await falProvider.submitJob({
        model: FAL_MODELS.elevenlabs,
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

export function parseElevenlabsResult(falResult: unknown): ElevenlabsOutput {
  const result = falResult as FalElevenlabsResponse;
  
  return {
    type: "audio",
    audio: AssetRefSchema.parse({
      url: result.audio.url,
      mimeType: result.audio.content_type,
      durationMs: result.audio.duration ? result.audio.duration * 1000 : undefined,
    }),
  };
}

function executeMock(_input: ElevenlabsInput): NodeExecutionResult {
  // Use base64 silent audio to avoid CORS issues with mock responses
  const mockAudioBase64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAB8ANX9AAAItMK7P80IACqu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/+1DEJgAAA0gAAAAAu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7";
  return {
    success: true,
    output: {
      type: "audio",
      audio: {
        url: mockAudioBase64,
        mimeType: "audio/mp3",
        durationMs: 1000,
      },
    },
    providerUsed: "mock",
    actualCost: 0,
  };
}

export default elevenlabsExecutor;

