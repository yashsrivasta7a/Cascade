import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/test(.*)", // Test endpoints for development
  "/api/trigger-test(.*)", // Trigger.dev test endpoint
  "/api/nodes(.*)", // All node execution endpoints
  "/api/openapi(.*)", // OpenAPI spec endpoint for Mintlify
  "/api/workflow/trigger(.*)", // Workflow trigger - handles both Clerk and API key auth internally
]);

// Routes that should completely bypass Clerk (use API key auth instead)
// Note: /api/workflow/trigger is NOT here - it needs Clerk middleware to run for web UI auth
const isApiKeyRoute = createRouteMatcher([
  "/api/v1(.*)", // REST API endpoints - use API key auth, not Clerk
  "/api/executions(.*)", // Execution endpoints - support API key auth
  "/api/workflow-templates(.*)", // Template caching - global, no auth needed
]);

export default async function middleware(req: NextRequest) {
  // Completely bypass Clerk for API key routes
  // These routes use Bearer token API keys, not Clerk JWTs
  if (isApiKeyRoute(req)) {
    return NextResponse.next();
  }

  // For all other routes, use Clerk middleware
  return clerkMiddleware(async (auth, req) => {
    const { pathname } = req.nextUrl;

    // Redirect root to dashboard
    if (pathname === "/") {
      const { userId } = await auth();
      if (userId) {
        // Authenticated - go to dashboard
        return NextResponse.redirect(new URL("/dashboard", req.url));
      } else {
        // Not authenticated - go to sign-in
        return NextResponse.redirect(new URL("/sign-in", req.url));
      }
    }

    // Allow public routes
    if (isPublicRoute(req)) {
      return;
    }

    // Protect all other routes
    await auth.protect();
  })(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
