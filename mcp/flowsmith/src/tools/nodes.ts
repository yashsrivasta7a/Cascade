import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getNodeInfoList, getNodeDetail, getCategories, isValidNodeType } from "../data/nodes.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// NODE TOOL DEFINITIONS
// =============================================================================

export const nodeToolDefinitions: Tool[] = [
  {
    name: "list_nodes",
    description: "List all available nodes or filter by category. Returns node type, label, description, category, provider, action, estimated cost, and inputs/outputs for each node.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category (optional)",
          enum: ["image", "video", "audio", "llm", "utility", "io"],
        },
      },
      required: [],
    },
  },
  {
    name: "get_node_info",
    description: "Get detailed information about a specific node type including inputs, outputs, features, models, and estimated cost/time.",
    inputSchema: {
      type: "object",
      properties: {
        nodeType: {
          type: "string",
          description: "The node type to get info for",
        },
      },
      required: ["nodeType"],
    },
  },
];

// =============================================================================
// NODE TOOL HANDLERS
// =============================================================================

interface ListNodesArgs {
  category?: string;
}

interface GetNodeInfoArgs {
  nodeType: string;
}

/**
 * Register node tool handlers
 */
export function registerNodeTools(handlers: Map<string, (args: unknown) => Promise<unknown>>): void {
  // list_nodes - Get all nodes or filter by category
  handlers.set("list_nodes", async (args: unknown) => {
    const { category } = (args as ListNodesArgs) || {};
    
    logger.debug(`Listing nodes`, { category });
    
    const nodes = getNodeInfoList(category);
    const categories = getCategories();

    return {
      nodes,
      count: nodes.length,
      categories,
      filter: category || "all",
    };
  });

  // get_node_info - Get detailed info for a specific node
  handlers.set("get_node_info", async (args: unknown) => {
    const { nodeType } = args as GetNodeInfoArgs;
    
    if (!nodeType) {
      throw new Error("Missing required parameter: nodeType");
    }

    logger.debug(`Getting node info: ${nodeType}`);

    if (!isValidNodeType(nodeType)) {
      const allNodes = getNodeInfoList();
      const availableTypes = allNodes.map((n) => n.type);
      throw new Error(`Unknown node type: ${nodeType}. Available types: ${availableTypes.join(", ")}`);
    }

    const nodeDetail = getNodeDetail(nodeType);
    if (!nodeDetail) {
      throw new Error(`Could not get details for node type: ${nodeType}`);
    }

    return {
      node: nodeDetail,
      inputCount: nodeDetail.inputs.length,
      outputCount: nodeDetail.outputs.length,
    };
  });
}
