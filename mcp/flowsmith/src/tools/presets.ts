import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getPresetInfoList, getPresetById, getPresetIds } from "../data/presets.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// PRESET TOOL DEFINITIONS
// =============================================================================

export const presetToolDefinitions: Tool[] = [
  {
    name: "list_presets",
    description: "List all available workflow presets. Returns preset ID, name, description, category, and node count for each preset.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "use_preset",
    description: "Get a complete workflow from a preset. Returns the full nodes and edges arrays ready to be saved or displayed. Available presets: llm, image-gen, video-gen, tts, upscale, lipsync.",
    inputSchema: {
      type: "object",
      properties: {
        preset: {
          type: "string",
          description: "The preset ID to use",
          enum: ["llm", "image-gen", "video-gen", "tts", "upscale", "lipsync"],
        },
      },
      required: ["preset"],
    },
  },
];

// =============================================================================
// PRESET TOOL HANDLERS
// =============================================================================

interface UsePresetArgs {
  preset: string;
}

/**
 * Register preset tool handlers
 */
export function registerPresetTools(handlers: Map<string, (args: unknown) => Promise<unknown>>): void {
  // list_presets - Get all available presets
  handlers.set("list_presets", async () => {
    logger.debug("Listing presets");
    const presets = getPresetInfoList();
    return {
      presets,
      count: presets.length,
      availableIds: getPresetIds(),
    };
  });

  // use_preset - Get a specific preset with full workflow data
  handlers.set("use_preset", async (args: unknown) => {
    const { preset } = args as UsePresetArgs;
    
    if (!preset) {
      throw new Error("Missing required parameter: preset");
    }

    logger.debug(`Getting preset: ${preset}`);
    
    const presetData = getPresetById(preset);
    if (!presetData) {
      const available = getPresetIds();
      throw new Error(`Unknown preset: ${preset}. Available presets: ${available.join(", ")}`);
    }

    // Identify required inputs from Input nodes
    const requiredInputs = presetData.nodes
      .filter((n: { type?: string }) => n.type === "input" || n.type?.includes("-input"))
      .map((n: { id: string; type?: string; data?: { mediaType?: string; label?: string } }) => ({
        nodeId: n.id,
        type: n.data?.mediaType || n.type?.replace("-input", "") || "text",
        label: n.data?.label || "Input",
      }));

    return {
      id: presetData.id,
      name: presetData.name,
      description: presetData.description,
      nodes: presetData.nodes,
      edges: presetData.edges,
      nodeCount: presetData.nodes.length,
      edgeCount: presetData.edges.length,
      // Tell AI what inputs are needed
      requiredInputs,
      nextStep: `ASK THE USER: This workflow needs input: ${requiredInputs.map((i: { label: string; type: string }) => `${i.label} (${i.type})`).join(", ")}. Ask the user what they want to ${presetData.id === "llm" ? "ask the LLM" : presetData.id === "image-gen" ? "generate an image of" : presetData.id === "tts" ? "convert to speech" : "process"}.`,
    };
  });
}
