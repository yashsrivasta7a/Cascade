import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { buildWorkflow } from "../utils/workflow-builder.js";
import { isValidNodeType, getNodeInfoList } from "../data/nodes.js";
import { logger } from "../utils/logger.js";
import type { NodeSpec } from "../schemas/index.js";

// =============================================================================
// BUILDER TOOL DEFINITIONS
// =============================================================================

export const builderToolDefinitions: Tool[] = [
  {
    name: "build_workflow",
    description: `Build a custom workflow by specifying the nodes in sequence. 
Automatically positions nodes horizontally and creates edges based on type compatibility.

Input: An array of node specs with type and optional configuration.
Output: Complete workflow data with positioned nodes and proper edges.

Common node types:
- input: Universal input (set inputType to "text", "image", "video", or "audio")
- output: Workflow output
- seedream: Text to image
- seedvr: Image upscaling  
- seedance: Text/image to video
- elevenlabs: Text to speech
- openrouter: LLM text generation
- lipsync: Video + audio lip sync
- merge-audio-video: Combine audio and video
- merge-videos: Concatenate videos
- extract-audio: Extract audio from video
- crop-image: Crop images`,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the workflow",
        },
        nodes: {
          type: "array",
          description: "Array of node specifications in execution order",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "The node type (e.g., 'input', 'seedream', 'output')",
              },
              inputType: {
                type: "string",
                description: "For input nodes: the type of input (text, image, video, audio)",
                enum: ["text", "image", "video", "audio"],
              },
              config: {
                type: "object",
                description: "Optional node configuration (e.g., { model: 'openai/gpt-4o' })",
              },
            },
            required: ["type"],
          },
        },
      },
      required: ["name", "nodes"],
    },
  },
];

// =============================================================================
// BUILDER TOOL HANDLERS
// =============================================================================

interface BuildWorkflowArgs {
  name: string;
  nodes: NodeSpec[];
}

/**
 * Register builder tool handlers
 */
export function registerBuilderTools(handlers: Map<string, (args: unknown) => Promise<unknown>>): void {
  handlers.set("build_workflow", async (args: unknown) => {
    const { name, nodes } = args as BuildWorkflowArgs;

    if (!name) {
      throw new Error("Missing required parameter: name");
    }

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      throw new Error("Missing or empty nodes array");
    }

    logger.info(`Building workflow: ${name} with ${nodes.length} nodes`);

    // Validate all node types
    const invalidTypes: string[] = [];
    for (const nodeSpec of nodes) {
      if (!nodeSpec.type) {
        throw new Error("Each node must have a 'type' property");
      }
      if (!isValidNodeType(nodeSpec.type)) {
        invalidTypes.push(nodeSpec.type);
      }
    }

    if (invalidTypes.length > 0) {
      const allNodes = getNodeInfoList();
      const availableTypes = allNodes.map((n) => n.type).join(", ");
      throw new Error(
        `Invalid node type(s): ${invalidTypes.join(", ")}. Available types: ${availableTypes}`
      );
    }

    try {
      const workflow = buildWorkflow(name, nodes);

      // Identify required inputs from Input nodes
      const requiredInputs = workflow.nodes
        .filter((n) => n.type === "input" || n.type?.includes("-input"))
        .map((n) => ({
          nodeId: n.id,
          type: n.data?.mediaType || n.type?.replace("-input", "") || "text",
          label: n.data?.label || "Input",
        }));

      return {
        name: workflow.name,
        nodes: workflow.nodes,
        edges: workflow.edges,
        nodeCount: workflow.nodes.length,
        edgeCount: workflow.edges.length,
        summary: workflow.nodes.map((n) => n.type).join(" → "),
        // Tell AI what inputs are needed
        requiredInputs,
        nextStep: requiredInputs.length > 0
          ? `ASK THE USER: This workflow needs ${requiredInputs.length} input(s): ${requiredInputs.map(i => `${i.label} (${i.type})`).join(", ")}. Ask the user to provide these values before saving or executing.`
          : "Workflow is ready to save. No user inputs required.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to build workflow: ${message}`);
      throw new Error(`Failed to build workflow: ${message}`);
    }
  });
}
