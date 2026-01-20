/**
 * API Key utilities for generating, hashing, and validating API keys
 */

import { randomBytes, createHash } from "crypto";
import { db } from "./db";

// Key format: sk_live_<32 random hex chars> = 40 chars total after prefix
const KEY_PREFIX = "sk_live_";
const KEY_LENGTH = 32; // 32 hex chars = 16 bytes of randomness

/**
 * Generate a new API key
 * Returns the full key (only shown once) and the prefix for storage
 */
export function generateApiKey(): { fullKey: string; prefix: string; hashedKey: string } {
  const randomPart = randomBytes(KEY_LENGTH / 2).toString("hex"); // 16 bytes = 32 hex chars
  const fullKey = `${KEY_PREFIX}${randomPart}`;
  const prefix = fullKey.substring(0, 12); // "sk_live_xxxx"
  const hashedKey = hashApiKey(fullKey);
  
  return { fullKey, prefix, hashedKey };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate an API key and return the associated user
 * Returns null if the key is invalid, expired, or revoked
 */
export async function validateApiKey(key: string): Promise<{
  userId: string;
  apiKeyId: string;
  scopes: string[];
} | null> {
  console.log("[validateApiKey] Validating key:", key ? `${key.substring(0, 20)}...` : "none");
  
  if (!key || !key.startsWith(KEY_PREFIX)) {
    console.log("[validateApiKey] Invalid key format");
    return null;
  }

  const hashedKey = hashApiKey(key);
  console.log("[validateApiKey] Hashed key:", hashedKey.substring(0, 16) + "...");

  let apiKey;
  try {
    apiKey = await db.apiKey.findUnique({
      where: { hashedKey },
      select: {
        id: true,
        userId: true,
        scopes: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
    console.log("[validateApiKey] DB lookup result:", apiKey ? "found" : "not found");
  } catch (error) {
    console.error("[validateApiKey] DB error:", error);
    return null;
  }

  if (!apiKey) {
    return null;
  }

  // Check if revoked
  if (apiKey.revokedAt) {
    return null;
  }

  // Check if expired
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Update last used timestamp and usage count (fire and forget)
  db.apiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  }).catch(() => {
    // Silently ignore update errors - don't block the request
  });

  return {
    userId: apiKey.userId,
    apiKeyId: apiKey.id,
    scopes: apiKey.scopes,
  };
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(
  userId: string,
  name: string,
  options?: {
    expiresAt?: Date;
    scopes?: string[];
    rateLimit?: number;
  }
): Promise<{ id: string; fullKey: string; prefix: string; name: string; createdAt: Date }> {
  const { fullKey, prefix, hashedKey } = generateApiKey();

  const apiKey = await db.apiKey.create({
    data: {
      userId,
      name,
      prefix,
      hashedKey,
      scopes: options?.scopes ?? ["*"],
      rateLimit: options?.rateLimit ?? 100,
      expiresAt: options?.expiresAt,
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });

  return {
    id: apiKey.id,
    fullKey, // Only returned on creation - never stored in plain text
    prefix,
    name: apiKey.name,
    createdAt: apiKey.createdAt,
  };
}

/**
 * List all API keys for a user (without exposing the actual keys)
 */
export async function listApiKeys(userId: string) {
  return db.apiKey.findMany({
    where: {
      userId,
      revokedAt: null, // Only show active keys
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      rateLimit: true,
      lastUsedAt: true,
      usageCount: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Revoke an API key (soft delete)
 */
export async function revokeApiKey(userId: string, apiKeyId: string): Promise<boolean> {
  const result = await db.apiKey.updateMany({
    where: {
      id: apiKeyId,
      userId, // Ensure user owns this key
      revokedAt: null, // Only revoke if not already revoked
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return result.count > 0;
}
