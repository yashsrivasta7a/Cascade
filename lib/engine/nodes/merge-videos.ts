import { z } from "zod";
import dotenv from "dotenv";
import { Transloadit } from "transloadit";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { AssetRefSchema, VideoOutSchema } from "@/lib/workflow/node-schemas";

dotenv.config({ path: ".env.local" });

// =============================================================================
// MERGE VIDEOS - Internal Utility Node (via Transloadit)
// =============================================================================

export const MergeVideosInputSchema = z.object({
  video1: AssetRefSchema,
  video2: AssetRefSchema,
  transition: z.enum(["none", "fade", "dissolve"]).default("none"),
  transitionDuration: z.number().min(0).max(2).default(0.5),
  context: z.string().optional(),
});

export type MergeVideosInput = z.infer<typeof MergeVideosInputSchema>;

export const MergeVideosOutputSchema = VideoOutSchema;
export type MergeVideosOutput = z.infer<typeof MergeVideosOutputSchema>;

function isTransloaditConfigured(): boolean {
  return Boolean(
    process.env.TRANSLOADIT_AUTH_KEY && process.env.TRANSLOADIT_AUTH_SECRET
  );
}

export const mergeVideosExecutor: NodeExecutor<MergeVideosInput, MergeVideosOutput> = {
  type: "merge-videos",
  version: "1.0.0",
  inputSchema: MergeVideosInputSchema,
  outputSchema: MergeVideosOutputSchema,
  providers: ["internal"],  // Internal processing only
  config: {
    timeout: "5m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: MergeVideosInput,
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
            import_video1: {
              robot: "/http/import",
              url: input.video1.url,
              result: true,
            },
            import_video2: {
              robot: "/http/import",
              url: input.video2.url,
              result: true,
            },
            concat: {
              robot: "/video/concat",
              use: {
                steps: [
                  { name: "import_video1", as: "video_1" },
                  { name: "import_video2", as: "video_2" },
                ],
              },
              preset: "ipad-high",
              ffmpeg_stack: "v6.0.0",
            },
            export: {
              robot: "/s3/store",
              use: "concat",
            },
          },
        },
        waitForCompletion: true,
      });

      if (result.ok !== "ASSEMBLY_COMPLETED") {
        throw new Error(`Transloadit assembly failed: ${result.error}`);
      }

      const concatenatedVideo = result.results?.concat?.[0];
      if (!concatenatedVideo) {
        throw new Error("No concatenated video in result");
      }

      return {
        success: true,
        output: {
          type: "video",
          video: {
            url: concatenatedVideo.ssl_url,
            mimeType: concatenatedVideo.mime,
            durationMs: concatenatedVideo.meta?.duration
              ? concatenatedVideo.meta.duration * 1000
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

function executeMock(input: MergeVideosInput): NodeExecutionResult {
  return {
    success: true,
    output: {
      type: "video",
      video: {
        url: input.video1.url,
        mimeType: "video/mp4",
        durationMs: (input.video1.durationMs ?? 0) + (input.video2.durationMs ?? 0),
      },
    },
    providerUsed: "mock",
    actualCost: 0,
  };
}

export default mergeVideosExecutor;

