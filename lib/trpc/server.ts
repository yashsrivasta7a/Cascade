import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import { authenticateUser, authenticateWithApiKeyDirect, type EnsuredUser } from "@/lib/user";
import { OpenApiMeta } from "trpc-to-openapi";

// =============================================================================
// TRPC SERVER SETUP
// =============================================================================

export interface Context {
  db: typeof db;
  user: EnsuredUser | null;
  userId: string | null;
  authMethod: "clerk" | "api_key" | null;
  apiKeyId?: string;
}

export interface CreateContextOptions {
  req?: Request; // Use generic Request type for compatibility with both tRPC and OpenAPI handlers
}

/**
 * Creates the context for each tRPC request
 * Supports both Clerk session and API key authentication
 */
export async function createContext(opts?: CreateContextOptions): Promise<Context> {
  // If we have a request with Authorization header, try API key auth first
  if (opts?.req) {
    const authHeader = opts.req.headers.get("authorization");
    console.log("[createContext] Request provided, auth header:", authHeader ? `${authHeader.substring(0, 40)}...` : "none");
    
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      const authResult = await authenticateWithApiKeyDirect(authHeader);
      if (authResult.user) {
        console.log("[createContext] API key auth successful for user:", authResult.user.id);
        return {
          db,
          user: authResult.user,
          userId: authResult.user.id,
          authMethod: authResult.authMethod,
          apiKeyId: authResult.apiKeyId,
        };
      }
    }
  }
  
  // Fall back to standard auth (Clerk + headers())
  const authResult = await authenticateUser();
  
  return {
    db,
    user: authResult.user,
    userId: authResult.user?.id ?? null,
    authMethod: authResult.authMethod,
    apiKeyId: authResult.apiKeyId,
  };
}

// Initialize tRPC with OpenAPI meta support
const t = initTRPC.context<Context>().meta<OpenApiMeta>().create();

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

