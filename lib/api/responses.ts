import { NextResponse } from "next/server";
import { formatCredits } from "@/lib/credits";

// =============================================================================
// STANDARD API RESPONSE HELPERS
// Provides consistent response formats across all API routes
// =============================================================================

/**
 * Return a 401 Unauthorized response
 */
export function unauthorized(message = "Unauthorized - please sign in"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Return a 400 Bad Request response
 */
export function badRequest(error: string, details?: unknown): NextResponse {
  return NextResponse.json(
    { error, ...(details && { details }) },
    { status: 400 }
  );
}

/**
 * Return a 404 Not Found response
 */
export function notFound(resource: string): NextResponse {
  return NextResponse.json(
    { error: `${resource} not found` },
    { status: 404 }
  );
}

/**
 * Return a 402 Payment Required response for insufficient credits
 * Preserves existing format for backwards compatibility
 */
export function insufficientCredits(balance: number, required: number): NextResponse {
  return NextResponse.json(
    {
      error: `Insufficient credits. You have ${formatCredits(balance)} but need ${formatCredits(required)} to run this node.`,
      insufficientCredits: true,
      balance,
      required,
    },
    { status: 402 }
  );
}

/**
 * Return a 500 Internal Server Error response
 */
export function serverError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Return a successful 200 response with JSON data
 */
export function success<T extends object>(data: T): NextResponse<T> {
  return NextResponse.json(data);
}

/**
 * Return a 201 Created response with JSON data
 */
export function created<T extends object>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 });
}

/**
 * Return a 403 Forbidden response
 */
export function forbidden(message = "You don't have permission to access this resource"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Return a 409 Conflict response
 */
export function conflict(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}

// Type helpers for consistent API response typing
export type ApiResponse<T = unknown> = 
  | { data: T; error?: never }
  | { data?: never; error: string };

export type ApiErrorResponse = {
  error: string;
  details?: unknown;
};

export type CreditErrorResponse = {
  error: string;
  insufficientCredits: true;
  balance: number;
  required: number;
};
