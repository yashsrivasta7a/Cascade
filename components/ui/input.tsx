"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
 label?: string;
 error?: string;
 leftIcon?: React.ReactNode;
 rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
 ({ className, label, error, leftIcon, rightIcon, ...props }, ref) => {
 return (
 <div className="space-y-2">
 {label && (
 <label className="text-sm font-medium text-white/70">{label}</label>
 )}
 <div className="relative">
 {leftIcon && (
 <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
 {leftIcon}
 </div>
 )}
 <input
 ref={ref}
 className={cn(
 `w-full h-11 px-4 rounded-xl
 bg-white border border-white/10
 text-white placeholder-white/30
 transition-all duration-200
 focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10 focus:bg-white/[0.05]
 hover:border-white/15 hover:bg-white/60/[0.07]
 disabled:opacity-50 disabled:cursor-not-allowed`,
 leftIcon && "pl-11",
 rightIcon && "pr-11",
 error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/10",
 className
 )}
 {...props}
 />
 {rightIcon && (
 <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40">
 {rightIcon}
 </div>
 )}
 </div>
 {error && <p className="text-sm text-red-400">{error}</p>}
 </div>
 );
 }
);

Input.displayName = "Input";

export { Input };
