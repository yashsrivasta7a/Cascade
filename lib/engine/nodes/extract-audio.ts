import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { AssetRefSchema, AudioOutSchema } from "@/lib/workflow/node-schemas";
import { spawn, spawnSync } from "child_process";
import { promises as fs, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
// Use static binary for serverless environments (Trigger.dev)
import ffmpegPath from "ffmpeg-static";
// Transloadit for cloud processing fallback
import { Transloadit } from "transloadit";

// =============================================================================
// EXTRACT AUDIO - Internal Utility Node (via FFmpeg or Transloadit)
// Local: Uses FFmpeg for audio extraction
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

export const ExtractAudioInputSchema = z.object({
  video: AssetRefSchema,
  format: z.enum(["mp3", "wav", "aac", "ogg"]).default("mp3"),
  bitrate: z.enum(["128k", "192k", "256k", "320k"]).default("192k"),
  sampleRate: z.enum(["22050", "44100", "48000"]).default("44100"),
  channels: z.enum(["1", "2"]).default("2"), // mono or stereo
  normalize: z.boolean().default(false),
  context: z.string().optional(),
  useCache: z.boolean().optional().default(false),
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

// =============================================================================
// TRANSLOADIT CLOUD FALLBACK
// =============================================================================

function isTransloaditConfigured(): boolean {
  return Boolean(process.env.TRANSLOADIT_AUTH_KEY && process.env.TRANSLOADIT_AUTH_SECRET);
}

async function extractAudioWithTransloadit(
  input: ExtractAudioInput
): Promise<NodeExecutionResult | null> {
  if (!isTransloaditConfigured()) {
    console.log("[ExtractAudio] Transloadit not configured, skipping cloud fallback");
    return null;
  }

  try {
    console.log("[ExtractAudio] Using Transloadit cloud processing");
    
    const client = new Transloadit({
      authKey: process.env.TRANSLOADIT_AUTH_KEY!,
      authSecret: process.env.TRANSLOADIT_AUTH_SECRET!,
    });

    const videoUrl = input.video.url;

    // Handle base64 data URLs - skip for now
    if (videoUrl.startsWith("data:")) {
      console.log("[ExtractAudio] Base64 video not supported for Transloadit fallback");
      return null;
    }

    // Map format to Transloadit preset
    const presetMap: Record<string, string> = {
      mp3: "mp3",
      wav: "wav",
      aac: "aac",
      ogg: "ogg",
    };

    // Create assembly to extract audio
    const assembly = await client.createAssembly({
      params: {
        steps: {
          // Import video
          imported: {
            robot: "/http/import",
            url: videoUrl,
            ignore_errors: ["meta"],
          },
          // Extract and encode audio
          extracted: {
            robot: "/audio/encode",
            use: "imported",
            preset: presetMap[input.format] || "mp3",
            bitrate: parseInt(input.bitrate) || 192,
            sample_rate: parseInt(input.sampleRate) || 44100,
            channels: parseInt(input.channels) || 2,
            ffmpeg_stack: "v6.0.0",
          },
        },
      },
      waitForCompletion: true,
    });

    console.log(`[ExtractAudio] Transloadit assembly: ${assembly.ok}`);

    if (assembly.results?.extracted?.[0]?.ssl_url) {
      const resultUrl = assembly.results.extracted[0].ssl_url;
      console.log(`[ExtractAudio] Transloadit result: ${resultUrl.slice(0, 80)}...`);
      
      return {
        success: true,
        output: {
          type: "audio",
          audio: {
            url: resultUrl,
            mimeType: FORMAT_MIMETYPES[input.format] || "audio/mpeg",
          },
        },
        providerUsed: "transloadit",
        actualCost: 2_000, // $0.002 for extract-audio operation
      };
    }

    console.warn("[ExtractAudio] Transloadit: No result URL in assembly");
    return null;
  } catch (error) {
    console.error("[ExtractAudio] Transloadit error:", error);
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
      // Try Transloadit cloud processing as fallback
      const transloaditResult = await extractAudioWithTransloadit(input);
      if (transloaditResult) {
        console.log("[ExtractAudio] Used Transloadit cloud processing");
        return transloaditResult;
      }
      
      // No Transloadit - use mock in development
      if (process.env.NODE_ENV === "development") {
        console.log("[ExtractAudio] FFmpeg not found, using mock audio for development");
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
          actualCost: 2_000, // $0.002 for extract-audio operation
        };
      }
      return {
        success: false,
        error: "FFmpeg is not installed and Transloadit is not configured. Please install FFmpeg or configure Transloadit.",
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
        actualCost: 2_000, // $0.002 for extract-audio operation
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
