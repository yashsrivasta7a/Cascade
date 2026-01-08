import type {
  AIProvider,
  ProviderId,
  ProviderJobSubmission,
  ProviderWebhookPayload,
} from "./types";

// =============================================================================
// OPENROUTER PROVIDER (for LLM/Vision)
// =============================================================================

// OpenRouter doesn't use webhooks - it's synchronous
// But we wrap it in the same interface for consistency

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterResponse {
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

export class OpenRouterProvider implements AIProvider {
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

  parseWebhookPayload(_rawPayload: unknown): ProviderWebhookPayload {
    // OpenRouter doesn't use webhooks
    throw new Error("OpenRouter does not support webhooks");
  }

  // Synchronous execution for OpenRouter
  async executeSync(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    if (!this.isConfigured()) {
      throw new Error("OpenRouter is not configured. Set OPENROUTER_API_KEY environment variable.");
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.WEBHOOK_BASE_URL ?? "http://localhost:3000",
        "X-Title": "Flowsmith",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<OpenRouterResponse>;
  }
}

// Singleton instance
export const openRouterProvider = new OpenRouterProvider();

