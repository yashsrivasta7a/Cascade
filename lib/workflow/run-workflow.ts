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
  AssetRefSchema,
} from "./node-schemas";

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

function getIncomingText(edges: Edge[], outputs: OutputByNode, nodeId: string, nodes: Node[]): string | undefined {
  const incoming = edges.filter((e) => e.target === nodeId);
  console.log(`[getIncomingText] Node ${nodeId} has ${incoming.length} incoming edges`);
  
  const textParts: string[] = [];
  
  for (const e of incoming) {
    const out = outputs.get(e.source);
    const sourceNode = nodes.find((n) => n.id === e.source);
    
    console.log(`[getIncomingText] Checking edge from ${e.source}:`, {
      hasOutput: !!out,
      outputType: out?.type,
      sourceNodeFound: !!sourceNode,
    });
    
    if (out?.type === "text") {
      // Include both the original prompt and the response for full context
      const sourceData = (sourceNode?.data ?? {}) as { prompt?: string };
      const originalPrompt = sourceData.prompt;
      
      console.log(`[getIncomingText] Source node prompt: "${originalPrompt?.slice(0, 50)}..."`);
      console.log(`[getIncomingText] Source output text: "${out.text?.slice(0, 50)}..."`);
      
      if (originalPrompt) {
        textParts.push(`[Previous message: "${originalPrompt}"]\n[Response: "${out.text}"]`);
      } else {
        textParts.push(out.text);
      }
    }
  }
  
  const result = textParts.length > 0 ? textParts.join("\n\n") : undefined;
  console.log(`[getIncomingText] Result for node ${nodeId}:`, result ? `"${result.slice(0, 100)}..."` : "undefined");
  
  return result;
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

function buildNodeInput(node: Node, edges: Edge[], outputs: OutputByNode, nodes: Node[]) {
  const type = node.type as AINodeType;
  const data = (node.data ?? {}) as any;

  // Black box rule: only pass validated outputs forward. Here we only use prior outputs map (not raw node.data).
  const prevText = getIncomingText(edges, outputs, node.id, nodes);

  // Map connected outputs into expected input fields
  // For this submission we support:
  // - text context chaining (prevText -> context)
  // - keeping node's own config fields from node.data
  // IMPORTANT: Use prevText if available (it contains previous node outputs)
  // Only fall back to data.context if there's no incoming connection output
  const contextValue = prevText || (typeof data.context === 'string' && data.context.trim() ? data.context : undefined);
  
  const base = {
    ...data,
    context: contextValue,
  };

  // Utility: if node expects media input, allow a `data.<field>.url` OR a raw string url; normalize to AssetRef.
  const normalizeAsset = (v: unknown) => {
    if (!v) return v;
    if (typeof v === "string") return { url: v };
    return v;
  };

  switch (type) {
    case "seedvr":
      return { ...base, image: normalizeAsset(base.image) };
    case "crop-image":
      return { ...base, image: normalizeAsset(base.image) };
    case "extract-audio":
      return { ...base, video: normalizeAsset(base.video) };
    case "merge-videos":
      return { ...base, video1: normalizeAsset(base.video1), video2: normalizeAsset(base.video2) };
    case "merge-audio-video":
      return { ...base, video: normalizeAsset(base.video), audio: normalizeAsset(base.audio) };
    case "lipsync":
      return { ...base, video: normalizeAsset(base.video), audio: normalizeAsset(base.audio) };
    case "seedance":
      return { ...base, frame: normalizeAsset(base.frame) };
    default:
      return base;
  }
}

function providerIsConfigured(_provider: ProviderId): boolean {
  // Allow all providers - we'll call real APIs
  return true;
}

function fakeAssetUrl(kind: "image" | "video" | "audio") {
  // Deterministic placeholder assets for non-implemented nodes
  if (kind === "image") return "https://picsum.photos/seed/flowsmith/512/512";
  if (kind === "video") return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  return "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav";
}

async function executeWithProvider(type: AINodeType, provider: ProviderId, input: unknown): Promise<AnyOut> {
  void provider;

  const outType = NodePrimaryOutputType[type];
  
  console.log(`[executeWithProvider] Executing ${type} with provider ${provider}`);
  console.log(`[executeWithProvider] Input:`, input);
  
  // For OpenRouter/LLM nodes, call the real API
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

  // For other text nodes, return placeholder
  if (outType === "text") {
    const prompt = (input as any)?.prompt ?? "";
    const ctx = (input as any)?.context ? `\n\nContext: ${(input as any).context}` : "";
    return { type: "text", text: `[${type}] Processing: ${prompt}${ctx}` };
  }

  if (outType === "image") {
    return { type: "image", image: AssetRefSchema.parse({ url: fakeAssetUrl("image") }) };
  }

  if (outType === "video") {
    return { type: "video", video: AssetRefSchema.parse({ url: fakeAssetUrl("video") }) };
  }

  return { type: "audio", audio: AssetRefSchema.parse({ url: fakeAssetUrl("audio") }) };
}

export async function runWorkflow(
  nodes: Node[],
  edges: Edge[],
  callbacks: RunCallbacks = {}
): Promise<void> {
  console.log("[RunWorkflow] Starting workflow execution");
  console.log("[RunWorkflow] Nodes:", nodes.map(n => ({ id: n.id, type: n.type })));
  console.log("[RunWorkflow] Edges:", edges.map(e => ({ source: e.source, target: e.target })));
  
  const outputs: OutputByNode = new Map();
  const ordered = topoSort(nodes, edges);
  
  console.log("[RunWorkflow] Execution order:", ordered.map(n => n.id));

  for (const n of ordered) {
    const type = n.type as AINodeType;
    if (!NodeInputSchemas[type] || !NodeOutputSchemas[type]) {
      callbacks.onNodeStatus?.(n.id, "failed", { error: `Missing schemas for node type: ${type}` });
      continue;
    }

    callbacks.onNodeStatus?.(n.id, "queued");
  }

  for (const node of ordered) {
    const type = node.type as AINodeType;
    const inputSchema = NodeInputSchemas[type] as z.ZodTypeAny;
    const outputSchema = NodeOutputSchemas[type] as z.ZodTypeAny;
    const data = (node.data ?? {}) as any;

    callbacks.onNodeStatus?.(node.id, "running", { progress: 10 });

    const rawInput = buildNodeInput(node, edges, outputs, ordered);
    console.log(`[RunWorkflow] Node ${node.id} (${type}) - Built input:`, {
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
      continue;
    }

    // Provider fallback chain (node-configurable)
    // node.data.providers: string[] (ordered)
    // node.data.retryPerProvider: number
    // node.data.timeout: e.g. "2m" | "30s" | 60000
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
      continue;
    }

    outputs.set(node.id, finalOut);
    console.log(`[RunWorkflow] Node ${node.id} completed. Output stored:`, {
      type: finalOut.type,
      textPreview: finalOut.type === "text" ? finalOut.text?.slice(0, 100) : undefined,
    });
    console.log(`[RunWorkflow] Current outputs map size: ${outputs.size}`);
    
    const resultText =
      finalOut.type === "text"
        ? finalOut.text
        : finalOut.type === "image"
          ? finalOut.image.url
          : finalOut.type === "video"
            ? finalOut.video.url
            : finalOut.audio.url;

    callbacks.onNodeResult?.(node.id, resultText, finalOut);
    callbacks.onNodeStatus?.(node.id, "completed", {
      progress: 100,
      providerUsed,
      attemptedProviders,
    });
  }
  
  console.log("[RunWorkflow] Workflow execution completed");
}

export async function runSingleNode(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  callbacks: RunCallbacks = {}
): Promise<void> {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const type = node.type as AINodeType;
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

  // Provider fallback chain (same rules as runWorkflow)
  const data = (node.data ?? {}) as any;
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

  callbacks.onNodeResult?.(node.id, resultText, finalOut);
  callbacks.onNodeStatus?.(node.id, "completed", {
    progress: 100,
    providerUsed,
    attemptedProviders,
  });
}



