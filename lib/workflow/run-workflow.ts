import type { Edge, Node } from "reactflow";
import { z } from "zod";
import type { AINodeType } from "@/types/nodes";
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

export type NodeRunStatus = "queued" | "running" | "completed" | "failed";

export interface RunCallbacks {
  onNodeStatus?: (nodeId: string, status: NodeRunStatus, patch?: Record<string, unknown>) => void;
  onNodeResult?: (nodeId: string, resultText: string, output: AnyOut) => void;
}

type OutputByNode = Map<string, AnyOut>;

const DEFAULT_NODE_TIMEOUT_MS = 60_000;

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
  const incoming = edges.filter((e) => e.target === nodeId && (!targetHandle || e.targetHandle === targetHandle));
  
  for (const e of incoming) {
    const out = outputs.get(e.source);
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

  const base = {
    ...data,
    prompt: promptValue,
    context: contextValue,
  };

  // Utility: if node expects media input, allow a `data.<field>.url` OR a raw string url; normalize to AssetRef.
  const normalizeAsset = (v: unknown) => {
    if (!v) return v;
    if (typeof v === "string") return { url: v };
    return v;
  };

  // Helper to get media from connected nodes or from node data
  const getVideoInput = (handleId?: string, dataField: string = "inputVideo") => {
    // First check connected nodes
    const connected = getIncomingMedia(edges, outputs, node.id, handleId);
    if (connected) return { url: connected };
    // Fall back to node's stored data
    return normalizeAsset(data[dataField]);
  };

  const getAudioInput = (handleId?: string, dataField: string = "inputAudio") => {
    // First check connected nodes
    const connected = getIncomingMedia(edges, outputs, node.id, handleId);
    if (connected) return { url: connected };
    // Fall back to node's stored data
    return normalizeAsset(data[dataField]);
  };

  const getImageInput = (handleId?: string, dataField: string = "inputImage") => {
    // First check connected nodes
    const connected = getIncomingMedia(edges, outputs, node.id, handleId);
    if (connected) return { url: connected };
    // Fall back to node's stored data
    return normalizeAsset(data[dataField]);
  };

  switch (type) {
    case "seedvr":
      return { ...base, image: getImageInput("image", "inputImage") || normalizeAsset(base.image) };
    case "crop-image":
      return { ...base, image: getImageInput("inputImage", "inputImage") || normalizeAsset(base.image) };
    case "extract-audio":
      return { ...base, video: getVideoInput("inputVideo", "inputVideo") };
    case "merge-videos": {
      // Get videos from connected nodes by their specific handles
      const video1Connected = getIncomingMedia(edges, outputs, node.id, "inputVideo1");
      const video2Connected = getIncomingMedia(edges, outputs, node.id, "inputVideo2");
      return {
        ...base,
        video1: video1Connected ? { url: video1Connected } : normalizeAsset(data.inputVideo1),
        video2: video2Connected ? { url: video2Connected } : normalizeAsset(data.inputVideo2),
      };
    }
    case "merge-audio-video": {
      // Get video and audio from connected nodes by their specific handles
      const videoConnected = getIncomingMedia(edges, outputs, node.id, "inputVideo");
      const audioConnected = getIncomingMedia(edges, outputs, node.id, "inputAudio");
      return {
        ...base,
        video: videoConnected ? { url: videoConnected } : normalizeAsset(data.inputVideo),
        audio: audioConnected ? { url: audioConnected } : normalizeAsset(data.inputAudio),
      };
    }
    case "lipsync": {
      const videoConnected = getIncomingMedia(edges, outputs, node.id, "video");
      const audioConnected = getIncomingMedia(edges, outputs, node.id, "audio");
      return {
        ...base,
        video: videoConnected ? { url: videoConnected } : normalizeAsset(data.video),
        audio: audioConnected ? { url: audioConnected } : normalizeAsset(data.audio),
      };
    }
    case "seedance":
      return { ...base, frame: getImageInput("frame", "frame") || normalizeAsset(base.frame) };
    default:
      return base;
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

async function executeWithProvider(type: AINodeType, provider: ProviderId, input: unknown): Promise<AnyOut> {
  void provider;
  
  console.log(`[executeWithProvider] Executing ${type} with provider ${provider}`);

  // LOCAL utility nodes - run via sync API (no network overhead for large data)
  if (LOCAL_NODE_TYPES.includes(type)) {
    try {
      console.log(`[executeWithProvider] Calling sync API for LOCAL node: ${type}`);
      
      const response = await fetch("/api/nodes/execute-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: type,
          input,
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
      
      // Generate a unique nodeId for this execution
      const nodeId = (input as { nodeId?: string })?.nodeId || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: type,
          input: { ...input as object, nodeId },
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
  callbacks: RunCallbacks = {}
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

    running.add(node.id);
    callbacks.onNodeStatus?.(node.id, "running", { progress: 10 });

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

    // Check cache for identical inputs
    let cacheHash: string | undefined;
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
          });
          return;
        }
      }
    } catch (error) {
      console.warn(`[RunWorkflow] Cache check failed for ${node.id}, proceeding with execution:`, error);
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
            executeWithProvider(type, p as any, parsed.data),
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

    // Cache successful result for future identical executions
    if (cacheHash) {
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

  if (!inputSchema || !outputSchema) {
    callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
    return;
  }

  callbacks.onNodeStatus?.(node.id, "queued");
  callbacks.onNodeStatus?.(node.id, "running", { progress: 10 });

  // For "run node", use current node.data + connected node's last output as context fallback.
  const preview = getConnectedPreviewFromLastOutputs(nodes, edges, node.id);
  const base = {
    ...(node.data ?? {}),
    context: (node.data as any)?.context ?? preview,
  };

  const parsed = inputSchema.safeParse(base);
  if (!parsed.success) {
    callbacks.onNodeStatus?.(node.id, "failed", {
      error: parsed.error.issues.map((i) => i.message).join("; "),
      progress: 0,
    });
    return;
  }

  // Check cache for identical inputs (skip re-execution if cached)
  let cacheHash: string | undefined;
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
        });
        return;
      }
    }
  } catch (error) {
    console.warn("[runSingleNode] Cache check failed, proceeding with execution:", error);
  }

  // For async nodes (fal.ai), use the API which tracks via Trigger.dev
  if (ASYNC_NODE_TYPES.includes(type)) {
    try {
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: type,
          input: { ...parsed.data, nodeId }, // Include nodeId so polling can match
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      // The node is now running via Trigger.dev - polling will update status
      callbacks.onNodeStatus?.(node.id, "running", {
        progress: 25,
        providerUsed: "fal",
        triggerRunId: data.triggerRunId,
        nodeExecutionId: data.nodeExecutionId,
      });

      // Don't wait here - the polling in page.tsx will handle status updates
      console.log(`[runSingleNode] ${type} submitted to Trigger.dev: ${data.triggerRunId}`);
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
  const data = (node.data ?? {}) as Record<string, unknown>;
  const nodeProvidersRaw = Array.isArray(data.providers) ? data.providers : undefined;
  const providers = (nodeProvidersRaw?.filter((p: unknown) => typeof p === "string" && p.trim()) as string[] | undefined)
    ?? (NodeProviders[type] as unknown as string[] | undefined)
    ?? ["mock"];

  const retryPerProvider =
    typeof data.retryPerProvider === "number" && Number.isFinite(data.retryPerProvider) && data.retryPerProvider > 0
      ? Math.floor(data.retryPerProvider)
      : 1;

  const timeoutMs =
    parseDurationMs(data.timeout) ??
    parseDurationMs(data.timeoutMs) ??
    parseDurationMs(data.nodeTimeout) ??
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
          executeWithProvider(type, p as any, parsed.data),
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
      const creditCost = estimateNodeCost(type, parsed.data);
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

  // Cache successful result for future identical executions
  if (cacheHash) {
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
  });
}



