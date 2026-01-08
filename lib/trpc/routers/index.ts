import { router } from "../server";
import { workflowRouter } from "./workflow";
import { executionRouter } from "./execution";
import { dashboardRouter } from "./dashboard";

// =============================================================================
// ROOT ROUTER
// Combines all sub-routers into a single app router
// =============================================================================

export const appRouter = router({
  workflow: workflowRouter,
  execution: executionRouter,
  dashboard: dashboardRouter,
});

// Export type for client-side inference
export type AppRouter = typeof appRouter;


