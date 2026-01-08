"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
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
      focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101010]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    `;

    const variants = {
      primary: `
        bg-white/10 text-white font-semibold
        border border-white/15
        hover:bg-white/15 hover:border-white/25
        active:scale-[0.98]
      `,
      secondary: `
        bg-white/5 text-white/90 font-semibold
        border border-white/10
        hover:bg-white/10 hover:border-white/20
        active:scale-[0.98]
      `,
      ghost: `
        bg-transparent
        text-white/60
        hover:text-white
        hover:bg-white/5
      `,
      outline: `
        bg-transparent
        border border-white/10
        text-white/80
        hover:border-white/20
        hover:bg-white/5
        hover:text-white
      `,
      danger: `
        bg-white/10
        text-white
        border border-white/15
        hover:bg-white/15 hover:border-white/25
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
