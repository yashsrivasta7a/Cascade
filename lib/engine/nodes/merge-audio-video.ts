import { z } from "zod";
import { Transloadit } from "transloadit";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { AssetRefSchema, VideoOutSchema } from "@/lib/workflow/node-schemas";

// =============================================================================
// MERGE AUDIO + VIDEO - Internal Utility Node (via Transloadit)
// =============================================================================

export const MergeAudioVideoInputSchema = z.object({
  video: AssetRefSchema,
  audio: AssetRefSchema,
  replaceAudio: z.boolean().default(true),
  context: z.string().optional(),
});

export type MergeAudioVideoInput = z.infer<typeof MergeAudioVideoInputSchema>;

export const MergeAudioVideoOutputSchema = VideoOutSchema;
export type MergeAudioVideoOutput = z.infer<typeof MergeAudioVideoOutputSchema>;

function isTransloaditConfigured(): boolean {
  return Boolean(
    process.env.TRANSLOADIT_AUTH_KEY && process.env.TRANSLOADIT_AUTH_SECRET
  );
}

export const mergeAudioVideoExecutor: NodeExecutor<MergeAudioVideoInput, MergeAudioVideoOutput> = {
  type: "merge-audio-video",
  version: "1.0.0",
  inputSchema: MergeAudioVideoInputSchema,
  outputSchema: MergeAudioVideoOutputSchema,
  providers: ["internal"],  // Internal processing only
  config: {
    timeout: "5m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: MergeAudioVideoInput,
    _context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    if (!isTransloaditConfigured()) {
      return executeMock(input);
    }

    try {
      const transloadit = new Transloadit({
        authKey: process.env.TRANSLOADIT_AUTH_KEY!,
        authSecret: process.env.TRANSLOADIT_AUTH_SECRET!,
      });

      const result = await transloadit.createAssembly({
        params: {
          steps: {
            import_video: {
              robot: "/http/import",
              url: input.video.url,
              result: true,
            },
            import_audio: {
              robot: "/http/import",
              url: input.audio.url,
              result: true,
            },
            merge: {
              robot: "/video/merge",
              use: {
                steps: [
                  { name: "import_video", as: "video" },
                  { name: "import_audio", as: "audio" },
                ],
              },
              preset: "ipad-high",
              ffmpeg_stack: "v6.0.0",
              // Replace or mix audio
              ...(input.replaceAudio
                ? {}
                : { audio_fade_seconds: 0 }),
            },
            export: {
              robot: "/s3/store",
              use: "merge",
            },
          },
        },
        waitForCompletion: true,
      });

      if (result.ok !== "ASSEMBLY_COMPLETED") {
        throw new Error(`Transloadit assembly failed: ${result.error}`);
      }

      const mergedVideo = result.results?.merge?.[0];
      if (!mergedVideo) {
        throw new Error("No merged video in result");
      }

      return {
        success: true,
        output: {
          type: "video",
          video: {
            url: mergedVideo.ssl_url,
            mimeType: mergedVideo.mime,
            durationMs: mergedVideo.meta?.duration
              ? mergedVideo.meta.duration * 1000
              : undefined,
          },
        },
        providerUsed: "internal",
        actualCost: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerUsed: "internal",
      };
    }
  },
};

function executeMock(input: MergeAudioVideoInput): NodeExecutionResult {
  return {
    success: true,
    output: {
      type: "video",
      video: {
        url: input.video.url,
        mimeType: "video/mp4",
        durationMs: input.video.durationMs,
      },
    },
    providerUsed: "mock",
    actualCost: 0,
  };
}

export default mergeAudioVideoExecutor;

