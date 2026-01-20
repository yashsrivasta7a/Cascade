import type { Edge, Node } from "reactflow";
import { z } from "zod";
import { type AINodeType, NODE_DEFINITIONS } from "@/types/nodes";
import {
  NodeInputSchemas,
  NodeOutputSchemas,
  NodePrimaryOutputType,
  NodeProviders,
  type ProviderId,
  type AnyOut,
} from "./node-schemas";
import { estimateNodeCost } from "@/lib/credits";
import { checkCache, cacheResult } from "@/lib/cache";
import { NODE_CONFIG } from "@/lib/config";
import { parseLLMToFieldValue, canFieldAcceptLLMInput } from "./llm-type-parser";
import { showSkipWarning, showAllSkippedWarning } from "@/lib/toast";

// =============================================================================
// UPLOAD LARGE MEDIA TO CDN BEFORE API CALLS
// =============================================================================
// Vercel has a ~4MB body limit. Base64 media can be 10MB+.
// We upload to CDN first, then send only the URL to the API.

async function uploadMediaToCDN(dataUrl: string, type: "video" | "audio" | "image"): Promise<string> {
  // Only upload base64 data URLs
  if (!dataUrl.startsWith("data:")) {
    return dataUrl;
  }
  
  // Check size - only upload if > 1MB (to avoid unnecessary API calls)
  if (dataUrl.length < 1_000_000) {
    return dataUrl;
  }
  
  console.log(`[uploadMediaToCDN] Uploading ${type} (${(dataUrl.length / 1024 / 1024).toFixed(2)}MB) to CDN...`);
  
  try {
    const response = await fetch("/api/media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, type }),
    });
    
    if (response.ok) {
      const { url } = await response.json();
      console.log(`[uploadMediaToCDN] ${type} uploaded to CDN: ${url.slice(0, 80)}...`);
      return url;
    } else {
      console.warn(`[uploadMediaToCDN] CDN upload failed (${response.status}), keeping base64`);
      return dataUrl;
    }
  } catch (error) {
    console.warn("[uploadMediaToCDN] CDN upload error:", error);
    return dataUrl;
  }
}

async function preprocessInputForAPI(input: unknown): Promise<unknown> {
  if (!input || typeof input !== "object") return input;
  
  const obj = input as Record<string, unknown>;
  const result: Record<string, unknown> = { ...obj };
  
  // Fields that might contain large media
  const mediaFields: Record<string, "video" | "audio" | "image"> = {
    video: "video",
    audio: "audio",
    image: "image",
    inputVideo: "video",
    inputAudio: "audio",
    inputImage: "image",
    video1: "video",
    video2: "video",
  };
  
  for (const [field, type] of Object.entries(mediaFields)) {
    const value = obj[field];
    
    // Handle string URLs
    if (typeof value === "string" && value.startsWith("data:") && value.length > 1_000_000) {
      result[field] = await uploadMediaToCDN(value, type);
    }
    
    // Handle object with url property
    if (typeof value === "object" && value !== null && "url" in value) {
      const urlObj = value as { url: string; mimeType?: string };
      if (typeof urlObj.url === "string" && urlObj.url.startsWith("data:") && urlObj.url.length > 1_000_000) {
        const uploadedUrl = await uploadMediaToCDN(urlObj.url, type);
        result[field] = { ...urlObj, url: uploadedUrl };
      }
    }
  }
  
  return result;
}

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

/**
 * Get default values for a node type from config (CONFIG-DRIVEN)
 * This ensures all defaults come from the central node configuration.
 */
function getNodeDefaults(nodeType: AINodeType): Record<string, unknown> {
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

export type NodeRunStatus = "queued" | "running" | "completed" | "failed";

export interface RunCallbacks {
  onNodeStatus?: (nodeId: string, status: NodeRunStatus, patch?: Record<string, unknown>) => void;
  onNodeResult?: (nodeId: string, resultText: string, output: AnyOut) => void;
}

type OutputByNode = Map<string, AnyOut>;

// Default timeout for node execution (10 minutes for video processing)
const DEFAULT_NODE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Per-node-type timeouts (some nodes need longer)
const NODE_TIMEOUT_MS: Record<string, number> = {
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${Math.ceil(timeoutMs / 1000)}s`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (t) clearTimeout(t);
  }) as Promise<T>;
}

function parseDurationMs(v: unknown): number | undefined {
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

function topoSort(nodes: Node[], edges: Edge[]): Node[] {
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

  return out;
}

/**
 * Get all upstream (ancestor) nodes that the target node depends on.
 * Returns nodes in topological order (parents before children).
 */
function getUpstreamNodes(targetNodeId: string, nodes: Node[], edges: Edge[]): Node[] {
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
 * Check if a node has already produced output (has a result).
 */
function nodeHasOutput(node: Node): boolean {
  const data = node.data as Record<string, unknown>;
  const result = data?.result;
  
  // Has a valid result if it's a non-empty string or a valid URL
  if (typeof result === "string" && result.trim().length > 0) {
    return true;
  }
  
  return false;
}

// Get incoming text for context (includes history)
function getIncomingTextForContext(edges: Edge[], outputs: OutputByNode, nodeId: string, nodes: Node[]): string | undefined {
  const incoming = edges.filter((e) => e.target === nodeId && e.targetHandle !== "prompt");
  console.log(`[getIncomingTextForContext] Node ${nodeId} has ${incoming.length} context edges`);
  
  const textParts: string[] = [];
  
  for (const e of incoming) {
    const out = outputs.get(e.source);
    const sourceNode = nodes.find((n) => n.id === e.source);
    
    if (out?.type === "text") {
      // Include both the original prompt and the response for full context
      const sourceData = (sourceNode?.data ?? {}) as { prompt?: string };
      const originalPrompt = sourceData.prompt;
      
      if (originalPrompt) {
        textParts.push(`[Previous message: "${originalPrompt}"]\n[Response: "${out.text}"]`);
      } else {
        textParts.push(out.text);
      }
    }
  }
  
  return textParts.length > 0 ? textParts.join("\n\n") : undefined;
}

// Get incoming text for prompt (just the response, no history)
function getIncomingTextForPrompt(edges: Edge[], outputs: OutputByNode, nodeId: string): string | undefined {
  const incoming = edges.filter((e) => e.target === nodeId && e.targetHandle === "prompt");
  console.log(`[getIncomingTextForPrompt] Node ${nodeId} has ${incoming.length} prompt edges`);
  
  for (const e of incoming) {
    const out = outputs.get(e.source);
    
    if (out?.type === "text") {
      // response → prompt: ONLY the LLM response, no history
      console.log(`[getIncomingTextForPrompt] Using response as prompt: "${out.text?.slice(0, 100)}..."`);
      return out.text;
    }
  }
  
  return undefined;
}

/**
 * Get parsed settings values from connected LLM nodes.
 * When an LLM node is connected to any settings handle,
 * this function parses the LLM text output to the expected type.
 * 
 * Supports ALL field types: select, slider, number, toggle, text, textarea
 * 
 * @returns Object with parsed settings values, or errors for failed parses
 */
function getIncomingSettingsFromLLM(
  edges: Edge[], 
  outputs: OutputByNode, 
  nodes: Node[],
  nodeId: string,
  nodeType: AINodeType
): { values: Record<string, unknown>; errors: { handle: string; error: string }[] } {
  const values: Record<string, unknown> = {};
  const errors: { handle: string; error: string }[] = [];
  
  // Find all edges to this node
  const incoming = edges.filter((e) => e.target === nodeId);
  
  for (const edge of incoming) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) continue;
    
    // Only process LLM sources
    if (sourceNode.type !== "openrouter") continue;
    
    const out = outputs.get(edge.source);
    if (!out || out.type !== "text" || !out.text) continue;
    
    const targetHandle = edge.targetHandle;
    if (!targetHandle) continue;
    
    // Skip prompt and context - they're handled separately
    if (targetHandle === "prompt" || targetHandle === "context") continue;
    
    // Check if this field can accept LLM input
    if (!canFieldAcceptLLMInput(nodeType, targetHandle)) {
      // For non-parseable fields (like file inputs), just pass through as-is
      values[targetHandle] = out.text;
      continue;
    }
    
    // Use universal parser that handles ALL field types
    console.log(`[getIncomingSettingsFromLLM] Parsing LLM output for ${nodeId}.${targetHandle}: "${out.text.slice(0, 50)}..."`);
    const parseResult = parseLLMToFieldValue(out.text, nodeType, targetHandle);
    
    if (parseResult.success) {
      console.log(`[getIncomingSettingsFromLLM] Parse success: ${JSON.stringify(parseResult.value)}`);
      values[targetHandle] = parseResult.value;
    } else {
      const errorMsg = 'error' in parseResult ? parseResult.error : 'Unknown parse error';
      console.log(`[getIncomingSettingsFromLLM] Parse FAILED: ${errorMsg}`);
      errors.push({ handle: targetHandle, error: errorMsg });
    }
  }
  
  return { values, errors };
}

function getNodeOutputPreviewFromData(node: Node): string | undefined {
  const d = (node.data ?? {}) as any;
  const candidates = [
    d.result,
    d.response,
    d.output,
    d.prompt,
    d.systemPrompt,
    d.text,
    d.image,
    d.video,
    d.audio,
  ];

  for (const v of candidates) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim().slice(0, 2000);
    // Some nodes may store assets as {url}
    if (v && typeof v === "object" && typeof (v as any).url === "string") {
      const u = String((v as any).url).trim();
      if (u) return u.slice(0, 2000);
    }
  }

  return undefined;
}

function getConnectedPreviewFromLastOutputs(nodes: Node[], edges: Edge[], nodeId: string): string | undefined {
  const incoming = edges.filter((e) => e.target === nodeId);
  for (const e of incoming) {
    const source = nodes.find((n) => n.id === e.source);
    if (!source) continue;
    const preview = getNodeOutputPreviewFromData(source);
    if (preview) return preview;
  }
  return undefined;
}

// Get incoming media (video/audio/image) from connected nodes
function getIncomingMedia(edges: Edge[], outputs: OutputByNode, nodeId: string, targetHandle?: string): string | undefined {
  // First try exact handle match
  let incoming = edges.filter((e) => e.target === nodeId && e.targetHandle === targetHandle);
  
  // If no exact match, try edges with no specific target handle or any handle
  if (incoming.length === 0 && targetHandle) {
    incoming = edges.filter((e) => e.target === nodeId && (!e.targetHandle || e.targetHandle === targetHandle));
  }
  
  // If still no match, get ALL incoming edges to this node
  if (incoming.length === 0) {
    incoming = edges.filter((e) => e.target === nodeId);
  }
  
  console.log(`[getIncomingMedia] Node ${nodeId}, targetHandle: ${targetHandle}, found ${incoming.length} edges`);
  
  for (const e of incoming) {
    const out = outputs.get(e.source);
    console.log(`[getIncomingMedia] Edge from ${e.source} (handle: ${e.sourceHandle}) -> ${e.target} (handle: ${e.targetHandle}), output:`, out ? out.type : 'not found');
    
    if (!out) continue;
    
    // Check what type of output this is and return the URL
    if (out.type === "video" && out.video?.url) {
      return out.video.url;
    }
    if (out.type === "audio" && out.audio?.url) {
      return out.audio.url;
    }
    if (out.type === "image" && out.image?.url) {
      return out.image.url;
    }
  }
  
  return undefined;
}

function buildNodeInput(node: Node, edges: Edge[], outputs: OutputByNode, nodes: Node[]) {
  const type = node.type as AINodeType;
  const data = (node.data ?? {}) as any;

  console.log(`[buildNodeInput] === Building input for ${node.id} (${type}) ===`);
  console.log(`[buildNodeInput] Edges count: ${edges.length}, edges to this node: ${edges.filter(e => e.target === node.id).length}`);
  console.log(`[buildNodeInput] Outputs map size: ${outputs.size}, keys: ${[...outputs.keys()].join(', ')}`);
  console.log(`[buildNodeInput] Nodes available: ${nodes.length}, IDs: ${nodes.map(n => n.id).join(', ')}`);
  
  // Debug: Log raw node data for crop-image to diagnose object-instead-of-number issue
  if (type === "crop-image") {
    console.log(`[buildNodeInput:crop-image] RAW NODE DATA:`, JSON.stringify(data, null, 2));
    console.log(`[buildNodeInput:crop-image] xPercent type: ${typeof data.xPercent}, value: ${JSON.stringify(data.xPercent)}`);
    console.log(`[buildNodeInput:crop-image] yPercent type: ${typeof data.yPercent}, value: ${JSON.stringify(data.yPercent)}`);
    console.log(`[buildNodeInput:crop-image] widthPercent type: ${typeof data.widthPercent}, value: ${JSON.stringify(data.widthPercent)}`);
    console.log(`[buildNodeInput:crop-image] heightPercent type: ${typeof data.heightPercent}, value: ${JSON.stringify(data.heightPercent)}`);
  }

  // Get incoming text for prompt (response → prompt: just the response)
  const incomingPrompt = getIncomingTextForPrompt(edges, outputs, node.id);
  
  // Get incoming text for context (includes conversation history)
  const incomingContext = getIncomingTextForContext(edges, outputs, node.id, nodes);

  // Determine prompt value:
  // 1. If there's an incoming prompt connection, use the LLM response as the prompt
  // 2. Otherwise, use the node's own prompt setting
  const promptValue = incomingPrompt || data.prompt;

  // Determine context value:
  // 1. If there's incoming context, use it (includes history)
  // 2. Otherwise, fall back to node's stored context
  const contextValue = incomingContext || (typeof data.context === 'string' && data.context.trim() ? data.context : undefined);

  // Filter out metadata fields that shouldn't be passed to the executor
  const metadataFields = new Set([
    "_inheritedFrom", 
    "incomingFrom", 
    "_isUploading",
    "advancedOpen",
    "status",
    "error",
    "progress",
  ]);
  
  // Sanitize data: remove metadata and ensure numeric fields are numbers
  const sanitizedData: Record<string, unknown> = {};
  
  // List of all numeric fields across all node types
  const numericFields = new Set([
    "xPercent", "yPercent", "widthPercent", "heightPercent",
    "temperature", "maxTokens", "seed", "numInferenceSteps", "guidanceScale",
    "stability", "clarity", "transitionDuration",
    "topP", "topK", "frequencyPenalty", "presencePenalty",
  ]);
  
  for (const [key, value] of Object.entries(data)) {
    // Skip metadata fields
    if (metadataFields.has(key)) continue;
    
    // Skip any field that starts with underscore (internal metadata)
    if (key.startsWith("_")) continue;
    
    // Ensure numeric fields are actually numbers (not objects)
    if (numericFields.has(key)) {
      if (typeof value === "number") {
        sanitizedData[key] = value;
      } else if (typeof value === "string" && !isNaN(Number(value))) {
        sanitizedData[key] = Number(value);
      } else if (typeof value === "object" && value !== null) {
        // Try to extract number from object if it has a value property
        const objValue = (value as Record<string, unknown>).value;
        if (typeof objValue === "number") {
          console.warn(`[buildNodeInput] Field ${key} was an object, extracted value: ${objValue}`);
          sanitizedData[key] = objValue;
        } else {
          console.warn(`[buildNodeInput] Field ${key} is an object (expected number), skipping: ${JSON.stringify(value).slice(0, 100)}`);
        }
      }
      // Skip if value is invalid - will use default from config
      continue;
    }
    
    // For non-numeric fields, also skip if they're objects that look like metadata
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      // Skip if it looks like inheritance metadata (has sourceNodeId or settings)
      if (obj.sourceNodeId !== undefined || obj.settings !== undefined || obj.fullInheritance !== undefined) {
        console.warn(`[buildNodeInput] Skipping metadata-like object in field ${key}`);
        continue;
      }
    }
    
    sanitizedData[key] = value;
  }
  
  console.log(`[buildNodeInput] Sanitized data keys: ${Object.keys(sanitizedData).join(", ")}`);
  if (type === "crop-image") {
    console.log(`[buildNodeInput] Sanitized numeric values: xPercent=${sanitizedData.xPercent} (${typeof sanitizedData.xPercent}), yPercent=${sanitizedData.yPercent} (${typeof sanitizedData.yPercent}), widthPercent=${sanitizedData.widthPercent} (${typeof sanitizedData.widthPercent}), heightPercent=${sanitizedData.heightPercent} (${typeof sanitizedData.heightPercent})`);
  }

  // Get parsed settings from connected LLM nodes
  const llmSettings = getIncomingSettingsFromLLM(edges, outputs, nodes, node.id, type);
  
  // Log any LLM parsing errors (but don't fail the build - let schema validation catch it)
  if (llmSettings.errors.length > 0) {
    for (const err of llmSettings.errors) {
      console.error(`[buildNodeInput] LLM parse error for ${node.id}.${err.handle}: ${err.error}`);
    }
  }

  const base = {
    ...sanitizedData,
    ...llmSettings.values, // Override with parsed LLM values
    prompt: promptValue,
    context: contextValue,
  };
  
  if (typeof base.referenceImages === "string") {
    base.referenceImages = [base.referenceImages];
  }

  // Utility: if node expects media input, allow a `data.<field>.url` OR a raw string url; normalize to AssetRef.
  const normalizeAsset = (v: unknown) => {
    if (!v) return v;
    if (typeof v === "string") return { url: v };
    return v;
  };

  // Helper to get media from connected nodes, parent node results, or node data
  const getMediaFromParentResults = (mediaType: "video" | "audio" | "image"): string | undefined => {
    // Find edges pointing to this node
    const incoming = edges.filter((e) => e.target === node.id);
    for (const e of incoming) {
      // Find the source node
      const sourceNode = nodes.find((n) => n.id === e.source);
      if (!sourceNode) continue;
      
      // Check if source node has a result that matches the media type
      const sourceData = sourceNode.data as Record<string, unknown>;
      const result = sourceData?.result as string | undefined;
      
      if (result && typeof result === "string" && result.length > 0) {
        // Check if the result looks like it could be the right media type
        const sourceType = sourceNode.type;
        if (mediaType === "video" && (sourceType?.includes("video") || sourceType === "merge-audio-video" || sourceType === "seedance" || sourceType === "lipsync" || sourceType === "merge-videos" || sourceType === "video-input")) {
          console.log(`[getMediaFromParentResults] Found video from parent ${sourceNode.id}: ${result.slice(0, 50)}...`);
          return result;
        }
        if (mediaType === "audio" && (sourceType?.includes("audio") || sourceType === "elevenlabs" || sourceType === "extract-audio" || sourceType === "audio-input")) {
          console.log(`[getMediaFromParentResults] Found audio from parent ${sourceNode.id}: ${result.slice(0, 50)}...`);
          return result;
        }
        if (mediaType === "image" && (sourceType?.includes("image") || sourceType === "seedream" || sourceType === "seedvr" || sourceType === "crop-image" || sourceType === "image-input")) {
          console.log(`[getMediaFromParentResults] Found image from parent ${sourceNode.id}: ${result.slice(0, 50)}...`);
          return result;
        }
      }
    }
    return undefined;
  };

  const getVideoInput = (handleId?: string, dataField: string = "inputVideo") => {
    // First check connected nodes via outputs map
    const connected = getIncomingMedia(edges, outputs, node.id, handleId);
    if (connected) return { url: connected };
    
    // Try getting from parent node results directly
    const parentResult = getMediaFromParentResults("video");
    if (parentResult) return { url: parentResult };
    
    // Fall back to node's stored data
    return normalizeAsset(data[dataField]);
  };

  const getAudioInput = (handleId?: string, dataField: string = "inputAudio") => {
    // First check connected nodes via outputs map
    const connected = getIncomingMedia(edges, outputs, node.id, handleId);
    if (connected) return { url: connected };
    
    // Try getting from parent node results directly
    const parentResult = getMediaFromParentResults("audio");
    if (parentResult) return { url: parentResult };
    
    // Fall back to node's stored data
    return normalizeAsset(data[dataField]);
  };

  const getImageInput = (handleId?: string, dataField: string = "inputImage") => {
    // First check connected nodes via outputs map
    const connected = getIncomingMedia(edges, outputs, node.id, handleId);
    if (connected) return { url: connected };
    
    // Try getting from parent node results directly
    const parentResult = getMediaFromParentResults("image");
    if (parentResult) return { url: parentResult };
    
    // Fall back to node's stored data
    return normalizeAsset(data[dataField]);
  };

  // Get CONFIG-DRIVEN defaults for this node type
  const configDefaults = getNodeDefaults(type);
  
  // Merge: configDefaults < data (user values) < base (with prompt/context)
  // This ensures config defaults are used when user hasn't set a value
  const withDefaults = { ...configDefaults, ...base };

  // Helper to get media from parent nodes (for chain execution)
  const getMediaFromParents = (mediaType: "video" | "audio" | "image"): string | undefined => {
    const incoming = edges.filter((e) => e.target === node.id);
    for (const e of incoming) {
      const sourceNode = nodes.find((n) => n.id === e.source);
      const sourceData = sourceNode?.data as Record<string, unknown> | undefined;
      const result = sourceData?.result as string | undefined;
      if (result && typeof result === "string") {
        const sourceType = sourceNode?.type;
        if (mediaType === "video" && (sourceType === "seedance" || sourceType === "lipsync" || sourceType === "merge-videos" || sourceType === "merge-audio-video" || sourceType === "video-input" || e.targetHandle === "video" || e.sourceHandle === "video")) {
          return result;
        }
        if (mediaType === "audio" && (sourceType === "elevenlabs" || sourceType === "extract-audio" || sourceType === "audio-input" || e.targetHandle === "audio" || e.sourceHandle === "audio")) {
          return result;
        }
        if (mediaType === "image" && (sourceType === "seedream" || sourceType === "seedvr" || sourceType === "crop-image" || sourceType === "image-input" || e.targetHandle?.includes("image") || e.sourceHandle?.includes("image"))) {
          return result;
        }
      }
    }
    return undefined;
  };

  switch (type) {
    case "seedvr":
      return { 
        ...withDefaults, 
        image: getImageInput("image", "inputImage") || normalizeAsset(withDefaults.image),
      };
    case "crop-image": {
      // Ensure crop percentages are numbers (fix for settings connection issues)
      const ensureNumber = (val: unknown, defaultVal: number): number => {
        if (typeof val === "number") return val;
        if (typeof val === "string" && !isNaN(Number(val))) return Number(val);
        return defaultVal;
      };
      
      const result = {
        ...withDefaults,
        image: getImageInput("image", "image") || normalizeAsset(withDefaults.image),
        xPercent: ensureNumber(withDefaults.xPercent, 0),
        yPercent: ensureNumber(withDefaults.yPercent, 0),
        widthPercent: ensureNumber(withDefaults.widthPercent, 100),
        heightPercent: ensureNumber(withDefaults.heightPercent, 100),
      };
      
      console.log(`[buildNodeInput:crop-image] Final values: x=${result.xPercent}, y=${result.yPercent}, w=${result.widthPercent}, h=${result.heightPercent}`);
      return result;
    }
    case "extract-audio": {
      console.log(`[buildNodeInput:extract-audio] withDefaults:`, JSON.stringify(withDefaults));
      console.log(`[buildNodeInput:extract-audio] node data format:`, data.format);
      
      // Try multiple strategies to get video input
      let videoUrl: string | undefined;
      
      // Strategy 1: Check outputs map via getIncomingMedia
      const outputsVideo = getIncomingMedia(edges, outputs, node.id, "video");
      if (outputsVideo) {
        console.log(`[buildNodeInput:extract-audio] Found video via outputs map: ${outputsVideo.slice(0, 50)}...`);
        videoUrl = outputsVideo;
      }
      
      // Strategy 2: Check parent node results directly
      if (!videoUrl) {
        const parentVideo = getMediaFromParentResults("video");
        if (parentVideo) {
          console.log(`[buildNodeInput:extract-audio] Found video via parent results: ${parentVideo.slice(0, 50)}...`);
          videoUrl = parentVideo;
        }
      }
      
      // Strategy 3: Check getMediaFromParents (different implementation)
      if (!videoUrl) {
        const parentsVideo = getMediaFromParents("video");
        if (parentsVideo) {
          console.log(`[buildNodeInput:extract-audio] Found video via getMediaFromParents: ${parentsVideo.slice(0, 50)}...`);
          videoUrl = parentsVideo;
        }
      }
      
      // Strategy 4: Check ALL incoming edges for any video result
      if (!videoUrl) {
        const incoming = edges.filter((e) => e.target === node.id);
        console.log(`[buildNodeInput:extract-audio] Checking ${incoming.length} incoming edges...`);
        for (const e of incoming) {
          const sourceNode = nodes.find((n) => n.id === e.source);
          if (sourceNode) {
            const sourceData = sourceNode.data as Record<string, unknown>;
            const result = sourceData?.result as string | undefined;
            console.log(`[buildNodeInput:extract-audio] Edge from ${sourceNode.id} (${sourceNode.type}), result: ${result?.slice(0, 50) || 'none'}`);
            if (result && typeof result === "string" && result.startsWith("http")) {
              videoUrl = result;
              console.log(`[buildNodeInput:extract-audio] Using result from ${sourceNode.id}: ${videoUrl.slice(0, 50)}...`);
              break;
            }
          }
        }
      }
      
      // Strategy 5: Check node's own data.video field
      if (!videoUrl) {
        const nodeVideo = data.video;
        if (typeof nodeVideo === "string" && nodeVideo.startsWith("http")) {
          videoUrl = nodeVideo;
          console.log(`[buildNodeInput:extract-audio] Found video in node data: ${videoUrl.slice(0, 50)}...`);
        } else if (nodeVideo && typeof nodeVideo === "object" && (nodeVideo as any).url) {
          videoUrl = (nodeVideo as any).url as string;
          console.log(`[buildNodeInput:extract-audio] Found video object in node data: ${videoUrl?.slice(0, 50)}...`);
        }
      }
      
      const videoInput = videoUrl ? { url: videoUrl } : undefined;
      console.log(`[buildNodeInput:extract-audio] Final video input:`, videoInput ? `{ url: "${videoInput.url.slice(0, 50)}..." }` : 'undefined');
      
      // Ensure format is a valid option (safeguard against invalid stored values)
      const validFormats = ["mp3", "wav", "aac", "ogg"];
      const format = validFormats.includes(withDefaults.format as string) 
        ? withDefaults.format 
        : (validFormats.includes(data.format as string) ? data.format : "mp3");
      
      console.log(`[buildNodeInput:extract-audio] Final format:`, format);
      
      return { 
        ...withDefaults, 
        video: videoInput,
        format, // Explicitly set validated format
      };
    }
    case "merge-videos": {
      // Get videos from connected nodes by their specific handles
      const video1Connected = getIncomingMedia(edges, outputs, node.id, "video1");
      const video2Connected = getIncomingMedia(edges, outputs, node.id, "video2");
      
      // Also try getting videos from parent node results if not found via handles
      let video1Result = video1Connected;
      let video2Result = video2Connected;
      
      if (!video1Result || !video2Result) {
        const incoming = edges.filter((e) => e.target === node.id);
        for (const e of incoming) {
          const sourceNode = nodes.find((n) => n.id === e.source);
          const sourceData = sourceNode?.data as Record<string, unknown> | undefined;
          const result = sourceData?.result as string | undefined;
          if (result && typeof result === "string") {
            if (e.targetHandle === "video1" || (!video1Result && !e.targetHandle)) {
              video1Result = result;
            } else if (e.targetHandle === "video2" || (!video2Result && !e.targetHandle)) {
              video2Result = result;
            }
          }
        }
      }
      
      return {
        ...withDefaults,
        video1: video1Result ? { url: video1Result } : normalizeAsset(data.video1),
        video2: video2Result ? { url: video2Result } : normalizeAsset(data.video2),
      };
    }
    case "merge-audio-video": {
      // Robust video retrieval
      let videoUrl: string | undefined;
      videoUrl = getIncomingMedia(edges, outputs, node.id, "video");
      if (!videoUrl) videoUrl = getMediaFromParentResults("video");
      if (!videoUrl) videoUrl = getMediaFromParents("video");
      if (!videoUrl && data.video) {
        videoUrl = typeof data.video === "string" ? data.video : (data.video as any)?.url;
      }
      
      // Robust audio retrieval
      let audioUrl: string | undefined;
      audioUrl = getIncomingMedia(edges, outputs, node.id, "audio");
      if (!audioUrl) audioUrl = getMediaFromParentResults("audio");
      if (!audioUrl) audioUrl = getMediaFromParents("audio");
      if (!audioUrl && data.audio) {
        audioUrl = typeof data.audio === "string" ? data.audio : (data.audio as any)?.url;
      }
      
      console.log(`[buildNodeInput:merge-audio-video] video: ${videoUrl?.slice(0, 50) || 'none'}, audio: ${audioUrl?.slice(0, 50) || 'none'}`);
      
      return {
        ...withDefaults,
        video: videoUrl ? { url: videoUrl } : undefined,
        audio: audioUrl ? { url: audioUrl } : undefined,
      };
    }
    case "lipsync": {
      // Robust video retrieval
      let videoUrl: string | undefined;
      videoUrl = getIncomingMedia(edges, outputs, node.id, "video");
      if (!videoUrl) videoUrl = getMediaFromParentResults("video");
      if (!videoUrl) videoUrl = getMediaFromParents("video");
      if (!videoUrl && data.video) {
        videoUrl = typeof data.video === "string" ? data.video : (data.video as any)?.url;
      }
      
      // Robust audio retrieval
      let audioUrl: string | undefined;
      audioUrl = getIncomingMedia(edges, outputs, node.id, "audio");
      if (!audioUrl) audioUrl = getMediaFromParentResults("audio");
      if (!audioUrl) audioUrl = getMediaFromParents("audio");
      if (!audioUrl && data.audio) {
        audioUrl = typeof data.audio === "string" ? data.audio : (data.audio as any)?.url;
      }
      
      console.log(`[buildNodeInput:lipsync] video: ${videoUrl?.slice(0, 50) || 'none'}, audio: ${audioUrl?.slice(0, 50) || 'none'}`);
      
      return {
        ...withDefaults,
        video: videoUrl ? { url: videoUrl } : undefined,
        audio: audioUrl ? { url: audioUrl } : undefined,
      };
    }
    case "seedance":
      return { 
        ...withDefaults, 
        frame: getImageInput("frame", "frame") || normalizeAsset(withDefaults.frame),
      };
    case "openrouter": {
      const imageConnected = getIncomingMedia(edges, outputs, node.id, "inputImage") || getMediaFromParents("image");
      const imageUrl = imageConnected || data.inputImage;
      
      console.log(`[buildNodeInput] OpenRouter node ${node.id}:`);
      console.log(`[buildNodeInput]   - imageConnected: ${imageConnected ? "yes" : "no"}`);
      console.log(`[buildNodeInput]   - final imageUrl: ${imageUrl ? String(imageUrl).slice(0, 50) + "..." : "undefined"}`);
      
      return {
        ...withDefaults,
        imageUrl,
      };
    }
    case "seedream": {
      const refImageConnected = getIncomingMedia(edges, outputs, node.id, "referenceImages") || getMediaFromParents("image");
      let referenceImages = withDefaults.referenceImages;
      if (refImageConnected) {
        referenceImages = [refImageConnected];
      }
      
      return {
        ...withDefaults,
        referenceImages,
      };
    }
    case "elevenlabs": {
      return {
        ...withDefaults,
      };
    }
    default:
      return withDefaults;
  }
}

function providerIsConfigured(_provider: ProviderId): boolean {
  // Allow all providers - we'll call real APIs
  return true;
}


// AI nodes that go through Trigger.dev (external API calls)
const TRIGGER_NODE_TYPES = [
  "seedream", "seedvr", "seedance", "elevenlabs", "lipsync", "openrouter",
];

// Utility nodes that run locally (fast internal processing)
const LOCAL_NODE_TYPES = [
  "crop-image", "merge-audio-video", "merge-videos", "extract-audio",
];

// Poll for node completion
async function pollNodeStatus(nodeId: string, timeoutMs: number = 300000): Promise<{ status: string; output?: unknown; error?: string }> {
  const startTime = Date.now();
  const pollInterval = 2000; // Poll every 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`/api/nodes/status?nodeId=${encodeURIComponent(nodeId)}`);
      const result = await response.json();

      if (result.status === "completed") {
        return { status: "completed", output: result.output };
      }

      if (result.status === "failed") {
        return { status: "failed", error: result.error || "Node execution failed" };
      }

      // Still running, wait and poll again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error(`[pollNodeStatus] Error polling ${nodeId}:`, error);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  return { status: "failed", error: "Execution timed out" };
}

interface ExecutionContext {
  workflowId?: string;
  nodeId?: string;
  nodeLabel?: string;
}

async function executeWithProvider(type: AINodeType, provider: ProviderId, input: unknown, context?: ExecutionContext): Promise<AnyOut> {
  void provider;
  
  console.log(`[executeWithProvider] Executing ${type} with provider ${provider}`);

  // LOCAL utility nodes - run via sync API (no network overhead for large data)
  if (LOCAL_NODE_TYPES.includes(type)) {
    try {
      console.log(`[executeWithProvider] Calling sync API for LOCAL node: ${type}`);
      
      // Preprocess input: upload large base64 media to CDN to avoid 413 errors
      const processedInput = await preprocessInputForAPI(input);
      
      // Debug: Log input for crop-image
      if (type === "crop-image") {
        const cropInput = processedInput as Record<string, unknown>;
        console.log(`[executeWithProvider:crop-image] INPUT TO API:`, JSON.stringify({
          xPercent: cropInput.xPercent,
          yPercent: cropInput.yPercent,
          widthPercent: cropInput.widthPercent,
          heightPercent: cropInput.heightPercent,
          image: typeof cropInput.image === "object" ? "{ url: ... }" : cropInput.image,
        }));
      }
      
      const response = await fetch("/api/nodes/execute-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: type,
          input: processedInput,
          // Include workflow context for Activity tab filtering
          workflowId: context?.workflowId,
          nodeId: context?.nodeId,
          nodeLabel: context?.nodeLabel,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || `${type} execution failed`);
      }

      console.log(`[executeWithProvider] ${type} completed successfully (local)`);
      return result.output as AnyOut;
    } catch (error) {
      console.error(`[executeWithProvider] ${type} execution error:`, error);
      throw new Error(`${type} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // AI nodes go through Trigger.dev
  if (TRIGGER_NODE_TYPES.includes(type)) {
    try {
      console.log(`[executeWithProvider] Calling Trigger.dev API for ${type}`);
      
      // Preprocess input: upload large base64 media to CDN to avoid 413 errors
      const processedInput = await preprocessInputForAPI(input);
      
      // Use context nodeId or generate a unique one for this execution
      const nodeId = context?.nodeId || (processedInput as { nodeId?: string })?.nodeId || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: type,
          input: { ...processedInput as object, nodeId },
          // Include workflow context for Activity tab filtering
          workflowId: context?.workflowId,
          nodeId,
          nodeLabel: context?.nodeLabel,
        }),
      });

      const triggerResult = await response.json();

      if (triggerResult.status === "error") {
        throw new Error(triggerResult.error || `${type} execution failed to start`);
      }

      console.log(`[executeWithProvider] ${type} triggered via Trigger.dev, polling for completion...`);
      
      // Poll for completion (5 min timeout for AI nodes)
      const pollResult = await pollNodeStatus(nodeId, 300000);
      
      if (pollResult.status === "failed") {
        throw new Error(pollResult.error || `${type} execution failed`);
      }

      if (pollResult.output) {
        console.log(`[executeWithProvider] ${type} completed successfully via Trigger.dev`);
        return pollResult.output as AnyOut;
      }

      throw new Error(`${type} completed but no output received`);
    } catch (error) {
      console.error(`[executeWithProvider] ${type} execution error:`, error);
      throw new Error(`${type} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Fallback for any unhandled node types (shouldn't happen)
  const outType = NodePrimaryOutputType[type];
  if (type === "openrouter" && outType === "text") {
    const inputData = input as {
      prompt?: string;
      systemPrompt?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      context?: string;
    };

    const prompt = inputData.prompt ?? "";
    const context = inputData.context ?? "";

    console.log(`[executeWithProvider] OpenRouter call - prompt: "${prompt.slice(0, 50)}...", context: "${context.slice(0, 100)}..."`);

    // Call the streaming LLM API but collect full response
    try {
      const response = await fetch("/api/nodes/llm/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          systemPrompt: inputData.systemPrompt,
          model: inputData.model || "openai/gpt-4o-mini",
          temperature: inputData.temperature ?? 0.7,
          maxTokens: inputData.maxTokens ?? 4096,
          context,
        }),
      });

      console.log(`[executeWithProvider] API response status: ${response.status}`);

      if (!response.ok) {
        const error = await response.json();
        console.error(`[executeWithProvider] API error:`, error);
        throw new Error(error.error || "LLM API error");
      }

      // Read the full stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonData = line.slice(6);
            if (jsonData === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonData);
              if (parsed.content) {
                fullText += parsed.content;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      console.log(`[executeWithProvider] OpenRouter completed. Response length: ${fullText.length}`);
      return { type: "text", text: fullText };
    } catch (error) {
      console.error(`[executeWithProvider] LLM execution error:`, error);
      throw new Error(`LLM execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Unsupported node type - throw error instead of returning mock data
  throw new Error(`Node type "${type}" is not supported for execution. Please check your workflow configuration.`);
}

/**
 * PARALLEL WORKFLOW EXECUTION
 * 
 * Execution order is determined by dependencies:
 * 1. Nodes with no incoming edges (root nodes) start immediately IN PARALLEL
 * 2. When a node completes, all nodes that only depended on it become ready
 * 3. Ready nodes start immediately IN PARALLEL
 * 4. This continues until all nodes are complete
 * 
 * Example with two independent pipelines:
 *   Pipeline A: LLM1 → Image1 → Video1
 *   Pipeline B: LLM2 → Image2 → Video2
 * 
 * Execution:
 *   - LLM1 and LLM2 start simultaneously (both are roots)
 *   - When LLM1 finishes, Image1 starts immediately
 *   - When LLM2 finishes, Image2 starts immediately
 *   - Both Image nodes run in parallel
 *   - And so on...
 */
export async function runWorkflow(
  nodes: Node[],
  edges: Edge[],
  callbacks: RunCallbacks = {},
  workflowId?: string
): Promise<void> {
  console.log("[RunWorkflow] Starting PARALLEL workflow execution");
  console.log("[RunWorkflow] Nodes:", nodes.map(n => ({ id: n.id, type: n.type })));
  console.log("[RunWorkflow] Edges:", edges.map(e => ({ source: e.source, target: e.target })));
  
  const outputs: OutputByNode = new Map();
  const allNodes = topoSort(nodes, edges); // Still need topo sort for validation
  
  // Build dependency graph
  const nodeById = new Map<string, Node>(allNodes.map(n => [n.id, n]));
  const dependencies = new Map<string, Set<string>>(); // node -> set of nodes it depends on
  const dependents = new Map<string, Set<string>>();   // node -> set of nodes that depend on it
  
  // Initialize dependency structures
  for (const node of allNodes) {
    dependencies.set(node.id, new Set());
    dependents.set(node.id, new Set());
  }
  
  // Populate dependencies from edges
  for (const edge of edges) {
    const source = edge.source;
    const target = edge.target;
    if (nodeById.has(source) && nodeById.has(target)) {
      dependencies.get(target)!.add(source);
      dependents.get(source)!.add(target);
    }
  }
  
  // ==========================================================================
  // ALL NODES SKIPPED CHECK - Warn if every node is skipped
  // ==========================================================================
  const allNodesSkipped = allNodes.every(node => {
    const nodeData = node.data as Record<string, unknown> | undefined;
    return nodeData?.skip === true;
  });
  
  if (allNodesSkipped && allNodes.length > 0) {
    console.log("[RunWorkflow] All nodes are skipped - nothing to execute");
    showAllSkippedWarning();
    // Mark all as completed with skip status
    for (const node of allNodes) {
      const nodeData = node.data as Record<string, unknown>;
      const existingResult = nodeData?.result as string | undefined;
      if (existingResult) {
        callbacks.onNodeStatus?.(node.id, "completed", { skipped: true, progress: 100 });
      } else {
        callbacks.onNodeStatus?.(node.id, "failed", { 
          error: "Skip enabled but no cached output available",
          skipped: true 
        });
      }
    }
    return;
  }
  
  // Track node states
  const completed = new Set<string>();
  const failed = new Set<string>();
  const running = new Set<string>();
  
  // Find nodes that can run (no pending dependencies)
  const getReadyNodes = (): Node[] => {
    const ready: Node[] = [];
    for (const node of allNodes) {
      if (completed.has(node.id) || failed.has(node.id) || running.has(node.id)) {
        continue;
      }
      const deps = dependencies.get(node.id)!;
      const allDepsComplete = [...deps].every(d => completed.has(d));
      const anyDepFailed = [...deps].some(d => failed.has(d));
      
      if (anyDepFailed) {
        // Skip this node - a dependency failed
        failed.add(node.id);
        callbacks.onNodeStatus?.(node.id, "failed", { 
          error: "Dependency failed",
          progress: 0 
        });
        continue;
      }
      
      if (allDepsComplete) {
        ready.push(node);
      }
    }
    return ready;
  };
  
  // Execute a single node
  // I/O node types that are passthrough (don't need execution)
  const IO_NODE_TYPES = ["image-input", "video-input", "audio-input", "output", "comment"];
  
  const executeNode = async (node: Node): Promise<void> => {
    const type = node.type as AINodeType;
    const inputSchema = NodeInputSchemas[type] as z.ZodTypeAny;
    const outputSchema = NodeOutputSchemas[type] as z.ZodTypeAny;
    const data = (node.data ?? {}) as any;

    if (!inputSchema || !outputSchema) {
      callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
      failed.add(node.id);
      return;
    }

    // ==========================================================================
    // I/O NODE HANDLING - These are passthrough nodes
    // ==========================================================================
    if (IO_NODE_TYPES.includes(type)) {
      console.log(`[RunWorkflow] I/O node ${node.id} (${type}) - passthrough handling`);
      console.log(`[RunWorkflow] I/O node data:`, JSON.stringify(data).slice(0, 500));
      
      // Input nodes: use their result/value as output
      if (type === "image-input" || type === "video-input" || type === "audio-input") {
        // Try multiple possible property names for the uploaded file
        const result = data.result || data.value || data.url || data.file;
        console.log(`[RunWorkflow] Input node ${node.id} result:`, result ? `${String(result).slice(0, 100)}...` : 'undefined');
        
        if (result && typeof result === "string" && result.length > 0) {
          const outputType = type === "image-input" ? "image" : type === "video-input" ? "video" : "audio";
          const passOutput: AnyOut = outputType === "image" 
            ? { type: "image", image: { url: result } }
            : outputType === "video"
            ? { type: "video", video: { url: result } }
            : { type: "audio", audio: { url: result } };
          
          outputs.set(node.id, passOutput);
          completed.add(node.id);
          callbacks.onNodeResult?.(node.id, result, passOutput);
          callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
          console.log(`[RunWorkflow] Input node ${node.id} completed with result`);
          return;
        } else {
          // No input file uploaded - provide more helpful error
          const dataKeys = Object.keys(data);
          console.error(`[RunWorkflow] Input node ${node.id} has no file. Data keys:`, dataKeys);
          callbacks.onNodeStatus?.(node.id, "failed", { 
            error: `No file uploaded to ${type.replace('-input', '')} input node`,
            details: `Please upload a file to the input node before running the workflow`
          });
          failed.add(node.id);
          return;
        }
      }
      
      // Output node: get value from connected upstream node
      if (type === "output") {
        // Find incoming edge and get the output from the source node
        const incomingEdge = edges.find(e => e.target === node.id);
        if (incomingEdge) {
          const sourceOutput = outputs.get(incomingEdge.source);
          if (sourceOutput) {
            outputs.set(node.id, sourceOutput);
            completed.add(node.id);
            const resultText = sourceOutput.type === "text" ? sourceOutput.text 
              : sourceOutput.type === "image" ? sourceOutput.image.url
              : sourceOutput.type === "video" ? sourceOutput.video.url
              : sourceOutput.audio.url;
            callbacks.onNodeResult?.(node.id, resultText, sourceOutput);
            callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
            return;
          }
        }
        // No input connected or source didn't produce output
        callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
        completed.add(node.id);
        return;
      }
      
      // Comment node: just mark as completed
      if (type === "comment") {
        completed.add(node.id);
        callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
        return;
      }
    }

    // ==========================================================================
    // SKIP CHECK - Use existing output if skip is enabled
    // ==========================================================================
    if (data.skip === true) {
      const existingResult = data.result as string | undefined;
      const nodeName = data.label || NODE_DEFINITIONS[type]?.label || type;
      
      if (existingResult && typeof existingResult === "string" && existingResult.trim().length > 0) {
        // Node has output - use it instead of executing
        console.log(`[RunWorkflow] Node ${node.id} (${type}) SKIPPED - using existing output`);
        
        // Determine output type based on node type
        const outputType = NodePrimaryOutputType[type];
        let skipOutput: AnyOut;
        
        if (outputType === "text") {
          skipOutput = { type: "text", text: existingResult };
        } else if (outputType === "image") {
          skipOutput = { type: "image", image: { url: existingResult } };
        } else if (outputType === "video") {
          skipOutput = { type: "video", video: { url: existingResult } };
        } else {
          skipOutput = { type: "audio", audio: { url: existingResult } };
        }
        
        outputs.set(node.id, skipOutput);
        completed.add(node.id);
        
        callbacks.onNodeResult?.(node.id, existingResult, skipOutput);
        callbacks.onNodeStatus?.(node.id, "completed", {
          progress: 100,
          skipped: true,
        });
        return;
      } else {
        // Skip enabled but no output available - show warning and fail
        console.log(`[RunWorkflow] Node ${node.id} (${type}) SKIP FAILED - no existing output`);
        showSkipWarning(nodeName);
        callbacks.onNodeStatus?.(node.id, "failed", {
          error: "Skip enabled but no cached output available",
          skipped: true,
        });
        failed.add(node.id);
        return;
      }
    }

    running.add(node.id);
    callbacks.onNodeStatus?.(node.id, "running", { progress: 10 });

    // Compute input hash for change detection
    const inputHash = computeNodeInputHash(node, edges, allNodes);

    const rawInput = buildNodeInput(node, edges, outputs, allNodes);
    console.log(`[RunWorkflow] Node ${node.id} (${type}) starting - Built input:`, {
      prompt: (rawInput as any)?.prompt?.slice(0, 100),
      context: (rawInput as any)?.context?.slice(0, 200),
      hasContext: !!(rawInput as any)?.context,
    });
    
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: parsed.error.issues.map((i) => i.message).join("; "),
        progress: 0,
      });
      running.delete(node.id);
      failed.add(node.id);
      return;
    }

    // Check cache for identical inputs (only if caching enabled)
    const useCache = (data as { useCache?: boolean }).useCache === true;
    let cacheHash: string | undefined;
    
    if (useCache) {
      try {
        const cacheCheck = await checkCache(type, parsed.data as Record<string, unknown>);
        cacheHash = cacheCheck.hash;
        
        if (cacheCheck.hit && cacheCheck.result) {
          console.log(`[RunWorkflow] Cache HIT for ${node.id} (${type}) - skipping execution`);
          
          const cachedOut = cacheCheck.result as AnyOut;
          const validated = outputSchema.safeParse(cachedOut);
          
          if (validated.success) {
            running.delete(node.id);
            outputs.set(node.id, cachedOut);
            completed.add(node.id);
            
            const resultText =
              cachedOut.type === "text"
                ? cachedOut.text
                : cachedOut.type === "image"
                  ? cachedOut.image.url
                  : cachedOut.type === "video"
                    ? cachedOut.video.url
                    : cachedOut.audio.url;

            callbacks.onNodeResult?.(node.id, resultText, cachedOut);
            callbacks.onNodeStatus?.(node.id, "completed", {
              progress: 100,
              fromCache: true,
              _lastInputHash: inputHash,
            });
            return;
          }
        }
      } catch (error) {
        console.warn(`[RunWorkflow] Cache check failed for ${node.id}, proceeding with execution:`, error);
      }
    } else {
      console.log(`[RunWorkflow] Cache DISABLED for ${node.id} (${type}) - executing fresh`);
    }

    // Provider fallback chain
    const nodeProvidersRaw = Array.isArray(data.providers) ? data.providers : undefined;
    const providers = (nodeProvidersRaw?.filter((p: unknown) => typeof p === "string" && p.trim()) as string[] | undefined)
      ?? (NodeProviders[type] as unknown as string[] | undefined)
      ?? ["fal"];

    const retryPerProvider =
      typeof data.retryPerProvider === "number" && Number.isFinite(data.retryPerProvider) && data.retryPerProvider > 0
        ? Math.floor(data.retryPerProvider)
        : 1;

    const timeoutMs =
      parseDurationMs(data.timeout) ??
      parseDurationMs(data.timeoutMs) ??
      parseDurationMs(data.nodeTimeout) ??
      NODE_TIMEOUT_MS[type] ??
      DEFAULT_NODE_TIMEOUT_MS;

    let lastError: string | undefined;
    let finalOut: AnyOut | undefined;
    let providerUsed: string | undefined;
    const attemptedProviders: string[] = [];

    for (const p of providers) {
      if (!providerIsConfigured(p as any)) continue;
      attemptedProviders.push(p);

      for (let attempt = 1; attempt <= retryPerProvider; attempt++) {
        callbacks.onNodeStatus?.(node.id, "running", {
          progress: 20 + (attempt * 10),
          providerTrying: p,
          providerAttempt: attempt,
        });

        try {
          const out = await withTimeout(
            executeWithProvider(type, p as any, parsed.data, {
              workflowId,
              nodeId: node.id,
              nodeLabel: data.label || NODE_DEFINITIONS[type]?.label || type,
            }),
            timeoutMs,
            `${type} (${p})`
          );
          const validated = outputSchema.safeParse(out);
          if (!validated.success) {
            throw new Error(`Output schema invalid: ${validated.error.issues.map((i) => i.message).join("; ")}`);
          }
          finalOut = validated.data as AnyOut;
          providerUsed = p;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          console.log(`[RunWorkflow] Node ${node.id} attempt ${attempt} failed: ${lastError}`);
        }
      }

      if (finalOut) break;
    }

    running.delete(node.id);

    if (!finalOut) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: lastError ?? "All providers failed",
        attemptedProviders,
        progress: 0,
      });
      failed.add(node.id);
      return;
    }

    outputs.set(node.id, finalOut);
    completed.add(node.id);
    
    console.log(`[RunWorkflow] Node ${node.id} completed. Output stored.`);
    
    const resultText =
      finalOut.type === "text"
        ? finalOut.text
        : finalOut.type === "image"
          ? finalOut.image.url
          : finalOut.type === "video"
            ? finalOut.video.url
            : finalOut.audio.url;

    // Cache successful result for future identical executions (only if caching enabled)
    if (useCache && cacheHash) {
      try {
        await cacheResult(cacheHash, type, finalOut as Record<string, unknown>);
      } catch (error) {
        console.warn(`[RunWorkflow] Failed to cache result for ${node.id}:`, error);
      }
    }

    callbacks.onNodeResult?.(node.id, resultText, finalOut);
    callbacks.onNodeStatus?.(node.id, "completed", {
      progress: 100,
      providerUsed,
      attemptedProviders,
      _lastInputHash: inputHash,
    });
  };
  
  // Mark all nodes as queued initially
  for (const node of allNodes) {
    const type = node.type as AINodeType;
    if (!NodeInputSchemas[type] || !NodeOutputSchemas[type]) {
      callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
      failed.add(node.id);
      continue;
    }
    callbacks.onNodeStatus?.(node.id, "queued");
  }
  
  // Identify independent pipelines for logging
  const rootNodes = allNodes.filter(n => dependencies.get(n.id)!.size === 0);
  console.log(`[RunWorkflow] Found ${rootNodes.length} root node(s) - these will start in PARALLEL:`, rootNodes.map(n => n.id));
  
  // Main execution loop - run nodes in parallel waves
  while (completed.size + failed.size < allNodes.length) {
    const readyNodes = getReadyNodes();
    
    if (readyNodes.length === 0) {
      // No nodes ready and not all complete - might be stuck
      if (running.size === 0) {
        console.error("[RunWorkflow] No nodes ready and none running - possible cycle or all failed");
        break;
      }
      // Wait a bit for running nodes to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    
    console.log(`[RunWorkflow] Starting ${readyNodes.length} node(s) in PARALLEL:`, readyNodes.map(n => `${n.id} (${n.type})`));
    
    // Start all ready nodes in parallel
    const promises = readyNodes.map(node => executeNode(node));
    
    // Wait for at least one to complete before checking for new ready nodes
    await Promise.race(promises);
    
    // Also wait for all current batch to settle before next iteration
    // This prevents starting too many concurrent operations
    await Promise.allSettled(promises);
  }
  
  const successCount = completed.size;
  const failCount = failed.size;
  console.log(`[RunWorkflow] Workflow execution completed: ${successCount} succeeded, ${failCount} failed`);
}

// Nodes that require server-side execution via Trigger.dev (async/webhook-based)
const ASYNC_NODE_TYPES: AINodeType[] = ["seedream", "seedvr", "seedance", "elevenlabs", "lipsync"];

/**
 * Run a single node WITH its dependencies.
 * If the node depends on parent nodes that haven't run yet, it will run them first.
 * 
 * @param nodeId - The ID of the node to run
 * @param nodes - All nodes in the workflow
 * @param edges - All edges in the workflow
 * @param callbacks - Callbacks for status updates
 * @param workflowId - Optional workflow ID for tracking
 * @param updateNodeData - Callback to update node data in the store (for propagating outputs)
 */
export async function runNodeWithDependencies(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  callbacks: RunCallbacks = {},
  workflowId?: string,
  updateNodeData?: (nodeId: string, data: Record<string, unknown>) => void
): Promise<void> {
  const targetNode = nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    console.error(`[runNodeWithDependencies] Node ${nodeId} not found`);
    return;
  }

  console.log(`[runNodeWithDependencies] Starting execution for node ${nodeId} (${targetNode.type})`);

  // Find all upstream dependencies
  const upstreamNodes = getUpstreamNodes(nodeId, nodes, edges);
  console.log(`[runNodeWithDependencies] Found ${upstreamNodes.length} upstream dependencies:`, 
    upstreamNodes.map(n => `${n.id} (${n.type})`));

  // SMART CHANGE DETECTION:
  // A node needs to run if:
  // 1. It has no output yet, OR
  // 2. Its inputs/settings have changed since last run, OR
  // 3. Any of its upstream nodes have changed
  const nodesToRun = upstreamNodes.filter(n => {
    // No output - definitely needs to run
    if (!nodeHasOutput(n)) {
      console.log(`[runNodeWithDependencies] Node ${n.id} has no output - needs to run`);
      return true;
    }
    
    // Has output - check if inputs changed
    if (hasNodeInputsChanged(n, edges, nodes)) {
      console.log(`[runNodeWithDependencies] Node ${n.id} inputs changed - needs to re-run`);
      return true;
    }
    
    console.log(`[runNodeWithDependencies] Node ${n.id} unchanged - can use cached result`);
    return false;
  });
  
  // Also check if the TARGET node itself needs to run due to changes
  const targetNeedsRun = !nodeHasOutput(targetNode) || hasNodeInputsChanged(targetNode, edges, nodes);
  console.log(`[runNodeWithDependencies] Target node ${nodeId} needs run: ${targetNeedsRun}`);
  
  console.log(`[runNodeWithDependencies] ${nodesToRun.length} upstream nodes need to run:`,
    nodesToRun.map(n => `${n.id} (${n.type})`));

  // If there are dependencies to run, execute them first using runWorkflow logic
  if (nodesToRun.length > 0) {
    // Include the target node in the execution
    const allNodesToRun = [...nodesToRun, targetNode];
    const nodesToRunIds = new Set(allNodesToRun.map(n => n.id));
    
    // Include ALL upstream nodes (even those with output) for edge filtering
    // This ensures data flows from completed nodes to running nodes
    const allUpstreamIds = new Set([...upstreamNodes.map(n => n.id), targetNode.id]);
    
    // Filter edges to include:
    // 1. Edges between nodes we're running
    // 2. Edges FROM upstream nodes with output TO nodes we're running
    const relevantEdges = edges.filter(e => 
      (allUpstreamIds.has(e.source) && nodesToRunIds.has(e.target)) ||
      (nodesToRunIds.has(e.source) && nodesToRunIds.has(e.target))
    );

    console.log(`[runNodeWithDependencies] Running ${allNodesToRun.length} nodes in dependency order`);
    console.log(`[runNodeWithDependencies] allUpstreamIds:`, [...allUpstreamIds]);
    console.log(`[runNodeWithDependencies] nodesToRunIds:`, [...nodesToRunIds]);
    console.log(`[runNodeWithDependencies] relevantEdges:`, relevantEdges.map(e => `${e.source} -> ${e.target}`));
    console.log(`[runNodeWithDependencies] All input edges:`, edges.filter(e => e.target === nodeId).map(e => `${e.source} -> ${e.target}`));

    // Pre-populate outputs from upstream nodes that already have results
    // This ensures data flows from completed nodes to running nodes
    const prePopulatedOutputs: OutputByNode = new Map();
    for (const upstreamNode of upstreamNodes) {
      if (nodeHasOutput(upstreamNode)) {
        const data = upstreamNode.data as Record<string, unknown>;
        const result = data.result as string;
        const nodeType = upstreamNode.type;
        
        // Determine output type based on node type
        let outputEntry: AnyOut;
        if (nodeType === "seedream" || nodeType === "seedvr" || nodeType === "crop-image" || nodeType === "image-input") {
          outputEntry = { type: "image", image: { url: result } };
        } else if (nodeType === "seedance" || nodeType === "lipsync" || nodeType === "merge-videos" || nodeType === "merge-audio-video" || nodeType === "video-input") {
          outputEntry = { type: "video", video: { url: result } };
        } else if (nodeType === "elevenlabs" || nodeType === "extract-audio" || nodeType === "audio-input") {
          outputEntry = { type: "audio", audio: { url: result } };
        } else {
          outputEntry = { type: "text", text: result };
        }
        
        prePopulatedOutputs.set(upstreamNode.id, outputEntry);
        console.log(`[runNodeWithDependencies] Pre-populated output from ${upstreamNode.id} (${nodeType}): ${result.slice(0, 50)}...`);
      }
    }

    // CRITICAL FIX: Include ALL upstream nodes (including pre-populated ones) 
    // so buildNodeInput can find parent node data when looking up results
    const allNodesForInput = [...upstreamNodes, targetNode];
    
    // Run the subset of the workflow
    await runWorkflowSubset(
      allNodesToRun,
      relevantEdges,
      {
        onNodeStatus: (id, status, patch) => {
          callbacks.onNodeStatus?.(id, status, patch);
        },
        onNodeResult: (id, resultText, output) => {
          callbacks.onNodeResult?.(id, resultText, output);
          
          // Update the node data in the store so outputs propagate
          if (updateNodeData) {
            updateNodeData(id, { result: resultText, status: "completed" });
          }
        },
      },
      workflowId,
      prePopulatedOutputs,
      allNodesForInput // Pass ALL upstream nodes for input building
    );
  } else {
    // No upstream dependencies - check if target node itself needs to run
    if (!targetNeedsRun) {
      // Target node has result and inputs unchanged - skip execution
      console.log(`[runNodeWithDependencies] Target node ${nodeId} unchanged - skipping execution, using cached result`);
      
      // Still notify as "completed" with existing result
      const targetData = targetNode.data as Record<string, unknown>;
      if (targetData.result) {
        callbacks.onNodeStatus?.(nodeId, "completed", { result: targetData.result });
      }
      return;
    }
    
    // No dependencies needed, run the target node directly
    console.log(`[runNodeWithDependencies] No dependencies needed, running ${nodeId} directly`);
    await runSingleNode(nodeId, nodes, edges, callbacks, workflowId);
  }
}

/**
 * Run a subset of a workflow - used for running dependencies.
 * Similar to runWorkflow but operates on a subset of nodes.
 * @param prePopulatedOutputs - Optional pre-populated outputs from nodes that already completed
 * @param allNodesForInput - Optional array of ALL nodes (including pre-populated) for input building
 */
async function runWorkflowSubset(
  nodes: Node[],
  edges: Edge[],
  callbacks: RunCallbacks = {},
  workflowId?: string,
  prePopulatedOutputs?: OutputByNode,
  allNodesForInput?: Node[]
): Promise<void> {
  console.log("[runWorkflowSubset] Starting execution for", nodes.length, "nodes");
  console.log("[runWorkflowSubset] All nodes for input building:", allNodesForInput?.length || nodes.length);
  
  // Start with pre-populated outputs if provided (from upstream nodes that already have results)
  const outputs: OutputByNode = prePopulatedOutputs ? new Map(prePopulatedOutputs) : new Map();
  console.log("[runWorkflowSubset] Pre-populated outputs:", outputs.size);
  
  // CRITICAL: Get IDs of pre-populated nodes - these are already "completed"
  const prePopulatedNodeIds = prePopulatedOutputs ? new Set(prePopulatedOutputs.keys()) : new Set<string>();
  console.log("[runWorkflowSubset] Pre-populated node IDs:", [...prePopulatedNodeIds]);
  
  const allNodes = topoSort(nodes, edges);
  
  // CRITICAL: Use allNodesForInput for buildNodeInput if provided
  // This includes pre-populated upstream nodes so their data can be found
  const nodesForInputBuilding = allNodesForInput || allNodes;
  console.log("[runWorkflowSubset] Nodes for input building:", nodesForInputBuilding.map(n => `${n.id} (${n.type})`));
  
  // Build dependency graph - include pre-populated node IDs in the lookup
  const nodeById = new Map<string, Node>(allNodes.map(n => [n.id, n]));
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  
  for (const node of allNodes) {
    dependencies.set(node.id, new Set());
    dependents.set(node.id, new Set());
  }
  
  // Build dependencies - also count pre-populated nodes as valid sources
  for (const edge of edges) {
    const source = edge.source;
    const target = edge.target;
    
    // Include edge if target is in our nodes AND (source is in our nodes OR source has pre-populated output)
    const targetInNodes = nodeById.has(target);
    const sourceInNodes = nodeById.has(source);
    const sourceIsPrePopulated = prePopulatedNodeIds.has(source);
    
    if (targetInNodes && (sourceInNodes || sourceIsPrePopulated)) {
      dependencies.get(target)!.add(source);
      if (sourceInNodes) {
        dependents.get(source)!.add(target);
      }
    }
  }
  
  // Initialize completed set with pre-populated node IDs
  // These nodes already have output and don't need to run
  const completed = new Set<string>(prePopulatedNodeIds);
  const failed = new Set<string>();
  const running = new Set<string>();
  
  console.log("[runWorkflowSubset] Initial completed set (pre-populated):", [...completed]);
  
  const getReadyNodes = (): Node[] => {
    const ready: Node[] = [];
    for (const node of allNodes) {
      if (completed.has(node.id) || failed.has(node.id) || running.has(node.id)) {
        continue;
      }
      const deps = dependencies.get(node.id)!;
      const allDepsComplete = [...deps].every(d => completed.has(d));
      const anyDepFailed = [...deps].some(d => failed.has(d));
      
      if (anyDepFailed) {
        failed.add(node.id);
        callbacks.onNodeStatus?.(node.id, "failed", { 
          error: "Dependency failed",
          progress: 0 
        });
        continue;
      }
      
      if (allDepsComplete) {
        ready.push(node);
      }
    }
    return ready;
  };
  
  // I/O node types that are passthrough (don't need execution)
  const IO_NODE_TYPES = ["image-input", "video-input", "audio-input", "output", "comment"];
  
  const executeNode = async (node: Node): Promise<void> => {
    const type = node.type as AINodeType;
    const inputSchema = NodeInputSchemas[type] as z.ZodTypeAny;
    const outputSchema = NodeOutputSchemas[type] as z.ZodTypeAny;
    const data = (node.data ?? {}) as any;

    if (!inputSchema || !outputSchema) {
      callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
      failed.add(node.id);
      return;
    }

    // ==========================================================================
    // I/O NODE HANDLING - These are passthrough nodes
    // ==========================================================================
    if (IO_NODE_TYPES.includes(type)) {
      console.log(`[runWorkflowSubset] I/O node ${node.id} (${type}) - passthrough handling`);
      console.log(`[runWorkflowSubset] I/O node data:`, JSON.stringify(data).slice(0, 500));
      
      // Input nodes: use their result/value as output
      if (type === "image-input" || type === "video-input" || type === "audio-input") {
        // Try multiple possible property names for the uploaded file
        const result = data.result || data.value || data.url || data.file;
        console.log(`[runWorkflowSubset] Input node ${node.id} result:`, result ? `${String(result).slice(0, 100)}...` : 'undefined');
        
        if (result && typeof result === "string" && result.length > 0) {
          const outputType = type === "image-input" ? "image" : type === "video-input" ? "video" : "audio";
          const passOutput: AnyOut = outputType === "image" 
            ? { type: "image", image: { url: result } }
            : outputType === "video"
            ? { type: "video", video: { url: result } }
            : { type: "audio", audio: { url: result } };
          
          outputs.set(node.id, passOutput);
          completed.add(node.id);
          callbacks.onNodeResult?.(node.id, result, passOutput);
          callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
          console.log(`[runWorkflowSubset] Input node ${node.id} completed with result`);
          return;
        } else {
          // No input file uploaded - provide more helpful error
          const dataKeys = Object.keys(data);
          console.error(`[runWorkflowSubset] Input node ${node.id} has no file. Data keys:`, dataKeys);
          callbacks.onNodeStatus?.(node.id, "failed", { 
            error: `No file uploaded to ${type.replace('-input', '')} input node`,
            details: `Please upload a file to the input node before running the workflow`
          });
          failed.add(node.id);
          return;
        }
      }
      
      // Output node: get value from connected upstream node
      if (type === "output") {
        // Find incoming edge and get the output from the source node
        const incomingEdge = edges.find(e => e.target === node.id);
        if (incomingEdge) {
          const sourceOutput = outputs.get(incomingEdge.source);
          if (sourceOutput) {
            outputs.set(node.id, sourceOutput);
            completed.add(node.id);
            const resultText = sourceOutput.type === "text" ? sourceOutput.text 
              : sourceOutput.type === "image" ? sourceOutput.image.url
              : sourceOutput.type === "video" ? sourceOutput.video.url
              : sourceOutput.audio.url;
            callbacks.onNodeResult?.(node.id, resultText, sourceOutput);
            callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
            return;
          }
        }
        // No input connected or source didn't produce output
        callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
        completed.add(node.id);
        return;
      }
      
      // Comment node: just mark as completed
      if (type === "comment") {
        completed.add(node.id);
        callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
        return;
      }
    }

    // ==========================================================================
    // SKIP CHECK - Use existing output if skip is enabled
    // ==========================================================================
    if (data.skip === true) {
      const existingResult = data.result as string | undefined;
      const nodeName = data.label || NODE_DEFINITIONS[type]?.label || type;
      
      if (existingResult && typeof existingResult === "string" && existingResult.trim().length > 0) {
        // Node has output - use it instead of executing
        console.log(`[runWorkflowSubset] Node ${node.id} (${type}) SKIPPED - using existing output`);
        
        // Determine output type based on node type
        const outputType = NodePrimaryOutputType[type];
        let skipOutput: AnyOut;
        
        if (outputType === "text") {
          skipOutput = { type: "text", text: existingResult };
        } else if (outputType === "image") {
          skipOutput = { type: "image", image: { url: existingResult } };
        } else if (outputType === "video") {
          skipOutput = { type: "video", video: { url: existingResult } };
        } else {
          skipOutput = { type: "audio", audio: { url: existingResult } };
        }
        
        outputs.set(node.id, skipOutput);
        completed.add(node.id);
        
        callbacks.onNodeResult?.(node.id, existingResult, skipOutput);
        callbacks.onNodeStatus?.(node.id, "completed", {
          progress: 100,
          skipped: true,
        });
        return;
      } else {
        // Skip enabled but no output available - show warning and fail
        console.log(`[runWorkflowSubset] Node ${node.id} (${type}) SKIP FAILED - no existing output`);
        showSkipWarning(nodeName);
        callbacks.onNodeStatus?.(node.id, "failed", {
          error: "Skip enabled but no cached output available",
          skipped: true,
        });
        failed.add(node.id);
        return;
      }
    }

    running.add(node.id);
    callbacks.onNodeStatus?.(node.id, "running", { progress: 10 });

    // Compute input hash for change detection
    const inputHash = computeNodeInputHash(node, edges, nodesForInputBuilding);

    // CRITICAL: Use nodesForInputBuilding to include pre-populated upstream nodes
    const rawInput = buildNodeInput(node, edges, outputs, nodesForInputBuilding);
    console.log(`[runWorkflowSubset] Node ${node.id} (${type}) starting with input:`, JSON.stringify(rawInput).slice(0, 200));
    
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: parsed.error.issues.map((i) => i.message).join("; "),
        progress: 0,
      });
      running.delete(node.id);
      failed.add(node.id);
      return;
    }

    // Check cache (only if caching enabled)
    const useCache = (data as { useCache?: boolean }).useCache === true;
    let cacheHash: string | undefined;
    
    if (useCache) {
      try {
        const cacheCheck = await checkCache(type, parsed.data as Record<string, unknown>);
        cacheHash = cacheCheck.hash;
        
        if (cacheCheck.hit && cacheCheck.result) {
          console.log(`[runWorkflowSubset] Cache HIT for ${node.id} (${type})`);
          
          const cachedOut = cacheCheck.result as AnyOut;
          const validated = outputSchema.safeParse(cachedOut);
          
          if (validated.success) {
            running.delete(node.id);
            outputs.set(node.id, cachedOut);
            completed.add(node.id);
            
            const resultText =
              cachedOut.type === "text"
                ? cachedOut.text
                : cachedOut.type === "image"
                  ? cachedOut.image.url
                  : cachedOut.type === "video"
                    ? cachedOut.video.url
                    : cachedOut.audio.url;

            callbacks.onNodeResult?.(node.id, resultText, cachedOut);
            callbacks.onNodeStatus?.(node.id, "completed", {
              progress: 100,
              fromCache: true,
              _lastInputHash: inputHash,
            });
            return;
          }
        }
      } catch (error) {
        console.warn(`[runWorkflowSubset] Cache check failed for ${node.id}:`, error);
      }
    } else {
      console.log(`[runWorkflowSubset] Cache DISABLED for ${node.id} (${type}) - executing fresh`);
    }

    // Provider execution
    const nodeProvidersRaw = Array.isArray(data.providers) ? data.providers : undefined;
    const providers = (nodeProvidersRaw?.filter((p: unknown) => typeof p === "string" && p.trim()) as string[] | undefined)
      ?? (NodeProviders[type] as unknown as string[] | undefined)
      ?? ["fal"];

    const retryPerProvider =
      typeof data.retryPerProvider === "number" && Number.isFinite(data.retryPerProvider) && data.retryPerProvider > 0
        ? Math.floor(data.retryPerProvider)
        : 1;

    const timeoutMs =
      parseDurationMs(data.timeout) ??
      parseDurationMs(data.timeoutMs) ??
      parseDurationMs(data.nodeTimeout) ??
      NODE_TIMEOUT_MS[type] ??
      DEFAULT_NODE_TIMEOUT_MS;

    let lastError: string | undefined;
    let finalOut: AnyOut | undefined;
    let providerUsed: string | undefined;
    const attemptedProviders: string[] = [];

    for (const p of providers) {
      if (!providerIsConfigured(p as any)) continue;
      attemptedProviders.push(p);

      for (let attempt = 1; attempt <= retryPerProvider; attempt++) {
        callbacks.onNodeStatus?.(node.id, "running", {
          progress: 20 + (attempt * 10),
          providerTrying: p,
          providerAttempt: attempt,
        });

        try {
          const out = await withTimeout(
            executeWithProvider(type, p as any, parsed.data, {
              workflowId,
              nodeId: node.id,
              nodeLabel: data.label || NODE_DEFINITIONS[type]?.label || type,
            }),
            timeoutMs,
            `${type} (${p})`
          );
          const validated = outputSchema.safeParse(out);
          if (!validated.success) {
            throw new Error(`Output schema invalid: ${validated.error.issues.map((i) => i.message).join("; ")}`);
          }
          finalOut = validated.data as AnyOut;
          providerUsed = p;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          console.log(`[runWorkflowSubset] Node ${node.id} attempt ${attempt} failed: ${lastError}`);
        }
      }

      if (finalOut) break;
    }

    running.delete(node.id);

    if (!finalOut) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: lastError ?? "All providers failed",
        attemptedProviders,
        progress: 0,
      });
      failed.add(node.id);
      return;
    }

    outputs.set(node.id, finalOut);
    completed.add(node.id);
    
    const resultText =
      finalOut.type === "text"
        ? finalOut.text
        : finalOut.type === "image"
          ? finalOut.image.url
          : finalOut.type === "video"
            ? finalOut.video.url
            : finalOut.audio.url;

    // Cache result (only if caching enabled)
    if (useCache && cacheHash) {
      try {
        await cacheResult(cacheHash, type, finalOut as Record<string, unknown>);
      } catch (error) {
        console.warn(`[runWorkflowSubset] Failed to cache result for ${node.id}:`, error);
      }
    }

    callbacks.onNodeResult?.(node.id, resultText, finalOut);
    callbacks.onNodeStatus?.(node.id, "completed", {
      progress: 100,
      providerUsed,
      attemptedProviders,
      _lastInputHash: inputHash,
    });
  };
  
  // Mark all nodes as queued
  for (const node of allNodes) {
    const type = node.type as AINodeType;
    if (!NodeInputSchemas[type] || !NodeOutputSchemas[type]) {
      callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
      failed.add(node.id);
      continue;
    }
    callbacks.onNodeStatus?.(node.id, "queued");
  }
  
  // Execute nodes sequentially for dependency runs (simpler and more predictable)
  while (completed.size + failed.size < allNodes.length) {
    const readyNodes = getReadyNodes();
    
    if (readyNodes.length === 0) {
      if (running.size === 0) {
        console.error("[runWorkflowSubset] No nodes ready and none running");
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    
    // Run one node at a time for dependency execution (sequential is safer)
    const nodeToRun = readyNodes[0];
    console.log(`[runWorkflowSubset] Running node: ${nodeToRun.id} (${nodeToRun.type})`);
    await executeNode(nodeToRun);
  }
  
  console.log(`[runWorkflowSubset] Completed: ${completed.size} succeeded, ${failed.size} failed`);
}

export async function runSingleNode(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  callbacks: RunCallbacks = {},
  workflowId?: string
): Promise<void> {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const type = node.type as AINodeType;
  const startTime = Date.now();
  const inputSchema = NodeInputSchemas[type] as z.ZodTypeAny | undefined;
  const outputSchema = NodeOutputSchemas[type] as z.ZodTypeAny | undefined;
  const data = (node.data ?? {}) as Record<string, unknown>;

  if (!inputSchema || !outputSchema) {
    callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
    return;
  }

  // ==========================================================================
  // I/O NODE HANDLING - These are passthrough nodes
  // ==========================================================================
  const IO_NODE_TYPES = ["image-input", "video-input", "audio-input", "output", "comment"];
  
  if (IO_NODE_TYPES.includes(type)) {
    console.log(`[runSingleNode] I/O node ${node.id} (${type}) - passthrough handling`);
    console.log(`[runSingleNode] I/O node data:`, JSON.stringify(data).slice(0, 500));
    
    // Input nodes: use their result/value as output
    if (type === "image-input" || type === "video-input" || type === "audio-input") {
      // Try multiple possible property names for the uploaded file
      const result = (data.result || data.value || data.url || data.file) as string | undefined;
      console.log(`[runSingleNode] Input node ${node.id} result:`, result ? `${String(result).slice(0, 100)}...` : 'undefined');
      
      if (result && typeof result === "string" && result.length > 0) {
        const outputType = type === "image-input" ? "image" : type === "video-input" ? "video" : "audio";
        const passOutput: AnyOut = outputType === "image" 
          ? { type: "image", image: { url: result } }
          : outputType === "video"
          ? { type: "video", video: { url: result } }
          : { type: "audio", audio: { url: result } };
        
        callbacks.onNodeResult?.(node.id, result, passOutput);
        callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
        console.log(`[runSingleNode] Input node ${node.id} completed with result`);
        return;
      } else {
        // No input file uploaded - provide more helpful error
        const dataKeys = Object.keys(data);
        console.error(`[runSingleNode] Input node ${node.id} has no file. Data keys:`, dataKeys);
        callbacks.onNodeStatus?.(node.id, "failed", { 
          error: `No file uploaded to ${type.replace('-input', '')} input node`,
          details: `Please upload a file to the input node before running the workflow`
        });
        return;
      }
    }
    
    // Output and comment nodes - just mark as completed
    callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
    return;
  }

  // ==========================================================================
  // SKIP CHECK - Use existing output if skip is enabled
  // ==========================================================================
  if (data.skip === true) {
    const existingResult = data.result as string | undefined;
    const nodeName = (data.label as string) || NODE_DEFINITIONS[type]?.label || type;
    
    if (existingResult && typeof existingResult === "string" && existingResult.trim().length > 0) {
      // Node has output - use it instead of executing
      console.log(`[runSingleNode] Node ${node.id} (${type}) SKIPPED - using existing output`);
      
      // Determine output type based on node type
      const outputType = NodePrimaryOutputType[type];
      let skipOutput: AnyOut;
      
      if (outputType === "text") {
        skipOutput = { type: "text", text: existingResult };
      } else if (outputType === "image") {
        skipOutput = { type: "image", image: { url: existingResult } };
      } else if (outputType === "video") {
        skipOutput = { type: "video", video: { url: existingResult } };
      } else {
        skipOutput = { type: "audio", audio: { url: existingResult } };
      }
      
      callbacks.onNodeResult?.(node.id, existingResult, skipOutput);
      callbacks.onNodeStatus?.(node.id, "completed", {
        progress: 100,
        skipped: true,
      });
      return;
    } else {
      // Skip enabled but no output available - show warning and fail
      console.log(`[runSingleNode] Node ${node.id} (${type}) SKIP FAILED - no existing output`);
      showSkipWarning(nodeName);
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: "Skip enabled but no cached output available",
        skipped: true,
      });
      return;
    }
  }

  callbacks.onNodeStatus?.(node.id, "queued");
  callbacks.onNodeStatus?.(node.id, "running", { progress: 10 });

  // Compute input hash BEFORE execution for change detection on re-runs
  const inputHash = computeNodeInputHash(node, edges, nodes);
  console.log(`[runSingleNode] Input hash for ${nodeId}: ${inputHash}`);

  // Build input the same way full workflow runs do, so media inputs like
  // `inputImage` become schema fields like `{ image: { url } }`.
  const rawInput = buildNodeInput(node, edges, new Map(), nodes);

  // For "run node", also allow a context fallback from connected node output previews.
  const preview = getConnectedPreviewFromLastOutputs(nodes, edges, node.id);
  if (!(rawInput as any)?.context && preview) {
    (rawInput as any).context = preview;
  }

  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    callbacks.onNodeStatus?.(node.id, "failed", {
      error: parsed.error.issues.map((i) => i.message).join("; "),
      progress: 0,
    });
    return;
  }

  // Debug: Log parsed data for crop-image
  if (type === "crop-image") {
    const parsedData = parsed.data as Record<string, unknown>;
    console.log(`[runSingleNode:crop-image] PARSED.DATA:`, JSON.stringify({
      xPercent: parsedData.xPercent,
      yPercent: parsedData.yPercent,
      widthPercent: parsedData.widthPercent,
      heightPercent: parsedData.heightPercent,
    }));
  }

  // Check cache for identical inputs (skip re-execution if cached)
  const useCache = (node.data as { useCache?: boolean } | undefined)?.useCache === true;
  let cacheHash: string | undefined;
  
  if (useCache) {
    try {
      const cacheCheck = await checkCache(type, parsed.data as Record<string, unknown>);
      cacheHash = cacheCheck.hash;
      
      if (cacheCheck.hit && cacheCheck.result) {
        console.log(`[runSingleNode] Cache HIT for ${type} - skipping execution`);
        
        const cachedOut = cacheCheck.result as AnyOut;
        const validated = outputSchema.safeParse(cachedOut);
        
        if (validated.success) {
          const resultText =
            cachedOut.type === "text"
              ? cachedOut.text
              : cachedOut.type === "image"
                ? cachedOut.image.url
                : cachedOut.type === "video"
                  ? cachedOut.video.url
                  : cachedOut.audio.url;

          callbacks.onNodeResult?.(node.id, resultText, cachedOut);
          callbacks.onNodeStatus?.(node.id, "completed", {
            progress: 100,
            fromCache: true,
            _lastInputHash: inputHash, // Save hash for change detection
          });
          return;
        }
      }
    } catch (error) {
      console.warn("[runSingleNode] Cache check failed, proceeding with execution:", error);
    }
  } else {
    console.log(`[runSingleNode] Cache DISABLED for ${type} - executing fresh`);
  }

  // For async nodes (fal.ai), use the API which tracks via Trigger.dev
  if (ASYNC_NODE_TYPES.includes(type)) {
    const nodeData = (node.data ?? {}) as Record<string, unknown>;
    try {
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: type,
          input: { ...(parsed.data as Record<string, unknown>), nodeId }, // Include nodeId so polling can match
          workflowId, // Link to workflow for Activity tab filtering
          nodeId, // React Flow node ID
          nodeLabel: nodeData.label || NODE_DEFINITIONS[type]?.label || type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const responseData = await response.json();
      
      // The node is now running via Trigger.dev - polling will update status
      callbacks.onNodeStatus?.(node.id, "running", {
        progress: 25,
        providerUsed: "fal",
        triggerRunId: responseData.triggerRunId,
        nodeExecutionId: responseData.nodeExecutionId,
      });

      // Don't wait here - the polling in page.tsx will handle status updates
      console.log(`[runSingleNode] ${type} submitted to Trigger.dev: ${responseData.triggerRunId}`);
      return;
    } catch (error) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: error instanceof Error ? error.message : String(error),
        progress: 0,
      });
      return;
    }
  }

  // For synchronous nodes (openrouter, merge-videos, etc.), run locally
  const nodeDataSync = (node.data ?? {}) as Record<string, unknown>;
  const nodeProvidersRaw = Array.isArray(nodeDataSync.providers) ? nodeDataSync.providers : undefined;
  const providers = (nodeProvidersRaw?.filter((p: unknown) => typeof p === "string" && p.trim()) as string[] | undefined)
    ?? (NodeProviders[type] as unknown as string[] | undefined)
    ?? ["mock"];

  const retryPerProvider =
    typeof nodeDataSync.retryPerProvider === "number" && Number.isFinite(nodeDataSync.retryPerProvider) && nodeDataSync.retryPerProvider > 0
      ? Math.floor(nodeDataSync.retryPerProvider)
      : 1;

  const timeoutMs =
    parseDurationMs(nodeDataSync.timeout) ??
    parseDurationMs(nodeDataSync.timeoutMs) ??
    parseDurationMs(nodeDataSync.nodeTimeout) ??
    NODE_TIMEOUT_MS[type] ??
    DEFAULT_NODE_TIMEOUT_MS;

  let lastError: string | undefined;
  let finalOut: AnyOut | undefined;
  let providerUsed: string | undefined;
  const attemptedProviders: string[] = [];

  for (const p of providers) {
    if (!providerIsConfigured(p as any)) continue;
    attemptedProviders.push(p);

    for (let attempt = 1; attempt <= retryPerProvider; attempt++) {
      callbacks.onNodeStatus?.(node.id, "running", {
        progress: 20,
        providerTrying: p,
        providerAttempt: attempt,
      });

      try {
        const out = await withTimeout(
          executeWithProvider(type, p as any, parsed.data, {
            workflowId,
            nodeId: node.id,
            nodeLabel: (nodeDataSync.label as string) || NODE_DEFINITIONS[type]?.label || type,
          }),
          timeoutMs,
          `${type} (${p})`
        );
        const validated = outputSchema.safeParse(out);
        if (!validated.success) {
          throw new Error(`Output schema invalid: ${validated.error.issues.map((i) => i.message).join("; ")}`);
        }
        finalOut = validated.data as AnyOut;
        providerUsed = p;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    if (finalOut) break;
  }

  if (!finalOut) {
    callbacks.onNodeStatus?.(node.id, "failed", {
      error: lastError ?? "All providers failed",
      attemptedProviders,
      progress: 0,
    });
    return;
  }

  const resultText =
    finalOut.type === "text"
      ? finalOut.text
      : finalOut.type === "image"
        ? finalOut.image.url
        : finalOut.type === "video"
          ? finalOut.video.url
          : finalOut.audio.url;

  // Deduct credits and record execution for synchronous nodes (utility nodes)
  // Note: openrouter handles its own credit deduction in /api/nodes/llm/stream
  if (type !== "openrouter") {
    try {
      const creditCost = estimateNodeCost(type, parsed.data as Record<string, unknown>);
      const durationMs = Date.now() - startTime;
      const nodeLabel = (node.data as any)?.label || type;
      
      const response = await fetch("/api/nodes/deduct-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: type,
          creditCost,
          input: parsed.data,
          workflowId,
          nodeId: node.id,
          nodeLabel,
          durationMs,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[runSingleNode] Recorded ${type} execution, credits: ${creditCost}, execution: ${result.executionId}`);
      } else {
        console.warn(`[runSingleNode] Failed to record execution for ${type}`);
      }
    } catch (error) {
      console.warn(`[runSingleNode] Execution recording error for ${type}:`, error);
    }
  }

  // Cache successful result for future identical executions (only if caching enabled)
  if (useCache && cacheHash) {
    try {
      await cacheResult(cacheHash, type, finalOut as Record<string, unknown>);
    } catch (error) {
      console.warn("[runSingleNode] Failed to cache result:", error);
    }
  }

  callbacks.onNodeResult?.(node.id, resultText, finalOut);
  callbacks.onNodeStatus?.(node.id, "completed", {
    progress: 100,
    providerUsed,
    attemptedProviders,
    _lastInputHash: inputHash, // Save hash for change detection on re-runs
  });
}



