import type { Node, Edge, Connection } from "reactflow";
import { type AINodeType, type DataType, NODE_CONTRACTS, getHandleDataType as getHandleDataTypeFn, isTypeCompatible as isTypeCompatibleFn } from "@/types/nodes";

// =============================================================================
// NODE OUTPUT PREVIEW UTILITIES
// =============================================================================

export function getNodeOutputPreview(node: Node): string | undefined {
  const d = (node.data ?? {}) as Record<string, unknown>;
  const candidates = [
    d.result,
    d.response,
    d.output,
    d.prompt,
    d.systemPrompt,
    d.text,
  ];

  for (const v of candidates) {
    if (typeof v === "string" && v.trim().length > 0) {
      return v.trim().slice(0, 500);
    }
  }

  return undefined;
}

/**
 * Get the actual media output from a node (image/video/audio URL)
 * Maps output handle names to data fields where the actual output is stored
 */
export function getNodeMediaOutput(node: Node, handleId: string | null): string | undefined {
  const d = (node.data ?? {}) as Record<string, unknown>;
  
  // Direct field match first
  if (handleId && d[handleId] && typeof d[handleId] === "string") {
    return d[handleId] as string;
  }
  
  // Map handle names to common data field names
  const handleToFieldMap: Record<string, string[]> = {
    // Image outputs
    "image": ["result", "image", "outputImage"],
    "upscaled": ["result", "upscaled", "outputImage"],
    "cropped": ["result", "cropped", "outputImage"],
    // Video outputs
    "video": ["result", "video", "outputVideo"],
    "synced": ["result", "synced", "outputVideo"],
    "combined": ["result", "combined", "outputVideo"],
    "merged": ["result", "merged", "outputVideo"],
    // Audio outputs
    "audio": ["result", "audio", "outputAudio"],
    // Text outputs
    "response": ["response", "result", "output"],
    "out": ["result", "response", "output"],
  };
  
  const fieldsToCheck = handleId ? (handleToFieldMap[handleId] || [handleId, "result"]) : ["result"];
  
  for (const field of fieldsToCheck) {
    if (d[field] && typeof d[field] === "string" && (d[field] as string).trim().length > 0) {
      return d[field] as string;
    }
  }
  
  return undefined;
}

// =============================================================================
// NODE SETTINGS UTILITIES
// =============================================================================

export function getNodeSettingKeys(node: Node | undefined): string[] {
  if (!node?.type) return [];
  const nodeType = node.type as AINodeType;

  // Use NODE_CONTRACTS for accurate settings mapping (config-driven)
  const contract = NODE_CONTRACTS[nodeType];
  if (contract) {
    return contract.settings.map((s: { id: string }) => s.id);
  }

  return [];
}

export function getHandleDataType(
  node: Node | undefined,
  direction: "inputs" | "outputs",
  handleId: string | null | undefined
): DataType | undefined {
  if (!node?.type) return undefined;
  
  // Special handling for unified input node - use mediaType from data
  if (node.type === "input" && direction === "outputs") {
    const mediaType = (node.data as Record<string, unknown>)?.mediaType as string | undefined;
    if (mediaType && ["text", "image", "video", "audio"].includes(mediaType)) {
      return mediaType as DataType;
    }
    // If no mediaType selected yet, return "any" to allow any connection
    return "any";
  }
  
  // Use the centralized config-driven function for other nodes
  return getHandleDataTypeFn(node.type as AINodeType, direction, handleId);
}

// =============================================================================
// GRAPH UTILITIES
// =============================================================================

export function wouldCreateCycle(edges: Edge[], source: string, target: string): boolean {
  if (source === target) return true;

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  // Check if there's already a path target -> source
  const stack = [target];
  const visited = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const next = adj.get(cur);
    if (next) stack.push(...next);
  }
  return false;
}

// Type compatibility - use centralized function from types/nodes.ts
export function isTypeCompatible(from: DataType | undefined, to: DataType | undefined): boolean {
  return isTypeCompatibleFn(from, to);
}

