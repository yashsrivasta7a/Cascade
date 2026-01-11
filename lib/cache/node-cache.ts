import { createHash } from "crypto";
import { db } from "@/lib/db";

// =============================================================================
// NODE RESULT CACHE
// =============================================================================
// Caches node execution results based on input hash.
// Identical inputs = skip re-execution and return cached result.
// Uses database storage with 7-day TTL.

const CACHE_TTL_DAYS = 7;

/**
 * Generate a deterministic hash for node inputs
 * Combines nodeType with sorted, stringified inputs
 */
export function hashNodeInputs(
  nodeType: string,
  inputs: Record<string, unknown>
): string {
  // Sort keys for deterministic ordering
  const sortedInputs = Object.keys(inputs)
    .sort()
    .reduce((acc, key) => {
      acc[key] = inputs[key];
      return acc;
    }, {} as Record<string, unknown>);

  const data = JSON.stringify({ nodeType, inputs: sortedInputs });
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Check if a cached result exists for the given hash
 * Returns null if not found or expired
 */
export async function getCachedResult(
  hash: string
): Promise<Record<string, unknown> | null> {
  try {
    const cached = await db.nodeResultCache.findUnique({
      where: { hash },
    });

    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < new Date()) {
      // Delete expired entry (fire and forget)
      db.nodeResultCache.delete({ where: { hash } }).catch(() => {});
      return null;
    }

    console.log(`[NodeCache] Cache HIT for hash: ${hash.slice(0, 12)}...`);
    return cached.output as Record<string, unknown>;
  } catch (error) {
    console.error("[NodeCache] Error reading cache:", error);
    return null;
  }
}

/**
 * Store a result in the cache with TTL
 */
export async function setCachedResult(
  hash: string,
  nodeType: string,
  output: Record<string, unknown>
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    await db.nodeResultCache.upsert({
      where: { hash },
      create: {
        hash,
        nodeType,
        output,
        expiresAt,
      },
      update: {
        output,
        expiresAt,
      },
    });

    console.log(`[NodeCache] Cached result for hash: ${hash.slice(0, 12)}...`);
  } catch (error) {
    console.error("[NodeCache] Error writing cache:", error);
    // Don't throw - caching is not critical
  }
}

/**
 * Clean up expired cache entries
 * Run this periodically (e.g., via cron or on startup)
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await db.nodeResultCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    console.log(`[NodeCache] Cleaned up ${result.count} expired entries`);
    return result.count;
  } catch (error) {
    console.error("[NodeCache] Error cleaning cache:", error);
    return 0;
  }
}

/**
 * Check cache and return result if available
 * Use this as a wrapper before node execution
 */
export async function checkCache(
  nodeType: string,
  inputs: Record<string, unknown>
): Promise<{ hit: boolean; hash: string; result: Record<string, unknown> | null }> {
  const hash = hashNodeInputs(nodeType, inputs);
  const result = await getCachedResult(hash);
  
  return {
    hit: result !== null,
    hash,
    result,
  };
}

/**
 * Cache a successful node execution result
 */
export async function cacheResult(
  hash: string,
  nodeType: string,
  output: Record<string, unknown>
): Promise<void> {
  await setCachedResult(hash, nodeType, output);
}

export default {
  hashNodeInputs,
  getCachedResult,
  setCachedResult,
  cleanupExpiredCache,
  checkCache,
  cacheResult,
};
