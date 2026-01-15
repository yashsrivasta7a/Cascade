"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { NumberFieldConfig, SliderFieldConfig } from "@/lib/config/types";

interface NumberFieldProps {
  config: NumberFieldConfig;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
  className?: string;
}

function NumberFieldComponent({
  config,
  value,
  onChange,
  disabled = false,
  className,
}: NumberFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      onChange(undefined);
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        onChange(num);
      }
    }
  };

  return (
    <div className={className}>
      {/* Label */}
      {config.label && (
        <label className="block text-[10px] text-zinc-500 mb-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {config.label}
          {config.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}

      <input
        type="number"
        value={value ?? ""}
        onChange={handleChange}
        placeholder={config.placeholder ?? "Enter number"}
        min={config.min}
        max={config.max}
        step={config.step}
        disabled={disabled}
        className={cn(
          "nodrag nowheel w-full h-8 px-3 rounded-lg border text-xs",
          "bg-gray-50 dark:bg-zinc-900/60 border-gray-200 dark:border-white/10",
          "text-gray-900 dark:text-zinc-100",
          "placeholder-gray-400 dark:placeholder-zinc-600",
          "focus:outline-none focus:border-gray-400 dark:focus:border-white/20",
          "transition-colors",
          disabled && "cursor-not-allowed opacity-60"
        )}
      />

      {/* Description */}
      {config.description && (
        <p className="mt-1 text-[9px] text-gray-400 dark:text-zinc-600">
          {config.description}
        </p>
      )}
    </div>
  );
}

export const NumberField = memo(NumberFieldComponent);

// =============================================================================
// SLIDER FIELD
// =============================================================================

interface SliderFieldProps {
  config: SliderFieldConfig;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

function SliderFieldComponent({
  config,
  value,
  onChange,
  disabled = false,
  className,
}: SliderFieldProps) {
  const step = config.step ?? 1;
  const percentage = ((value - config.min) / (config.max - config.min)) * 100;

  return (
    <div className={className}>
      {/* Label with value */}
      <div className="flex items-center justify-between mb-1">
        {config.label && (
          <label className="text-[10px] text-zinc-500" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            {config.label}
            {config.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
        )}
        {config.showValue && (
          <span className="text-[10px] text-gray-600 dark:text-zinc-400 font-mono">
            {value}
          </span>
        )}
      </div>

      {/* Slider track */}
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 dark:bg-white rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <input
          type="range"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          min={config.min}
          max={config.max}
          step={step}
          disabled={disabled}
          className={cn(
            "nodrag nowheel absolute inset-0 w-full h-full opacity-0 cursor-pointer",
            disabled && "cursor-not-allowed"
          )}
        />

        {/* Thumb indicator */}
        <div
          className={cn(
            "absolute w-4 h-4 bg-white dark:bg-zinc-200 rounded-full shadow-md border border-gray-200 dark:border-zinc-400",
            "pointer-events-none transition-all"
          )}
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>

      {/* Min/Max labels */}
      <div className="flex justify-between mt-0.5">
        <span className="text-[8px] text-gray-400 dark:text-zinc-600">{config.min}</span>
        <span className="text-[8px] text-gray-400 dark:text-zinc-600">{config.max}</span>
      </div>

      {/* Description */}
      {config.description && (
        <p className="mt-1 text-[9px] text-gray-400 dark:text-zinc-600">
          {config.description}
        </p>
      )}
    </div>
  );
}

export const SliderField = memo(SliderFieldComponent);
