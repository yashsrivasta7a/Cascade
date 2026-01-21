import type { Edge, Node } from "reactflow";
import { type AINodeType } from "@/types/nodes";
import { NODE_CONFIG } from "@/lib/config";

// =============================================================================
// NODE DEFAULTS
// =============================================================================

/**
 * Get default values for a node type from config (CONFIG-DRIVEN)
 * This ensures all defaults come from the central node configuration.
 */
export function getNodeDefaults(nodeType: AINodeType): Record<string, unknown> {
  const config = NODE_CONFIG[nodeType];
  if (!config?.ui?.inputs) return {};
  
  const defaults: Record<string, unknown> = {};
  
  for (const field of config.ui.inputs) {
    if (field.defaultValue !== undefined) {
      defaults[field.id] = field.defaultValue;
    }
    // Handle toggle fields that default to false
    if (field.type === "toggle" && field.defaultValue === undefined) {
      defaults[field.id] = false;
    }
  }
  
  return defaults;
}

// =============================================================================
// TIMEOUT UTILITIES
// =============================================================================

// Default timeout for node execution (10 minutes for video processing)
export const DEFAULT_NODE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Per-node-type timeouts (some nodes need longer)
export const NODE_TIMEOUT_MS: Record<string, number> = {
  "openrouter": 2 * 60 * 1000,      // 2 minutes for LLM
  "seedream": 5 * 60 * 1000,        // 5 minutes for image gen
  "seedvr": 5 * 60 * 1000,          // 5 minutes for video repainting
  "seedance": 10 * 60 * 1000,       // 10 minutes for video gen
  "elevenlabs": 2 * 60 * 1000,      // 2 minutes for TTS
  "lipsync": 10 * 60 * 1000,        // 10 minutes for lipsync
  "crop-image": 2 * 60 * 1000,      // 2 minutes for crop
  "merge-videos": 10 * 60 * 1000,   // 10 minutes for video merge
  "merge-audio-video": 10 * 60 * 1000, // 10 minutes for A/V merge
  "extract-audio": 5 * 60 * 1000,   // 5 minutes for audio extraction
};

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${Math.ceil(timeoutMs / 1000)}s`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (t) clearTimeout(t);
  }) as Promise<T>;
}

export function parseDurationMs(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (!s) return undefined;

  // plain number => ms
  if (/^\d+$/.test(s)) return Number(s);

  const m = s.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return undefined;

  const unit = m[2];
  if (unit === "ms") return Math.round(n);
  if (unit === "s") return Math.round(n * 1000);
  if (unit === "m") return Math.round(n * 60_000);
  if (unit === "h") return Math.round(n * 3_600_000);
  return undefined;
}

// =============================================================================
// GRAPH UTILITIES
// =============================================================================

// Memoization cache for topoSort
// Key: hash of node IDs + edge connections, Value: sorted node IDs
let _topoSortCache: {
  hash: string;
  sortedIds: string[];
} | null = null;

/**
 * Generate a hash key for the current graph structure.
 * Only considers node IDs and edge connections (not node data).
 */
function getGraphHash(nodes: Node[], edges: Edge[]): string {
  // Sort for consistent hashing regardless of array order
  const nodeIds = nodes.map(n => n.id).sort().join(",");
  const edgeKeys = edges.map(e => `${e.source}->${e.target}`).sort().join(",");
  return `${nodeIds}|${edgeKeys}`;
}

/**
 * Topological sort with memoization.
 * Results are cached and reused when the graph structure hasn't changed.
 */
export function topoSort(nodes: Node[], edges: Edge[]): Node[] {
  const hash = getGraphHash(nodes, edges);
  
  // Return cached result if graph structure unchanged
  if (_topoSortCache && _topoSortCache.hash === hash) {
    // Rebuild Node[] from cached IDs (nodes may have updated data)
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return _topoSortCache.sortedIds
      .map(id => byId.get(id))
      .filter((n): n is Node => n !== undefined);
  }
  
  // Calculate fresh topological sort
  const inDeg = new Map<string, number>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();

  for (const n of nodes) inDeg.set(n.id, 0);
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }

  const q: string[] = [];
  for (const [id, deg] of inDeg.entries()) if (deg === 0) q.push(id);

  const out: Node[] = [];
  while (q.length) {
    const id = q.shift()!;
    const n = byId.get(id);
    if (n) out.push(n);
    for (const nxt of adj.get(id) ?? []) {
      inDeg.set(nxt, (inDeg.get(nxt) ?? 0) - 1);
      if (inDeg.get(nxt) === 0) q.push(nxt);
    }
  }

  // Cache the result (store IDs only, not node references)
  _topoSortCache = {
    hash,
    sortedIds: out.map(n => n.id),
  };

  return out;
}

/**
 * Clear the topoSort cache. Call this if you need to force recalculation.
 */
export function clearTopoSortCache(): void {
  _topoSortCache = null;
}

/**
 * Get all upstream (ancestor) nodes that the target node depends on.
 * Returns nodes in topological order (parents before children).
 */
export function getUpstreamNodes(targetNodeId: string, nodes: Node[], edges: Edge[]): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const upstream = new Set<string>();
  
  // Build reverse adjacency list (child -> parents)
  const reverseAdj = new Map<string, string[]>();
  for (const e of edges) {
    if (!reverseAdj.has(e.target)) reverseAdj.set(e.target, []);
    reverseAdj.get(e.target)!.push(e.source);
  }
  
  // DFS to find all ancestors
  const dfs = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const parents = reverseAdj.get(nodeId) ?? [];
    for (const parentId of parents) {
      upstream.add(parentId);
      dfs(parentId);
    }
  };
  
  dfs(targetNodeId);
  
  // Convert to array of nodes
  const upstreamNodes: Node[] = [];
  for (const id of upstream) {
    const node = byId.get(id);
    if (node) upstreamNodes.push(node);
  }
  
  // Return in topological order (so parents run before their children)
  return topoSort(upstreamNodes, edges.filter(e => upstream.has(e.source) && upstream.has(e.target)));
}

/**
 * Check if a node has output data
 */
export function nodeHasOutput(node: Node): boolean {
  const data = node.data as Record<string, unknown> | undefined;
  if (!data) return false;
  
  // Check for result object
  const result = data.result;
  if (!result) return false;
  
  // Check if result has actual content
  if (typeof result === "object" && result !== null) {
    const resultObj = result as Record<string, unknown>;
    // Check for common output fields
    if (resultObj.url || resultObj.text || resultObj.image || resultObj.video || resultObj.audio) {
      return true;
    }
  }
  
  return false;
}

// Node type categories
export const TRIGGER_NODE_TYPES = [
  "seedream", "seedvr", "seedance", "elevenlabs", "lipsync"
];

export const LOCAL_NODE_TYPES = [
  "crop-image", "merge-audio-video", "merge-videos", "extract-audio"
];
