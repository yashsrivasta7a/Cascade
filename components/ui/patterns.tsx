"use client";

import { cn } from "@/lib/utils";

export function DotPattern({ className }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="dot-pattern"
          x="0"
          y="0"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-pattern)" />
    </svg>
  );
}

export function GridPattern({ className }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="grid-pattern"
          x="0"
          y="0"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    </svg>
  );
}

export function PageBackground({
  children,
  showDots = true,
  className
}: {
  children: React.ReactNode;
  showDots?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("h-full flex flex-col bg-[#909192] dark:bg-[#09090b] relative overflow-hidden", className)}>
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {showDots && (
          <DotPattern className="text-gray-300 dark:text-zinc-800/40 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black_70%)]" />
        )}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/[0.02] dark:bg-blue-600/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-600/[0.02] dark:bg-cyan-600/[0.03] rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>
      {/* Content */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "zinc",
  className
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  color?: "zinc" | "violet" | "blue" | "emerald" | "amber" | "red";
  className?: string;
}) {
  const colorMap = {
    zinc: "text-zinc-500 hover:border-zinc-700/60",
    violet: "text-violet-500 hover:border-violet-500/20",
    blue: "text-blue-500 hover:border-blue-500/20",
    emerald: "text-emerald-500 hover:border-emerald-500/20",
    amber: "text-amber-500 hover:border-amber-500/20",
    red: "text-red-500 hover:border-red-500/20",
  };

  return (
    <div className={cn(
      "relative p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group transition-colors",
      colorMap[color],
      className
    )}>
      <DotPattern className={cn(
        "transition-colors",
        color === "zinc" ? "text-zinc-500/5 group-hover:text-zinc-500/10" :
          color === "violet" ? "text-violet-500/5 group-hover:text-violet-500/10" :
            color === "blue" ? "text-blue-500/5 group-hover:text-blue-500/10" :
              color === "emerald" ? "text-emerald-500/5 group-hover:text-emerald-500/10" :
                color === "amber" ? "text-amber-500/5 group-hover:text-amber-500/10" :
                  "text-red-500/5 group-hover:text-red-500/10"
      )} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          {Icon && <Icon className={cn("w-4 h-4", colorMap[color].split(" ")[0])} />}
          <span className="text-xs text-zinc-500">{label}</span>
        </div>
        <span className="text-3xl font-semibold text-white tabular-nums">
          {value}
        </span>
      </div>
    </div>
  );
}
