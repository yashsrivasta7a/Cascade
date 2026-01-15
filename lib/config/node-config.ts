import { z } from "zod";
import type { NodeConfig, NodeConfigRegistry } from "./types";

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

// Asset reference schema (for images, videos, audio files)
export const AssetRefSchema = z.object({
  url: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

// Output schemas
export const TextOutSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const ImageOutSchema = z.object({
  type: z.literal("image"),
  image: AssetRefSchema,
});

export const VideoOutSchema = z.object({
  type: z.literal("video"),
  video: AssetRefSchema,
});

export const AudioOutSchema = z.object({
  type: z.literal("audio"),
  audio: AssetRefSchema,
});

// =============================================================================
// FAL.AI MODEL IDS
// =============================================================================

export const FAL_MODELS = {
  seedream: "fal-ai/seedream-4.5",
  seedvr: "fal-ai/seed-vr-2",
  seedance: "fal-ai/seedance-1.5",
  elevenlabs: "fal-ai/elevenlabs/v3",
  lipsync: "fal-ai/sync",
} as const;

// =============================================================================
// NODE CONFIGURATIONS
// =============================================================================

export const NODE_CONFIG: NodeConfigRegistry = {
  // ===========================================================================
  // IMAGE NODES
  // ===========================================================================
  
  seedream: {
    type: "seedream",
    version: "1.0.0",
    category: "image",
    label: "Seedream 4.5",
    description: "High-quality text-to-image generation with advanced prompt understanding",
    color: "emerald",
    
    providers: [
      {
        id: "fal",
        model: FAL_MODELS.seedream,
        inputMapping: {
          prompt: "prompt",
          negativePrompt: "negative_prompt",
          aspectRatio: "image_size",  // Will be transformed
          seed: "seed",
          numInferenceSteps: "num_inference_steps",
          guidanceScale: "guidance_scale",
          truncatePrompt: "truncate_prompt",
          promptEnhancer: "prompt_enhancer",
          syncMode: "sync_mode",
          referenceImages: "image_urls",
        },
        outputMapping: {
          "image.url": "images[0].url",
          "image.mimeType": "images[0].content_type",
          "image.width": "images[0].width",
          "image.height": "images[0].height",
        },
      },
    ],
    
    inputSchema: z.object({
      prompt: z.string().min(1).max(6000),
      negativePrompt: z.string().optional(),
      aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).default("1:1"),
      seed: z.number().int().optional(),
      numInferenceSteps: z.number().int().min(1).max(60).optional(),
      guidanceScale: z.number().min(0).max(30).optional(),
      truncatePrompt: z.boolean().optional(),
      promptEnhancer: z.boolean().optional(),
      syncMode: z.boolean().optional(),
      context: z.string().optional(),
      referenceImages: z.array(z.string().url()).max(14).optional(),
    }),
    
    outputSchema: ImageOutSchema,
    
    execution: {
      timeout: "5m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    ui: {
      inputs: [
        { id: "prompt", type: "textarea", label: "Prompt", required: true, rows: 3, placeholder: "Describe the image you want to create..." },
        { id: "negativePrompt", type: "textarea", label: "Negative Prompt", rows: 2, placeholder: "What to avoid...", advanced: true },
        { id: "aspectRatio", type: "select", label: "Aspect Ratio", options: ["1:1", "16:9", "9:16", "4:3", "3:4"], defaultValue: "1:1" },
        { id: "referenceImages", type: "file", label: "Reference Images (up to 14)", accept: "image/*", preview: true },
        { id: "seed", type: "number", label: "Seed", placeholder: "Random", advanced: true },
        { id: "numInferenceSteps", type: "slider", label: "Steps", min: 1, max: 60, defaultValue: 30, advanced: true },
        { id: "guidanceScale", type: "slider", label: "Guidance", min: 0, max: 30, step: 0.5, defaultValue: 7.5, advanced: true },
        { id: "promptEnhancer", type: "toggle", label: "Prompt Enhancer", advanced: true },
      ],
      outputs: [
        { id: "image", type: "image", label: "Generated Image" },
      ],
      layout: "vertical",
    },
    
    estimatedCost: 40_000,
    estimatedTime: "~10s",
    features: ["Negative Prompt", "Prompt Enhancer", "Multi-Reference (up to 14)"],
    
    mockResponse: () => ({
      type: "image",
      image: {
        url: "https://picsum.photos/1024/1024",
        mimeType: "image/jpeg",
        width: 1024,
        height: 1024,
      },
    }),
  },

  seedvr: {
    type: "seedvr",
    version: "1.0.0",
    category: "image",
    label: "SeedVR 2",
    description: "AI-powered image upscaling with face enhancement",
    color: "emerald",
    
    providers: [
      {
        id: "fal",
        model: FAL_MODELS.seedvr,
        inputMapping: {
          "image.url": "image_url",
          scale: { field: "upscale_factor", transform: "scaleToNumber" },
          enhanceFaces: "enable_face_enhancement",
        },
        outputMapping: {
          "image.url": "image.url",
          "image.mimeType": "image.content_type",
          "image.width": "image.width",
          "image.height": "image.height",
        },
      },
    ],
    
    inputSchema: z.object({
      image: AssetRefSchema,
      scale: z.enum(["2x", "4x"]).default("2x"),
      enhanceFaces: z.boolean().default(false),
      context: z.string().optional(),
    }),
    
    outputSchema: ImageOutSchema,
    
    execution: {
      timeout: "5m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    ui: {
      inputs: [
        { id: "image", type: "file", label: "Input Image", accept: "image/*", required: true, preview: true },
        { id: "scale", type: "select", label: "Scale", options: ["2x", "4x"], defaultValue: "2x" },
        { id: "enhanceFaces", type: "toggle", label: "Enhance Faces" },
      ],
      outputs: [
        { id: "image", type: "image", label: "Upscaled Image" },
      ],
    },
    
    estimatedCost: 2_000,
    estimatedTime: "~5s",
    features: ["2x/4x Upscale", "Face Enhancement"],
    
    mockResponse: (input: unknown) => {
      const inp = input as { image: { url: string }; scale: string };
      const scale = inp.scale === "4x" ? 4 : 2;
      return {
        type: "image",
        image: {
          url: inp.image.url,
          mimeType: "image/jpeg",
          width: 512 * scale,
          height: 512 * scale,
        },
      };
    },
  },

  // ===========================================================================
  // VIDEO NODES
  // ===========================================================================
  
  seedance: {
    type: "seedance",
    version: "1.0.0",
    category: "video",
    label: "Seedance 1.5",
    description: "Generate cinematic videos from text prompts or animate still images",
    color: "violet",
    
    providers: [
      {
        id: "fal",
        model: FAL_MODELS.seedance,
        inputMapping: {
          prompt: "prompt",
          duration: { field: "duration", transform: "durationToSeconds" },
          aspectRatio: "aspect_ratio",
          seed: "seed",
          "frame.url": "image_url",
        },
        outputMapping: {
          "video.url": "video.url",
          "video.mimeType": "video.content_type",
        },
      },
    ],
    
    inputSchema: z.object({
      prompt: z.string().min(1).max(6000),
      frame: AssetRefSchema.optional(),
      duration: z.enum(["4s", "8s", "16s"]).default("4s"),
      aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
      seed: z.number().int().optional(),
      context: z.string().optional(),
    }),
    
    outputSchema: VideoOutSchema,
    
    execution: {
      timeout: "10m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    ui: {
      inputs: [
        { id: "prompt", type: "textarea", label: "Prompt", required: true, rows: 2, placeholder: "Describe the video..." },
        { id: "frame", type: "file", label: "Start Frame (optional)", accept: "image/*", preview: true },
        { id: "duration", type: "select", label: "Duration", options: [
          { value: "4s", label: "4 seconds" },
          { value: "8s", label: "8 seconds" },
          { value: "16s", label: "16 seconds" },
        ], defaultValue: "4s" },
        { id: "aspectRatio", type: "select", label: "Aspect Ratio", options: ["16:9", "9:16", "1:1"], defaultValue: "16:9" },
        { id: "seed", type: "number", label: "Seed", placeholder: "Random", advanced: true },
      ],
      outputs: [
        { id: "video", type: "video", label: "Generated Video" },
      ],
      layout: "vertical",
    },
    
    estimatedCost: 260_000,
    estimatedTime: "~45s",
    features: ["4s/8s/16s Duration", "Image-to-Video", "Motion Control"],
    
    mockResponse: () => ({
      type: "video",
      video: {
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        mimeType: "video/mp4",
        durationMs: 4000,
      },
    }),
  },

  lipsync: {
    type: "lipsync",
    version: "1.0.0",
    category: "video",
    label: "Sync Lipsync",
    description: "AI-powered lip synchronization for video with audio",
    color: "violet",
    
    providers: [
      {
        id: "fal",
        model: FAL_MODELS.lipsync,
        inputMapping: {
          "video.url": "video_url",
          "audio.url": "audio_url",
          model: "model",
        },
        outputMapping: {
          "video.url": "video.url",
          "video.mimeType": "video.content_type",
        },
      },
    ],
    
    inputSchema: z.object({
      video: AssetRefSchema,
      audio: AssetRefSchema,
      model: z.enum(["sync-1.5", "sync-1.6-beta"]).default("sync-1.5"),
      context: z.string().optional(),
    }),
    
    outputSchema: VideoOutSchema,
    
    execution: {
      timeout: "10m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    ui: {
      inputs: [
        { id: "video", type: "file", label: "Video", accept: "video/*", required: true, preview: true },
        { id: "audio", type: "file", label: "Audio", accept: "audio/*", required: true },
        { id: "model", type: "select", label: "Model", options: [
          { value: "sync-1.5", label: "Sync 1.5" },
          { value: "sync-1.6-beta", label: "Sync 1.6 Beta" },
        ], defaultValue: "sync-1.5", advanced: true },
      ],
      outputs: [
        { id: "video", type: "video", label: "Synced Video" },
      ],
    },
    
    estimatedCost: 350_000,
    estimatedTime: "~30s",
    features: ["HD Output", "Multi-language"],
    
    mockResponse: (input: unknown) => {
      const inp = input as { video: { url: string } };
      return {
        type: "video",
        video: {
          url: inp.video.url,
          mimeType: "video/mp4",
        },
      };
    },
  },

  // ===========================================================================
  // AUDIO NODES
  // ===========================================================================
  
  elevenlabs: {
    type: "elevenlabs",
    version: "1.0.0",
    category: "audio",
    label: "ElevenLabs V3",
    description: "Ultra-realistic text-to-speech with emotion control",
    color: "teal",
    
    providers: [
      {
        id: "fal",
        model: FAL_MODELS.elevenlabs,
        inputMapping: {
          text: "text",
          voiceId: "voice_id",
          stability: "voice_settings.stability",
          clarity: "voice_settings.similarity_boost",
        },
        outputMapping: {
          "audio.url": "audio.url",
          "audio.mimeType": "audio.content_type",
          "audio.durationMs": "audio.duration",
        },
      },
    ],
    
    inputSchema: z.object({
      text: z.string().min(1).max(6000),
      voiceId: z.string().min(1).default("21m00Tcm4TlvDq8ikWAM"),
      stability: z.number().min(0).max(1).default(0.5),
      clarity: z.number().min(0).max(1).default(0.75),
      context: z.string().optional(),
    }),
    
    outputSchema: AudioOutSchema,
    
    execution: {
      timeout: "2m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    ui: {
      inputs: [
        { id: "text", type: "textarea", label: "Script", required: true, rows: 3, placeholder: "Enter text to convert to speech..." },
        { id: "voiceId", type: "select", label: "Voice", options: [
          { value: "21m00Tcm4TlvDq8ikWAM", label: "Rachel" },
          { value: "AZnzlk1XvdvUeBnXmlld", label: "Domi" },
          { value: "EXAVITQu4vr4xnSDxMaL", label: "Bella" },
          { value: "ErXwobaYiN019PkySvjV", label: "Antoni" },
          { value: "MF3mGyEYCl7XYWbV9V6O", label: "Elli" },
          { value: "TxGEqnHWrfWFTfGW9XjX", label: "Josh" },
          { value: "VR6AewLTigWG4xSOukaG", label: "Arnold" },
          { value: "pNInz6obpgDQGcFmaJgB", label: "Adam" },
          { value: "yoZ06aMxZJJ28mfd3POQ", label: "Sam" },
        ], defaultValue: "21m00Tcm4TlvDq8ikWAM" },
        { id: "stability", type: "slider", label: "Stability", min: 0, max: 1, step: 0.1, defaultValue: 0.5, showValue: true, advanced: true },
        { id: "clarity", type: "slider", label: "Clarity", min: 0, max: 1, step: 0.1, defaultValue: 0.75, showValue: true, advanced: true },
      ],
      outputs: [
        { id: "audio", type: "audio", label: "Voice Audio" },
      ],
    },
    
    estimatedCost: 50_000,
    estimatedTime: "~3s",
    features: ["50+ Voices", "Stability Control", "Clarity Control"],
    
    mockResponse: () => ({
      type: "audio",
      audio: {
        url: "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav",
        mimeType: "audio/wav",
        durationMs: 60000,
      },
    }),
  },

  // ===========================================================================
  // LLM NODES
  // ===========================================================================
  
  openrouter: {
    type: "openrouter",
    version: "1.0.0",
    category: "llm",
    label: "OpenRouter LLM",
    description: "Access GPT-4, Claude, Gemini and more through a unified API",
    color: "blue",
    
    providers: [
      {
        id: "openrouter",
        model: "openai/gpt-4o-mini",  // Default model, overridden by input
        inputMapping: {
          prompt: "prompt",
          systemPrompt: "systemPrompt",
          model: "model",
          temperature: "temperature",
          maxTokens: "maxTokens",
          context: "context",
          imageUrl: "imageUrl",
        },
        outputMapping: {
          text: "text",
        },
        syncMode: true,
      },
    ],
    
    inputSchema: z.object({
      prompt: z.string().min(1).max(128000),
      systemPrompt: z.string().optional(),
      model: z.string().default("openai/gpt-4o-mini"),
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().min(1).max(128000).default(4096),
      context: z.string().optional(),
      imageUrl: z.string().optional(),
    }),
    
    outputSchema: TextOutSchema,
    
    execution: {
      timeout: "2m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    ui: {
      inputs: [
        { id: "prompt", type: "textarea", label: "Prompt", required: true, rows: 3, placeholder: "Enter your prompt..." },
        { id: "systemPrompt", type: "textarea", label: "System Prompt", rows: 2, placeholder: "Set the AI's behavior...", advanced: true },
        { id: "model", type: "select", label: "Model", options: [
          { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
          { value: "openai/gpt-4o", label: "GPT-4o" },
          { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
          { value: "anthropic/claude-3-opus", label: "Claude 3 Opus" },
          { value: "google/gemini-pro-1.5", label: "Gemini Pro 1.5" },
          { value: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
        ], defaultValue: "openai/gpt-4o-mini" },
        { id: "imageUrl", type: "file", label: "Image (Vision)", accept: "image/*", preview: true },
        { id: "temperature", type: "slider", label: "Temperature", min: 0, max: 2, step: 0.1, defaultValue: 0.7, showValue: true, advanced: true },
        { id: "maxTokens", type: "number", label: "Max Tokens", min: 1, max: 128000, defaultValue: 4096, advanced: true },
      ],
      outputs: [
        { id: "text", type: "text", label: "Response" },
      ],
      layout: "vertical",
    },
    
    estimatedCost: 50_000,
    estimatedTime: "~2s",
    features: ["Vision Input", "Streaming", "System Prompts"],
    
    mockResponse: (input: unknown) => {
      const inp = input as { prompt: string; context?: string };
      return {
        type: "text",
        text: `Mock LLM response for prompt: "${inp.prompt.slice(0, 100)}..."${
          inp.context ? `\n\nUsing context: "${inp.context.slice(0, 50)}..."` : ""
        }`,
      };
    },
  },

  // ===========================================================================
  // UTILITY NODES
  // ===========================================================================
  
  "crop-image": {
    type: "crop-image",
    version: "1.0.0",
    category: "utility",
    label: "Crop Image",
    description: "Precisely crop images using percentage-based coordinates",
    color: "amber",
    
    providers: [
      {
        id: "internal",
        model: "sharp",
        syncMode: true, // Internal nodes execute synchronously
        inputMapping: {
          "image.url": "imageUrl",
          xPercent: "xPercent",
          yPercent: "yPercent",
          widthPercent: "widthPercent",
          heightPercent: "heightPercent",
        },
        outputMapping: {
          "image.url": "url",
          "image.mimeType": "mimeType",
          "image.width": "width",
          "image.height": "height",
        },
      },
    ],
    
    inputSchema: z.object({
      image: AssetRefSchema,
      xPercent: z.number().min(0).max(100).default(0),
      yPercent: z.number().min(0).max(100).default(0),
      widthPercent: z.number().min(1).max(100).default(100),
      heightPercent: z.number().min(1).max(100).default(100),
      context: z.string().optional(),
    }),
    
    outputSchema: ImageOutSchema,
    
    execution: {
      timeout: "2m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    ui: {
      inputs: [
        { id: "image", type: "file", label: "Input Image", accept: "image/*", required: true, preview: true },
        { id: "xPercent", type: "slider", label: "X Position (%)", min: 0, max: 100, defaultValue: 0, showValue: true },
        { id: "yPercent", type: "slider", label: "Y Position (%)", min: 0, max: 100, defaultValue: 0, showValue: true },
        { id: "widthPercent", type: "slider", label: "Width (%)", min: 1, max: 100, defaultValue: 100, showValue: true },
        { id: "heightPercent", type: "slider", label: "Height (%)", min: 1, max: 100, defaultValue: 100, showValue: true },
      ],
      outputs: [
        { id: "image", type: "image", label: "Cropped Image" },
      ],
    },
    
    estimatedCost: 1_000,
    estimatedTime: "<1s",
    features: ["Percentage Crop", "Preserve Quality"],
    
    mockResponse: (input: unknown) => {
      const inp = input as { image: { url: string } };
      return {
        type: "image",
        image: {
          url: inp.image.url,
          mimeType: "image/jpeg",
        },
      };
    },
  },

  "merge-audio-video": {
    type: "merge-audio-video",
    version: "1.0.0",
    category: "utility",
    label: "Merge Audio + Video",
    description: "Combine or replace audio tracks in video files",
    color: "amber",
    
    providers: [
      {
        id: "internal",
        model: "ffmpeg",
        syncMode: true, // Internal nodes execute synchronously
        inputMapping: {
          "video.url": "videoUrl",
          "audio.url": "audioUrl",
          replaceAudio: "replaceAudio",
        },
        outputMapping: {
          "video.url": "url",
          "video.mimeType": "mimeType",
        },
      },
    ],
    
    inputSchema: z.object({
      video: AssetRefSchema,
      audio: AssetRefSchema,
      replaceAudio: z.boolean().default(true),
      context: z.string().optional(),
    }),
    
    outputSchema: VideoOutSchema,
    
    execution: {
      timeout: "5m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    ui: {
      inputs: [
        { id: "video", type: "file", label: "Video", accept: "video/*", required: true, preview: true },
        { id: "audio", type: "file", label: "Audio", accept: "audio/*", required: true },
        { id: "replaceAudio", type: "toggle", label: "Replace Original Audio", defaultValue: true },
      ],
      outputs: [
        { id: "video", type: "video", label: "Combined Video" },
      ],
    },
    
    estimatedCost: 3_000,
    estimatedTime: "~5s",
    features: ["Replace Audio", "Mix Audio"],
    
    mockResponse: (input: unknown) => {
      const inp = input as { video: { url: string } };
      return {
        type: "video",
        video: {
          url: inp.video.url,
          mimeType: "video/mp4",
        },
      };
    },
  },

  "merge-videos": {
    type: "merge-videos",
    version: "1.0.0",
    category: "utility",
    label: "Merge Videos",
    description: "Seamlessly concatenate multiple videos with optional transitions",
    color: "amber",
    
    providers: [
      {
        id: "internal",
        model: "ffmpeg",
        syncMode: true, // Internal nodes execute synchronously
        inputMapping: {
          "video1.url": "video1Url",
          "video2.url": "video2Url",
          transition: "transition",
          transitionDuration: "transitionDuration",
        },
        outputMapping: {
          "video.url": "url",
          "video.mimeType": "mimeType",
        },
      },
    ],
    
    inputSchema: z.object({
      video1: AssetRefSchema,
      video2: AssetRefSchema,
      transition: z.enum(["none", "fade", "dissolve"]).default("none"),
      transitionDuration: z.number().min(0).max(2).default(0.5),
      context: z.string().optional(),
    }),
    
    outputSchema: VideoOutSchema,
    
    execution: {
      timeout: "10m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    ui: {
      inputs: [
        { id: "video1", type: "file", label: "Video 1", accept: "video/*", required: true, preview: true },
        { id: "video2", type: "file", label: "Video 2", accept: "video/*", required: true, preview: true },
        { id: "transition", type: "select", label: "Transition", options: [
          { value: "none", label: "None (Direct Cut)" },
          { value: "fade", label: "Fade" },
          { value: "dissolve", label: "Dissolve" },
        ], defaultValue: "none" },
        { id: "transitionDuration", type: "slider", label: "Transition Duration (s)", min: 0, max: 2, step: 0.1, defaultValue: 0.5, showValue: true, showWhen: { field: "transition", value: ["fade", "dissolve"] } },
      ],
      outputs: [
        { id: "video", type: "video", label: "Merged Video" },
      ],
    },
    
    estimatedCost: 5_000,
    estimatedTime: "~5s",
    features: ["Fade Transition", "Dissolve"],
    
    mockResponse: () => ({
      type: "video",
      video: {
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        mimeType: "video/mp4",
      },
    }),
  },

  "extract-audio": {
    type: "extract-audio",
    version: "1.0.0",
    category: "utility",
    label: "Extract Audio",
    description: "Extract and convert audio tracks from video with format options",
    color: "amber",
    
    providers: [
      {
        id: "internal",
        model: "ffmpeg",
        syncMode: true, // Internal nodes execute synchronously
        inputMapping: {
          "video.url": "videoUrl",
          format: "format",
          bitrate: "bitrate",
          sampleRate: "sampleRate",
          channels: "channels",
          normalize: "normalize",
        },
        outputMapping: {
          "audio.url": "url",
          "audio.mimeType": "mimeType",
        },
      },
    ],
    
    inputSchema: z.object({
      video: AssetRefSchema,
      format: z.enum(["mp3", "wav", "aac", "ogg"]).default("mp3"),
      bitrate: z.enum(["128k", "192k", "256k", "320k"]).default("192k"),
      sampleRate: z.enum(["22050", "44100", "48000"]).default("44100"),
      channels: z.enum(["1", "2"]).default("2"),
      normalize: z.boolean().default(false),
      context: z.string().optional(),
    }),
    
    outputSchema: AudioOutSchema,
    
    execution: {
      timeout: "5m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    ui: {
      inputs: [
        { id: "video", type: "file", label: "Video", accept: "video/*", required: true, preview: true },
        { id: "format", type: "select", label: "Format", options: [
          { value: "mp3", label: "MP3" },
          { value: "wav", label: "WAV" },
          { value: "aac", label: "AAC" },
          { value: "ogg", label: "OGG" },
        ], defaultValue: "mp3" },
        { id: "bitrate", type: "select", label: "Bitrate", options: ["128k", "192k", "256k", "320k"], defaultValue: "192k", advanced: true },
        { id: "sampleRate", type: "select", label: "Sample Rate", options: [
          { value: "22050", label: "22.05 kHz" },
          { value: "44100", label: "44.1 kHz" },
          { value: "48000", label: "48 kHz" },
        ], defaultValue: "44100", advanced: true },
        { id: "channels", type: "select", label: "Channels", options: [
          { value: "1", label: "Mono" },
          { value: "2", label: "Stereo" },
        ], defaultValue: "2", advanced: true },
        { id: "normalize", type: "toggle", label: "Normalize Audio", advanced: true },
      ],
      outputs: [
        { id: "audio", type: "audio", label: "Audio Track" },
      ],
    },
    
    estimatedCost: 2_000,
    estimatedTime: "~3s",
    features: ["MP3/WAV/AAC", "Bitrate Control", "Normalize"],
    
    mockResponse: () => ({
      type: "audio",
      audio: {
        url: "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav",
        mimeType: "audio/wav",
      },
    }),
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get node configuration by type
 */
export function getNodeConfig(nodeType: string): NodeConfig | undefined {
  return NODE_CONFIG[nodeType];
}

/**
 * Get all node types
 */
export function getAllNodeTypes(): string[] {
  return Object.keys(NODE_CONFIG);
}

/**
 * Get nodes by category
 */
export function getNodesByCategory(category: string): NodeConfig[] {
  return Object.values(NODE_CONFIG).filter((node) => node.category === category);
}

/**
 * Check if a node type exists
 */
export function isValidNodeType(nodeType: string): boolean {
  return nodeType in NODE_CONFIG;
}

// Export schemas for external use
export { AssetRefSchema as AssetRef };
