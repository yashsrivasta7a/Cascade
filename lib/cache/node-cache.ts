import { createHash } from "crypto";
import { db } from "@/lib/db";
import { cacheLogger as log } from "@/lib/logger";

// =============================================================================
// NODE RESULT CACHE
// =============================================================================
// Caches node execution results based on input hash.
// Identical inputs = skip re-execution and return cached result.
// Uses database storage with 7-day TTL.

const CACHE_TTL_DAYS = 7;

/**
 * Normalize a URL for caching - removes query parameters that might change between runs
 * but keeps the core URL that identifies the content
 */
function normalizeUrlForCache(url: string): string {
  // Skip base64 data URLs - just use first 100 chars + length for identity
  if (url.startsWith("data:")) {
    return `data:${url.length}:${url.slice(0, 100)}`;
  }
  
  try {
    const parsed = new URL(url);
    // Remove common cache-busting or token parameters
    const paramsToRemove = ["token", "t", "ts", "timestamp", "expires", "signature", "sig", "_"];
    paramsToRemove.forEach(param => parsed.searchParams.delete(param));
    return parsed.toString();
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Normalize a value for caching - handles nested objects with URLs
 */
function normalizeValueForCache(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value === "string") {
    // Check if it looks like a URL
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
      return normalizeUrlForCache(value);
    }
    return value;
  }
  
  if (Array.isArray(value)) {
    return value.map(normalizeValueForCache);
  }
  
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      // Special handling for 'url' keys in AssetRef objects
      if (key === "url" && typeof obj[key] === "string") {
        normalized[key] = normalizeUrlForCache(obj[key] as string);
      } else {
        normalized[key] = normalizeValueForCache(obj[key]);
      }
    }
    return normalized;
  }
  
  return value;
}

/**
 * Generate a deterministic hash for node inputs
 * Combines nodeType with sorted, stringified inputs
 * Filters out undefined, null, and empty string values for consistent hashing
 * Normalizes URLs to remove cache-busting parameters
 */
export function hashNodeInputs(
  nodeType: string,
  inputs: Record<string, unknown>
): string {
  // Sort keys and filter out undefined/null/empty values for deterministic ordering
  const sortedInputs = Object.keys(inputs)
    .sort()
    .reduce((acc, key) => {
      const value = inputs[key];
      // Only include defined, non-null, non-empty values
      if (value !== undefined && value !== null && value !== "") {
        // Normalize the value (especially URLs) for consistent hashing
        acc[key] = normalizeValueForCache(value);
      }
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

    log.debug(`Cache HIT for hash: ${hash.slice(0, 12)}...`);
    return cached.output as Record<string, unknown>;
  } catch (error) {
    log.error("Error reading cache", error);
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

    log.debug(`Cached result for hash: ${hash.slice(0, 12)}...`);
  } catch (error) {
    log.error("Error writing cache", error);
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
    log.info(`Cleaned up ${result.count} expired entries`);
    return result.count;
  } catch (error) {
    log.error("Error cleaning cache", error);
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
  // Log the normalized inputs (for debugging)
  const normalizedInputs: Record<string, unknown> = {};
  for (const key of Object.keys(inputs).sort()) {
    const value = inputs[key];
    if (value !== undefined && value !== null && value !== "") {
      normalizedInputs[key] = normalizeValueForCache(value);
    }
  }
  
  const hash = hashNodeInputs(nodeType, inputs);
  log.debug(`Checking cache for ${nodeType}`, { hash: hash.slice(0, 16), keys: Object.keys(normalizedInputs) });
  
  const result = await getCachedResult(hash);
  
  if (result) {
    log.debug(`Cache HIT for ${nodeType} - returning cached result`);
  } else {
    log.debug(`Cache MISS for ${nodeType} - will execute`);
  }
  
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
  log.debug(`Caching result for ${nodeType}`, { hash: hash.slice(0, 12) });
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
