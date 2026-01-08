// =============================================================================
// TRPC EXPORTS - SERVER ONLY
// Only import this file from server-side code (API routes, server components)
// =============================================================================

export { router, publicProcedure, protectedProcedure, createContext } from "./server";
export type { TRPCContext } from "./server";

export { appRouter } from "./routers";
export type { AppRouter } from "./routers";
