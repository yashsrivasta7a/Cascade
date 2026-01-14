import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";

// =============================================================================
// USER HELPER FUNCTIONS
// Ensures user exists in database before any operation
// =============================================================================

export interface EnsuredUser {
  id: string;
  email: string;
  credits: number;
}

/**
 * Ensures the current authenticated user exists in the database.
 * Creates them if they don't exist (in case webhook hasn't fired yet).
 * Returns null if not authenticated.
 */
export async function ensureCurrentUser(): Promise<EnsuredUser | null> {
  try {
    const authResult = await auth();
    const { userId } = authResult;
    
    console.log("[ensureCurrentUser] Auth result:", { 
      userId: userId ? "present" : "null",
      hasSessionClaims: !!authResult.sessionClaims,
    });
    
    if (!userId) {
      console.log("[ensureCurrentUser] No userId in auth result");
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

      console.log(`[ensureCurrentUser] Created user ${userId} (${email})`);
    }

    return user;
  } catch (error) {
    console.error("[ensureCurrentUser] Auth error:", error);
    console.error("[ensureCurrentUser] Error details:", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
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
    console.error("[deductCredits] Error:", error);
    return false;
  }
}


