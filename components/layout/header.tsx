"use client";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/react";
import Link from "next/link";

// =============================================================================
// CREDIT BALANCE DISPLAY
// =============================================================================

export function CreditBalanceDisplay() {
  const { data: creditsData, isLoading } = trpc.credits.getBalance.useQuery(undefined, {
    staleTime: 30_000, // Cache for 30 seconds
  });

  return (
    <Link
      href="/billing"
      className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-1.5 hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors group"
    >
      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-inner">
        <span className="text-[10px] text-amber-950 font-bold">$</span>
      </div>
      <div className="flex flex-col">
        {isLoading ? (
          <span className="text-xs font-medium text-zinc-400 animate-pulse">...</span>
        ) : (
          <>
            <span className="text-xs font-semibold text-zinc-100 tabular-nums leading-none group-hover:text-white transition-colors">
              {creditsData?.formatted ?? "0"}
            </span>
            <span className="text-[10px] text-zinc-500 leading-none">credits</span>
          </>
        )}
      </div>
    </Link>
  );
}

// =============================================================================
// HEADER
// =============================================================================

interface HeaderProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  showCredits?: boolean;
}

export function Header({ title, description, actions, showCredits = false }: HeaderProps) {
  return (
    <header className="h-14 px-6 flex items-center justify-between border-b border-zinc-900 bg-zinc-950">
      {/* Left: Title */}
      <div>
        {title && (
          <h1 className="text-base font-semibold text-zinc-100">{title}</h1>
        )}
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>

      {/* Right: Actions + Credits */}
      <div className="flex items-center gap-3">
        {showCredits && <CreditBalanceDisplay />}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

// =============================================================================
// TOOLBAR (for pages that need secondary actions)
// =============================================================================

interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function Toolbar({ children, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        "h-11 px-6 flex items-center gap-2 border-b border-zinc-900 bg-zinc-950/50",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarDivider() {
  return <div className="w-px h-5 bg-zinc-800" />;
}
