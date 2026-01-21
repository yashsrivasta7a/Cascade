import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { db } from "./db";
import { extractBearerToken, validateApiKey } from "./api-keys";
import { authLogger as log } from "./logger";

// =============================================================================
// USER HELPER FUNCTIONS
// Ensures user exists in database before any operation
// =============================================================================

export interface EnsuredUser {
  id: string;
  email: string;
  credits: number;
}

export interface AuthResult {
  user: EnsuredUser | null;
  authMethod: "clerk" | "api_key" | null;
  apiKeyId?: string;
}

/**
 * Ensures the current authenticated user exists in the database.
 * Creates them if they don't exist (in case webhook hasn't fired yet).
 * Returns null if not authenticated.
 */
export async function ensureCurrentUser(): Promise<EnsuredUser | null> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return null;
    }

    // Try to get user from DB first
    let user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, credits: true },
    });

    // If not in DB, fetch from Clerk and create
    if (!user) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@flowsmith.app`;

      user = await db.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email,
          credits: 1000, // Welcome credits
        },
        update: {},
        select: { id: true, email: true, credits: true },
      });

      log.info(`Created user ${userId}`, { email });
    }

    return user;
  } catch (error) {
    log.error("ensureCurrentUser failed", error);
    return null;
  }
}

/**
 * Authenticates a user via API key from the Authorization header.
 * Used for /api/v1/* routes that accept Bearer token authentication.
 * Returns the user if authenticated, null otherwise.
 */
export async function authenticateWithApiKey(): Promise<AuthResult> {
  try {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    log.debug("Auth header received", { hasHeader: !!authHeader });
    
    return authenticateWithApiKeyDirect(authHeader);
  } catch (error) {
    log.error("authenticateWithApiKey failed", error);
    return { user: null, authMethod: null };
  }
}

/**
 * Authenticates a user via API key from a provided Authorization header string.
 * This version doesn't use Next.js headers() - useful for trpc-to-openapi context.
 */
export async function authenticateWithApiKeyDirect(authHeader: string | null): Promise<AuthResult> {
  try {
    log.debug("Authenticating with API key", { hasHeader: !!authHeader });
    
    const token = extractBearerToken(authHeader);

    if (!token) {
      log.debug("No token found in header");
      return { user: null, authMethod: null };
    }

    // Validate the API key
    const keyData = await validateApiKey(token);
    log.debug("Key validation result", { valid: !!keyData });
    if (!keyData) {
      return { user: null, authMethod: null };
    }

    // Get the user associated with this API key
    const user = await db.user.findUnique({
      where: { id: keyData.userId },
      select: { id: true, email: true, credits: true },
    });

    if (!user) {
      return { user: null, authMethod: null };
    }

    return {
      user,
      authMethod: "api_key",
      apiKeyId: keyData.apiKeyId,
    };
  } catch (error) {
    log.error("authenticateWithApiKeyDirect failed", error);
    return { user: null, authMethod: null };
  }
}

/**
 * Authenticates a user via either Clerk session or API key.
 * Tries Clerk first, then falls back to API key.
 * Used for routes that accept both authentication methods.
 */
export async function authenticateUser(): Promise<AuthResult> {
  // Try Clerk authentication first
  const clerkUser = await ensureCurrentUser();
  if (clerkUser) {
    return { user: clerkUser, authMethod: "clerk" };
  }

  // Fall back to API key authentication
  return authenticateWithApiKey();
}

/**
 * Gets userId for API routes, with dev fallback for testing.
 * Always tries to ensure user exists in DB.
 */
export async function getUserIdForApi(): Promise<{ userId: string; isDevUser: boolean }> {
  try {
    const user = await ensureCurrentUser();
    
    if (user) {
      return { userId: user.id, isDevUser: false };
    }
  } catch {
    // Auth failed - fall through to dev user
  }

  // Dev fallback
  const devUserId = process.env.DEV_USER_ID ?? "dev-user";
  
  // Ensure dev user exists
  await db.user.upsert({
    where: { id: devUserId },
    create: {
      id: devUserId,
      email: "dev@flowsmith.dev",
      credits: 99999,
    },
    update: {},
  });

  return { userId: devUserId, isDevUser: true };
}

/**
 * Deducts credits from a user. Returns false if insufficient credits.
 */
export async function deductCredits(userId: string, amount: number): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    if (!user || user.credits < amount) {
      return false;
    }

    await db.user.update({
      where: { id: userId },
      data: { credits: { decrement: amount } },
    });

    return true;
  } catch (error) {
    log.error("deductCredits failed", error);
    return false;
  }
}


