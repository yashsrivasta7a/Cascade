import { z } from "zod";
import type { NodeConfig } from "../types";
import { AssetRefSchema, ImageOutSchema, VideoOutSchema, AudioOutSchema } from "../schemas";

// =============================================================================
// UTILITY NODES
// Nodes for media processing and manipulation
// =============================================================================

export const cropImageConfig: NodeConfig = {
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
      syncMode: true,
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
};

export const mergeAudioVideoConfig: NodeConfig = {
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
      syncMode: true,
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
};

export const mergeVideosConfig: NodeConfig = {
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
      syncMode: true,
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
};

export const extractAudioConfig: NodeConfig = {
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
      syncMode: true,
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
      url: "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAB8ANX9AAAItMK7P80IACqu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/+1DEJgAAA0gAAAAAu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7",
      mimeType: "audio/mp3",
    },
  }),
};

// Export all utility node configs
export const utilityNodes = {
  "crop-image": cropImageConfig,
  "merge-audio-video": mergeAudioVideoConfig,
  "merge-videos": mergeVideosConfig,
  "extract-audio": extractAudioConfig,
};
