import { NODE_CONFIG } from "@/lib/config";
import type { AINodeType } from "@/types/nodes";

// =============================================================================
// LLM OUTPUT PARSING FOR SETTINGS
// =============================================================================

/**
 * Parse text to a number. Extracts first number from text.
 */
export function parseToNumber(text: string): number | null {
  const cleaned = text.trim();
  
  // Try direct parse first
  const direct = parseFloat(cleaned);
  if (!isNaN(direct) && isFinite(direct)) {
    return direct;
  }
  
  // Extract first number from text (handles "90%", "set to 50", etc.)
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
 * Get field config from node config
 */
export function getFieldConfig(nodeType: string, handleId: string): { type: string; min?: number; max?: number; options?: unknown[] } | null {
  const config = NODE_CONFIG[nodeType as AINodeType];
  if (!config?.ui?.inputs) return null;
  
  const field = config.ui.inputs.find((f: { id: string }) => f.id === handleId);
  if (!field) return null;
  
  return field as { type: string; min?: number; max?: number; options?: unknown[] };
}

/**
 * Check if a field can accept parsed LLM input
 */
export function canFieldAcceptLLMInput(nodeType: string, handleId: string): boolean {
  const fieldConfig = getFieldConfig(nodeType, handleId);
  if (!fieldConfig) return false;
  
  const parseableTypes = ["select", "slider", "number", "toggle", "textarea", "text"];
  return parseableTypes.includes(fieldConfig.type);
}

/**
 * Parse LLM text to a value suitable for a specific field type
 */
export function parseLLMToFieldValue(text: string, nodeType: string, handleId: string): { success: boolean; value?: unknown; error?: string } {
  if (!text || text.trim() === "") {
    return { success: false, error: "Empty text" };
  }
  
  const trimmedText = text.trim();
  const fieldConfig = getFieldConfig(nodeType, handleId);
  
  if (!fieldConfig) {
    return { success: true, value: trimmedText };
  }
  
  switch (fieldConfig.type) {
    case "slider":
    case "number": {
      const num = parseToNumber(trimmedText);
      if (num === null) {
        return { success: false, error: `Could not parse "${trimmedText.slice(0, 30)}" as a number` };
      }
      
      // Validate against min/max
      if (fieldConfig.min !== undefined && num < fieldConfig.min) {
        return { success: false, error: `Value ${num} is below minimum ${fieldConfig.min}` };
      }
      if (fieldConfig.max !== undefined && num > fieldConfig.max) {
        return { success: false, error: `Value ${num} exceeds maximum ${fieldConfig.max}` };
      }
      
      return { success: true, value: num };
    }
    
    case "select": {
      // Try to match against allowed options
      const options = fieldConfig.options as Array<string | { value: string }> | undefined;
      if (!options) return { success: true, value: trimmedText };
      
      const allowedValues = options.map(opt => typeof opt === "string" ? opt : opt.value);
      const lowerText = trimmedText.toLowerCase();
      
      for (const value of allowedValues) {
        if (value.toLowerCase() === lowerText || lowerText.includes(value.toLowerCase())) {
          return { success: true, value };
        }
      }
      
      return { success: false, error: `"${trimmedText}" doesn't match options: ${allowedValues.join(", ")}` };
    }
    
    case "toggle": {
      const lower = trimmedText.toLowerCase();
      if (["true", "yes", "1", "on", "enable", "enabled"].includes(lower)) {
        return { success: true, value: true };
      }
      if (["false", "no", "0", "off", "disable", "disabled"].includes(lower)) {
        return { success: true, value: false };
      }
      return { success: false, error: `Could not parse "${trimmedText}" as boolean` };
    }
    
    default:
      return { success: true, value: trimmedText };
  }
}
