import { z } from "zod";
import { Transloadit } from "transloadit";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { AssetRefSchema, AudioOutSchema } from "@/lib/workflow/node-schemas";

// =============================================================================
// EXTRACT AUDIO - Internal Utility Node (via Transloadit)
// =============================================================================

export const ExtractAudioInputSchema = z.object({
  video: AssetRefSchema,
  format: z.enum(["mp3", "wav", "aac"]).default("mp3"),
  context: z.string().optional(),
});

export type ExtractAudioInput = z.infer<typeof ExtractAudioInputSchema>;

export const ExtractAudioOutputSchema = AudioOutSchema;
export type ExtractAudioOutput = z.infer<typeof ExtractAudioOutputSchema>;

function isTransloaditConfigured(): boolean {
  return Boolean(
    process.env.TRANSLOADIT_AUTH_KEY && process.env.TRANSLOADIT_AUTH_SECRET
  );
}

const FORMAT_PRESETS: Record<string, string> = {
  mp3: "mp3",
  wav: "wav",
  aac: "aac",
};

export const extractAudioExecutor: NodeExecutor<ExtractAudioInput, ExtractAudioOutput> = {
  type: "extract-audio",
  version: "1.0.0",
  inputSchema: ExtractAudioInputSchema,
  outputSchema: ExtractAudioOutputSchema,
  providers: ["internal"],  // Internal processing only
  config: {
    timeout: "2m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: ExtractAudioInput,
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
            import: {
              robot: "/http/import",
              url: input.video.url,
            },
            extract: {
              robot: "/audio/encode",
              use: "import",
              preset: FORMAT_PRESETS[input.format] ?? "mp3",
              ffmpeg_stack: "v6.0.0",
            },
            export: {
              robot: "/s3/store",
              use: "extract",
            },
          },
        },
        waitForCompletion: true,
      });

      if (result.ok !== "ASSEMBLY_COMPLETED") {
        throw new Error(`Transloadit assembly failed: ${result.error}`);
      }

      const extractedAudio = result.results?.extract?.[0];
      if (!extractedAudio) {
        throw new Error("No extracted audio in result");
      }

      return {
        success: true,
        output: {
          type: "audio",
          audio: {
            url: extractedAudio.ssl_url,
            mimeType: extractedAudio.mime,
            durationMs: extractedAudio.meta?.duration
              ? extractedAudio.meta.duration * 1000
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

function executeMock(input: ExtractAudioInput): NodeExecutionResult {
  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    aac: "audio/aac",
  };

  return {
    success: true,
    output: {
      type: "audio",
      audio: {
        url: "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav",
        mimeType: mimeTypes[input.format] ?? "audio/mpeg",
        durationMs: input.video.durationMs,
      },
    },
    providerUsed: "mock",
    actualCost: 0,
  };
}

export default extractAudioExecutor;

