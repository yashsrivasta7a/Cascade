import { NextRequest, NextResponse } from "next/server";
import { ensureCurrentUser, authenticateUser, type EnsuredUser, type AuthResult } from "@/lib/user";
import { unauthorized } from "./responses";

// =============================================================================
// AUTH WRAPPER FOR API ROUTES
// Provides consistent authentication handling across all API routes
// =============================================================================

/**
 * Context passed to authenticated route handlers
 */
export interface AuthContext {
  user: EnsuredUser;
  authMethod: "clerk" | "api_key";
  apiKeyId?: string;
}

/**
 * Route handler type for authenticated routes
 */
export type AuthenticatedHandler<TParams = unknown> = (
  request: NextRequest,
  context: { params: TParams },
  auth: AuthContext
) => Promise<NextResponse> | NextResponse;

/**
 * Route handler type for routes that may or may not require auth
 */
export type MaybeAuthenticatedHandler<TParams = unknown> = (
  request: NextRequest,
  context: { params: TParams },
  auth: AuthContext | null
) => Promise<NextResponse> | NextResponse;

/**
 * Wrap a route handler with Clerk session authentication.
 * Returns 401 if user is not authenticated.
 * 
 * @example
 * ```ts
 * export const GET = withAuth(async (req, ctx, { user }) => {
 *   return NextResponse.json({ userId: user.id });
 * });
 * ```
 */
export function withAuth<TParams = unknown>(
  handler: AuthenticatedHandler<TParams>
) {
  return async (
    request: NextRequest,
    context: { params: TParams }
  ): Promise<NextResponse> => {
    const user = await ensureCurrentUser();
    
    if (!user) {
      return unauthorized();
    }
    
    return handler(request, context, {
      user,
      authMethod: "clerk",
    });
  };
}

/**
 * Wrap a route handler with flexible authentication (Clerk or API key).
 * Returns 401 if neither authentication method succeeds.
 * 
 * @example
 * ```ts
 * export const POST = withFlexAuth(async (req, ctx, { user, authMethod }) => {
 *   console.log(`Authenticated via ${authMethod}`);
 *   return NextResponse.json({ userId: user.id });
 * });
 * ```
 */
export function withFlexAuth<TParams = unknown>(
  handler: AuthenticatedHandler<TParams>
) {
  return async (
    request: NextRequest,
    context: { params: TParams }
  ): Promise<NextResponse> => {
    const result = await authenticateUser();
    
    if (!result.user || !result.authMethod) {
      return unauthorized();
    }
    
    return handler(request, context, {
      user: result.user,
      authMethod: result.authMethod,
      apiKeyId: result.apiKeyId,
    });
  };
}

/**
 * Wrap a route handler with optional authentication.
 * Handler receives null auth context if not authenticated.
 * 
 * @example
 * ```ts
 * export const GET = withOptionalAuth(async (req, ctx, auth) => {
 *   if (auth) {
 *     return NextResponse.json({ userId: auth.user.id });
 *   }
 *   return NextResponse.json({ message: "Anonymous access" });
 * });
 * ```
 */
export function withOptionalAuth<TParams = unknown>(
  handler: MaybeAuthenticatedHandler<TParams>
) {
  return async (
    request: NextRequest,
    context: { params: TParams }
  ): Promise<NextResponse> => {
    const result = await authenticateUser();
    
    if (!result.user || !result.authMethod) {
      return handler(request, context, null);
    }
    
    return handler(request, context, {
      user: result.user,
      authMethod: result.authMethod,
      apiKeyId: result.apiKeyId,
    });
  };
}
