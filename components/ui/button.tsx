"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "gradient";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      relative inline-flex items-center justify-center gap-2
      font-medium transition-all duration-200
      focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#101010]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    `;

    const variants = {
      primary: `
        bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold
        shadow-lg shadow-cyan-500/25
        hover:from-cyan-600 hover:to-violet-600
        active:scale-[0.98]
      `,
      gradient: `
        bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold
        shadow-lg shadow-violet-500/25
        hover:from-violet-500 hover:to-indigo-500
        active:scale-[0.98]
      `,
      secondary: `
        bg-gray-100 text-gray-700 font-semibold
        border border-gray-300
        hover:bg-gray-200 hover:border-gray-400
        dark:bg-zinc-800 dark:text-white
        dark:border-zinc-700/50
        dark:hover:bg-zinc-700 dark:hover:border-zinc-600/50
        active:scale-[0.98]
      `,
      ghost: `
        bg-transparent
        text-gray-500 dark:text-zinc-400
        hover:text-gray-900 dark:hover:text-white
        hover:bg-gray-100 dark:hover:bg-zinc-800/50
      `,
      outline: `
        bg-transparent
        border border-gray-300 dark:border-zinc-700/50
        text-gray-600 dark:text-zinc-300
        hover:border-gray-400 dark:hover:border-zinc-600
        hover:bg-gray-100 dark:hover:bg-zinc-800/50
        hover:text-gray-900 dark:hover:text-white
      `,
      danger: `
        bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400
        border border-red-200 dark:border-red-500/20
        hover:bg-red-100 dark:hover:bg-red-500/20 hover:border-red-300 dark:hover:border-red-500/30
      `,
    };

    const sizes = {
      sm: "h-8 px-3 text-xs rounded-lg",
      md: "h-10 px-4 text-sm rounded-xl",
      lg: "h-12 px-6 text-sm rounded-xl",
      icon: "h-10 w-10 rounded-xl",
    };

    return (
      <motion.button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        whileTap={{ scale: 0.98 }}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : leftIcon ? (
          leftIcon
        ) : null}
        {children}
        {rightIcon && !isLoading ? rightIcon : null}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
