// =============================================================================
// Setting Value Clamping - ensures values stay within valid ranges
// =============================================================================

// Define min/max values for settings that should be clamped
// These values MUST match the Zod schema constraints in lib/config/node-config.ts
export const SETTING_RANGES: Record<string, { min: number; max: number }> = {
  // LLM settings (openrouter)
  "temperature": { min: 0, max: 2 },
  "maxTokens": { min: 1, max: 128000 },
  "topP": { min: 0, max: 1 },
  "topK": { min: 0, max: 100 },
  "frequencyPenalty": { min: -2, max: 2 },
  "presencePenalty": { min: -2, max: 2 },
  // Image generation settings (seedream) - from schema: z.number().min(0).max(30)
  "numInferenceSteps": { min: 1, max: 60 },
  "guidanceScale": { min: 0, max: 30 },
  // Seed - no max in schema, but cap to prevent overflow when passed to other settings
  "seed": { min: 0, max: 2147483647 },
  // Crop image settings (0-100 percentage)
  "xPercent": { min: 0, max: 100 },
  "yPercent": { min: 0, max: 100 },
  "widthPercent": { min: 1, max: 100 },
  "heightPercent": { min: 1, max: 100 },
  // Video settings (merge-videos) - from schema: z.number().min(0).max(2)
  "transitionDuration": { min: 0, max: 2 },
  // ElevenLabs voice settings
  "stability": { min: 0, max: 1 },
  "similarityBoost": { min: 0, max: 1 },
  "clarity": { min: 0, max: 1 },
};

/**
 * Helper to clamp a value to its range if defined
 * Also sanitizes non-numeric values for numeric settings
 */
export function clampSettingValue(key: string, value: unknown): unknown {
  // Check if this is a numeric setting
  const numericSettings = new Set(Object.keys(SETTING_RANGES));
  
  if (numericSettings.has(key)) {
    // For numeric settings, MUST return a number
    if (typeof value === "number") {
      const range = SETTING_RANGES[key];
      if (range !== undefined) {
        return Math.min(Math.max(range.min, value), range.max);
      }
      return value;
    } else if (typeof value === "string" && !isNaN(Number(value))) {
      const numValue = Number(value);
      const range = SETTING_RANGES[key];
      if (range !== undefined) {
        return Math.min(Math.max(range.min, numValue), range.max);
      }
      return numValue;
    } else {
      // Non-numeric value for numeric setting - return undefined to skip
      return undefined;
    }
  }
  
  // Non-numeric settings pass through as-is
  return value;
}
