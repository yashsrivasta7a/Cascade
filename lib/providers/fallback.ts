import type { ProviderId } from "./types";
import type { NodeExecutionContext, NodeExecutionResult, NodeExecutionConfig } from "@/lib/engine/types";

// =============================================================================
// PROVIDER FALLBACK CHAIN
// =============================================================================

/**
 * Provider execution function type
 * Each provider implements this interface for a specific node type
 */
export type ProviderExecutor<TInput = unknown> = (
  input: TInput,
  context: NodeExecutionContext
) => Promise<NodeExecutionResult>;

/**
 * Map of provider implementations for a node type
 * Example: { fal: async (input) => {...}, replicate: async (input) => {...} }
 */
export type ProviderExecutorMap<TInput = unknown> = Partial<
  Record<ProviderId, ProviderExecutor<TInput>>
>;

/**
 * Result of a fallback chain execution
 */
export interface FallbackExecutionResult extends NodeExecutionResult {
  /** Which providers were tried before success/failure */
  attemptedProviders: ProviderId[];
  /** Errors from each failed provider */
  providerErrors: Record<ProviderId, string>;
}

/**
 * Options for fallback execution
 */
export interface FallbackExecutionOptions {
  /** Config from the node (timeout, retries) */
  config: NodeExecutionConfig;
  /** Ordered list of providers to try */
  providerOrder: ProviderId[];
  /** Map of provider implementations */
  providers: ProviderExecutorMap;
  /** Context for the execution */
  context: NodeExecutionContext;
  /** Log function for debugging */
  log?: (message: string) => void;
}

/**
 * Execute with provider fallback chain
 * 
 * Tries each provider in order:
 * 1. Attempt provider with retryPerProvider retries
 * 2. If all retries fail, move to next provider
 * 3. If all providers fail, throw error with details
 * 
 * @example
 * ```typescript
 * const result = await executeWithFallback(input, {
 *   config: { timeout: "2m", retryPerProvider: 2, maxRetries: 3 },
 *   providerOrder: ["fal", "replicate", "mock"],
 *   providers: {
 *     fal: async (input, ctx) => { ... },
 *     replicate: async (input, ctx) => { ... },
 *     mock: async (input, ctx) => { ... },
 *   },
 *   context: executionContext,
 * });
 * ```
 */
export async function executeWithFallback<TInput>(
  input: TInput,
  options: FallbackExecutionOptions
): Promise<FallbackExecutionResult> {
  const { config, providerOrder, providers, context, log } = options;
  
  const attemptedProviders: ProviderId[] = [];
  const providerErrors: Record<ProviderId, string> = {};
  
  let totalAttempts = 0;
  
  // Try each provider in order
  for (const providerId of providerOrder) {
    const providerExecutor = providers[providerId];
    
    // Skip if this provider isn't implemented
    if (!providerExecutor) {
      log?.(`[Fallback] Provider ${providerId} not implemented, skipping`);
      continue;
    }
    
    attemptedProviders.push(providerId);
    
    // Try this provider with retries
    for (let retry = 0; retry < config.retryPerProvider; retry++) {
      totalAttempts++;
      
      // Check if we've exceeded max total retries
      if (totalAttempts > config.maxRetries) {
        log?.(`[Fallback] Max retries (${config.maxRetries}) exceeded`);
        break;
      }
      
      log?.(`[Fallback] Trying ${providerId} (attempt ${retry + 1}/${config.retryPerProvider})`);
      
      try {
        // Execute with this provider
        const result = await providerExecutor(input, {
          ...context,
          attempt: totalAttempts,
        });
        
        if (result.success) {
          log?.(`[Fallback] ${providerId} succeeded`);
          return {
            ...result,
            providerUsed: providerId,
            attemptedProviders,
            providerErrors,
          };
        }
        
        // Provider returned failure (not thrown)
        const errorMsg = result.error ?? "Unknown error";
        providerErrors[providerId] = errorMsg;
        log?.(`[Fallback] ${providerId} returned error: ${errorMsg}`);
        
      } catch (error) {
        // Provider threw an exception
        const errorMsg = error instanceof Error ? error.message : String(error);
        providerErrors[providerId] = errorMsg;
        log?.(`[Fallback] ${providerId} threw: ${errorMsg}`);
      }
    }
    
    // All retries for this provider failed, try next
    log?.(`[Fallback] ${providerId} exhausted all retries, trying next provider`);
  }
  
  // All providers failed
  const allErrors = Object.entries(providerErrors)
    .map(([p, e]) => `${p}: ${e}`)
    .join("; ");
    
  return {
    success: false,
    error: `All providers failed. ${allErrors}`,
    attemptedProviders,
    providerErrors,
  };
}

/**
 * Create a provider executor map for a node type
 * 
 * @example
 * ```typescript
 * const imageGenProviders = createProviderMap({
 *   fal: async (input, ctx) => {
 *     // fal.ai implementation
 *     return { success: true, output: { ... } };
 *   },
 *   mock: async (input, ctx) => {
 *     // Mock implementation for testing
 *     return { success: true, output: { type: "image", ... } };
 *   },
 * });
 * ```
 */
export function createProviderMap<TInput>(
  map: ProviderExecutorMap<TInput>
): ProviderExecutorMap<TInput> {
  return map;
}


