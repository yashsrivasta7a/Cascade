import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { AssetRefSchema, VideoOutSchema } from "@/lib/workflow/node-schemas";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

// =============================================================================
// MERGE VIDEOS - Internal Utility Node (via FFmpeg)
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

// Check if a video file has an audio stream
async function hasAudioStream(videoPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "a",
      "-show_entries", "stream=codec_type",
      "-of", "csv=p=0",
      videoPath,
    ]);
    
    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });
    
    ffprobe.on("close", () => {
      resolve(output.trim().length > 0);
    });
    
    ffprobe.on("error", () => {
      // If ffprobe fails, assume no audio to be safe
      resolve(false);
    });
  });
}

// Get video duration in seconds
async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      videoPath,
    ]);
    
    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });
    
    ffprobe.on("close", () => {
      const duration = parseFloat(output.trim());
      resolve(isNaN(duration) ? 5 : duration); // Default to 5 seconds if parsing fails
    });
    
    ffprobe.on("error", () => {
      resolve(5); // Default duration
    });
  });
}

export const mergeVideosExecutor: NodeExecutor<MergeVideosInput, MergeVideosOutput> = {
  type: "merge-videos",
  version: "1.0.0",
  inputSchema: MergeVideosInputSchema,
  outputSchema: MergeVideosOutputSchema,
  providers: ["internal"], // Uses FFmpeg internally
  config: {
    timeout: "10m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: MergeVideosInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // Check if FFmpeg is available
    const ffmpegAvailable = await isFFmpegAvailable();
    if (!ffmpegAvailable) {
      if (process.env.NODE_ENV === "development") {
        console.log("[MergeVideos] FFmpeg not found, using mock for development");
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
    const video1Path = join(tempDir, `video1-${randomUUID()}.mp4`);
    const video2Path = join(tempDir, `video2-${randomUUID()}.mp4`);
    const concatListPath = join(tempDir, `concat-${randomUUID()}.txt`);
    const outputPath = join(tempDir, `output-${randomUUID()}.mp4`);

    try {
      // Helper to get buffer from URL or data URL
      const getBuffer = async (url: string, name: string): Promise<Buffer> => {
        if (url.startsWith("data:")) {
          const base64Data = url.split(",")[1];
          if (!base64Data) throw new Error(`Invalid ${name} data URL format`);
          return Buffer.from(base64Data, "base64");
        } else if (url.startsWith("blob:")) {
          throw new Error(`Blob URLs cannot be processed on the server. Please use a file upload for ${name}.`);
        } else {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch ${name}: ${response.statusText}`);
          return Buffer.from(await response.arrayBuffer());
        }
      };

      // Get video buffers
      const [video1Buffer, video2Buffer] = await Promise.all([
        getBuffer(input.video1.url, "video 1"),
        getBuffer(input.video2.url, "video 2"),
      ]);

      await fs.writeFile(video1Path, video1Buffer);
      await fs.writeFile(video2Path, video2Buffer);

      let args: string[];

      if (input.transition === "none") {
        // Simple concatenation using concat demuxer
        const concatContent = `file '${video1Path}'\nfile '${video2Path}'`;
        await fs.writeFile(concatListPath, concatContent);

        args = [
          "-y",
          "-f", "concat",
          "-safe", "0",
          "-i", concatListPath,
          "-c", "copy",
          outputPath,
        ];
      } else {
        // Use xfade filter for transitions
        const xfadeType = input.transition === "fade" ? "fade" : "dissolve";
        const duration = input.transitionDuration;

        // Check if videos have audio streams
        const [hasAudio1, hasAudio2, video1Duration] = await Promise.all([
          hasAudioStream(video1Path),
          hasAudioStream(video2Path),
          getVideoDuration(video1Path),
        ]);

        // Calculate offset: transition should start near the end of video 1
        // Offset = video1 duration - transition duration
        const offset = Math.max(0, video1Duration - duration);

        console.log(`[MergeVideos] Video 1 duration: ${video1Duration}s, offset: ${offset}s`);
        console.log(`[MergeVideos] Audio streams - Video 1: ${hasAudio1}, Video 2: ${hasAudio2}`);

        // Build filter complex based on audio availability
        let filterComplex: string;
        let mapArgs: string[];

        if (hasAudio1 && hasAudio2) {
          // Both videos have audio - crossfade both video and audio
          filterComplex = `[0:v][1:v]xfade=transition=${xfadeType}:duration=${duration}:offset=${offset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;
          mapArgs = ["-map", "[v]", "-map", "[a]"];
        } else if (hasAudio1) {
          // Only video 1 has audio - just use video 1's audio
          filterComplex = `[0:v][1:v]xfade=transition=${xfadeType}:duration=${duration}:offset=${offset}[v]`;
          mapArgs = ["-map", "[v]", "-map", "0:a"];
        } else if (hasAudio2) {
          // Only video 2 has audio - just use video 2's audio
          filterComplex = `[0:v][1:v]xfade=transition=${xfadeType}:duration=${duration}:offset=${offset}[v]`;
          mapArgs = ["-map", "[v]", "-map", "1:a"];
        } else {
          // Neither video has audio - video only
          filterComplex = `[0:v][1:v]xfade=transition=${xfadeType}:duration=${duration}:offset=${offset}[v]`;
          mapArgs = ["-map", "[v]"];
        }

        args = [
          "-y",
          "-i", video1Path,
          "-i", video2Path,
          "-filter_complex", filterComplex,
          ...mapArgs,
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "28", // Compress for smaller file size (lower = better quality, larger file)
          "-maxrate", "2M", // Limit bitrate to reduce output size
          "-bufsize", "4M",
          ...(hasAudio1 || hasAudio2 ? ["-c:a", "aac", "-b:a", "128k"] : []),
          outputPath,
        ];
      }

      await runFFmpeg(args);

      // Read output
      const outputBuffer = await fs.readFile(outputPath);
      const base64 = outputBuffer.toString("base64");
      const dataUrl = `data:video/mp4;base64,${base64}`;

      // Cleanup
      await fs.unlink(video1Path).catch(() => {});
      await fs.unlink(video2Path).catch(() => {});
      await fs.unlink(concatListPath).catch(() => {});
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
      await fs.unlink(video1Path).catch(() => {});
      await fs.unlink(video2Path).catch(() => {});
      await fs.unlink(concatListPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerUsed: "internal",
      };
    }
  },
};

export default mergeVideosExecutor;
