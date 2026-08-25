"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { TRPCProvider } from "@/lib/trpc/react";
import { Toaster } from "sonner";

// =============================================================================
// APP PROVIDERS
// Client-side providers wrapper for the app
// =============================================================================

// Auth screens are always dark. forcedTheme pins the class without writing to
// storage, so the user keeps their theme preference everywhere else.
const FORCED_DARK_ROUTES = ["/sign-in", "/sign-up"];

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const forcedTheme = FORCED_DARK_ROUTES.some((r) => pathname?.startsWith(r))
    ? "dark"
    : undefined;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      forcedTheme={forcedTheme}
    >
      <TRPCProvider>
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            className: "!bg-zinc-900/95 !border-zinc-800 !text-zinc-200",
            style: {
              background: "rgba(24, 24, 27, 0.95)",
              border: "1px solid rgba(63, 63, 70, 0.6)",
              color: "#e4e4e7",
            },
          }}
          richColors
          closeButton
        />
      </TRPCProvider>
    </ThemeProvider>
  );
}

