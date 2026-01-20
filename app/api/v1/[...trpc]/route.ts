import { NextRequest, NextResponse } from "next/server";
import { createOpenApiFetchHandler } from "trpc-to-openapi";
import { appRouter } from "@/lib/trpc/routers";
import { createContext } from "@/lib/trpc/server";

// =============================================================================
// REST API HANDLER (OpenAPI Compatible)
// =============================================================================
// Exposes tRPC procedures as REST endpoints:
// - GET /api/v1/workflows → workflow.list
// - GET /api/v1/workflows/{id} → workflow.get
// - POST /api/v1/workflows → workflow.create
// - PATCH /api/v1/workflows/{id} → workflow.update
// - DELETE /api/v1/workflows/{id} → workflow.delete
// - GET /api/v1/credits/balance → credits.getBalance
// - GET /api/v1/credits/stats → credits.getStats

// CORS headers for cross-origin requests (e.g., Mintlify API playground)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Add CORS headers to response
function withCors(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Handler for App Router using fetch handler
async function handleRequest(req: NextRequest) {
  // Debug: Log incoming request with all headers
  const authHeader = req.headers.get("authorization");
  console.log("[REST API] Incoming request:", req.method, req.url);
  console.log("[REST API] Auth header:", authHeader ? `${authHeader.substring(0, 50)}...` : "none");
  console.log("[REST API] Origin:", req.headers.get("origin") || "none");
  
  // Use the fetch handler from trpc-to-openapi
  // It expects the full request with the endpoint path
  const response = await createOpenApiFetchHandler({
    req,
    router: appRouter,
    // Pass request to createContext so it can access headers directly
    createContext: () => createContext({ req }),
    endpoint: "/api/v1",
    onError: ({ error, path }) => {
      console.error(`[REST API] Error on ${path}:`, error.message);
    },
  });
  
  return withCors(response);
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Handle all HTTP methods
export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function PATCH(req: NextRequest) {
  return handleRequest(req);
}

export async function PUT(req: NextRequest) {
  return handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleRequest(req);
}
