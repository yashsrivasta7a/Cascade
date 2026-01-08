"use client";

import { createTRPCReact } from "@trpc/react-query";

// =============================================================================
// TRPC CLIENT
// Uses type-only import to get AppRouter type without bundling server code
// =============================================================================

// Type-only import - TypeScript erases this at compile time
// The bundler should NOT include the actual module in the client bundle
import type { AppRouter } from "./routers";

export const trpc = createTRPCReact<AppRouter>();
