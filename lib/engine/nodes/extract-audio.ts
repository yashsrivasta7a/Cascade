import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { AssetRefSchema, AudioOutSchema } from "@/lib/workflow/node-schemas";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
// Use static binary for serverless environments (Trigger.dev)
import ffmpegPath from "ffmpeg-static";

// =============================================================================
// EXTRACT AUDIO - Internal Utility Node (via FFmpeg)
// Runs on Trigger.dev using static ffmpeg binary
// =============================================================================

// Get the correct binary path (static or system)
const getFFmpegPath = (): string => ffmpegPath || "ffmpeg";

export const ExtractAudioInputSchema = z.object({
  video: AssetRefSchema,
  format: z.enum(["mp3", "wav", "aac", "ogg"]).default("mp3"),
  bitrate: z.enum(["128k", "192k", "256k", "320k"]).default("192k"),
  sampleRate: z.enum(["22050", "44100", "48000"]).default("44100"),
  channels: z.enum(["1", "2"]).default("2"), // mono or stereo
  normalize: z.boolean().default(false),
  context: z.string().optional(),
});

export type ExtractAudioInput = z.infer<typeof ExtractAudioInputSchema>;

export const ExtractAudioOutputSchema = AudioOutSchema;
export type ExtractAudioOutput = z.infer<typeof ExtractAudioOutputSchema>;

const FORMAT_CODECS: Record<string, string> = {
  mp3: "libmp3lame",
  wav: "pcm_s16le",
  aac: "aac",
  ogg: "libvorbis",
};

const FORMAT_MIMETYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  ogg: "audio/ogg",
};

async function isFFmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn(getFFmpegPath(), ["-version"]);
    ffmpeg.on("close", (code) => resolve(code === 0));
    ffmpeg.on("error", () => resolve(false));
  });
}

async function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(getFFmpegPath(), args);
    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`FFmpeg error: ${err.message}. Make sure FFmpeg is installed and in PATH.`));
    });
  });
}

export const extractAudioExecutor: NodeExecutor<ExtractAudioInput, ExtractAudioOutput> = {
  type: "extract-audio",
  version: "1.0.0",
  inputSchema: ExtractAudioInputSchema,
  outputSchema: ExtractAudioOutputSchema,
  providers: ["internal"], // Uses FFmpeg internally
  config: {
    timeout: "5m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: ExtractAudioInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // Check if FFmpeg is available
    const ffmpegAvailable = await isFFmpegAvailable();
    if (!ffmpegAvailable) {
      // In development, return a mock audio if FFmpeg isn't available
      if (process.env.NODE_ENV === "development") {
        console.log("[ExtractAudio] FFmpeg not found, using mock audio for development");
        // Return a simple silent audio as mock
        const mockMimeType = FORMAT_MIMETYPES[input.format] ?? "audio/mpeg";
        return {
          success: true,
          output: {
            type: "audio",
            audio: {
              url: "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav",
              mimeType: mockMimeType,
            },
          },
          providerUsed: "mock",
          actualCost: 0,
        };
      }
      return {
        success: false,
        error: "FFmpeg is not installed or not in PATH. Please install FFmpeg to use audio extraction. Download from: https://ffmpeg.org/download.html",
        providerUsed: "internal",
      };
    }

    const tempDir = tmpdir();
    const inputPath = join(tempDir, `input-${randomUUID()}.mp4`);
    const outputPath = join(tempDir, `output-${randomUUID()}.${input.format}`);

    try {
      // Download or decode the video
      let videoBuffer: Buffer;
      if (input.video.url.startsWith("data:")) {
        const base64Data = input.video.url.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid data URL format");
        }
        videoBuffer = Buffer.from(base64Data, "base64");
      } else if (input.video.url.startsWith("blob:")) {
        throw new Error("Blob URLs cannot be processed on the server. Please use a file upload.");
      } else {
        const response = await fetch(input.video.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.statusText}`);
        }
        videoBuffer = Buffer.from(await response.arrayBuffer());
      }
      
      // Check file size (limit for base64 transport)
      const fileSizeMB = videoBuffer.length / (1024 * 1024);
      if (fileSizeMB > 10) {
        throw new Error(`Video file too large (${fileSizeMB.toFixed(1)}MB). Maximum size is 10MB for processing.`);
      }

      await fs.writeFile(inputPath, videoBuffer);

      // Build FFmpeg command
      const codec = FORMAT_CODECS[input.format] ?? "libmp3lame";
      const args = [
        "-y", // Overwrite output
        "-i", inputPath,
        "-vn", // No video
        "-acodec", codec,
        "-b:a", input.bitrate,
        "-ar", input.sampleRate,
        "-ac", input.channels,
      ];

      // Add normalization filter if requested
      if (input.normalize) {
        args.push("-af", "loudnorm=I=-16:TP=-1.5:LRA=11");
      }

      args.push(outputPath);

      console.log(`[ExtractAudio] Running FFmpeg with args:`, args.join(" "));
      await runFFmpeg(args);

      // Read the output and convert to base64
      const audioBuffer = await fs.readFile(outputPath);
      const mimeType = FORMAT_MIMETYPES[input.format] ?? "audio/mpeg";
      const base64 = audioBuffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // Cleanup temp files
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});

      console.log(`[ExtractAudio] Success! Output size: ${(audioBuffer.length / 1024).toFixed(1)}KB`);

      return {
        success: true,
        output: {
          type: "audio",
          audio: {
            url: dataUrl,
            mimeType,
          },
        },
        providerUsed: "internal",
        actualCost: 0,
      };
    } catch (error) {
      // Cleanup on error
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});

      console.error(`[ExtractAudio] Error:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerUsed: "internal",
      };
    }
  },
};

export default extractAudioExecutor;
