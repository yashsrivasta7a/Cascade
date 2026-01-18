"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { ToggleFieldConfig } from "@/lib/config/types";

interface ToggleFieldProps {
  config: ToggleFieldConfig;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function ToggleFieldComponent({
  config,
  value,
  onChange,
  disabled = false,
  className,
}: ToggleFieldProps) {
  return (
    <label
      className={cn(
        "nodrag nowheel flex items-center justify-between gap-3 p-2.5 rounded-lg cursor-pointer",
        "bg-white dark:bg-white/[0.02] border border-gray-400 dark:border-white/10",
        "hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      <div className="flex-1">
        <span className="text-[11px] text-gray-700 dark:text-zinc-300 font-medium">
          {config.label}
        </span>
        {config.description && (
          <p className="text-[9px] text-gray-400 dark:text-zinc-600 mt-0.5">
            {config.description}
          </p>
        )}
      </div>

      {/* Toggle switch */}
      <div className="relative">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className={cn(
            "w-9 h-5 rounded-full transition-colors",
            "bg-gray-300 dark:bg-zinc-700",
            "peer-checked:bg-blue-500 dark:peer-checked:bg-blue-500",
            "peer-focus:ring-2 peer-focus:ring-blue-500/20"
          )}
        />
        <div
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform",
            "bg-white shadow-sm",
            value && "translate-x-4"
          )}
        />
      </div>
    </label>
  );
}

export const ToggleField = memo(ToggleFieldComponent);
