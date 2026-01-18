"use client";

import { memo, useEffect } from "react";
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
  // Clamp value to min/max if defined (handles out-of-range values from connections)
  const clampedValue = value !== undefined && config.min !== undefined && config.max !== undefined
    ? Math.min(Math.max(value, config.min), config.max)
    : value;

  // If value is out of range (e.g., from a settings connection), update to clamped value
  useEffect(() => {
    if (value !== undefined && clampedValue !== undefined && value !== clampedValue && !disabled) {
      onChange(clampedValue);
    }
  }, [value, clampedValue, onChange, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      onChange(undefined);
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        // Clamp to min/max when user types
        const clamped = config.min !== undefined && config.max !== undefined
          ? Math.min(Math.max(num, config.min), config.max)
          : num;
        onChange(clamped);
      }
    }
  };

  return (
    <div className={className}>
      {/* Label */}
      {config.label && (
        <label className="block text-[10px] text-gray-600 dark:text-zinc-500 mb-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {config.label}
          {config.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <input
        type="number"
        value={clampedValue ?? ""}
        onChange={handleChange}
        placeholder={config.placeholder ?? "Enter number"}
        min={config.min}
        max={config.max}
        step={config.step}
        disabled={disabled}
        className={cn(
          "nodrag nowheel w-full h-8 px-3 rounded-lg border text-xs",
          "bg-white dark:bg-zinc-900/60 border-gray-400 dark:border-white/10",
          "text-gray-900 dark:text-zinc-100",
          "placeholder-gray-400 dark:placeholder-zinc-600",
          "focus:outline-none focus:border-blue-400 dark:focus:border-white/20",
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
  // Clamp value to min/max range to prevent slider overflow when receiving out-of-range values
  // Also handle NaN values (e.g., from unparsed LLM outputs) by falling back to default or min
  // Ensure default value is a valid number, otherwise use min
  const defaultValue = (typeof config.defaultValue === 'number' && !isNaN(config.defaultValue)) 
    ? config.defaultValue 
    : config.min;
  const safeValue = (typeof value === 'number' && !isNaN(value)) ? value : defaultValue;
  const clampedValue = Math.min(Math.max(safeValue, config.min), config.max);
  const percentage = ((clampedValue - config.min) / (config.max - config.min)) * 100;

  // If value is out of range (e.g., from a settings connection), update to clamped value
  useEffect(() => {
    if (value !== clampedValue && !disabled) {
      onChange(clampedValue);
    }
  }, [value, clampedValue, onChange, disabled]);

  return (
    <div className={className}>
      {/* Label with value */}
      <div className="flex items-center justify-between mb-1">
        {config.label && (
          <label className="text-[10px] text-gray-600 dark:text-zinc-500" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            {config.label}
            {config.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        {config.showValue && (
          <span className="text-[10px] text-gray-700 dark:text-zinc-400 font-mono font-medium">
            {clampedValue}
          </span>
        )}
      </div>

      {/* Slider track */}
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-1.5 bg-gray-400 dark:bg-zinc-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <input
          type="range"
          value={clampedValue}
          onChange={(e) => {
            const newVal = parseFloat(e.target.value);
            console.log(`[SliderField] ${config.id} onChange: ${newVal}`);
            onChange(newVal);
          }}
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
            "absolute w-4 h-4 bg-blue-500 rounded-full shadow-md shadow-blue-500/30 border-2 border-white dark:border-blue-400",
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

// TEMP: Removed memo to debug
export const SliderField = SliderFieldComponent;
