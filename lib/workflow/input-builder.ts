import type { Edge, Node } from "reactflow";
import { type AINodeType } from "@/types/nodes";
import { parseLLMToFieldValue, canFieldAcceptLLMInput } from "./llm-type-parser";
import type { AnyOut } from "./node-schemas";

export type OutputByNode = Map<string, AnyOut>;

// =============================================================================
// TEXT INPUT HELPERS
// =============================================================================

/**
 * Get incoming text for context (includes history)
 */
export function getIncomingTextForContext(
  edges: Edge[], 
  outputs: OutputByNode, 
  nodeId: string, 
  nodes: Node[]
): string | undefined {
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

/**
 * Get incoming text for prompt (just the response, no history)
 */
export function getIncomingTextForPrompt(
  edges: Edge[], 
  outputs: OutputByNode, 
  nodeId: string
): string | undefined {
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

// =============================================================================
// MEDIA INPUT HELPERS
// =============================================================================

/**
 * Get incoming media (video/audio/image) from connected nodes
 */
export function getIncomingMedia(
  edges: Edge[], 
  outputs: OutputByNode, 
  nodeId: string, 
  targetHandle?: string
): string | undefined {
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

// =============================================================================
// LLM SETTINGS HELPERS
// =============================================================================

/**
 * Get parsed settings values from connected LLM nodes.
 * When an LLM node is connected to any settings handle,
 * this function parses the LLM text output to the expected type.
 * 
 * Supports ALL field types: select, slider, number, toggle, text, textarea
 */
export function getIncomingSettingsFromLLM(
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

// =============================================================================
// OUTPUT PREVIEW HELPERS
// =============================================================================

export function getNodeOutputPreviewFromData(node: Node): string | undefined {
  const d = (node.data ?? {}) as Record<string, unknown>;
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
    if (v && typeof v === "object" && typeof (v as Record<string, unknown>).url === "string") {
      const u = String((v as Record<string, unknown>).url).trim();
      if (u) return u.slice(0, 2000);
    }
  }

  return undefined;
}

export function getConnectedPreviewFromLastOutputs(
  nodes: Node[], 
  edges: Edge[], 
  nodeId: string
): string | undefined {
  const incoming = edges.filter((e) => e.target === nodeId);
  for (const e of incoming) {
    const source = nodes.find((n) => n.id === e.source);
    if (!source) continue;
    const preview = getNodeOutputPreviewFromData(source);
    if (preview) return preview;
  }
  return undefined;
}
