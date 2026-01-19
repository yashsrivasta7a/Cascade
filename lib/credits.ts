/**
 * Credits System - Constants and Helper Functions
 * 
 * Credit conversion: 1,000,000 credits = $1.00 provider cost
 * This allows for fine-grained pricing while using integers.
 */

import type { AINodeType } from "@/types/nodes";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Number of credits equal to $1.00 in provider costs.
 * Using 1 million allows for sub-cent precision with integers.
 */
export const CREDITS_PER_DOLLAR = 1_000_000;

/**
 * Default credits for new users (1M = $1.00 worth)
 */
export const DEFAULT_USER_CREDITS = 1_000_000;

/**
 * Minimum credits required to start any execution
 */
export const MINIMUM_CREDITS_TO_RUN = 100;

// =============================================================================
// NODE CREDIT COSTS (Base Estimates)
// =============================================================================

/**
 * Base estimated credit cost per node type.
 * These are DEFAULT estimates - actual costs are calculated dynamically.
 * 
 * Provider Pricing (1M credits = $1.00):
 * - Seedream 4.5: $0.04/image = 40,000 credits (FIXED)
 * - SeedVR: $0.001/megapixel = ~2,000 credits (1-2 MP average)
 * - Seedance 1.5: ~$0.26 for 720p 5s with audio = 260,000 credits
 * - ElevenLabs: $0.1/1000 chars = ~50,000 credits (500 char average)
 * - OpenRouter: varies by model = ~50,000 credits estimate
 * - Lipsync: $0.7/min = ~350,000 credits (30s average)
 */
export const NODE_CREDIT_COSTS: Record<AINodeType, number> = {
  // Image Generation
  seedream: 40_000,       // $0.04 per image (FIXED)
  seedvr: 2_000,          // ~$0.002 estimate (1-2 megapixel average)
  
  // Video Generation
  seedance: 260_000,      // ~$0.26 estimate (720p 5s with audio)
  
  // Audio Generation
  elevenlabs: 50_000,     // ~$0.05 estimate (~500 chars average)
  
  // LLM
  openrouter: 50_000,     // ~$0.05 estimate (varies by model)
  
  // Video + Audio
  lipsync: 350_000,       // ~$0.35 estimate (~30 second average)
  
  // Utility nodes - minimal server processing cost
  "crop-image": 1_000,        // $0.001 - basic image processing
  "merge-videos": 5_000,      // $0.005 - FFmpeg processing
  "merge-audio-video": 3_000, // $0.003 - FFmpeg processing
  "extract-audio": 2_000,     // $0.002 - FFmpeg processing
};

// =============================================================================
// DYNAMIC COST CALCULATORS
// =============================================================================

/**
 * SeedVR: $0.001 per megapixel = 1,000 credits per megapixel
 */
export function calculateSeedvrCost(width: number, height: number): number {
  const megapixels = (width * height) / 1_000_000;
  return Math.ceil(megapixels * 1_000);
}

/**
 * Seedance 1.5: Video token-based pricing
 * tokens = (height × width × FPS × duration) / 1024
 * With audio: $2.4/1M tokens = 2,400,000 credits per 1M tokens
 * Without audio: $1.2/1M tokens = 1,200,000 credits per 1M tokens
 * 
 * Reference: 720p 5s with audio ≈ $0.26 ≈ 260,000 credits
 */
export function calculateSeedanceCost(
  width: number,
  height: number,
  fps: number,
  durationSeconds: number,
  hasAudio: boolean = true
): number {
  const tokens = (width * height * fps * durationSeconds) / 1024;
  const costPerMillionTokens = hasAudio ? 2_400_000 : 1_200_000;
  return Math.ceil((tokens / 1_000_000) * costPerMillionTokens);
}

/**
 * ElevenLabs: $0.1 per 1000 characters = 100 credits per character
 */
export function calculateElevenlabsCost(characterCount: number): number {
  return Math.ceil(characterCount * 100);
}

/**
 * Lipsync: $0.7 per minute = 700,000 credits per minute
 */
export function calculateLipsyncCost(durationSeconds: number): number {
  const minutes = durationSeconds / 60;
  return Math.ceil(minutes * 700_000);
}

/**
 * OpenRouter LLM: Calculate cost based on token usage
 * 
 * Default pricing estimate (varies by model):
 * - GPT-4o-mini: ~$0.15/1M input, ~$0.60/1M output
 * - GPT-4o: ~$2.50/1M input, ~$10/1M output  
 * - Claude 3.5 Sonnet: ~$3/1M input, ~$15/1M output
 * 
 * We use a conservative average estimate for mixed usage.
 * Average: ~$1/1M input tokens, ~$3/1M output tokens
 * 
 * 1M credits = $1, so:
 * - Input: 1 credit per input token
 * - Output: 3 credits per output token
 */
export function calculateOpenrouterCost(
  inputTokens: number,
  outputTokens: number,
  model?: string
): number {
  // Model-specific pricing (credits per token)
  // Based on: 1M credits = $1.00, prices per 1M tokens
  let inputCostPerToken = 0.15;  // Default: $0.15/1M = 0.15 credits/token
  let outputCostPerToken = 0.60; // Default: $0.60/1M = 0.60 credits/token

  if (model) {
    const modelLower = model.toLowerCase();

    // GPT-4o Mini (OpenAI) - $0.15 input, $0.60 output per 1M tokens
    if (modelLower.includes('gpt-4o-mini')) {
      inputCostPerToken = 0.15;
      outputCostPerToken = 0.60;
    }
    // Gemini 2.5 Flash (Google) - $0.15 input, $0.60 output per 1M tokens (estimated)
    else if (modelLower.includes('gemini-2.5-flash') || modelLower.includes('gemini-2.5') || modelLower.includes('gemini-flash')) {
      inputCostPerToken = 0.15;
      outputCostPerToken = 0.60;
    }
    // Claude Sonnet 4.5 (Anthropic) - $3.00 input, $15.00 output per 1M tokens
    else if (modelLower.includes('claude-sonnet-4') || modelLower.includes('claude-4')) {
      inputCostPerToken = 3.00;
      outputCostPerToken = 15.00;
    }
  }

  // Calculate cost in credits (credits per token = $ per 1M tokens)
  const inputCost = Math.ceil(inputTokens * inputCostPerToken);
  const outputCost = Math.ceil(outputTokens * outputCostPerToken);

  // Minimum cost of 100 credits to cover API overhead
  return Math.max(100, inputCost + outputCost);
}

/**
 * Get dynamic cost estimate based on node type and input data.
 * Falls back to base NODE_CREDIT_COSTS if inputs aren't available.
 */
export function estimateNodeCost(
  nodeType: string,
  input?: Record<string, unknown>
): number {
  const type = nodeType as AINodeType;
  const baseCost = NODE_CREDIT_COSTS[type] ?? 0;
  
  if (!input) {
    return baseCost;
  }

  // Helper to safely parse numbers with fallback
  const safeNumber = (value: unknown, fallback: number): number => {
    if (typeof value === "number" && !Number.isNaN(value) && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  };

  let cost: number;

  switch (type) {
    case "seedream":
      // Fixed cost per image
      cost = 40_000;
      break;

    case "seedvr": {
      // Based on output resolution
      const width = safeNumber(input.width, 1024);
      const height = safeNumber(input.height, 1024);
      cost = calculateSeedvrCost(width, height);
      break;
    }

    case "seedance": {
      // Based on resolution, fps, duration, audio
      const width = safeNumber(input.width, 1280);
      const height = safeNumber(input.height, 720);
      const fps = safeNumber(input.fps, 24);
      const duration = safeNumber(input.duration, 5);
      const hasAudio = input.audio !== false;
      cost = calculateSeedanceCost(width, height, fps, duration, hasAudio);
      break;
    }

    case "elevenlabs": {
      // Based on text length
      const text = (input.text as string) || "";
      if (text.length > 0) {
        cost = calculateElevenlabsCost(text.length);
      } else {
        cost = NODE_CREDIT_COSTS.elevenlabs;
      }
      break;
    }

    case "lipsync": {
      // Based on video duration (in seconds)
      const duration = safeNumber(input.duration, 30);
      cost = calculateLipsyncCost(duration);
      break;
    }

    case "openrouter":
      // LLM costs vary by model - use base estimate
      cost = NODE_CREDIT_COSTS.openrouter;
      break;

    default:
      cost = baseCost;
  }

  // Final safety check - never return NaN or Infinity
  if (Number.isNaN(cost) || !Number.isFinite(cost)) {
    console.warn(`[estimateNodeCost] Invalid cost for ${type}, using base cost:`, cost);
    return baseCost;
  }

  return cost;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the estimated credit cost for a node type.
 */
export function getNodeCost(nodeType: string): number {
  return NODE_CREDIT_COSTS[nodeType as AINodeType] ?? 0;
}

/**
 * Calculate total estimated cost for a list of node types.
 */
export function calculateWorkflowCost(nodeTypes: string[]): number {
  return nodeTypes.reduce((total, type) => total + getNodeCost(type), 0);
}

/**
 * Calculate total estimated cost for a workflow, excluding skipped nodes.
 * Takes full node objects to check the skip flag.
 */
export function calculateWorkflowCostExcludingSkipped(
  nodes: Array<{ type?: string | null; data?: Record<string, unknown> }>
): number {
  return nodes.reduce((total, node) => {
    const nodeData = node.data ?? {};
    const nodeType = node.type;
    
    // Skip nodes with skip=true (they won't execute)
    if (nodeData.skip === true) {
      return total;
    }
    
    if (nodeType) {
      return total + getNodeCost(nodeType);
    }
    return total;
  }, 0);
}

/**
 * Check if user has enough credits for an estimated cost.
 */
export function hasEnoughCredits(balance: number, estimatedCost: number): boolean {
  return balance >= estimatedCost;
}

/**
 * Format credits for display (e.g., "5,000" or "1.2M")
 */
export function formatCredits(credits: number): string {
  if (credits === 0) return "0";
  if (credits >= 1_000_000) {
    // Show up to 2 decimal places for millions (e.g., "2.45M")
    const millions = credits / 1_000_000;
    if (millions >= 10) {
      return `${millions.toFixed(1)}M`;
    }
    return `${millions.toFixed(2)}M`;
  }
  if (credits >= 10_000) {
    return `${(credits / 1_000).toFixed(0)}K`;
  }
  if (credits >= 1_000) {
    // Show K format for thousands (e.g., "1K", "3K", "5K")
    return `${(credits / 1_000).toFixed(0)}K`;
  }
  return credits.toLocaleString();
}

/**
 * Format credits as dollar value for display.
 */
export function creditsToDollars(credits: number): string {
  const dollars = credits / CREDITS_PER_DOLLAR;
  if (dollars < 0.01) {
    return `<$0.01`;
  }
  return `$${dollars.toFixed(2)}`;
}

/**
 * Convert dollar amount to credits.
 */
export function dollarsToCredits(dollars: number): number {
  return Math.round(dollars * CREDITS_PER_DOLLAR);
}

// =============================================================================
// TRANSACTION TYPES
// =============================================================================

export type TransactionType = 
  | "PURCHASE"    // User bought credits
  | "EXECUTION"   // Credits deducted for node execution
  | "REFUND"      // Credits refunded
  | "BONUS"       // Free credits
  | "ADJUSTMENT"; // Manual adjustment

export interface CreditTransactionInput {
  userId: string;
  amount: number;
  type: TransactionType;
  description?: string;
  workflowExecutionId?: string;
  nodeExecutionId?: string;
  metadata?: Record<string, unknown>;
}
