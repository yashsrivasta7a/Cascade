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
  "seedream": { text: "prompt", prompt: "prompt", image: "referenceImages", any: "prompt" },
  "seedvr": { image: "image", any: "image" },
  "seedance": { text: "prompt", prompt: "prompt", image: "frame", any: "prompt" },
  "elevenlabs": { text: "text", prompt: "text", any: "text" },
  "openrouter": { text: "prompt", prompt: "prompt", image: "inputImage", any: "prompt" },
  "lipsync": { video: "video", audio: "audio" },
  "merge-audio-video": { video: "video", audio: "audio" },
  "merge-videos": { video: "video1", video2: "video2" },
  "extract-audio": { video: "video", any: "video" },
  "crop-image": { image: "image", any: "image" },
  "output": { any: "input", text: "input", image: "input", video: "input", audio: "input" },
};

// Nodes that require multiple inputs of the same type
const MULTI_INPUT_NODES: Record<string, { inputs: string[]; types: string[] }> = {
  "merge-videos": { inputs: ["video1", "video2"], types: ["video", "video"] },
  "merge-audio-video": { inputs: ["video", "audio"], types: ["video", "audio"] },
  "lipsync": { inputs: ["video", "audio"], types: ["video", "audio"] },
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
 * Handles both sequential connections and multi-input nodes
 */
export function generateEdges(nodes: Node[]): Edge[] {
  const edges: Edge[] = [];
  const usedInputHandles = new Map<string, Set<string>>(); // Track which handles are already connected
  
  // Initialize tracking for all nodes
  for (const node of nodes) {
    usedInputHandles.set(node.id, new Set());
  }

  // First pass: identify multi-input nodes and collect their source nodes
  const multiInputTargets = new Map<string, { node: Node; sourceNodes: Node[] }>();
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodeType = node.type || "";
    
    if (MULTI_INPUT_NODES[nodeType]) {
      multiInputTargets.set(node.id, { node, sourceNodes: [] });
    }
  }

  // Helper to get actual output type (handles input nodes with mediaType)
  const getActualOutputType = (node: Node): string => {
    const nodeType = node.type || "";
    // For input nodes, use mediaType directly
    if (nodeType === "input" && node.data?.mediaType) {
      return node.data.mediaType as string;
    }
    // For other nodes, use the definition's output type
    const defOutput = getNodeOutputType(nodeType);
    return defOutput !== "any" ? defOutput : "any";
  };

  // Second pass: match input nodes to multi-input targets
  for (let i = 0; i < nodes.length; i++) {
    const sourceNode = nodes[i];
    const sourceOutputType = getActualOutputType(sourceNode);
    
    // Look ahead for multi-input nodes
    for (let j = i + 1; j < nodes.length; j++) {
      const targetNode = nodes[j];
      const targetType = targetNode.type || "";
      const multiInputConfig = MULTI_INPUT_NODES[targetType];
      
      if (multiInputConfig) {
        const targetInfo = multiInputTargets.get(targetNode.id);
        if (targetInfo) {
          // Check if this source type matches any required input
          const typeIndex = multiInputConfig.types.indexOf(sourceOutputType);
          if (typeIndex !== -1) {
            targetInfo.sourceNodes.push(sourceNode);
            break; // Each source can only feed one target
          }
        }
      }
    }
  }

  // Third pass: create edges for multi-input nodes
  for (const [targetId, { node: targetNode, sourceNodes }] of multiInputTargets) {
    const targetType = targetNode.type || "";
    const multiInputConfig = MULTI_INPUT_NODES[targetType];
    
    if (!multiInputConfig) continue;
    
    // Match source nodes to input handles based on their output types
    const usedHandles = usedInputHandles.get(targetId)!;
    
    for (const sourceNode of sourceNodes) {
      const sourceType = sourceNode.type || "";
      const sourceOutputType = getActualOutputType(sourceNode);
      const sourceHandle = OUTPUT_HANDLES[sourceType] || "output";
      
      // Find an unused handle that matches this type
      for (let i = 0; i < multiInputConfig.types.length; i++) {
        const requiredType = multiInputConfig.types[i];
        const handleName = multiInputConfig.inputs[i];
        
        if (sourceOutputType === requiredType && !usedHandles.has(handleName)) {
          edges.push({
            id: `e${edges.length + 1}`,
            source: sourceNode.id,
            target: targetId,
            sourceHandle,
            targetHandle: handleName,
          });
          usedHandles.add(handleName);
          logger.debug(`Created multi-input edge: ${sourceNode.id}:${sourceHandle} -> ${targetId}:${handleName}`);
          break;
        }
      }
    }
  }

  // Fourth pass: create sequential edges for non-multi-input connections
  for (let i = 0; i < nodes.length - 1; i++) {
    const sourceNode = nodes[i];
    const targetNode = nodes[i + 1];
    
    const sourceType = sourceNode.type || "";
    const targetType = targetNode.type || "";
    
    // Skip if target is a multi-input node (already handled)
    if (MULTI_INPUT_NODES[targetType]) {
      continue;
    }
    
    // Skip if source is an input node that feeds a multi-input node
    let skipSource = false;
    for (const [, { sourceNodes }] of multiInputTargets) {
      if (sourceNodes.includes(sourceNode)) {
        skipSource = true;
        break;
      }
    }
    if (skipSource) continue;

    // Get actual output type and handle
    const sourceOutputType = getActualOutputType(sourceNode);
    const sourceHandle = OUTPUT_HANDLES[sourceType] || "output";
    
    // Find target input handle
    const targetHandle = findInputHandle(targetType, sourceOutputType);

    if (targetHandle) {
      const usedHandles = usedInputHandles.get(targetNode.id)!;
      if (!usedHandles.has(targetHandle)) {
        edges.push({
          id: `e${edges.length + 1}`,
          source: sourceNode.id,
          target: targetNode.id,
          sourceHandle,
          targetHandle,
        });
        usedHandles.add(targetHandle);
        logger.debug(`Created edge: ${sourceNode.id}:${sourceHandle} -> ${targetNode.id}:${targetHandle}`);
      }
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
