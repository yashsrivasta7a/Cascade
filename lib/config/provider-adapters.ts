import { fal } from "@fal-ai/client";
import type {
  ProviderId,
  ProviderAdapter,
  ProviderJobSubmission,
  ProviderWebhookResult,
  ProviderNodeConfig,
} from "./types";
import { transformInputForProvider, transformOutputFromProvider } from "./types";

// =============================================================================
// FAL.AI ADAPTER
// =============================================================================

// Configure fal.ai client
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

interface FalWebhookPayload {
  request_id: string;
  status: "OK" | "ERROR";
  payload?: unknown;
  error?: string;
}

class FalAdapter implements ProviderAdapter {
  id: ProviderId = "fal";
  name = "fal.ai";

  isConfigured(): boolean {
    return Boolean(process.env.FAL_KEY);
  }

  async submitJob(params: {
    model: string;
    input: Record<string, unknown>;
    webhookUrl: string;
  }): Promise<ProviderJobSubmission> {
    if (!this.isConfigured()) {
      throw new Error("fal.ai is not configured. Set FAL_KEY environment variable.");
    }

    const result = await fal.queue.submit(params.model, {
      input: params.input,
      webhookUrl: params.webhookUrl,
    });

    return {
      jobId: result.request_id,
      status: "submitted",
    };
  }

  parseWebhookPayload(rawPayload: unknown): ProviderWebhookResult {
    const payload = rawPayload as FalWebhookPayload;

    return {
      requestId: payload.request_id,
      status: payload.status === "OK" ? "completed" : "failed",
      result: payload.payload,
      error: payload.error,
    };
  }

  // Helper: Get result for a completed job (if webhook wasn't used)
  async getResult(requestId: string, model: string): Promise<unknown> {
    const result = await fal.queue.result(model, { requestId });
    return result.data;
  }

  // Helper: Check job status
  async getStatus(requestId: string, model: string): Promise<{
    status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
    position?: number;
  }> {
    const status = await fal.queue.status(model, { requestId, logs: false });
    return {
      status: status.status,
      position: "queue_position" in status ? (status as { queue_position?: number }).queue_position : undefined,
    };
  }
}

// =============================================================================
// OPENROUTER ADAPTER
// =============================================================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class OpenRouterAdapter implements ProviderAdapter {
  id: ProviderId = "openrouter";
  name = "OpenRouter";

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  // OpenRouter is synchronous, so we execute directly and return a "completed" job
  async submitJob(params: {
    model: string;
    input: Record<string, unknown>;
    webhookUrl: string;
  }): Promise<ProviderJobSubmission> {
    if (!this.isConfigured()) {
      throw new Error("OpenRouter is not configured. Set OPENROUTER_API_KEY environment variable.");
    }

    // For OpenRouter, we execute synchronously in the task itself
    // This method just returns a stub - actual execution happens in executeSync
    const jobId = `openrouter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    return {
      jobId,
      status: "processing",
    };
  }

  parseWebhookPayload(_rawPayload: unknown): ProviderWebhookResult {
    // OpenRouter doesn't use webhooks
    throw new Error("OpenRouter does not support webhooks");
  }

  // Synchronous execution for OpenRouter
  async executeSync(params: {
    model: string;
    input: Record<string, unknown>;
  }): Promise<unknown> {
    if (!this.isConfigured()) {
      throw new Error("OpenRouter is not configured. Set OPENROUTER_API_KEY environment variable.");
    }

    // Build messages from input
    const messages: OpenRouterMessage[] = [];
    
    if (params.input.systemPrompt) {
      messages.push({
        role: "system",
        content: params.input.systemPrompt as string,
      });
    }

    // Build user message content
    let userContent: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
    const prompt = params.input.prompt as string;
    const context = params.input.context as string | undefined;
    
    // Handle imageUrl as either string or object {url, mimeType}
    const rawImageUrl = params.input.imageUrl;
    let imageUrl: string | undefined;
    if (rawImageUrl) {
      if (typeof rawImageUrl === "string") {
        imageUrl = rawImageUrl;
      } else if (typeof rawImageUrl === "object" && rawImageUrl !== null && "url" in rawImageUrl) {
        imageUrl = (rawImageUrl as { url: string }).url;
      }
    }

    if (imageUrl) {
      // Vision request with image
      userContent = [
        { type: "text", text: prompt },
      ];
      if (context) {
        userContent.push({ type: "text", text: `\n\nContext: ${context}` });
      }
      userContent.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    } else {
      // Text-only request
      userContent = context ? `${prompt}\n\nContext: ${context}` : prompt;
    }

    messages.push({
      role: "user",
      content: userContent,
    });

    const request: OpenRouterRequest = {
      model: params.model,
      messages,
      temperature: params.input.temperature as number | undefined,
      max_tokens: params.input.maxTokens as number | undefined,
    };

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.WEBHOOK_BASE_URL ?? "http://localhost:3000",
        "X-Title": "Cascade",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const result = await response.json() as OpenRouterResponse;
    
    // Return in standardized format
    return {
      text: result.choices[0]?.message?.content ?? "",
      usage: result.usage,
    };
  }
}

// =============================================================================
// INTERNAL ADAPTER (for utility nodes using Transloadit/FFmpeg)
// =============================================================================

class InternalAdapter implements ProviderAdapter {
  id: ProviderId = "internal";
  name = "Internal";

  isConfigured(): boolean {
    // Internal provider is always available
    return true;
  }

  async submitJob(params: {
    model: string;
    input: Record<string, unknown>;
    webhookUrl: string;
  }): Promise<ProviderJobSubmission> {
    const jobId = `internal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    return {
      jobId,
      status: "processing",
    };
  }

  parseWebhookPayload(_rawPayload: unknown): ProviderWebhookResult {
    throw new Error("Internal provider doesn't use webhooks");
  }

  // Internal operations are handled directly by the executor
  async executeSync(params: {
    model: string;
    input: Record<string, unknown>;
  }): Promise<unknown> {
    // This will be overridden by specific internal handlers
    return params.input;
  }
}

// =============================================================================
// MOCK ADAPTER (for testing without real API calls)
// =============================================================================

class MockAdapter implements ProviderAdapter {
  id: ProviderId = "mock";
  name = "Mock";

  isConfigured(): boolean {
    return true;
  }

  async submitJob(_params: {
    model: string;
    input: Record<string, unknown>;
    webhookUrl: string;
  }): Promise<ProviderJobSubmission> {
    const jobId = `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    return {
      jobId,
      status: "processing",
    };
  }

  parseWebhookPayload(_rawPayload: unknown): ProviderWebhookResult {
    throw new Error("Mock provider doesn't use webhooks");
  }

  async executeSync(_params: {
    model: string;
    input: Record<string, unknown>;
  }): Promise<unknown> {
    // Mock response - will be overridden by node config's mockResponse
    return { mock: true };
  }
}

// =============================================================================
// PROVIDER REGISTRY
// =============================================================================

// Singleton instances
const falAdapter = new FalAdapter();
const openRouterAdapter = new OpenRouterAdapter();
const internalAdapter = new InternalAdapter();
const mockAdapter = new MockAdapter();

const providerAdapters: Record<ProviderId, ProviderAdapter> = {
  fal: falAdapter,
  openrouter: openRouterAdapter,
  internal: internalAdapter,
  mock: mockAdapter,
};

/**
 * Get provider adapter by ID
 */
export function getProviderAdapter(id: ProviderId): ProviderAdapter {
  const adapter = providerAdapters[id];
  if (!adapter) {
    throw new Error(`Unknown provider: ${id}`);
  }
  return adapter;
}

/**
 * Get all configured provider adapters
 */
export function getConfiguredProviders(): ProviderId[] {
  return (Object.keys(providerAdapters) as ProviderId[]).filter(
    (id) => providerAdapters[id].isConfigured()
  );
}

/**
 * Execute with a specific provider using the node's provider config
 */
export async function executeWithProvider(
  providerConfig: ProviderNodeConfig,
  input: Record<string, unknown>,
  webhookUrl: string
): Promise<{
  jobId: string;
  transformedInput: Record<string, unknown>;
}> {
  const adapter = getProviderAdapter(providerConfig.id);
  
  // Transform input using the provider's mapping
  const transformedInput = transformInputForProvider(input, providerConfig.inputMapping);
  
  // Submit job
  const submission = await adapter.submitJob({
    model: providerConfig.model,
    input: transformedInput,
    webhookUrl,
  });
  
  return {
    jobId: submission.jobId,
    transformedInput,
  };
}

/**
 * Execute synchronously with a provider (for providers that support it)
 */
export async function executeSyncWithProvider(
  providerConfig: ProviderNodeConfig,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const adapter = getProviderAdapter(providerConfig.id);
  
  if (!("executeSync" in adapter) || typeof (adapter as { executeSync?: unknown }).executeSync !== "function") {
    throw new Error(`Provider ${providerConfig.id} does not support synchronous execution`);
  }
  
  // Transform input using the provider's mapping
  const transformedInput = transformInputForProvider(input, providerConfig.inputMapping);
  
  // Execute synchronously
  const response = await (adapter as ProviderAdapter & { executeSync: (params: { model: string; input: Record<string, unknown> }) => Promise<unknown> }).executeSync({
    model: providerConfig.model,
    input: transformedInput,
  });
  
  // Transform output using the provider's mapping
  const transformedOutput = transformOutputFromProvider(response, providerConfig.outputMapping);
  
  return transformedOutput;
}

/**
 * Transform provider webhook response to standardized output
 */
export function transformWebhookResponse(
  providerConfig: ProviderNodeConfig,
  webhookPayload: unknown
): {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
} {
  const adapter = getProviderAdapter(providerConfig.id);
  
  try {
    const parsed = adapter.parseWebhookPayload(webhookPayload);
    
    if (parsed.status === "failed") {
      return {
        success: false,
        error: parsed.error || "Provider execution failed",
      };
    }
    
    // Transform output using the provider's mapping
    const transformedOutput = transformOutputFromProvider(parsed.result, providerConfig.outputMapping);
    
    return {
      success: true,
      result: transformedOutput,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Export adapters for direct access if needed
export { falAdapter, openRouterAdapter, internalAdapter, mockAdapter };

// Export types
export type { OpenRouterMessage, OpenRouterRequest, OpenRouterResponse };
