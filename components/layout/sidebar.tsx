"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Workflow,
  Zap,
  CreditCard,
  Settings,
  Plus,
  BookOpen,
  Activity,
  Sparkles,
  ExternalLink,
  FileText,
} from "lucide-react";

// =============================================================================
// NAV CONFIG
// =============================================================================

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "blue" },
  { label: "Workflows", href: "/workflows", icon: Workflow, color: "violet" },
  { label: "Activity", href: "/executions", icon: Activity, color: "emerald" },
];

const bottomItems = [
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Pricing", href: "/ledger", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings },
];

// External links
const DOCS_URL = "/docs"; // Redirects to Mintlify docs

// =============================================================================
// COMPONENT
// =============================================================================

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen flex flex-col bg-gradient-to-b from-slate-50 to-gray-100 dark:from-zinc-950 dark:to-zinc-900 border-r border-gray-200/80 dark:border-zinc-800/50">
      {/* Logo Header */}
      <Link 
        href="/dashboard" 
        className="h-16 px-5 flex items-center gap-3 border-b border-gray-200/80 dark:border-zinc-800/50 group"
      >
        <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-white/10 flex items-center justify-center border border-zinc-800 dark:border-white/10">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base text-gray-900 dark:text-white tracking-tight">Flowsmith</span>
          <span className="text-[10px] text-gray-500 dark:text-zinc-500 font-medium">Workflow Studio</span>
        </div>
      </Link>

      {/* New Workflow Button */}
      <div className="px-3 pt-4 pb-2">
        <Link href="/workflows/new">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-10 px-4 bg-zinc-900 dark:bg-white/10 hover:bg-zinc-800 dark:hover:bg-white/15 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 border border-zinc-800 dark:border-white/10 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </motion.button>
        </Link>
      </div>

      {/* Section Label */}
      <div className="px-5 pt-4 pb-2">
        <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wider">
          Menu
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            
            const colorClasses = {
              blue: {
                active: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
                icon: "text-blue-600 dark:text-blue-400",
                dot: "bg-blue-500",
              },
              violet: {
                active: "bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20",
                icon: "text-violet-600 dark:text-violet-400",
                dot: "bg-violet-500",
              },
              emerald: {
                active: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
                icon: "text-emerald-600 dark:text-emerald-400",
                dot: "bg-emerald-500",
              },
            }[item.color];

            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border",
                    isActive
                      ? cn(colorClasses.active, "text-gray-900 dark:text-white")
                      : "border-transparent text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-zinc-800/50"
                  )}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    isActive 
                      ? cn("bg-white dark:bg-zinc-900/50 shadow-sm", colorClasses.icon)
                      : "bg-gray-100 dark:bg-zinc-800/50 text-gray-500 dark:text-zinc-500"
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className={cn("absolute right-3 w-1.5 h-1.5 rounded-full", colorClasses.dot)}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Upgrade Card */}
      <div className="px-3 py-3">
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-200/80 dark:border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold text-gray-900 dark:text-white">Pro Plan</span>
            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Save 20%</span>
          </div>
          <p className="text-[11px] text-gray-600 dark:text-zinc-400 mb-3 leading-relaxed">
            Unlock unlimited workflows and priority support
          </p>
          <Link href="/billing">
            <button className="w-full h-8 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 rounded-lg border border-amber-300/50 dark:border-amber-500/30 transition-colors">
              Upgrade Now
            </button>
          </Link>
        </div>
      </div>

      {/* Bottom Section Label */}
      <div className="px-5 pt-2 pb-2">
        <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wider">
          Account
        </span>
      </div>

      {/* Bottom Navigation */}
      <div className="px-3 pb-2">
        <div className="space-y-0.5">
          {bottomItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                    isActive
                      ? "bg-gray-100 dark:bg-zinc-800/80 text-gray-900 dark:text-white"
                      : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100/60 dark:hover:bg-zinc-800/40"
                  )}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className={cn("w-4 h-4", isActive && "text-gray-700 dark:text-zinc-300")} />
                  <span className="font-medium">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* API Docs Link */}
      <div className="px-3 pb-4">
        <a 
          href={DOCS_URL} 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <motion.div
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100/60 dark:hover:bg-zinc-800/40 transition-all"
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
          >
            <FileText className="w-4 h-4" />
            <span className="font-medium">API Docs</span>
            <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
          </motion.div>
        </a>
      </div>
    </aside>
  );
}
