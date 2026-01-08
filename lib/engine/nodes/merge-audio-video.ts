import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { AssetRefSchema, VideoOutSchema } from "@/lib/workflow/node-schemas";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

// =============================================================================
// MERGE AUDIO + VIDEO - Internal Utility Node (via FFmpeg)
// =============================================================================

export const MergeAudioVideoInputSchema = z.object({
  video: AssetRefSchema,
  audio: AssetRefSchema,
  replaceAudio: z.boolean().default(true), // true = replace original audio, false = mix
  context: z.string().optional(),
});

export type MergeAudioVideoInput = z.infer<typeof MergeAudioVideoInputSchema>;

export const MergeAudioVideoOutputSchema = VideoOutSchema;
export type MergeAudioVideoOutput = z.infer<typeof MergeAudioVideoOutputSchema>;

async function isFFmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", ["-version"]);
    ffmpeg.on("close", (code) => resolve(code === 0));
    ffmpeg.on("error", () => resolve(false));
  });
}

async function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);
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
      reject(new Error(`FFmpeg error: ${err.message}. Make sure FFmpeg is installed.`));
    });
  });
}

export const mergeAudioVideoExecutor: NodeExecutor<MergeAudioVideoInput, MergeAudioVideoOutput> = {
  type: "merge-audio-video",
  version: "1.0.0",
  inputSchema: MergeAudioVideoInputSchema,
  outputSchema: MergeAudioVideoOutputSchema,
  providers: ["internal"], // Uses FFmpeg internally
  config: {
    timeout: "10m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: MergeAudioVideoInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // Check if FFmpeg is available
    const ffmpegAvailable = await isFFmpegAvailable();
    if (!ffmpegAvailable) {
      if (process.env.NODE_ENV === "development") {
        console.log("[MergeAudioVideo] FFmpeg not found, using mock for development");
        return {
          success: true,
          output: {
            type: "video",
            video: {
              url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
              mimeType: "video/mp4",
            },
          },
          providerUsed: "mock",
          actualCost: 0,
        };
      }
      return {
        success: false,
        error: "FFmpeg is not installed. Please install FFmpeg: https://ffmpeg.org/download.html",
        providerUsed: "internal",
      };
    }

    const tempDir = tmpdir();
    const videoPath = join(tempDir, `video-${randomUUID()}.mp4`);
    const audioPath = join(tempDir, `audio-${randomUUID()}.mp3`);
    const outputPath = join(tempDir, `output-${randomUUID()}.mp4`);

    try {
      // Helper to get buffer from URL or data URL
      const getBuffer = async (url: string, type: string): Promise<Buffer> => {
        if (url.startsWith("data:")) {
          const base64Data = url.split(",")[1];
          if (!base64Data) throw new Error(`Invalid ${type} data URL format`);
          return Buffer.from(base64Data, "base64");
        } else if (url.startsWith("blob:")) {
          throw new Error(`Blob URLs cannot be processed on the server. Please use a file upload for ${type}.`);
        } else {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch ${type}: ${response.statusText}`);
          return Buffer.from(await response.arrayBuffer());
        }
      };

      // Get video and audio buffers
      const videoBuffer = await getBuffer(input.video.url, "video");
      await fs.writeFile(videoPath, videoBuffer);

      const audioBuffer = await getBuffer(input.audio.url, "audio");
      await fs.writeFile(audioPath, audioBuffer);

      // Build FFmpeg command
      let args: string[];
      
      if (input.replaceAudio) {
        // Replace original audio with new audio
        args = [
          "-y",
          "-i", videoPath,
          "-i", audioPath,
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "28", // Compress for smaller output
          "-maxrate", "2M",
          "-bufsize", "4M",
          "-map", "0:v:0",
          "-map", "1:a:0",
          "-c:a", "aac",
          "-b:a", "128k",
          "-shortest",
          outputPath,
        ];
      } else {
        // Mix original and new audio
        args = [
          "-y",
          "-i", videoPath,
          "-i", audioPath,
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "28", // Compress for smaller output
          "-maxrate", "2M",
          "-bufsize", "4M",
          "-filter_complex", "[0:a][1:a]amerge=inputs=2[a]",
          "-map", "0:v:0",
          "-map", "[a]",
          "-c:a", "aac",
          "-b:a", "128k",
          "-ac", "2",
          "-shortest",
          outputPath,
        ];
      }

      await runFFmpeg(args);

      // Read output and convert to base64
      const outputBuffer = await fs.readFile(outputPath);
      const base64 = outputBuffer.toString("base64");
      const dataUrl = `data:video/mp4;base64,${base64}`;

      // Cleanup
      await fs.unlink(videoPath).catch(() => {});
      await fs.unlink(audioPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});

      return {
        success: true,
        output: {
          type: "video",
          video: {
            url: dataUrl,
            mimeType: "video/mp4",
          },
        },
        providerUsed: "internal",
        actualCost: 0,
      };
    } catch (error) {
      // Cleanup on error
      await fs.unlink(videoPath).catch(() => {});
      await fs.unlink(audioPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerUsed: "internal",
      };
    }
  },
};

export default mergeAudioVideoExecutor;
