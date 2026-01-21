import type { NodeConfig, NodeConfigRegistry } from "./types";
import { imageNodes } from "./nodes/image-nodes";
import { videoNodes } from "./nodes/video-nodes";
import { audioNodes } from "./nodes/audio-nodes";
import { llmNodes } from "./nodes/llm-nodes";
import { utilityNodes } from "./nodes/utility-nodes";
import { ioNodes } from "./nodes/io-nodes";

// Re-export schemas for backwards compatibility
export { 
  AssetRefSchema, 
  AssetRefSchema as AssetRef,
  TextOutSchema, 
  ImageOutSchema, 
  VideoOutSchema, 
  AudioOutSchema,
  FAL_MODELS,
} from "./schemas";

// =============================================================================
// NODE CONFIGURATION REGISTRY
// Combines all node configurations into a single registry
// =============================================================================

export const NODE_CONFIG: NodeConfigRegistry = {
  // Image nodes
  ...imageNodes,
  // Video nodes
  ...videoNodes,
  // Audio nodes
  ...audioNodes,
  // LLM nodes
  ...llmNodes,
  // Utility nodes
  ...utilityNodes,
  // I/O nodes
  ...ioNodes,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get node configuration by type
 */
export function getNodeConfig(nodeType: string): NodeConfig | undefined {
  return NODE_CONFIG[nodeType];
}

/**
 * Get all node types
 */
export function getAllNodeTypes(): string[] {
  return Object.keys(NODE_CONFIG);
}

/**
 * Get nodes by category
 */
export function getNodesByCategory(category: string): NodeConfig[] {
  return Object.values(NODE_CONFIG).filter((node) => node.category === category);
}

/**
 * Check if a node type exists
 */
export function isValidNodeType(nodeType: string): boolean {
  return nodeType in NODE_CONFIG;
}

/**
 * Get all categories
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  Object.values(NODE_CONFIG).forEach((node) => categories.add(node.category));
  return Array.from(categories);
}

/**
 * Get node count by category
 */
export function getNodeCountByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  Object.values(NODE_CONFIG).forEach((node) => {
    counts[node.category] = (counts[node.category] || 0) + 1;
  });
  return counts;
}
