"use client";

import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "accent" | "secondary";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-white/5 text-white/60 border-white/10",
    success: "bg-white/5 text-white/70 border-white/10",
    warning: "bg-white/5 text-white/70 border-white/10",
    error: "bg-white/5 text-white/70 border-white/10",
    accent: "bg-white/5 text-white/70 border-white/10",
    secondary: "bg-white/5 text-white/70 border-white/10",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border backdrop-blur-sm",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
