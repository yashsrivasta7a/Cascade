import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { AssetRefSchema, VideoOutSchema } from "@/lib/workflow/node-schemas";
import { spawn, spawnSync } from "child_process";
import { promises as fs, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
// Use static binaries for serverless environments (Trigger.dev)
import ffmpegPath from "ffmpeg-static";
// Transloadit for cloud video processing fallback
import { Transloadit } from "transloadit";

// =============================================================================
// MERGE AUDIO + VIDEO - Internal Utility Node (via FFmpeg or Transloadit)
// Local: Uses FFmpeg for video processing
// Cloud: Falls back to Transloadit when FFmpeg unavailable
// =============================================================================

// Cache for resolved FFmpeg path
let resolvedFFmpegPath: string | null = null;

// Find WinGet FFmpeg installations dynamically
function findWinGetFFmpeg(): string | null {
  if (process.platform !== "win32") return null;
  
  const wingetPackagesDir = join(
    process.env.LOCALAPPDATA || "",
    "Microsoft", "WinGet", "Packages"
  );
  
  try {
    if (!existsSync(wingetPackagesDir)) return null;
    
    const { readdirSync } = require("fs");
    const packages = readdirSync(wingetPackagesDir) as string[];
    const ffmpegPkg = packages.find((p: string) => p.startsWith("Gyan.FFmpeg"));
    
    if (!ffmpegPkg) return null;
    
    const pkgDir = join(wingetPackagesDir, ffmpegPkg);
    const builds = readdirSync(pkgDir) as string[];
    const ffmpegBuild = builds.find((b: string) => b.includes("full_build"));
    
    if (!ffmpegBuild) return null;
    
    const ffmpegExe = join(pkgDir, ffmpegBuild, "bin", "ffmpeg.exe");
    if (existsSync(ffmpegExe)) {
      return ffmpegExe;
    }
  } catch (err) {
    console.log("[FFmpeg] Error searching WinGet packages:", err);
  }
  
  return null;
}

// Get the correct binary path with robust fallbacks
function getFFmpegPath(): string {
  if (resolvedFFmpegPath) return resolvedFFmpegPath;
  
  const candidates: string[] = [];
  
  // 1. Environment variable (highest priority)
  if (process.env.FFMPEG_PATH) {
    candidates.push(process.env.FFMPEG_PATH);
  }
  
  // 2. ffmpeg-static package
  if (ffmpegPath) {
    candidates.push(ffmpegPath);
  }
  
  // 3. WinGet installation (dynamic search)
  const wingetPath = findWinGetFFmpeg();
  if (wingetPath) {
    candidates.push(wingetPath);
  }
  
  // 4. Common Windows paths
  if (process.platform === "win32") {
    candidates.push(
      "C:\\ffmpeg\\bin\\ffmpeg.exe",
      "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
      "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
      join(process.env.USERPROFILE || "", "ffmpeg", "bin", "ffmpeg.exe"),
    );
  }
  
  // 5. System PATH fallback
  candidates.push("ffmpeg");
  
  // Test each candidate
  for (const candidate of candidates) {
    if (candidate && testBinary(candidate)) {
      console.log(`[FFmpeg] Found working binary at: ${candidate}`);
      resolvedFFmpegPath = candidate;
      return candidate;
    }
  }
  
  console.warn("[FFmpeg] No working FFmpeg binary found. Candidates tested:", candidates.filter(Boolean));
  resolvedFFmpegPath = "ffmpeg";
  return resolvedFFmpegPath;
}

// Test if a binary is executable
function testBinary(binaryPath: string): boolean {
  try {
    if (binaryPath.includes("/") || binaryPath.includes("\\")) {
      if (!existsSync(binaryPath)) {
        return false;
      }
    }
    const result = spawnSync(binaryPath, ["-version"], { 
      timeout: 5000,
      windowsHide: true,
      stdio: "pipe"
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

export const MergeAudioVideoInputSchema = z.object({
  video: AssetRefSchema,
  audio: AssetRefSchema,
  replaceAudio: z.boolean().default(true), // true = replace original audio, false = mix
  context: z.string().optional(),
  useCache: z.boolean().optional().default(false),
});

export type MergeAudioVideoInput = z.infer<typeof MergeAudioVideoInputSchema>;

export const MergeAudioVideoOutputSchema = VideoOutSchema;
export type MergeAudioVideoOutput = z.infer<typeof MergeAudioVideoOutputSchema>;

// =============================================================================
// TRANSLOADIT CLOUD FALLBACK
// =============================================================================

function isTransloaditConfigured(): boolean {
  return Boolean(process.env.TRANSLOADIT_AUTH_KEY && process.env.TRANSLOADIT_AUTH_SECRET);
}

async function mergeAudioVideoWithTransloadit(
  input: MergeAudioVideoInput
): Promise<NodeExecutionResult | null> {
  if (!isTransloaditConfigured()) {
    console.log("[MergeAudioVideo] Transloadit not configured, skipping cloud fallback");
    return null;
  }

  try {
    console.log("[MergeAudioVideo] Using Transloadit cloud processing");
    
    const client = new Transloadit({
      authKey: process.env.TRANSLOADIT_AUTH_KEY!,
      authSecret: process.env.TRANSLOADIT_AUTH_SECRET!,
    });

    const videoUrl = input.video.url;
    const audioUrl = input.audio.url;

    // Handle base64 data URLs - skip for now
    if (videoUrl.startsWith("data:") || audioUrl.startsWith("data:")) {
      console.log("[MergeAudioVideo] Base64 media not supported for Transloadit fallback");
      return null;
    }

    // Create assembly to merge audio and video
    const assembly = await client.createAssembly({
      params: {
        steps: {
          // Import video
          video: {
            robot: "/http/import",
            url: videoUrl,
            ignore_errors: ["meta"],
          },
          // Import audio
          audio: {
            robot: "/http/import",
            url: audioUrl,
            ignore_errors: ["meta"],
          },
          // Merge audio with video
          merged: {
            robot: "/video/encode",
            use: {
              steps: [
                { name: "video", as: "video" },
                { name: "audio", as: "audio" },
              ],
            },
            preset: "iphone-high",
            ffmpeg_stack: "v6.0.0",
            // Replace audio entirely
            ...(input.replaceAudio && {
              ffmpeg: {
                an: false, // Remove original audio
                map: ["0:v", "1:a"], // Map video from first input, audio from second
              },
            }),
          },
        },
      },
      waitForCompletion: true,
    });

    console.log(`[MergeAudioVideo] Transloadit assembly: ${assembly.ok}`);

    if (assembly.results?.merged?.[0]?.ssl_url) {
      const resultUrl = assembly.results.merged[0].ssl_url;
      console.log(`[MergeAudioVideo] Transloadit result: ${resultUrl.slice(0, 80)}...`);
      
      return {
        success: true,
        output: {
          type: "video",
          video: {
            url: resultUrl,
            mimeType: assembly.results.merged[0].mime || "video/mp4",
          },
        },
        providerUsed: "transloadit",
        actualCost: 3_000, // $0.003 for merge-audio-video operation
      };
    }

    console.warn("[MergeAudioVideo] Transloadit: No result URL in assembly");
    return null;
  } catch (error) {
    console.error("[MergeAudioVideo] Transloadit error:", error);
    return null;
  }
}

// =============================================================================
// FFMPEG LOCAL PROCESSING
// =============================================================================

async function isFFmpegAvailable(): Promise<boolean> {
  const ffmpegBin = getFFmpegPath();
  console.log(`[FFmpeg] Checking availability at: ${ffmpegBin}`);
  
  return new Promise((resolve) => {
    const ffmpeg = spawn(ffmpegBin, ["-version"], { windowsHide: true });
    
    ffmpeg.on("close", (code) => {
      console.log(`[FFmpeg] Version check exit code: ${code}`);
      resolve(code === 0);
    });
    
    ffmpeg.on("error", (err) => {
      console.log(`[FFmpeg] Version check error: ${err.message}`);
      resolve(false);
    });
  });
}

async function runFFmpeg(args: string[]): Promise<void> {
  const ffmpegBin = getFFmpegPath();
  console.log(`[FFmpeg] Running: ${ffmpegBin} ${args.slice(0, 5).join(" ")}...`);
  
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegBin, args, { windowsHide: true });
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
    // ==========================================================================
    // PREFER TRANSLOADIT (cloud processing) - avoids OOM on small machines
    // ==========================================================================
    if (isTransloaditConfigured()) {
      console.log("[MergeAudioVideo] Transloadit configured - using cloud processing (recommended)");
      const transloaditResult = await mergeAudioVideoWithTransloadit(input);
      if (transloaditResult) {
        console.log("[MergeAudioVideo] Transloadit processing successful");
        return transloaditResult;
      }
      console.warn("[MergeAudioVideo] Transloadit failed, falling back to local FFmpeg");
    }

    // ==========================================================================
    // FALLBACK: Local FFmpeg processing (uses more RAM, may OOM on small machines)
    // ==========================================================================
    const ffmpegAvailable = await isFFmpegAvailable();
    if (!ffmpegAvailable) {
      // No FFmpeg and no Transloadit - use mock in development
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
          actualCost: 3_000,
        };
      }
      return {
        success: false,
        error: "FFmpeg is not installed and Transloadit is not configured. Please install FFmpeg or configure Transloadit.",
        providerUsed: "internal",
      };
    }
    
    console.log("[MergeAudioVideo] Using local FFmpeg (warning: may OOM on small machines)");

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
        actualCost: 3_000, // $0.003 for merge-audio-video operation
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
