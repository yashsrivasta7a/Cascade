import type { Edge, Node } from "reactflow";
import { type AINodeType } from "@/types/nodes";

// -----------------------------------------------------------------------------
// INPUT CHANGE DETECTION
// -----------------------------------------------------------------------------

/**
 * Compute a hash of relevant inputs for a node to detect changes.
 * Used to determine if a node needs to re-run or can use cached results.
 */
export function computeNodeInputHash(
  node: Node,
  edges: Edge[],
  nodes: Node[]
): string {
  const type = node.type as AINodeType;
  const data = (node.data ?? {}) as Record<string, unknown>;
  
  // Get settings from this node (excluding metadata and transient fields)
  const excludeFields = new Set([
    "_inheritedFrom", "incomingFrom", "_isUploading", "_lastInputHash",
    "advancedOpen", "status", "error", "progress", "result", "label"
  ]);
  
  const relevantSettings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (excludeFields.has(key) || key.startsWith("_")) continue;
    relevantSettings[key] = value;
  }
  
  // Get inputs from connected parent nodes
  const incomingEdges = edges.filter(e => e.target === node.id);
  const parentInputs: Record<string, unknown> = {};
  
  for (const edge of incomingEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) continue;
    
    const sourceData = sourceNode.data as Record<string, unknown>;
    const sourceResult = sourceData?.result;
    const sourceHandle = edge.sourceHandle || "default";
    const targetHandle = edge.targetHandle || "default";
    
    // Include the parent's result and relevant settings
    parentInputs[`${edge.source}:${sourceHandle}->${targetHandle}`] = {
      result: sourceResult,
      // Also include parent's relevant settings that might affect output
      parentType: sourceNode.type,
    };
  }
  
  // Combine into a single object and create a stable string representation
  const hashInput = {
    nodeType: type,
    settings: relevantSettings,
    parentInputs,
  };
  
  // Simple hash using JSON string - stable enough for change detection
  const jsonStr = JSON.stringify(hashInput, Object.keys(hashInput).sort());
  
  // Create a simple hash (djb2 algorithm)
  let hash = 5381;
  for (let i = 0; i < jsonStr.length; i++) {
    hash = ((hash << 5) + hash) + jsonStr.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash.toString(16);
}

/**
 * Check if a node's inputs have changed since its last execution.
 * Returns true if the node needs to re-run.
 */
export function hasNodeInputsChanged(
  node: Node,
  edges: Edge[],
  nodes: Node[]
): boolean {
  const data = node.data as Record<string, unknown>;
  const lastHash = data._lastInputHash as string | undefined;
  
  // If no previous hash, node hasn't run or was reset - needs to run
  if (!lastHash) {
    console.log(`[hasNodeInputsChanged] Node ${node.id} has no previous hash - needs to run`);
    return true;
  }
  
  const currentHash = computeNodeInputHash(node, edges, nodes);
  const changed = currentHash !== lastHash;
  
  console.log(`[hasNodeInputsChanged] Node ${node.id}: lastHash=${lastHash}, currentHash=${currentHash}, changed=${changed}`);
  
  return changed;
}

/**
 * Check if any upstream node's inputs have changed.
 * If a parent changed, we need to re-run even if our direct inputs look the same.
 */
export function hasUpstreamChanges(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  checkedNodes: Set<string> = new Set()
): boolean {
  // Prevent infinite loops
  if (checkedNodes.has(nodeId)) return false;
  checkedNodes.add(nodeId);
  
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return false;
  
  // Check if this node itself changed
  if (hasNodeInputsChanged(node, edges, nodes)) {
    console.log(`[hasUpstreamChanges] Node ${nodeId} has input changes`);
    return true;
  }
  
  // Check all upstream nodes recursively
  const incomingEdges = edges.filter(e => e.target === nodeId);
  for (const edge of incomingEdges) {
    if (hasUpstreamChanges(edge.source, nodes, edges, checkedNodes)) {
      console.log(`[hasUpstreamChanges] Upstream node ${edge.source} has changes affecting ${nodeId}`);
      return true;
    }
  }
  
  return false;
}
