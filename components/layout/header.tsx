"use client";

import { cn } from "@/lib/utils";

// =============================================================================
// HEADER
// =============================================================================

interface HeaderProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
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

      {/* Right: Actions */}
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
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
