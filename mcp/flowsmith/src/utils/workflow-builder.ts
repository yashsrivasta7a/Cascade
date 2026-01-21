import type { Node, Edge, NodeSpec } from "../schemas/index.js";
import { NODE_DEFINITIONS, getNodeDef, getNodeOutputType, nodeAcceptsType } from "../data/nodes.js";
import { logger } from "./logger.js";

// =============================================================================
// WORKFLOW BUILDER UTILITIES
// Auto-positioning and edge generation for workflows
// =============================================================================

const SPACING_X = 350;
const START_X = 0;
const START_Y = 100;

// Handle mappings for connecting nodes
// Maps output type to the compatible input handle on target nodes
const OUTPUT_HANDLES: Record<string, string> = {
  "seedream": "image",
  "seedvr": "image",
  "seedance": "video",
  "elevenlabs": "audio",
  "openrouter": "text",
  "lipsync": "video",
  "merge-audio-video": "video",
  "merge-videos": "video",
  "extract-audio": "audio",
  "crop-image": "image",
  "input": "output",
  "image-input": "output",
  "video-input": "output",
  "audio-input": "output",
};

// Maps node type to primary input handle based on expected input type
const INPUT_HANDLES: Record<string, Record<string, string>> = {
  "seedream": { text: "prompt", prompt: "prompt", any: "prompt" },
  "seedvr": { image: "image", any: "image" },
  "seedance": { text: "prompt", prompt: "prompt", image: "frame", any: "prompt" },
  "elevenlabs": { text: "text", prompt: "text", any: "text" },
  "openrouter": { text: "prompt", prompt: "prompt", any: "prompt" },
  "lipsync": { video: "video", audio: "audio" },
  "merge-audio-video": { video: "video", audio: "audio" },
  "merge-videos": { video: "video1" },
  "extract-audio": { video: "video", any: "video" },
  "crop-image": { image: "image", any: "image" },
  "output": { any: "input", text: "input", image: "input", video: "input", audio: "input" },
};

// Note: getNodeOutputType imported from nodes.ts for O(1) lookups

/**
 * Build node data based on spec (O(1) lookup)
 */
function buildNodeData(spec: NodeSpec): Record<string, unknown> {
  const def = getNodeDef(spec.type);
  const baseData: Record<string, unknown> = {
    label: def?.label || spec.type,
    nodeType: spec.type,
  };

  // Add inputType/mediaType for input nodes
  if (spec.type === "input" && spec.inputType) {
    baseData.mediaType = spec.inputType;
  }

  // Merge any additional config
  if (spec.config) {
    Object.assign(baseData, spec.config);
  }

  return baseData;
}

/**
 * Auto-layout nodes in a horizontal line
 */
export function autoLayoutNodes(nodeSpecs: NodeSpec[]): Node[] {
  return nodeSpecs.map((spec, index) => ({
    id: `${spec.type}-${index + 1}`,
    type: spec.type,
    position: { 
      x: START_X + index * SPACING_X, 
      y: START_Y,
    },
    data: buildNodeData(spec),
  }));
}

/**
 * Find the best input handle for a connection
 */
function findInputHandle(targetType: string, sourceOutputType: string): string | null {
  const handleMap = INPUT_HANDLES[targetType];
  if (!handleMap) return null;

  // Try exact match first
  if (handleMap[sourceOutputType]) {
    return handleMap[sourceOutputType];
  }

  // Try "any" as fallback
  if (handleMap.any) {
    return handleMap.any;
  }

  return null;
}

/**
 * Generate edges between nodes based on type compatibility
 * Connects output of node[i] to first compatible input of node[i+1]
 */
export function generateEdges(nodes: Node[]): Edge[] {
  const edges: Edge[] = [];

  for (let i = 0; i < nodes.length - 1; i++) {
    const sourceNode = nodes[i];
    const targetNode = nodes[i + 1];

    const sourceType = sourceNode.type || "";
    const targetType = targetNode.type || "";

    // Get source output handle
    const sourceHandle = OUTPUT_HANDLES[sourceType] || "output";
    
    // Get source output type
    const sourceOutputType = getNodeOutputType(sourceType);

    // Find target input handle
    const targetHandle = findInputHandle(targetType, sourceOutputType);

    if (targetHandle) {
      edges.push({
        id: `e${i + 1}`,
        source: sourceNode.id,
        target: targetNode.id,
        sourceHandle,
        targetHandle,
      });

      logger.debug(`Created edge: ${sourceNode.id}:${sourceHandle} -> ${targetNode.id}:${targetHandle}`);
    } else {
      logger.warn(`Could not find compatible connection: ${sourceType} -> ${targetType}`);
    }
  }

  return edges;
}

/**
 * Ensure workflow has proper Input/Output nodes
 * Automatically adds them if missing
 */
function ensureIONodes(nodeSpecs: NodeSpec[]): NodeSpec[] {
  const specs = [...nodeSpecs];
  
  // Check if first node is an input type
  const inputTypes = new Set(["input", "image-input", "video-input", "audio-input"]);
  const firstSpec = specs[0];
  const hasInput = firstSpec && inputTypes.has(firstSpec.type);
  
  // Check if last node is output
  const lastSpec = specs[specs.length - 1];
  const hasOutput = lastSpec && lastSpec.type === "output";
  
  // Determine input type needed based on first processing node
  if (!hasInput && specs.length > 0) {
    const firstProcessingNode = specs[0];
    let inputType: "text" | "image" | "video" | "audio" = "text";
    
    // Infer input type from first node
    const nodeType = firstProcessingNode.type;
    if (nodeType === "seedream" || nodeType === "elevenlabs" || nodeType === "openrouter") {
      inputType = "text";
    } else if (nodeType === "seedvr" || nodeType === "crop-image") {
      inputType = "image";
    } else if (nodeType === "seedance" || nodeType === "lipsync" || nodeType === "extract-audio") {
      inputType = "video";
    }
    
    logger.info(`Auto-adding input node (type: ${inputType})`);
    specs.unshift({ type: "input", inputType });
  }
  
  // Add output node if missing
  if (!hasOutput) {
    logger.info("Auto-adding output node");
    specs.push({ type: "output" });
  }
  
  return specs;
}

/**
 * Build a complete workflow from node specs
 * Automatically ensures Input/Output nodes exist
 * Optimized for large workflows (O(n) complexity)
 */
export function buildWorkflow(
  name: string,
  nodeSpecs: NodeSpec[]
): { name: string; nodes: Node[]; edges: Edge[] } {
  // Validate node types (O(n) with O(1) lookups)
  for (const spec of nodeSpecs) {
    if (!getNodeDef(spec.type)) {
      throw new Error(`Unknown node type: ${spec.type}`);
    }
  }

  // Ensure proper I/O nodes
  const finalSpecs = ensureIONodes(nodeSpecs);

  // Auto-layout nodes
  const nodes = autoLayoutNodes(finalSpecs);

  // Generate edges
  const edges = generateEdges(nodes);

  logger.info(`Built workflow "${name}" with ${nodes.length} nodes and ${edges.length} edges`);

  return { name, nodes, edges };
}

/**
 * Handle special multi-input nodes (like lipsync)
 * Adjusts Y positions for nodes that feed into a multi-input node
 */
export function layoutMultiInputWorkflow(
  mainNodes: NodeSpec[],
  secondaryInputs: { nodeSpec: NodeSpec; targetIndex: number; targetHandle: string }[]
): { nodes: Node[]; edges: Edge[] } {
  // Layout main nodes
  const mainNodesPositioned = autoLayoutNodes(mainNodes);
  
  // Offset for secondary inputs
  const SECONDARY_Y_OFFSET = 200;
  
  const allNodes: Node[] = [...mainNodesPositioned];
  const allEdges: Edge[] = generateEdges(mainNodesPositioned);

  // Add secondary inputs
  for (const { nodeSpec, targetIndex, targetHandle } of secondaryInputs) {
    const targetNode = mainNodesPositioned[targetIndex];
    if (!targetNode) continue;

    const secondaryNode: Node = {
      id: `${nodeSpec.type}-secondary-${allNodes.length}`,
      type: nodeSpec.type,
      position: {
        x: targetNode.position.x - SPACING_X,
        y: targetNode.position.y + SECONDARY_Y_OFFSET,
      },
      data: buildNodeData(nodeSpec),
    };

    allNodes.push(secondaryNode);

    // Create edge from secondary to target
    const sourceHandle = OUTPUT_HANDLES[nodeSpec.type] || "output";
    allEdges.push({
      id: `e-secondary-${allEdges.length}`,
      source: secondaryNode.id,
      target: targetNode.id,
      sourceHandle,
      targetHandle,
    });
  }

  return { nodes: allNodes, edges: allEdges };
}
