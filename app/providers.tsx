"use client";

import { TRPCProvider } from "@/lib/trpc/react";

// =============================================================================
// APP PROVIDERS
// Client-side providers wrapper for the app
// =============================================================================

export function Providers({ children }: { children: React.ReactNode }) {
  return <TRPCProvider>{children}</TRPCProvider>;
}

