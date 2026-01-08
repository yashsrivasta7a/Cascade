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
 * Default credits for new users (100k = $0.10 worth)
 */
export const DEFAULT_USER_CREDITS = 100_000;

/**
 * Minimum credits required to start any execution
 */
export const MINIMUM_CREDITS_TO_RUN = 100;

// =============================================================================
// NODE CREDIT COSTS (Estimates)
// =============================================================================

/**
 * Estimated credit cost per node type.
 * These are estimates used before execution.
 * Actual costs may vary based on provider pricing.
 */
export const NODE_CREDIT_COSTS: Record<AINodeType, number> = {
  // Image Generation
  seedream: 5_000,      // ~$0.005 per image
  seedvr: 3_000,        // ~$0.003 per upscale
  
  // Video Generation
  seedance: 25_000,     // ~$0.025 per video
  
  // Audio Generation
  elevenlabs: 8_000,    // ~$0.008 per TTS
  
  // LLM
  openrouter: 2_000,    // ~$0.002 per request (varies by model)
  
  // Video + Audio
  lipsync: 15_000,      // ~$0.015 per sync
  
  // Utility nodes are FREE
  "crop-image": 0,
  "merge-videos": 0,
  "merge-audio-video": 0,
  "extract-audio": 0,
};

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
 * Check if user has enough credits for an estimated cost.
 */
export function hasEnoughCredits(balance: number, estimatedCost: number): boolean {
  return balance >= estimatedCost;
}

/**
 * Format credits for display (e.g., "5,000" or "1.2M")
 */
export function formatCredits(credits: number): string {
  if (credits >= 1_000_000) {
    return `${(credits / 1_000_000).toFixed(1)}M`;
  }
  if (credits >= 10_000) {
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
