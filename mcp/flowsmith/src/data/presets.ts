import type { PresetData, PresetInfo } from "../schemas/index.js";

// =============================================================================
// PRESET DEFINITIONS
// 6 ready-to-use workflow templates
// =============================================================================

export const PRESETS: Record<string, PresetData> = {
  // ───────────────────────────────────────────────────────────────────────────
  // LLM: Text Generation
  // ───────────────────────────────────────────────────────────────────────────
  "llm": {
    id: "llm",
    name: "LLM Text Generation",
    description: "Generate text using GPT-4, Claude, or other LLMs through OpenRouter",
    nodes: [
      {
        id: "input-1",
        type: "input",
        position: { x: 0, y: 100 },
        data: { 
          label: "Text Input", 
          mediaType: "text",
          nodeType: "input",
        },
      },
      {
        id: "openrouter-1",
        type: "openrouter",
        position: { x: 350, y: 100 },
        data: { 
          label: "OpenRouter LLM",
          nodeType: "openrouter",
          model: "openai/gpt-4o-mini",
          temperature: 0.7,
          maxTokens: 4096,
        },
      },
      {
        id: "output-1",
        type: "output",
        position: { x: 700, y: 100 },
        data: { 
          label: "Output",
          nodeType: "output",
        },
      },
    ],
    edges: [
      {
        id: "e1-llm",
        source: "input-1",
        target: "openrouter-1",
        sourceHandle: "output",
        targetHandle: "prompt",
      },
      {
        id: "e2-llm",
        source: "openrouter-1",
        target: "output-1",
        sourceHandle: "text",
        targetHandle: "input",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // IMAGE-GEN: Text to Image
  // ───────────────────────────────────────────────────────────────────────────
  "image-gen": {
    id: "image-gen",
    name: "Text to Image",
    description: "Generate high-quality images from text prompts using Seedream 4.5",
    nodes: [
      {
        id: "input-1",
        type: "input",
        position: { x: 0, y: 100 },
        data: { 
          label: "Prompt Input",
          mediaType: "text",
          nodeType: "input",
        },
      },
      {
        id: "seedream-1",
        type: "seedream",
        position: { x: 350, y: 100 },
        data: { 
          label: "Seedream 4.5",
          nodeType: "seedream",
          aspectRatio: "1:1",
        },
      },
      {
        id: "output-1",
        type: "output",
        position: { x: 700, y: 100 },
        data: { 
          label: "Output",
          nodeType: "output",
        },
      },
    ],
    edges: [
      {
        id: "e1-img",
        source: "input-1",
        target: "seedream-1",
        sourceHandle: "output",
        targetHandle: "prompt",
      },
      {
        id: "e2-img",
        source: "seedream-1",
        target: "output-1",
        sourceHandle: "image",
        targetHandle: "input",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // VIDEO-GEN: Text to Video
  // ───────────────────────────────────────────────────────────────────────────
  "video-gen": {
    id: "video-gen",
    name: "Text to Video",
    description: "Generate cinematic videos from text prompts using Seedance 1.5",
    nodes: [
      {
        id: "input-1",
        type: "input",
        position: { x: 0, y: 100 },
        data: { 
          label: "Prompt Input",
          mediaType: "text",
          nodeType: "input",
        },
      },
      {
        id: "seedance-1",
        type: "seedance",
        position: { x: 350, y: 100 },
        data: { 
          label: "Seedance 1.5",
          nodeType: "seedance",
          duration: "4s",
          aspectRatio: "16:9",
        },
      },
      {
        id: "output-1",
        type: "output",
        position: { x: 700, y: 100 },
        data: { 
          label: "Output",
          nodeType: "output",
        },
      },
    ],
    edges: [
      {
        id: "e1-vid",
        source: "input-1",
        target: "seedance-1",
        sourceHandle: "output",
        targetHandle: "prompt",
      },
      {
        id: "e2-vid",
        source: "seedance-1",
        target: "output-1",
        sourceHandle: "video",
        targetHandle: "input",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // TTS: Text to Speech
  // ───────────────────────────────────────────────────────────────────────────
  "tts": {
    id: "tts",
    name: "Text to Speech",
    description: "Convert text to natural-sounding speech using ElevenLabs V3",
    nodes: [
      {
        id: "input-1",
        type: "input",
        position: { x: 0, y: 100 },
        data: { 
          label: "Script Input",
          mediaType: "text",
          nodeType: "input",
        },
      },
      {
        id: "elevenlabs-1",
        type: "elevenlabs",
        position: { x: 350, y: 100 },
        data: { 
          label: "ElevenLabs V3",
          nodeType: "elevenlabs",
          voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
          stability: 0.5,
          clarity: 0.75,
        },
      },
      {
        id: "output-1",
        type: "output",
        position: { x: 700, y: 100 },
        data: { 
          label: "Output",
          nodeType: "output",
        },
      },
    ],
    edges: [
      {
        id: "e1-tts",
        source: "input-1",
        target: "elevenlabs-1",
        sourceHandle: "output",
        targetHandle: "text",
      },
      {
        id: "e2-tts",
        source: "elevenlabs-1",
        target: "output-1",
        sourceHandle: "audio",
        targetHandle: "input",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // UPSCALE: Image Upscaling
  // ───────────────────────────────────────────────────────────────────────────
  "upscale": {
    id: "upscale",
    name: "Image Upscaler",
    description: "Upscale images to 2x or 4x resolution using SeedVR 2",
    nodes: [
      {
        id: "input-1",
        type: "input",
        position: { x: 0, y: 100 },
        data: { 
          label: "Image Input",
          mediaType: "image",
          nodeType: "input",
        },
      },
      {
        id: "seedvr-1",
        type: "seedvr",
        position: { x: 350, y: 100 },
        data: { 
          label: "SeedVR 2",
          nodeType: "seedvr",
          scale: "2x",
          enhanceFaces: false,
        },
      },
      {
        id: "output-1",
        type: "output",
        position: { x: 700, y: 100 },
        data: { 
          label: "Output",
          nodeType: "output",
        },
      },
    ],
    edges: [
      {
        id: "e1-up",
        source: "input-1",
        target: "seedvr-1",
        sourceHandle: "output",
        targetHandle: "image",
      },
      {
        id: "e2-up",
        source: "seedvr-1",
        target: "output-1",
        sourceHandle: "image",
        targetHandle: "input",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // LIPSYNC: Video + Audio Lip Sync
  // ───────────────────────────────────────────────────────────────────────────
  "lipsync": {
    id: "lipsync",
    name: "Lip Sync Video",
    description: "Synchronize video lip movements with audio using AI",
    nodes: [
      {
        id: "input-video",
        type: "input",
        position: { x: 0, y: 50 },
        data: { 
          label: "Video Input",
          mediaType: "video",
          nodeType: "input",
        },
      },
      {
        id: "input-audio",
        type: "input",
        position: { x: 0, y: 250 },
        data: { 
          label: "Audio Input",
          mediaType: "audio",
          nodeType: "input",
        },
      },
      {
        id: "lipsync-1",
        type: "lipsync",
        position: { x: 350, y: 150 },
        data: { 
          label: "Sync Lipsync",
          nodeType: "lipsync",
          model: "sync-1.5",
        },
      },
      {
        id: "output-1",
        type: "output",
        position: { x: 700, y: 150 },
        data: { 
          label: "Output",
          nodeType: "output",
        },
      },
    ],
    edges: [
      {
        id: "e1-lip-video",
        source: "input-video",
        target: "lipsync-1",
        sourceHandle: "output",
        targetHandle: "video",
      },
      {
        id: "e2-lip-audio",
        source: "input-audio",
        target: "lipsync-1",
        sourceHandle: "output",
        targetHandle: "audio",
      },
      {
        id: "e3-lip",
        source: "lipsync-1",
        target: "output-1",
        sourceHandle: "video",
        targetHandle: "input",
      },
    ],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all preset summaries (without full node/edge data)
 */
export function getPresetInfoList(): PresetInfo[] {
  return Object.values(PRESETS).map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    category: getCategoryForPreset(preset.id),
    nodeCount: preset.nodes.length,
  }));
}

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): PresetData | undefined {
  return PRESETS[id];
}

/**
 * Get category based on the main node type in the preset
 */
function getCategoryForPreset(presetId: string): string {
  const categoryMap: Record<string, string> = {
    "llm": "llm",
    "image-gen": "image",
    "video-gen": "video",
    "tts": "audio",
    "upscale": "image",
    "lipsync": "video",
  };
  return categoryMap[presetId] || "utility";
}

/**
 * Get all preset IDs
 */
export function getPresetIds(): string[] {
  return Object.keys(PRESETS);
}
