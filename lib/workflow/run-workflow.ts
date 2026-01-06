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

function getIncomingText(edges: Edge[], outputs: OutputByNode, nodeId: string): string | undefined {
  const incoming = edges.filter((e) => e.target === nodeId);
  for (const e of incoming) {
    const out = outputs.get(e.source);
    if (out?.type === "text") return out.text;
  }
  return undefined;
}

function buildNodeInput(node: Node, edges: Edge[], outputs: OutputByNode) {
  const type = node.type as AINodeType;
  const data = (node.data ?? {}) as any;

  // Black box rule: only pass validated outputs forward. Here we only use prior outputs map (not raw node.data).
  const prevText = getIncomingText(edges, outputs, node.id);

  // Map connected outputs into expected input fields
  // For this submission we support:
  // - text context chaining (prevText -> context)
  // - keeping node's own config fields from node.data
  const base = {
    ...data,
    context: data.context ?? prevText,
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
  // For this repo submission we always allow mock and internal.
  // Real providers can be gated by env vars later.
  if (_provider === "mock" || _provider === "internal") return true;
  return false;
}

function fakeAssetUrl(kind: "image" | "video" | "audio") {
  // Deterministic placeholder assets; avoids external calls.
  if (kind === "image") return "https://picsum.photos/seed/flowsmith/512/512";
  if (kind === "video") return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  return "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav";
}

async function executeWithProvider(type: AINodeType, provider: ProviderId, input: unknown): Promise<AnyOut> {
  // Provider fallback requirement: structured but safe. This is a minimal working engine.
  // External providers are stubbed; internal/mock return deterministic outputs.
  void provider;

  const outType = NodePrimaryOutputType[type];
  if (outType === "text") {
    const prompt = (input as any)?.prompt ?? "";
    const ctx = (input as any)?.context ? `\n\nContext: ${(input as any).context}` : "";
    return { type: "text", text: `Mock response for:\n${prompt}${ctx}` };
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
  const outputs: OutputByNode = new Map();
  const ordered = topoSort(nodes, edges);

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

    callbacks.onNodeStatus?.(node.id, "running", { progress: 10 });

    const rawInput = buildNodeInput(node, edges, outputs);
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: parsed.error.issues.map((i) => i.message).join("; "),
        progress: 0,
      });
      continue;
    }

    // Provider fallback chain
    const providers = NodeProviders[type] ?? ["mock"];
    let lastError: string | undefined;
    let finalOut: AnyOut | undefined;

    for (const p of providers) {
      if (!providerIsConfigured(p)) continue;
      try {
        const out = await executeWithProvider(type, p, parsed.data);
        const validated = outputSchema.safeParse(out);
        if (!validated.success) {
          throw new Error(`Output schema invalid: ${validated.error.issues.map((i) => i.message).join("; ")}`);
        }
        finalOut = validated.data as AnyOut;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    if (!finalOut) {
      callbacks.onNodeStatus?.(node.id, "failed", { error: lastError ?? "All providers failed" });
      continue;
    }

    outputs.set(node.id, finalOut);
    const resultText =
      finalOut.type === "text"
        ? finalOut.text
        : finalOut.type === "image"
          ? finalOut.image.url
          : finalOut.type === "video"
            ? finalOut.video.url
            : finalOut.audio.url;

    callbacks.onNodeResult?.(node.id, resultText, finalOut);
    callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
  }
}



