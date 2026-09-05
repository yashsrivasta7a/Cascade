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
  <label className="text-sm font-medium text-slate-700 dark:text-zinc-400">{label}</label>
  )}
  <div className="relative">
  {leftIcon && (
  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">
  {leftIcon}
  </div>
  )}
  <input
  ref={ref}
  className={cn(
  `w-full h-11 px-4 rounded-xl
  bg-white dark:bg-zinc-900/50 
  border border-[#6b6b6b] dark:border-zinc-800/60
  text-slate-900 dark:text-white 
  placeholder-slate-400 dark:placeholder-zinc-500
  transition-all duration-200
  focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 
  hover:border-gray-400 dark:hover:border-zinc-700
  disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-zinc-800/50`,
  leftIcon && "pl-11",
  rightIcon && "pr-11",
  error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/10",
  className
  )}
  {...props}
  />
  {rightIcon && (
  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">
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
