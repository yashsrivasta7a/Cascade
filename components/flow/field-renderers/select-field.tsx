"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { SelectFieldConfig } from "@/lib/config/types";

interface SelectFieldProps {
 config: SelectFieldConfig;
 value: string;
 onChange: (value: string) => void;
 disabled?: boolean;
 className?: string;
}

function SelectFieldComponent({
 config,
 value,
 onChange,
 disabled = false,
 className,
}: SelectFieldProps) {
 // Normalize options to value/label pairs
 const options = config.options.map((opt) =>
 typeof opt === "string" ? { value: opt, label: opt } : opt
 );

 return (
 <div className={className}>
 {/* Label */}
 {config.label && (
 <label className="block text-[10px] text-slate-800 dark:text-zinc-500 mb-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
 {config.label}
 {config.required && <span className="text-red-500 ml-0.5">*</span>}
 </label>
 )}

 <div className="relative">
 <select
 value={value}
 onChange={(e) => onChange(e.target.value)}
 disabled={disabled}
 className={cn(
 "nodrag nowheel w-full h-8 px-3 pr-8 rounded-lg border text-xs appearance-none",
 "bg-white dark:bg-zinc-900 border-gray-400 dark:border-white/10",
 "text-slate-900 dark:text-zinc-300",
 "focus:outline-none focus:border-blue-400 dark:focus:border-white/20",
 "transition-colors cursor-pointer",
 "[&>option]:bg-white [&>option]:dark:bg-zinc-900",
 "[&>option]:text-slate-900 [&>option]:dark:text-zinc-300",
 disabled && "cursor-not-allowed opacity-60"
 )}
 >
 {options.map((opt) => (
 <option 
 key={opt.value} 
 value={opt.value}
 className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-300"
 >
 {opt.label}
 </option>
 ))}
 </select>
 
 {/* Custom dropdown arrow */}
 <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-800 dark:text-zinc-500 pointer-events-none" />
 </div>

 {/* Description */}
 {config.description && (
 <p className="mt-1 text-[9px] text-slate-800 dark:text-zinc-600">
 {config.description}
 </p>
 )}
 </div>
 );
}

export const SelectField = memo(SelectFieldComponent);
