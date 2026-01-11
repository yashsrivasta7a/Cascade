import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/test(.*)", // Test endpoints for development
  "/api/trigger-test(.*)", // Trigger.dev test endpoint
  "/api/nodes(.*)", // All node execution endpoints
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Redirect root to workflows
  if (pathname === "/") {
    const { userId } = await auth();
    if (userId) {
      // Authenticated - go to workflows
      return NextResponse.redirect(new URL("/workflows", req.url));
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
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
