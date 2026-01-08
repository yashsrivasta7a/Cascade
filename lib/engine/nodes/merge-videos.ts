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
  console.log(`[FFmpeg] Running: ffmpeg ${args.join(" ")}`);
  
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log("[FFmpeg] Success");
        resolve();
      } else {
        console.error(`[FFmpeg] Failed with code ${code}`);
        console.error(`[FFmpeg] stderr: ${stderr.slice(-1000)}`);
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    ffmpeg.on("error", (err) => {
      console.error(`[FFmpeg] Spawn error: ${err.message}`);
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

// Get video info (resolution and fps)
interface VideoInfo {
  width: number;
  height: number;
  fps: number;
}

async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,r_frame_rate",
      "-of", "json",
      videoPath,
    ]);
    
    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });
    
    ffprobe.on("close", () => {
      try {
        const json = JSON.parse(output);
        const stream = json.streams?.[0];
        if (stream) {
          const [num, den] = (stream.r_frame_rate || "30/1").split("/");
          const fps = Math.round(parseInt(num) / parseInt(den)) || 30;
          resolve({
            width: stream.width || 1920,
            height: stream.height || 1080,
            fps,
          });
        } else {
          resolve({ width: 1920, height: 1080, fps: 30 });
        }
      } catch {
        resolve({ width: 1920, height: 1080, fps: 30 });
      }
    });
    
    ffprobe.on("error", () => {
      resolve({ width: 1920, height: 1080, fps: 30 });
    });
  });
}

// Normalize a video to specific resolution, fps, and ensure it has audio
async function normalizeVideo(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
  fps: number
): Promise<void> {
  // Check if video has audio
  const hasAudio = await hasAudioStream(inputPath);
  
  let args: string[];
  
  if (hasAudio) {
    // Video has audio - just normalize video and re-encode audio
    args = [
      "-y",
      "-i", inputPath,
      "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps},format=yuv420p`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-ar", "44100",
      "-ac", "2",
      "-shortest",
      outputPath,
    ];
  } else {
    // Video has no audio - add silent audio track
    args = [
      "-y",
      "-i", inputPath,
      "-f", "lavfi",
      "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps},format=yuv420p`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-ar", "44100",
      "-ac", "2",
      "-shortest",
      outputPath,
    ];
  }
  
  await runFFmpeg(args);
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
    const uuid = randomUUID();
    const video1RawPath = join(tempDir, `video1-raw-${uuid}.mp4`);
    const video2RawPath = join(tempDir, `video2-raw-${uuid}.mp4`);
    const video1Path = join(tempDir, `video1-${uuid}.mp4`);
    const video2Path = join(tempDir, `video2-${uuid}.mp4`);
    const concatListPath = join(tempDir, `concat-${uuid}.txt`);
    const outputPath = join(tempDir, `output-${uuid}.mp4`);

    const cleanupFiles = async () => {
      await fs.unlink(video1RawPath).catch(() => {});
      await fs.unlink(video2RawPath).catch(() => {});
      await fs.unlink(video1Path).catch(() => {});
      await fs.unlink(video2Path).catch(() => {});
      await fs.unlink(concatListPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    };

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

      await fs.writeFile(video1RawPath, video1Buffer);
      await fs.writeFile(video2RawPath, video2Buffer);

      // Get video info to determine target resolution
      const [info1, info2] = await Promise.all([
        getVideoInfo(video1RawPath),
        getVideoInfo(video2RawPath),
      ]);

      // Use the larger resolution as target (or first video's resolution)
      const targetWidth = Math.max(info1.width, info2.width);
      const targetHeight = Math.max(info1.height, info2.height);
      const targetFps = Math.max(info1.fps, info2.fps, 24); // At least 24fps

      console.log(`[MergeVideos] Video 1: ${info1.width}x${info1.height}@${info1.fps}fps`);
      console.log(`[MergeVideos] Video 2: ${info2.width}x${info2.height}@${info2.fps}fps`);
      console.log(`[MergeVideos] Normalizing to: ${targetWidth}x${targetHeight}@${targetFps}fps`);

      // Normalize both videos to same resolution, fps, and pixel format
      await Promise.all([
        normalizeVideo(video1RawPath, video1Path, targetWidth, targetHeight, targetFps),
        normalizeVideo(video2RawPath, video2Path, targetWidth, targetHeight, targetFps),
      ]);

      let args: string[];

      if (input.transition === "none") {
        // Simple concatenation using concat demuxer
        const concatContent = `file '${video1Path.replace(/\\/g, "/")}'\nfile '${video2Path.replace(/\\/g, "/")}'`;
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
        
        // Get durations of both normalized videos
        const [video1Duration, video2Duration] = await Promise.all([
          getVideoDuration(video1Path),
          getVideoDuration(video2Path),
        ]);

        // Ensure transition duration doesn't exceed either video's length
        // Transition must be shorter than the shortest video
        const maxTransitionDuration = Math.min(video1Duration, video2Duration) * 0.9;
        const duration = Math.min(input.transitionDuration, maxTransitionDuration, 2);

        // Calculate offset: transition should start near the end of video 1
        // Offset must be at least 0 and leave room for the transition
        const offset = Math.max(0.1, video1Duration - duration);

        console.log(`[MergeVideos] Video 1 duration: ${video1Duration}s, Video 2 duration: ${video2Duration}s`);
        console.log(`[MergeVideos] Transition: ${xfadeType}, duration: ${duration}s, offset: ${offset}s`);

        // Build filter complex - videos are now normalized so we can safely use xfade
        // Both normalized videos have audio (added silent audio if none existed)
        const filterComplex = `[0:v][1:v]xfade=transition=${xfadeType}:duration=${duration}:offset=${offset}[v];[0:a][1:a]acrossfade=d=${duration}[a]`;

        console.log(`[MergeVideos] Filter complex: ${filterComplex}`);

        args = [
          "-y",
          "-i", video1Path,
          "-i", video2Path,
          "-filter_complex", filterComplex,
          "-map", "[v]",
          "-map", "[a]",
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "23",
          "-c:a", "aac",
          "-b:a", "128k",
          outputPath,
        ];
      }

      await runFFmpeg(args);

      // Read output
      const outputBuffer = await fs.readFile(outputPath);
      const base64 = outputBuffer.toString("base64");
      const dataUrl = `data:video/mp4;base64,${base64}`;

      // Cleanup
      await cleanupFiles();

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
      await cleanupFiles();

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerUsed: "internal",
      };
    }
  },
};

export default mergeVideosExecutor;
