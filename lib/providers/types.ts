import { z } from "zod";

// =============================================================================
// PROVIDER TYPES
// =============================================================================

export type ProviderId = "fal" | "openrouter" | "internal" | "mock";

export interface ProviderJobSubmission {
  jobId: string;
  status: "submitted" | "processing";
  estimatedDurationMs?: number;
}

export interface ProviderJobResult {
  success: boolean;
  data?: unknown;
  error?: string;
  cost?: number;
}

// Webhook payload that providers send back
export const ProviderWebhookPayloadSchema = z.object({
  requestId: z.string(),
  status: z.enum(["completed", "failed"]),
  result: z.unknown().optional(),
  error: z.string().optional(),
  cost: z.number().optional(),
});

export type ProviderWebhookPayload = z.infer<typeof ProviderWebhookPayloadSchema>;

// Base provider interface for all AI providers
export interface AIProvider {
  id: ProviderId;
  name: string;

  // Submit a job asynchronously with webhook callback
  submitJob(params: {
    model: string;
    input: Record<string, unknown>;
    webhookUrl: string;
  }): Promise<ProviderJobSubmission>;

  // Parse webhook payload from this provider
  parseWebhookPayload(rawPayload: unknown): ProviderWebhookPayload;

  // Check if this provider is configured (has API keys)
  isConfigured(): boolean;
}

