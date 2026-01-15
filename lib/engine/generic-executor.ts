import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from "./types";
import type { AINodeType } from "@/types/nodes";
import {
  getNodeConfig,
  getProviderAdapter,
  executeWithProvider,
  executeSyncWithProvider,
} from "@/lib/config";
import type { NodeConfig, ProviderId, ProviderNodeConfig } from "@/lib/config/types";

// =============================================================================
// GENERIC NODE EXECUTOR
// =============================================================================

/**
 * Generic executor that handles any node type based on config
 * This replaces individual node executor files with a single config-driven system
 */
export class GenericNodeExecutor implements NodeExecutor {
  type: AINodeType;
  version: string;
  inputSchema: NodeExecutor["inputSchema"];
  outputSchema: NodeExecutor["outputSchema"];
  providers: ProviderId[];
  config: NodeExecutor["config"];
  
  private nodeConfig: NodeConfig;

  constructor(nodeType: string) {
    const config = getNodeConfig(nodeType);
    if (!config) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }
    
    this.nodeConfig = config;
    this.type = config.type as AINodeType;
    this.version = config.version;
    this.inputSchema = config.inputSchema;
    this.outputSchema = config.outputSchema;
    this.providers = config.providers.map((p) => p.id);
    this.config = config.execution;
  }

  async execute(
    input: unknown,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // Validate input
    const parseResult = this.inputSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`,
      };
    }
    
    const validatedInput = parseResult.data as Record<string, unknown>;
    
    // Add context to prompt if available
    if (validatedInput.context && typeof validatedInput.prompt === "string") {
      validatedInput.prompt = `${validatedInput.prompt}\n\nContext: ${validatedInput.context}`;
    }
    
    // Try each provider in order
    for (const providerConfig of this.nodeConfig.providers) {
      const adapter = getProviderAdapter(providerConfig.id);
      
      // Skip if provider is not configured
      if (!adapter.isConfigured()) {
        console.log(`[${this.type}] Provider ${providerConfig.id} not configured, skipping`);
        continue;
      }
      
      try {
        const result = await this.executeWithSingleProvider(
          providerConfig,
          validatedInput,
          context
        );
        
        if (result.success) {
          return result;
        }
        
        console.log(`[${this.type}] Provider ${providerConfig.id} failed: ${result.error}`);
      } catch (error) {
        console.error(`[${this.type}] Provider ${providerConfig.id} threw error:`, error);
      }
    }
    
    // All providers failed - try mock if available
    if (this.nodeConfig.mockResponse) {
      console.log(`[${this.type}] All providers failed, using mock response`);
      return {
        success: true,
        output: this.nodeConfig.mockResponse(validatedInput),
        providerUsed: "mock",
        actualCost: 0,
      };
    }
    
    return {
      success: false,
      error: `All providers failed for node type: ${this.type}`,
    };
  }

  private async executeWithSingleProvider(
    providerConfig: ProviderNodeConfig,
    input: Record<string, unknown>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const adapter = getProviderAdapter(providerConfig.id);
    
    // Check if this provider supports sync execution
    if (providerConfig.syncMode && "executeSync" in adapter) {
      return this.executeSyncProvider(providerConfig, input);
    }
    
    // Async execution with webhook
    return this.executeAsyncProvider(providerConfig, input, context);
  }

  private async executeSyncProvider(
    providerConfig: ProviderNodeConfig,
    input: Record<string, unknown>
  ): Promise<NodeExecutionResult> {
    try {
      // For internal provider, delegate to the FFmpeg execution code
      if (providerConfig.id === "internal") {
        return this.executeInternalProvider(input);
      }
      
      const result = await executeSyncWithProvider(providerConfig, input);
      
      // Transform to output schema format
      const output = this.transformToOutputFormat(result);
      
      return {
        success: true,
        output,
        providerUsed: providerConfig.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerUsed: providerConfig.id,
      };
    }
  }

  /**
   * Execute internal node types (crop-image, merge-videos, etc.)
   * Delegates to legacy FFmpeg implementations while keeping config-driven approach
   */
  private async executeInternalProvider(
    input: Record<string, unknown>
  ): Promise<NodeExecutionResult> {
    // Dynamically import the legacy executor based on node type
    switch (this.type) {
      case "crop-image": {
        const { cropImageExecutor } = await import("./nodes-legacy/crop-image");
        return cropImageExecutor.execute(input as any, {} as any);
      }
      
      case "merge-audio-video": {
        const { mergeAudioVideoExecutor } = await import("./nodes-legacy/merge-audio-video");
        return mergeAudioVideoExecutor.execute(input as any, {} as any);
      }
      
      case "merge-videos": {
        const { mergeVideosExecutor } = await import("./nodes-legacy/merge-videos");
        return mergeVideosExecutor.execute(input as any, {} as any);
      }
      
      case "extract-audio": {
        const { extractAudioExecutor } = await import("./nodes-legacy/extract-audio");
        return extractAudioExecutor.execute(input as any, {} as any);
      }
      
      default:
        return {
          success: false,
          error: `Unknown internal node type: ${this.type}`,
          providerUsed: "internal",
        };
    }
  }

  private async executeAsyncProvider(
    providerConfig: ProviderNodeConfig,
    input: Record<string, unknown>,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    try {
      const webhookUrl = `${context.webhookBaseUrl}/api/webhooks/fal?nodeExecutionId=${context.nodeExecutionId}`;
      
      const { jobId, transformedInput } = await executeWithProvider(
        providerConfig,
        input,
        webhookUrl
      );
      
      // For async providers, we return success with no output
      // The actual output will be set when the webhook arrives
      return {
        success: true,
        providerUsed: providerConfig.id,
        providerJobId: jobId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerUsed: providerConfig.id,
      };
    }
  }

  private transformToOutputFormat(result: Record<string, unknown>): unknown {
    // Based on node type, construct the output format
    const outputType = this.nodeConfig.ui.outputs[0]?.type;
    
    switch (outputType) {
      case "text":
        return {
          type: "text",
          text: result.text ?? "",
        };
      
      case "image":
        return {
          type: "image",
          image: {
            url: result["image.url"] ?? result.url ?? "",
            mimeType: result["image.mimeType"] ?? result.mimeType,
            width: result["image.width"] ?? result.width,
            height: result["image.height"] ?? result.height,
          },
        };
      
      case "video":
        return {
          type: "video",
          video: {
            url: result["video.url"] ?? result.url ?? "",
            mimeType: result["video.mimeType"] ?? result.mimeType,
            durationMs: result["video.durationMs"] ?? result.durationMs,
          },
        };
      
      case "audio":
        return {
          type: "audio",
          audio: {
            url: result["audio.url"] ?? result.url ?? "",
            mimeType: result["audio.mimeType"] ?? result.mimeType,
            durationMs: result["audio.durationMs"] ?? result.durationMs,
          },
        };
      
      default:
        return result;
    }
  }
}

// =============================================================================
// EXECUTOR FACTORY
// =============================================================================

// Cache for executor instances
const executorCache = new Map<string, GenericNodeExecutor>();

/**
 * Get or create a generic executor for a node type
 */
export function getGenericExecutor(nodeType: string): GenericNodeExecutor {
  let executor = executorCache.get(nodeType);
  
  if (!executor) {
    executor = new GenericNodeExecutor(nodeType);
    executorCache.set(nodeType, executor);
  }
  
  return executor;
}

/**
 * Create executors for all node types in config
 */
export function createAllExecutors(): Map<string, GenericNodeExecutor> {
  const { getAllNodeTypes } = require("@/lib/config");
  const nodeTypes = getAllNodeTypes() as string[];
  
  for (const nodeType of nodeTypes) {
    if (!executorCache.has(nodeType)) {
      executorCache.set(nodeType, new GenericNodeExecutor(nodeType));
    }
  }
  
  return executorCache;
}

/**
 * Execute a node with the generic executor
 */
export async function executeNode(
  nodeType: string,
  input: unknown,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const executor = getGenericExecutor(nodeType);
  return executor.execute(input, context);
}

// =============================================================================
// WEBHOOK RESULT PARSER
// =============================================================================

/**
 * Parse webhook result from a provider and transform to node output format
 */
export function parseWebhookResult(
  nodeType: string,
  providerResult: unknown
): unknown {
  const config = getNodeConfig(nodeType);
  if (!config) {
    throw new Error(`Unknown node type: ${nodeType}`);
  }
  
  // Get the primary provider's output mapping
  const providerConfig = config.providers[0];
  if (!providerConfig) {
    return providerResult;
  }
  
  // Apply output mapping
  const { transformOutputFromProvider } = require("@/lib/config/types");
  const transformed = transformOutputFromProvider(providerResult, providerConfig.outputMapping);
  
  // Construct proper output format
  const outputType = config.ui.outputs[0]?.type;
  
  switch (outputType) {
    case "image":
      return {
        type: "image",
        image: {
          url: transformed["image.url"] ?? transformed.url,
          mimeType: transformed["image.mimeType"] ?? transformed.mimeType,
          width: transformed["image.width"] ?? transformed.width,
          height: transformed["image.height"] ?? transformed.height,
        },
      };
    
    case "video":
      return {
        type: "video",
        video: {
          url: transformed["video.url"] ?? transformed.url,
          mimeType: transformed["video.mimeType"] ?? transformed.mimeType,
          durationMs: transformed["video.durationMs"] ?? transformed.durationMs,
        },
      };
    
    case "audio":
      return {
        type: "audio",
        audio: {
          url: transformed["audio.url"] ?? transformed.url,
          mimeType: transformed["audio.mimeType"] ?? transformed.mimeType,
          durationMs: transformed["audio.durationMs"] ?? transformed.durationMs,
        },
      };
    
    case "text":
      return {
        type: "text",
        text: transformed.text ?? String(providerResult),
      };
    
    default:
      return transformed;
  }
}

// =============================================================================
// INTERNAL NODE HANDLERS
// =============================================================================

/**
 * Execute internal node types (crop-image, merge-videos, etc.)
 * These use local processing instead of external APIs
 */
export async function executeInternalNode(
  nodeType: string,
  input: unknown,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  // For internal nodes, we delegate to the legacy implementations
  // This allows gradual migration while keeping the config-driven approach
  
  switch (nodeType) {
    case "crop-image":
      return executeInternalCropImage(input);
    
    case "merge-audio-video":
      return executeInternalMergeAudioVideo(input);
    
    case "merge-videos":
      return executeInternalMergeVideos(input);
    
    case "extract-audio":
      return executeInternalExtractAudio(input);
    
    default:
      // Fall back to generic executor for non-internal nodes
      return executeNode(nodeType, input, context);
  }
}

// Placeholder implementations - these will import from legacy or be reimplemented
async function executeInternalCropImage(_input: unknown): Promise<NodeExecutionResult> {
  // Import from legacy implementation
  const { cropImageExecutor } = await import("./nodes-legacy/crop-image");
  return cropImageExecutor.execute(_input as any, {} as any);
}

async function executeInternalMergeAudioVideo(_input: unknown): Promise<NodeExecutionResult> {
  const { mergeAudioVideoExecutor } = await import("./nodes-legacy/merge-audio-video");
  return mergeAudioVideoExecutor.execute(_input as any, {} as any);
}

async function executeInternalMergeVideos(_input: unknown): Promise<NodeExecutionResult> {
  const { mergeVideosExecutor } = await import("./nodes-legacy/merge-videos");
  return mergeVideosExecutor.execute(_input as any, {} as any);
}

async function executeInternalExtractAudio(_input: unknown): Promise<NodeExecutionResult> {
  const { extractAudioExecutor } = await import("./nodes-legacy/extract-audio");
  return extractAudioExecutor.execute(_input as any, {} as any);
}

export default GenericNodeExecutor;
