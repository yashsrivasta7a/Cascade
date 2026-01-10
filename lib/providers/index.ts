export * from "./types";
export { falProvider, FAL_MODELS, type FalModelId } from "./fal";
export { openRouterProvider, type OpenRouterRequest, type OpenRouterResponse } from "./openrouter";
export {
  executeWithFallback,
  createProviderMap,
  type ProviderExecutor,
  type ProviderExecutorMap,
  type FallbackExecutionResult,
  type FallbackExecutionOptions,
} from "./fallback";
export {
  isTransloaditConfigured,
  uploadFromUrl,
  uploadFromBase64,
  uploadMedia,
  persistNodeOutput,
} from "./transloadit";

import { falProvider } from "./fal";
import { openRouterProvider } from "./openrouter";
import type { AIProvider, ProviderId } from "./types";

// Provider registry
const providers: Record<ProviderId, AIProvider> = {
  fal: falProvider,
  openrouter: openRouterProvider,
  // Internal and mock don't have external API calls
  internal: {
    id: "internal",
    name: "Internal",
    isConfigured: () => true,
    submitJob: async () => ({ jobId: "internal", status: "processing" }),
    parseWebhookPayload: () => { throw new Error("Internal provider doesn't use webhooks"); },
  },
  mock: {
    id: "mock",
    name: "Mock",
    isConfigured: () => true,
    submitJob: async () => ({ jobId: "mock", status: "processing" }),
    parseWebhookPayload: () => { throw new Error("Mock provider doesn't use webhooks"); },
  },
};

export function getProvider(id: ProviderId): AIProvider {
  const provider = providers[id];
  if (!provider) {
    throw new Error(`Unknown provider: ${id}`);
  }
  return provider;
}

export function getConfiguredProviders(): ProviderId[] {
  return (Object.keys(providers) as ProviderId[]).filter(
    (id) => providers[id].isConfigured()
  );
}

