"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Link2 } from "lucide-react";
import type { TextFieldConfig } from "@/lib/config/types";

interface TextFieldProps {
 config: TextFieldConfig;
 value: string;
 onChange: (value: string) => void;
 disabled?: boolean;
 isConnected?: boolean;
 className?: string;
}

function TextFieldComponent({
 config,
 value,
 onChange,
 disabled = false,
 isConnected = false,
 className,
}: TextFieldProps) {
 const isTextarea = config.type === "textarea";
 const rows = config.rows ?? 2;
 
 const baseClasses = cn(
 "nodrag nowheel w-full px-3 py-2 rounded-lg border text-xs",
 "text-slate-900 dark:text-zinc-100",
 "placeholder-gray-400 dark:placeholder-zinc-600",
 "focus:outline-none transition-colors",
 isConnected
 ? "bg-violet-50 dark:bg-violet-500/5 border-violet-300 dark:border-violet-500/20"
 : "bg-white dark:bg-white/[0.03] border-gray-400 dark:border-white/10 focus:border-blue-500 dark:focus:border-white/20",
 disabled && "cursor-not-allowed opacity-60",
 className
 );

 return (
 <div className="relative">
 {/* Connected indicator */}
 {isConnected && (
 <div className="absolute top-1 right-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30">
 <Link2 className="w-2.5 h-2.5 text-violet-600 dark:text-violet-400" />
 <span className="text-[8px] text-violet-400 font-medium">Linked</span>
 </div>
 )}

 {/* Label */}
 {config.label && (
 <label className="text-[10px] block text-slate-800 dark:text-zinc-500 mb-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
 {config.label}
 {config.required && <span className="text-red-500 ml-0.5">*</span>}
 </label>
 )}

 {isTextarea ? (
 <textarea
 value={value}
 onChange={(e) => !isConnected && onChange(e.target.value)}
 placeholder={isConnected ? "Waiting for connected node..." : config.placeholder}
 rows={rows}
 maxLength={config.maxLength}
 minLength={config.minLength}
 readOnly={isConnected || disabled}
 className={cn(baseClasses, "resize-none")}
 />
 ) : (
 <input
 type="text"
 value={value}
 onChange={(e) => !isConnected && onChange(e.target.value)}
 placeholder={isConnected ? "Waiting for connected node..." : config.placeholder}
 maxLength={config.maxLength}
 minLength={config.minLength}
 readOnly={isConnected || disabled}
 className={baseClasses}
 />
 )}

 {/* Character count for textarea */}
 {isTextarea && config.maxLength && (
 <div className="text-[9px] absolute bottom-2 right-2 text-slate-800 dark:text-zinc-600">
 {value.length}/{config.maxLength}
 </div>
 )}

 {/* Description */}
 {config.description && (
 <p className="text-[9px] mt-1 text-slate-800 dark:text-zinc-600">
 {config.description}
 </p>
 )}
 </div>
 );
}

export const TextField = memo(TextFieldComponent);
