import { type AINodeType } from "@/types/nodes";
import {
  NodePrimaryOutputType,
  type ProviderId,
  type AnyOut,
} from "./node-schemas";
import { preprocessInputForAPI } from "./media-upload";
import { TRIGGER_NODE_TYPES, LOCAL_NODE_TYPES } from "./node-utils";

// =============================================================================
// TYPES
// =============================================================================

export interface ExecutionContext {
  workflowId?: string;
  nodeId?: string;
  nodeLabel?: string;
}

// =============================================================================
// PROVIDER CONFIGURATION
// =============================================================================

export function providerIsConfigured(_provider: ProviderId): boolean {
  // Allow all providers - we'll call real APIs
  return true;
}

// =============================================================================
// POLLING
// =============================================================================

/**
 * Poll for node completion status
 */
export async function pollNodeStatus(
  nodeId: string, 
  timeoutMs: number = 300000
): Promise<{ status: string; output?: unknown; error?: string }> {
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

// =============================================================================
// PROVIDER EXECUTION
// =============================================================================

/**
 * Execute a node with the given provider
 */
export async function executeWithProvider(
  type: AINodeType, 
  provider: ProviderId, 
  input: unknown, 
  context?: ExecutionContext
): Promise<AnyOut> {
  void provider;
  
  console.log(`[executeWithProvider] Executing ${type} with provider ${provider}`);

  // LOCAL utility nodes - run via sync API (no network overhead for large data)
  if (LOCAL_NODE_TYPES.includes(type)) {
    return executeLocalNode(type, input, context);
  }

  // AI nodes go through Trigger.dev
  if (TRIGGER_NODE_TYPES.includes(type)) {
    return executeTriggerNode(type, input, context);
  }

  // OpenRouter fallback for streaming LLM
  const outType = NodePrimaryOutputType[type];
  if (type === "openrouter" && outType === "text") {
    return executeOpenRouterStream(input);
  }

  // Unsupported node type
  throw new Error(`Node type "${type}" is not supported for execution.`);
}

// =============================================================================
// LOCAL NODE EXECUTION
// =============================================================================

async function executeLocalNode(
  type: AINodeType, 
  input: unknown, 
  context?: ExecutionContext
): Promise<AnyOut> {
  try {
    console.log(`[executeWithProvider] Calling sync API for LOCAL node: ${type}`);
    
    const processedInput = await preprocessInputForAPI(input);
    
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

// =============================================================================
// TRIGGER.DEV NODE EXECUTION
// =============================================================================

async function executeTriggerNode(
  type: AINodeType, 
  input: unknown, 
  context?: ExecutionContext
): Promise<AnyOut> {
  try {
    console.log(`[executeWithProvider] Calling Trigger.dev API for ${type}`);
    
    const processedInput = await preprocessInputForAPI(input);
    const nodeId = context?.nodeId || 
      (processedInput as { nodeId?: string })?.nodeId || 
      `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const response = await fetch("/api/nodes/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeType: type,
        input: { ...processedInput as object, nodeId },
        workflowId: context?.workflowId,
        nodeId,
        nodeLabel: context?.nodeLabel,
      }),
    });

    const triggerResult = await response.json();

    if (triggerResult.status === "error") {
      throw new Error(triggerResult.error || `${type} execution failed to start`);
    }

    console.log(`[executeWithProvider] ${type} triggered via Trigger.dev, polling...`);
    
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

// =============================================================================
// OPENROUTER STREAMING EXECUTION
// =============================================================================

async function executeOpenRouterStream(input: unknown): Promise<AnyOut> {
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

  console.log(`[executeWithProvider] OpenRouter call - prompt: "${prompt.slice(0, 50)}..."`);

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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "LLM API error");
    }

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

    console.log(`[executeWithProvider] OpenRouter completed. Length: ${fullText.length}`);
    return { type: "text", text: fullText };
  } catch (error) {
    console.error(`[executeWithProvider] LLM execution error:`, error);
    throw new Error(`LLM execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
