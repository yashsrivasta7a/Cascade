import { z } from "zod";

// =============================================================================
// NODE CATEGORIES & COLORS
// =============================================================================

export type NodeCategory = "image" | "video" | "audio" | "llm" | "utility" | "io";

export type NodeColor = "emerald" | "violet" | "amber" | "blue" | "zinc" | "teal";

// Category to color mapping
export const CATEGORY_COLORS: Record<NodeCategory, NodeColor> = {
  image: "emerald",
  video: "violet",
  audio: "teal",
  llm: "blue",
  utility: "amber",
  io: "zinc",
};

// =============================================================================
// PROVIDER TYPES
// =============================================================================

export type ProviderId = "fal" | "openrouter" | "internal" | "mock";

// Field mapping: how to transform from your schema to provider's schema
export type FieldMapping = 
  | string  // Direct rename: "prompt" -> "prompt" or "aspectRatio" -> "aspect_ratio"
  | {
      field: string;                    // Target field name
      transform?: TransformId;          // Optional transform function
      nested?: boolean;                 // Whether to nest under "input" object
    };

// Built-in transform functions
export type TransformId =
  | "durationToSeconds"      // "4s" -> 4
  | "durationToFrames"       // "4s" -> 120
  | "aspectRatioSnakeCase"   // "16:9" -> "16:9" (already valid for most)
  | "aspectRatioWithX"       // "16:9" -> "16x9"
  | "scaleToNumber"          // "2x" -> 2
  | "booleanToNumber"        // true -> 1, false -> 0
  | "identity";              // No transform

// Provider configuration for a specific node
export interface ProviderNodeConfig {
  id: ProviderId;
  model: string;                                    // e.g., "fal-ai/seedance-1.5"
  inputMapping: Record<string, FieldMapping>;       // Your field -> provider field
  outputMapping: Record<string, string>;            // Provider response path -> your output path
  // Optional overrides
  syncMode?: boolean;                               // Some providers support sync execution
  webhookPath?: string;                             // Custom webhook path if needed
}

// =============================================================================
// UI FIELD TYPES
// =============================================================================

export type FieldType = 
  | "textarea"    // Multi-line text input
  | "text"        // Single-line text input
  | "select"      // Dropdown with options
  | "file"        // File upload with drag-drop
  | "number"      // Numeric input
  | "slider"      // Range slider
  | "toggle"      // Boolean checkbox/switch
  | "hidden";     // Hidden field (for internal use)

// Base field configuration
interface BaseFieldConfig {
  id: string;                           // Field ID (matches schema key)
  type: FieldType;                      // Field type
  label: string;                        // Display label
  description?: string;                 // Help text
  required?: boolean;                   // Is field required
  advanced?: boolean;                   // Show in advanced settings panel
  defaultValue?: unknown;               // Default value
  placeholder?: string;                 // Placeholder text
  disabled?: boolean;                   // Disable field
  // Conditional display based on other field values
  showWhen?: {
    field: string;
    value: unknown;
  };
}

// Text/Textarea specific config
export interface TextFieldConfig extends BaseFieldConfig {
  type: "textarea" | "text";
  rows?: number;                        // For textarea
  maxLength?: number;                   // Character limit
  minLength?: number;                   // Minimum characters
}

// Select specific config
export interface SelectFieldConfig extends BaseFieldConfig {
  type: "select";
  options: Array<{
    value: string;
    label: string;
  }> | string[];                        // Simple string array or value/label pairs
  multiple?: boolean;                   // Allow multiple selection
}

// File upload specific config
export interface FileFieldConfig extends BaseFieldConfig {
  type: "file";
  accept?: string;                      // MIME types: "image/*", "video/*", "audio/*"
  maxSize?: number;                     // Max file size in bytes
  preview?: boolean;                    // Show preview after upload
}

// Number specific config
export interface NumberFieldConfig extends BaseFieldConfig {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

// Slider specific config
export interface SliderFieldConfig extends BaseFieldConfig {
  type: "slider";
  min: number;
  max: number;
  step?: number;
  showValue?: boolean;                  // Display current value
}

// Toggle specific config
export interface ToggleFieldConfig extends BaseFieldConfig {
  type: "toggle";
}

// Hidden field config
export interface HiddenFieldConfig extends BaseFieldConfig {
  type: "hidden";
}

// Union type for all field configs
export type FieldConfig =
  | TextFieldConfig
  | SelectFieldConfig
  | FileFieldConfig
  | NumberFieldConfig
  | SliderFieldConfig
  | ToggleFieldConfig
  | HiddenFieldConfig;

// =============================================================================
// OUTPUT DISPLAY TYPES
// =============================================================================

export type OutputType = "image" | "video" | "audio" | "text";

export interface OutputConfig {
  id: string;                           // Output ID
  type: OutputType;                     // Output type for display
  label: string;                        // Display label
}

// =============================================================================
// EXECUTION CONFIGURATION
// =============================================================================

export interface ExecutionConfig {
  timeout: string;                      // e.g., "5m", "10m"
  retryPerProvider: number;             // Retries before trying next provider
  maxRetries: number;                   // Total retries across all providers
}

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  timeout: "5m",
  retryPerProvider: 2,
  maxRetries: 3,
};

// =============================================================================
// MAIN NODE CONFIGURATION
// =============================================================================

export interface NodeConfig {
  // Identity
  type: string;                         // Unique node type ID
  version: string;                      // Semantic version
  category: NodeCategory;               // Category for grouping
  label: string;                        // Display name
  description: string;                  // Short description
  color: NodeColor;                     // Theme color
  
  // Providers (order = priority for fallback)
  providers: ProviderNodeConfig[];
  
  // Schemas (Zod for validation)
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  
  // Result parser function name (maps provider response to output schema)
  resultParser?: string;
  
  // Execution settings
  execution: ExecutionConfig;
  
  // UI configuration
  ui: {
    inputs: FieldConfig[];              // Form fields
    outputs: OutputConfig[];            // Result display
    layout?: "horizontal" | "vertical"; // Layout style
  };
  
  // Metadata
  estimatedCost: number;                // Credits (microdollars)
  estimatedTime: string;                // e.g., "~30s"
  features?: string[];                  // Feature list for hover cards
  
  // Mock response generator (for testing without API)
  mockResponse?: (input: unknown) => unknown;
}

// =============================================================================
// PROVIDER ADAPTER INTERFACE
// =============================================================================

export interface ProviderJobSubmission {
  jobId: string;
  status: "submitted" | "processing";
  estimatedDurationMs?: number;
}

export interface ProviderWebhookResult {
  requestId: string;
  status: "completed" | "failed";
  result?: unknown;
  error?: string;
  cost?: number;
}

export interface ProviderAdapter {
  id: ProviderId;
  name: string;
  
  // Check if provider is configured (has API keys)
  isConfigured(): boolean;
  
  // Submit async job with webhook callback
  submitJob(params: {
    model: string;
    input: Record<string, unknown>;
    webhookUrl: string;
  }): Promise<ProviderJobSubmission>;
  
  // Parse incoming webhook payload
  parseWebhookPayload(rawPayload: unknown): ProviderWebhookResult;
  
  // Optional: Execute synchronously (for providers that support it)
  executeSync?(params: {
    model: string;
    input: Record<string, unknown>;
  }): Promise<unknown>;
}

// =============================================================================
// NODE REGISTRY TYPES
// =============================================================================

export interface NodeConfigRegistry {
  [nodeType: string]: NodeConfig;
}

// =============================================================================
// TRANSFORM FUNCTIONS REGISTRY
// =============================================================================

export const TRANSFORMS: Record<TransformId, (value: unknown) => unknown> = {
  durationToSeconds: (val) => {
    const map: Record<string, number> = { "4s": 4, "8s": 8, "16s": 16 };
    return map[val as string] ?? 4;
  },
  durationToFrames: (val) => {
    const map: Record<string, number> = { "4s": 120, "8s": 240, "16s": 480 };
    return map[val as string] ?? 120;
  },
  aspectRatioSnakeCase: (val) => val,
  aspectRatioWithX: (val) => (val as string).replace(":", "x"),
  scaleToNumber: (val) => parseInt((val as string).replace("x", ""), 10),
  booleanToNumber: (val) => (val ? 1 : 0),
  identity: (val) => val,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Apply field mapping transformation
 */
export function applyFieldMapping(
  value: unknown,
  mapping: FieldMapping
): { field: string; value: unknown } {
  if (typeof mapping === "string") {
    return { field: mapping, value };
  }
  
  const transform = mapping.transform ? TRANSFORMS[mapping.transform] : TRANSFORMS.identity;
  return {
    field: mapping.field,
    value: transform(value),
  };
}

/**
 * Transform input using provider's input mapping
 */
export function transformInputForProvider(
  input: Record<string, unknown>,
  mapping: Record<string, FieldMapping>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [sourceKey, sourceValue] of Object.entries(input)) {
    const fieldMapping = mapping[sourceKey];
    if (!fieldMapping) {
      // Pass through unmapped fields
      result[sourceKey] = sourceValue;
      continue;
    }
    
    const { field, value } = applyFieldMapping(sourceValue, fieldMapping);
    
    // Handle nested paths like "input.prompt"
    if (field.includes(".")) {
      const parts = field.split(".");
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = current[parts[i]] || {};
        current = current[parts[i]] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = value;
    } else {
      result[field] = value;
    }
  }
  
  return result;
}

/**
 * Extract value from nested path like "payload.video.url"
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    // Handle array access like "output[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  
  return current;
}

/**
 * Transform provider response using output mapping
 */
export function transformOutputFromProvider(
  response: unknown,
  mapping: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [targetKey, sourcePath] of Object.entries(mapping)) {
    const value = getNestedValue(response, sourcePath);
    
    // Handle nested target paths
    if (targetKey.includes(".")) {
      const parts = targetKey.split(".");
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = current[parts[i]] || {};
        current = current[parts[i]] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = value;
    } else {
      result[targetKey] = value;
    }
  }
  
  return result;
}
