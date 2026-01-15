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
  return {
    success: true,
    output: {
      type: "audio",
      audio: {
        url: "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav",
        mimeType: "audio/wav",
        durationMs: 60000,
      },
    },
    providerUsed: "mock",
    actualCost: 0,
  };
}

export default elevenlabsExecutor;

