"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  Command,
  X,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications] = useState(3);

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-40">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {title && (
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-white tracking-tight leading-none mb-1">{title}</h1>
            {description && (
              <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{description}</p>
            )}
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <AnimatePresence>
          {searchOpen ? (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <Input
                placeholder="Search workflows..."
                leftIcon={<Search className="w-4 h-4" />}
                rightIcon={
                  <button
                    onClick={() => setSearchOpen(false)}
                    className="p-0.5 rounded hover:bg-zinc-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                }
                autoFocus
                className="h-9"
              />
            </motion.div>
          ) : (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">Search...</span>
              <div className="flex items-center gap-0.5 ml-4 text-xs">
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                  <Command className="w-3 h-3" />
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">K</kbd>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {notifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold text-white flex items-center justify-center border border-white/10">
              {notifications}
            </span>
          )}
        </Button>

        {/* Custom Actions */}
        {actions}
      </div>
    </header>
  );
}

interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function Toolbar({ children, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        "h-12 px-4 flex items-center gap-2 border-b border-zinc-800/50 bg-zinc-900/50",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarDivider() {
  return <div className="w-px h-6 bg-zinc-800" />;
}

