import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@/lib/trpc";
import { auth } from "@clerk/nextjs/server";

// =============================================================================
// TRPC API ROUTE HANDLER
// Handles all tRPC requests at /api/trpc/*
// =============================================================================

const handler = async (req: Request) => {
  // Debug: Check auth at the route level
  const authResult = await auth();
  console.log("[tRPC Route] Auth check:", {
    hasUserId: !!authResult.userId,
    hasSessionId: !!authResult.sessionId,
    path: new URL(req.url).pathname,
  });

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError: ({ path, error }) => {
      console.error(`❌ tRPC error on ${path ?? "<no-path>"}:`, error.message);
    },
  });
};

export { handler as GET, handler as POST };


