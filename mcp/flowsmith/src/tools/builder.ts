import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { buildWorkflow } from "../utils/workflow-builder.js";
import { isValidNodeType, getNodeInfoList, hasRequiredConfig, getMissingConfig, getRequiredConfig, type RequiredConfigParam } from "../data/nodes.js";
import { logger } from "../utils/logger.js";
import type { NodeSpec } from "../schemas/index.js";
import {
  findWorkflowByQuery,
  findPreseededTemplate,
  findSemanticMatch,
  patternToNodeSpecs,
  getOrBuildWorkflow,
  getCacheStats,
  PRESEEDED_TEMPLATES,
} from "../utils/template-cache.js";

// =============================================================================
// BUILDER TOOL DEFINITIONS
// =============================================================================

export const builderToolDefinitions: Tool[] = [
  {
    name: "build_workflow",
    description: `Build a custom workflow by specifying the nodes in sequence. 
Automatically positions nodes horizontally and creates edges based on type compatibility.
Uses template caching to speed up repeated workflow patterns.

CRITICAL RULES:
1. All workflows should start with Input nodes for user data:
   - User text/prompts → {type:"input", inputType:"text"} 
   - User images → {type:"input", inputType:"image"}
   - User videos → {type:"input", inputType:"video"}
   - User audio → {type:"input", inputType:"audio"}

2. NEVER assume configuration parameters for processing nodes!
   - crop-image: MUST ask user for xPercent, yPercent, widthPercent, heightPercent (all 0-100)
   - elevenlabs: MUST ask user which voice to use
   - seedvr: Should ask user for scale (2x or 4x)
   - merge-videos: Should ask user for transition type
   - If a node needs parameters, ASK THE USER FIRST before building

Input nodes connect to processing nodes which do the work:
- openrouter: LLM text generation (receives text from input node)
- seedream: Text to image (receives prompt from input node)
- seedvr: Image upscaling (REQUIRES: scale - ask user!)
- seedance: Text/image to video
- elevenlabs: Text to speech (REQUIRES: voice - ask user!)
- lipsync: Video + audio lip sync
- merge-audio-video: Combine audio and video
- merge-videos: Concatenate videos (ask for transition)
- extract-audio: Extract audio from video
- crop-image: Crop images (REQUIRES: xPercent, yPercent, widthPercent, heightPercent - ask user!)
- output: Workflow output (displays results)

Example: LLM workflow = input(text) → openrouter → output
At execution, user input goes to "input-1", NOT directly to "openrouter".`,
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
  {
    name: "find_workflow_template",
    description: `Find a pre-built workflow template by natural language query.
Searches preseeded templates and semantic patterns to find matching workflows.
Use this BEFORE build_workflow to check if a template already exists.

Examples:
- "merge two videos" → Video Merge template
- "add audio to video" → Audio Video Merge template  
- "lipsync" → Lipsync template
- "generate image from text" → Text to Image template`,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language description of the workflow you want",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_workflow_templates",
    description: `List all available pre-built workflow templates.
Returns templates that can be used directly without building from scratch.`,
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_cache_stats",
    description: `Get statistics about the workflow template cache.
Shows memory cache hits, preseeded template count, and popular templates.`,
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
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

interface FindTemplateArgs {
  query: string;
}

/**
 * Register builder tool handlers
 */
export function registerBuilderTools(handlers: Map<string, (args: unknown) => Promise<unknown>>): void {
  // build_workflow - with caching support
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
      // Check for missing required configuration parameters BEFORE building
      const missingConfigs: Array<{
        nodeType: string;
        nodeIndex: number;
        missingParams: RequiredConfigParam[];
        allParams: RequiredConfigParam[];
      }> = [];

      for (let i = 0; i < nodes.length; i++) {
        const nodeSpec = nodes[i];
        if (hasRequiredConfig(nodeSpec.type)) {
          const allParams = getRequiredConfig(nodeSpec.type);
          const missing = getMissingConfig(nodeSpec.type, nodeSpec.config as Record<string, unknown> | undefined);
          if (missing.length > 0) {
            missingConfigs.push({
              nodeType: nodeSpec.type,
              nodeIndex: i,
              missingParams: missing,
              allParams,
            });
          }
        }
      }

      // If there are missing required configs, return prompt to ask user BEFORE proceeding
      if (missingConfigs.length > 0) {
        const paramDescriptions = missingConfigs.map(mc => {
          const paramList = mc.missingParams.map(p => {
            let desc = `  - ${p.name}: ${p.description}`;
            if (p.options) desc += ` (options: ${p.options.join(", ")})`;
            if (p.min !== undefined || p.max !== undefined) {
              desc += ` (range: ${p.min ?? 0}-${p.max ?? 100})`;
            }
            return desc;
          }).join("\n");
          return `**${mc.nodeType}** requires:\n${paramList}`;
        }).join("\n\n");

        return {
          success: false,
          needsUserInput: true,
          missingConfig: missingConfigs,
          message: `Cannot build workflow - missing required parameters. Please ASK THE USER for these values:\n\n${paramDescriptions}`,
          instructions: "DO NOT make assumptions or use default values. Ask the user to provide specific values for each missing parameter, then call this tool again with the config values included.",
          example: `After getting user values, call build_workflow with: nodes=[..., {type:"${missingConfigs[0].nodeType}", config:{${missingConfigs[0].missingParams.map(p => `${p.name}: <user_value>`).join(", ")}}}, ...]`,
        };
      }

      // Use caching system
      const cached = await getOrBuildWorkflow(name, nodes, buildWorkflow);

      // Identify required inputs from Input nodes
      const requiredInputs = cached.nodes
        .filter((n) => n.type === "input" || n.type?.includes("-input"))
        .map((n) => ({
          nodeId: n.id,
          type: n.data?.mediaType || n.type?.replace("-input", "") || "text",
          label: n.data?.label || "Input",
        }));

      return {
        name: cached.name,
        nodes: cached.nodes,
        edges: cached.edges,
        nodeCount: cached.nodes.length,
        edgeCount: cached.edges.length,
        summary: cached.nodes.map((n) => n.type).join(" → "),
        // Cache info
        fromCache: cached.fromCache,
        structureHash: cached.structureHash.slice(0, 16),
        usageCount: cached.usageCount,
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

  // find_workflow_template - semantic search for templates
  handlers.set("find_workflow_template", async (args: unknown) => {
    const { query } = args as FindTemplateArgs;

    if (!query) {
      throw new Error("Missing required parameter: query");
    }

    logger.info(`Searching for workflow template: "${query}"`);

    // Helper to get required config for template nodes
    const getTemplateRequiredConfig = (nodes: Array<{ type: string; id: string; data?: { mediaType?: string; label?: string } }>) => {
      const configNeeded: Array<{
        nodeType: string;
        nodeId: string;
        params: RequiredConfigParam[];
      }> = [];
      
      for (const node of nodes) {
        if (hasRequiredConfig(node.type)) {
          const params = getRequiredConfig(node.type);
          if (params.length > 0) {
            configNeeded.push({
              nodeType: node.type,
              nodeId: node.id,
              params,
            });
          }
        }
      }
      return configNeeded;
    };

    // 1. Check preseeded templates first
    const preseeded = findPreseededTemplate(query);
    if (preseeded) {
      const requiredInputs = preseeded.nodes
        .filter((n) => n.type === "input")
        .map((n) => ({
          nodeId: n.id,
          type: n.data?.mediaType || "text",
          label: n.data?.label || "Input",
        }));

      const requiredConfig = getTemplateRequiredConfig(preseeded.nodes);

      // Build nextStep message
      let nextStep = "";
      if (requiredConfig.length > 0) {
        const configDesc = requiredConfig.map(c => 
          `${c.nodeType}: ${c.params.map(p => p.name).join(", ")}`
        ).join("; ");
        nextStep = `IMPORTANT: Before using this template, ASK THE USER for required parameters: ${configDesc}. `;
      }
      if (requiredInputs.length > 0) {
        nextStep += `Also ask for inputs: ${requiredInputs.map(i => `${i.label} (${i.type})`).join(", ")}`;
      }

      return {
        found: true,
        source: "preseeded",
        template: {
          name: preseeded.name,
          description: preseeded.description,
          nodes: preseeded.nodes,
          edges: preseeded.edges,
          nodeCount: preseeded.nodes.length,
        },
        requiredInputs,
        requiredConfig,
        message: `Found preseeded template: "${preseeded.name}"`,
        nextStep: nextStep || "This template is ready to use.",
      };
    }

    // 2. Check semantic patterns
    const pattern = findSemanticMatch(query);
    if (pattern) {
      const nodeSpecs = patternToNodeSpecs(pattern);
      const workflow = buildWorkflow(pattern.description, nodeSpecs);

      const requiredInputs = workflow.nodes
        .filter((n) => n.type === "input")
        .map((n) => ({
          nodeId: n.id,
          type: n.data?.mediaType || "text",
          label: n.data?.label || "Input",
        }));

      const requiredConfig = getTemplateRequiredConfig(workflow.nodes);

      // Build nextStep message
      let nextStep = "";
      if (requiredConfig.length > 0) {
        const configDesc = requiredConfig.map(c => 
          `${c.nodeType}: ${c.params.map(p => p.name).join(", ")}`
        ).join("; ");
        nextStep = `IMPORTANT: Before using this template, ASK THE USER for required parameters: ${configDesc}. `;
      }
      if (requiredInputs.length > 0) {
        nextStep += `Also ask for inputs: ${requiredInputs.map(i => `${i.label} (${i.type})`).join(", ")}`;
      }

      return {
        found: true,
        source: "semantic",
        template: {
          name: pattern.description,
          description: pattern.description,
          nodes: workflow.nodes,
          edges: workflow.edges,
          nodeCount: workflow.nodes.length,
        },
        requiredInputs,
        requiredConfig,
        message: `Found semantic match: "${pattern.description}"`,
        nextStep: nextStep || "This template is ready to use.",
      };
    }

    // 3. No match found
    return {
      found: false,
      message: `No template found for "${query}". Use build_workflow to create a custom workflow.`,
      suggestions: PRESEEDED_TEMPLATES.slice(0, 5).map(t => ({
        name: t.name,
        description: t.description,
        keywords: t.keywords.slice(0, 3),
      })),
    };
  });

  // list_workflow_templates - list all preseeded templates
  handlers.set("list_workflow_templates", async () => {
    logger.info("Listing all workflow templates");

    return {
      templates: PRESEEDED_TEMPLATES.map(t => ({
        name: t.name,
        description: t.description,
        keywords: t.keywords,
        nodeCount: t.nodes.length,
        nodeTypes: t.nodes.map(n => n.type).filter((t, i, arr) => arr.indexOf(t) === i),
      })),
      count: PRESEEDED_TEMPLATES.length,
      message: `Found ${PRESEEDED_TEMPLATES.length} pre-built templates. Use find_workflow_template with a query to get a specific template.`,
    };
  });

  // get_cache_stats - cache statistics
  handlers.set("get_cache_stats", async () => {
    logger.info("Getting cache statistics");

    const stats = getCacheStats();

    return {
      memoryCache: {
        size: stats.memoryCache.size,
        totalHits: stats.memoryCache.totalHits,
        topEntries: stats.memoryCache.entries,
      },
      preseededTemplates: stats.preseededCount,
      semanticPatterns: stats.semanticPatterns,
      message: `Cache has ${stats.memoryCache.size} entries with ${stats.memoryCache.totalHits} total hits`,
    };
  });
}
