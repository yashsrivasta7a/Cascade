import { z } from "zod";
import type { NodeConfig } from "../types";
import { AudioOutSchema, FAL_MODELS } from "../schemas";

// =============================================================================
// AUDIO NODES
// Nodes for audio generation and processing
// =============================================================================

export const elevenlabsConfig: NodeConfig = {
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
      url: "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAB8ANX9AAAItMK7P80IACqu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/+1DEJgAAA0gAAAAAu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7",
      mimeType: "audio/mp3",
      durationMs: 1000,
    },
  }),
};

// Export all audio node configs
export const audioNodes = {
  elevenlabs: elevenlabsConfig,
};
