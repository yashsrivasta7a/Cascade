import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { ensureCurrentUser, type EnsuredUser } from "@/lib/user";

// =============================================================================
// TRPC SERVER SETUP
// =============================================================================

export interface Context {
  db: typeof db;
  user: EnsuredUser | null;
  userId: string | null;
}

/**
 * Creates the context for each tRPC request
 */
export async function createContext(): Promise<Context> {
  const user = await ensureCurrentUser();
  
  return {
    db,
    user,
    userId: user?.id ?? null,
  };
}

const t = initTRPC.context<Context>().create();

// Base router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authenticated user
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      userId: ctx.user.id,
    },
  });
});

export type { Context as TRPCContext };

