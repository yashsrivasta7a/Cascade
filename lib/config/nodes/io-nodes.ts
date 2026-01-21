import { z } from "zod";
import type { NodeConfig } from "../types";
import { ImageOutSchema, VideoOutSchema, AudioOutSchema } from "../schemas";

// =============================================================================
// I/O NODES
// Input and Output nodes for workflow connections
// =============================================================================

export const inputConfig: NodeConfig = {
  type: "input",
  version: "1.0.0",
  category: "io",
  label: "Input",
  description: "Add input (text, image, video, or audio) to use in your workflow",
  color: "zinc",
  
  providers: [],
  
  inputSchema: z.object({
    value: z.string().optional(),
    mediaType: z.enum(["text", "image", "video", "audio"]).optional(),
  }),
  
  outputSchema: z.object({
    value: z.string(),
    type: z.enum(["text", "image", "video", "audio"]),
  }),
  
  execution: {
    timeout: "0s",
    retryPerProvider: 0,
    maxRetries: 0,
  },
  
  ui: {
    inputs: [],
    outputs: [
      { id: "output", type: "any", label: "Output" },
    ],
  },
  
  estimatedCost: 0,
  estimatedTime: "instant",
  features: ["Text Input", "Upload", "Drag & Drop", "Preview", "Type Selection"],
};

export const imageInputConfig: NodeConfig = {
  type: "image-input",
  version: "1.0.0",
  category: "io",
  label: "Image Input",
  description: "Upload an image to use as input for your workflow",
  color: "emerald",
  
  providers: [],
  
  inputSchema: z.object({
    value: z.string().optional(),
  }),
  
  outputSchema: ImageOutSchema,
  
  execution: {
    timeout: "0s",
    retryPerProvider: 0,
    maxRetries: 0,
  },
  
  ui: {
    inputs: [],
    outputs: [
      { id: "output", type: "image", label: "Image" },
    ],
  },
  
  estimatedCost: 0,
  estimatedTime: "instant",
  features: ["Upload", "Drag & Drop", "Preview"],
};

export const videoInputConfig: NodeConfig = {
  type: "video-input",
  version: "1.0.0",
  category: "io",
  label: "Video Input",
  description: "Upload a video to use as input for your workflow",
  color: "violet",
  
  providers: [],
  
  inputSchema: z.object({
    value: z.string().optional(),
  }),
  
  outputSchema: VideoOutSchema,
  
  execution: {
    timeout: "0s",
    retryPerProvider: 0,
    maxRetries: 0,
  },
  
  ui: {
    inputs: [],
    outputs: [
      { id: "output", type: "video", label: "Video" },
    ],
  },
  
  estimatedCost: 0,
  estimatedTime: "instant",
  features: ["Upload", "Drag & Drop", "Preview"],
};

export const audioInputConfig: NodeConfig = {
  type: "audio-input",
  version: "1.0.0",
  category: "io",
  label: "Audio Input",
  description: "Upload audio to use as input for your workflow",
  color: "teal",
  
  providers: [],
  
  inputSchema: z.object({
    value: z.string().optional(),
  }),
  
  outputSchema: AudioOutSchema,
  
  execution: {
    timeout: "0s",
    retryPerProvider: 0,
    maxRetries: 0,
  },
  
  ui: {
    inputs: [],
    outputs: [
      { id: "output", type: "audio", label: "Audio" },
    ],
  },
  
  estimatedCost: 0,
  estimatedTime: "instant",
  features: ["Upload", "Drag & Drop", "Playback"],
};

export const outputConfig: NodeConfig = {
  type: "output",
  version: "1.0.0",
  category: "io",
  label: "Output",
  description: "Display and download workflow output",
  color: "zinc",
  
  providers: [],
  
  inputSchema: z.object({
    result: z.string().optional(),
  }),
  
  outputSchema: z.object({
    type: z.enum(["image", "video", "audio", "text"]),
    value: z.string(),
  }),
  
  execution: {
    timeout: "0s",
    retryPerProvider: 0,
    maxRetries: 0,
  },
  
  ui: {
    inputs: [
      { id: "input", type: "hidden", label: "Input" },
    ],
    outputs: [],
  },
  
  estimatedCost: 0,
  estimatedTime: "instant",
  features: ["Auto-detect Type", "Preview", "Download"],
};

// Export all I/O node configs
export const ioNodes = {
  "input": inputConfig,
  "image-input": imageInputConfig,
  "video-input": videoInputConfig,
  "audio-input": audioInputConfig,
  "output": outputConfig,
};
