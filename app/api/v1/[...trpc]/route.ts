import { NextRequest } from "next/server";
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

// Handler for App Router using fetch handler
async function handleRequest(req: NextRequest) {
  // Use the fetch handler from trpc-to-openapi
  // It expects the full request with the endpoint path
  return createOpenApiFetchHandler({
    req,
    router: appRouter,
    createContext,
    endpoint: "/api/v1",
    onError: ({ error, path }) => {
      console.error(`[REST API] Error on ${path}:`, error.message);
    },
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
