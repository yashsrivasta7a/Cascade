import { fal } from "@fal-ai/client";
import dotenv from "dotenv";
import type {
  AIProvider,
  ProviderId,
  ProviderJobSubmission,
  ProviderWebhookPayload,
} from "./types";

dotenv.config({ path: ".env.local" });

// =============================================================================
// FAL.AI PROVIDER
// =============================================================================

// Configure fal.ai client
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

// fal.ai model mappings for our nodes
export const FAL_MODELS = {
  // Image Generation - Seedream 4.5
  seedream: "fal-ai/seedream-4.5",
  
  // Image Upscaling - SeedVR 2
  seedvr: "fal-ai/seed-vr-2",
  
  // Video Generation - Seedance 1.5
  seedance: "fal-ai/seedance-1.5",
  
  // Text-to-Speech - ElevenLabs V3 (via fal.ai)
  elevenlabs: "fal-ai/elevenlabs/v3",
  
  // Lip Sync - Sync
  lipsync: "fal-ai/sync",
} as const;

export type FalModelId = keyof typeof FAL_MODELS;

// fal.ai webhook payload structure
interface FalWebhookPayload {
  request_id: string;
  status: "OK" | "ERROR";
  payload?: unknown;
  error?: string;
}

export class FalProvider implements AIProvider {
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

    // Submit job with webhook
    const result = await fal.queue.submit(params.model, {
      input: params.input,
      webhookUrl: params.webhookUrl,
    });

    return {
      jobId: result.request_id,
      status: "submitted",
    };
  }

  parseWebhookPayload(rawPayload: unknown): ProviderWebhookPayload {
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

// Singleton instance
export const falProvider = new FalProvider();

