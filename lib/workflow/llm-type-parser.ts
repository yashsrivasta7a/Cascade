import type { DataType, AINodeType } from "@/types/nodes";
import { NODE_CONFIG } from "@/lib/config";

// =============================================================================
// LLM TYPE PARSER
// =============================================================================
//
// Parses LLM text responses to typed values for settings handles.
// Used when OpenRouter output is connected to a settings input.
//
// =============================================================================

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export type ParseResult<T = unknown> =
  | { success: true; value: T }
  | { success: false; error: string };

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

interface NumericConstraint {
  type: "numeric";
  min?: number;
  max?: number;
  integer?: boolean;
}

interface AllowedConstraint {
  type: "allowed";
  values: readonly string[];
}

type Constraint = NumericConstraint | AllowedConstraint;

// -----------------------------------------------------------------------------
// PROVIDER CONSTRAINTS
// -----------------------------------------------------------------------------

/**
 * Provider-specific constraints for each node type's settings.
 * These are based on the actual API limits of fal.ai, ElevenLabs, etc.
 */
const PROVIDER_CONSTRAINTS: Partial<Record<AINodeType, Record<string, Constraint>>> = {
  seedream: {
    aspectRatio: { type: "allowed", values: ["1:1", "16:9", "9:16", "4:3", "3:4"] as const },
    numInferenceSteps: { type: "numeric", min: 1, max: 60, integer: true },
    guidanceScale: { type: "numeric", min: 0, max: 30 },
    seed: { type: "numeric", min: 0, max: 2147483647, integer: true },
  },
  seedvr: {
    scale: { type: "allowed", values: ["2x", "4x"] as const },
  },
  seedance: {
    aspectRatio: { type: "allowed", values: ["16:9", "9:16", "1:1"] as const },
    duration: { type: "allowed", values: ["4s", "8s", "16s"] as const },
    seed: { type: "numeric", min: 0, max: 2147483647, integer: true },
  },
  elevenlabs: {
    stability: { type: "numeric", min: 0, max: 1 },
    clarity: { type: "numeric", min: 0, max: 1 },
  },
  openrouter: {
    temperature: { type: "numeric", min: 0, max: 2 },
    maxTokens: { type: "numeric", min: 1, max: 128000, integer: true },
    topP: { type: "numeric", min: 0, max: 1 },
    frequencyPenalty: { type: "numeric", min: -2, max: 2 },
    presencePenalty: { type: "numeric", min: -2, max: 2 },
  },
  lipsync: {
    model: { type: "allowed", values: ["sync-1.5", "sync-1.6-beta"] as const },
  },
  "crop-image": {
    xPercent: { type: "numeric", min: 0, max: 100 },
    yPercent: { type: "numeric", min: 0, max: 100 },
    widthPercent: { type: "numeric", min: 0, max: 100 },
    heightPercent: { type: "numeric", min: 0, max: 100 },
  },
  "merge-videos": {
    transition: { type: "allowed", values: ["none", "fade", "dissolve"] as const },
    transitionDuration: { type: "numeric", min: 0, max: 2 },
  },
  "extract-audio": {
    format: { type: "allowed", values: ["mp3", "wav", "aac", "ogg"] as const },
    bitrate: { type: "allowed", values: ["128k", "192k", "256k", "320k"] as const },
    sampleRate: { type: "allowed", values: ["22050", "44100", "48000"] as const },
    channels: { type: "allowed", values: ["1", "2"] as const },
  },
};

// -----------------------------------------------------------------------------
// TYPE-SPECIFIC PARSERS
// -----------------------------------------------------------------------------

/**
 * Extract a number from text.
 * Handles integers, decimals, and numbers embedded in sentences.
 */
function parseToNumber(text: string): number | null {
  // Clean the text
  const cleaned = text.trim();
  
  // Try direct parse first (for clean numeric strings)
  const direct = parseFloat(cleaned);
  if (!isNaN(direct) && isFinite(direct)) {
    return direct;
  }
  
  // Extract first number from text (including decimals and negative)
  const match = cleaned.match(/-?\d+\.?\d*/);
  if (match) {
    const num = parseFloat(match[0]);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }
  
  return null;
}

/**
 * Parse text to boolean.
 * Handles various representations: true/false, yes/no, on/off, 1/0
 */
function parseToBoolean(text: string): boolean | null {
  const cleaned = text.trim().toLowerCase();
  
  // Direct matches
  if (["true", "yes", "on", "1", "enable", "enabled"].includes(cleaned)) {
    return true;
  }
  if (["false", "no", "off", "0", "disable", "disabled"].includes(cleaned)) {
    return false;
  }
  
  // Check if text contains these words
  if (/\b(true|yes|enable|enabled)\b/i.test(text)) {
    return true;
  }
  if (/\b(false|no|disable|disabled)\b/i.test(text)) {
    return false;
  }
  
  return null;
}

/**
 * Extract aspect ratio from text.
 * Handles formats like "16:9", "16/9", "16x9"
 */
function parseToAspectRatio(text: string): string | null {
  const cleaned = text.trim();
  
  // Standard aspect ratio patterns
  const patterns = [
    /\b(\d+):(\d+)\b/,      // 16:9
    /\b(\d+)\/(\d+)\b/,     // 16/9
    /\b(\d+)x(\d+)\b/i,     // 16x9
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      // Normalize to colon format
      return `${match[1]}:${match[2]}`;
    }
  }
  
  // Check for common aspect ratio names
  const ratioNames: Record<string, string> = {
    "square": "1:1",
    "portrait": "9:16",
    "landscape": "16:9",
    "widescreen": "16:9",
    "vertical": "9:16",
    "horizontal": "16:9",
  };
  
  const lowerText = cleaned.toLowerCase();
  for (const [name, ratio] of Object.entries(ratioNames)) {
    if (lowerText.includes(name)) {
      return ratio;
    }
  }
  
  return null;
}

/**
 * Extract duration from text.
 * Handles formats like "4s", "8 seconds", "16sec"
 */
function parseToDuration(text: string): string | null {
  const cleaned = text.trim().toLowerCase();
  
  // Match duration patterns
  const match = cleaned.match(/(\d+)\s*(?:s|sec|seconds?)/i);
  if (match) {
    return `${match[1]}s`;
  }
  
  // Check for just a number (assume seconds)
  const numMatch = cleaned.match(/^\d+$/);
  if (numMatch) {
    return `${numMatch[0]}s`;
  }
  
  return null;
}

/**
 * Extract seed value from text.
 * Must be a non-negative integer.
 */
function parseToSeed(text: string): number | null {
  const num = parseToNumber(text);
  if (num !== null && Number.isInteger(num) && num >= 0) {
    return num;
  }
  return null;
}

/**
 * Extract temperature value from text.
 * Must be a number between 0 and 2.
 */
function parseToTemperature(text: string): number | null {
  const num = parseToNumber(text);
  if (num !== null && num >= 0 && num <= 2) {
    return num;
  }
  return null;
}

// -----------------------------------------------------------------------------
// MAIN PARSER FUNCTION
// -----------------------------------------------------------------------------

/**
 * Parse LLM text response to the target data type.
 * 
 * @param text - The raw text from the LLM
 * @param targetType - The expected data type for the target handle
 * @param targetNodeType - The node type receiving the value
 * @param targetHandle - The specific handle/setting ID
 * @returns ParseResult with the parsed value or an error
 */
export function parseLLMToType(
  text: string,
  targetType: DataType,
  targetNodeType: AINodeType,
  targetHandle: string
): ParseResult {
  // Handle empty/null text
  if (!text || text.trim() === "") {
    return { success: false, error: "Empty text cannot be parsed" };
  }

  const trimmedText = text.trim();

  switch (targetType) {
    // Pass-through types (no conversion needed)
    case "text":
    case "prompt":
    case "negative":
    case "model":
      return { success: true, value: trimmedText };

    // Numeric types
    case "number": {
      const num = parseToNumber(trimmedText);
      if (num === null) {
        return { success: false, error: `Could not parse "${trimmedText.slice(0, 50)}" as a number` };
      }
      return { success: true, value: num };
    }

    case "seed": {
      const seed = parseToSeed(trimmedText);
      if (seed === null) {
        return { success: false, error: `Could not parse "${trimmedText.slice(0, 50)}" as a seed (non-negative integer)` };
      }
      return { success: true, value: seed };
    }

    case "temperature": {
      const temp = parseToTemperature(trimmedText);
      if (temp === null) {
        return { success: false, error: `Could not parse "${trimmedText.slice(0, 50)}" as temperature (0-2)` };
      }
      return { success: true, value: temp };
    }

    // Enum-like types
    case "aspectRatio": {
      const ratio = parseToAspectRatio(trimmedText);
      if (ratio === null) {
        return { success: false, error: `Could not parse "${trimmedText.slice(0, 50)}" as aspect ratio (e.g., "16:9")` };
      }
      return { success: true, value: ratio };
    }

    case "duration": {
      const duration = parseToDuration(trimmedText);
      if (duration === null) {
        return { success: false, error: `Could not parse "${trimmedText.slice(0, 50)}" as duration (e.g., "4s", "8s")` };
      }
      return { success: true, value: duration };
    }

    // Boolean type
    case "boolean": {
      const bool = parseToBoolean(trimmedText);
      if (bool === null) {
        return { success: false, error: `Could not parse "${trimmedText.slice(0, 50)}" as boolean (true/false)` };
      }
      return { success: true, value: bool };
    }

    // Media types - these shouldn't be parsed from LLM text
    case "image":
    case "video":
    case "audio":
    case "any":
      return { 
        success: false, 
        error: `Cannot convert LLM text to media type "${targetType}"` 
      };

    default: {
      // Fallback: try to determine from the handle name
      const handleLower = targetHandle.toLowerCase();
      
      if (handleLower.includes("seed")) {
        const seed = parseToSeed(trimmedText);
        if (seed !== null) return { success: true, value: seed };
      }
      
      if (handleLower.includes("aspect") || handleLower.includes("ratio")) {
        const ratio = parseToAspectRatio(trimmedText);
        if (ratio !== null) return { success: true, value: ratio };
      }
      
      if (handleLower.includes("duration") || handleLower.includes("time")) {
        const duration = parseToDuration(trimmedText);
        if (duration !== null) return { success: true, value: duration };
      }
      
      // Default to string pass-through
      return { success: true, value: trimmedText };
    }
  }
}

// -----------------------------------------------------------------------------
// SELECT/ENUM FIELD PARSING
// -----------------------------------------------------------------------------

/**
 * Get allowed values for a select/enum field from node config.
 */
export function getSelectOptions(nodeType: AINodeType, handleId: string): string[] | null {
  const config = NODE_CONFIG[nodeType];
  if (!config?.ui?.inputs) return null;
  
  const field = config.ui.inputs.find((f: { id: string }) => f.id === handleId);
  if (!field || field.type !== "select") return null;
  
  const options = (field as { options?: Array<string | { value: string }> }).options;
  if (!options) return null;
  
  return options.map((opt: string | { value: string }) => 
    typeof opt === "string" ? opt : opt.value
  );
}

/**
 * Parse LLM text to match a select/enum field's allowed values.
 * Performs case-insensitive matching and partial matching.
 */
export function parseToSelectValue(text: string, allowedValues: string[]): string | null {
  const cleaned = text.trim().toLowerCase();
  
  // Try exact match (case-insensitive)
  for (const value of allowedValues) {
    if (value.toLowerCase() === cleaned) {
      return value; // Return original case
    }
  }
  
  // Try if text contains the value
  for (const value of allowedValues) {
    if (cleaned.includes(value.toLowerCase())) {
      return value;
    }
  }
  
  // Try if any value contains the text
  for (const value of allowedValues) {
    if (value.toLowerCase().includes(cleaned)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Parse LLM output for a select/enum field.
 */
export function parseLLMToSelectValue(
  text: string,
  nodeType: AINodeType,
  handleId: string
): ParseResult<string> {
  const allowedValues = getSelectOptions(nodeType, handleId);
  
  if (!allowedValues || allowedValues.length === 0) {
    return { success: false, error: `No options found for field "${handleId}"` };
  }
  
  const parsed = parseToSelectValue(text, allowedValues);
  
  if (parsed === null) {
    return { 
      success: false, 
      error: `"${text.slice(0, 30)}" doesn't match options: ${allowedValues.join(", ")}` 
    };
  }
  
  return { success: true, value: parsed };
}

/**
 * Check if a handle is a select/enum field.
 */
export function isSelectField(nodeType: AINodeType, handleId: string): boolean {
  const config = NODE_CONFIG[nodeType];
  if (!config?.ui?.inputs) return false;
  
  const field = config.ui.inputs.find((f: { id: string }) => f.id === handleId);
  return field?.type === "select";
}

/**
 * Get the field config for a handle from node config.
 */
export function getFieldConfig(nodeType: AINodeType, handleId: string): { type: string; min?: number; max?: number; step?: number; options?: unknown[] } | null {
  const config = NODE_CONFIG[nodeType];
  if (!config?.ui?.inputs) return null;
  
  const field = config.ui.inputs.find((f: { id: string }) => f.id === handleId);
  if (!field) return null;
  
  return field as { type: string; min?: number; max?: number; step?: number; options?: unknown[] };
}

/**
 * Universal LLM output parser that handles ANY field type.
 * This is the main function to use for parsing LLM outputs to any node input.
 */
export function parseLLMToFieldValue(
  text: string,
  nodeType: AINodeType,
  handleId: string
): ParseResult {
  if (!text || text.trim() === "") {
    return { success: false, error: "Empty text cannot be parsed" };
  }
  
  const trimmedText = text.trim();
  const fieldConfig = getFieldConfig(nodeType, handleId);
  
  if (!fieldConfig) {
    // No field config found - just pass through as text
    return { success: true, value: trimmedText };
  }
  
  switch (fieldConfig.type) {
    case "select": {
      // Parse against allowed options
      return parseLLMToSelectValue(text, nodeType, handleId);
    }
    
    case "slider":
    case "number": {
      // Parse as number with optional min/max validation
      const num = parseToNumber(trimmedText);
      if (num === null) {
        return { success: false, error: `Could not parse "${trimmedText.slice(0, 30)}" as a number` };
      }
      
      // Validate against min/max if defined
      if (fieldConfig.min !== undefined && num < fieldConfig.min) {
        return { success: false, error: `Value ${num} is below minimum ${fieldConfig.min}` };
      }
      if (fieldConfig.max !== undefined && num > fieldConfig.max) {
        return { success: false, error: `Value ${num} exceeds maximum ${fieldConfig.max}` };
      }
      
      return { success: true, value: num };
    }
    
    case "toggle": {
      // Parse as boolean
      const bool = parseToBoolean(trimmedText);
      if (bool === null) {
        return { success: false, error: `Could not parse "${trimmedText.slice(0, 30)}" as boolean (true/false/yes/no)` };
      }
      return { success: true, value: bool };
    }
    
    case "textarea":
    case "text": {
      // Text fields - pass through as-is
      return { success: true, value: trimmedText };
    }
    
    case "file": {
      // File fields expect URLs - pass through if it looks like a URL
      if (trimmedText.startsWith("http://") || trimmedText.startsWith("https://") || trimmedText.startsWith("data:")) {
        return { success: true, value: trimmedText };
      }
      return { success: false, error: `"${trimmedText.slice(0, 30)}" is not a valid URL for file input` };
    }
    
    default:
      // Unknown field type - pass through as text
      return { success: true, value: trimmedText };
  }
}

/**
 * Check if a field can accept LLM text input (i.e., is not a file/media input)
 */
export function canFieldAcceptLLMInput(nodeType: AINodeType, handleId: string): boolean {
  const fieldConfig = getFieldConfig(nodeType, handleId);
  if (!fieldConfig) return false;
  
  // File inputs typically need actual media, not LLM text
  // But we still allow URLs to pass through
  const parseableTypes = ["select", "slider", "number", "toggle", "textarea", "text"];
  return parseableTypes.includes(fieldConfig.type);
}

// -----------------------------------------------------------------------------
// CONSTRAINT VALIDATION
// -----------------------------------------------------------------------------

/**
 * Validate a parsed value against provider-specific constraints.
 * 
 * @param value - The parsed value to validate
 * @param nodeType - The target node type
 * @param handle - The target handle/setting ID
 * @returns ValidationResult indicating if the value is valid
 */
export function validateProviderConstraints(
  value: unknown,
  nodeType: AINodeType,
  handle: string
): ValidationResult {
  const nodeConstraints = PROVIDER_CONSTRAINTS[nodeType];
  if (!nodeConstraints) {
    // No constraints defined for this node type
    return { valid: true };
  }

  const constraint = nodeConstraints[handle];
  if (!constraint) {
    // No constraint defined for this handle
    return { valid: true };
  }

  if (constraint.type === "numeric") {
    if (typeof value !== "number") {
      return { valid: false, error: `Expected a number, got ${typeof value}` };
    }

    if (constraint.integer && !Number.isInteger(value)) {
      return { valid: false, error: `Expected an integer, got ${value}` };
    }

    if (constraint.min !== undefined && value < constraint.min) {
      return { valid: false, error: `Value ${value} is below minimum ${constraint.min}` };
    }

    if (constraint.max !== undefined && value > constraint.max) {
      return { valid: false, error: `Value ${value} exceeds maximum ${constraint.max}` };
    }

    return { valid: true };
  }

  if (constraint.type === "allowed") {
    const strValue = String(value);
    if (!constraint.values.includes(strValue)) {
      return { 
        valid: false, 
        error: `Value "${strValue}" is not allowed. Valid options: ${constraint.values.join(", ")}` 
      };
    }
    return { valid: true };
  }

  return { valid: true };
}

// -----------------------------------------------------------------------------
// COMBINED PARSE AND VALIDATE
// -----------------------------------------------------------------------------

/**
 * Parse LLM text and validate against provider constraints in one step.
 * 
 * @param text - The raw LLM text
 * @param targetType - The expected data type
 * @param targetNodeType - The target node type
 * @param targetHandle - The target handle/setting ID
 * @returns ParseResult with validated value or error
 */
export function parseAndValidateLLMValue(
  text: string,
  targetType: DataType,
  targetNodeType: AINodeType,
  targetHandle: string
): ParseResult {
  // First, parse the text to the target type
  const parseResult = parseLLMToType(text, targetType, targetNodeType, targetHandle);
  
  if (!parseResult.success) {
    return parseResult;
  }

  // Then validate against provider constraints
  const validation = validateProviderConstraints(parseResult.value, targetNodeType, targetHandle);
  
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return parseResult;
}
