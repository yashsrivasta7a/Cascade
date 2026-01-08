"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Workflow,
  Zap,
  Sparkles,
  CreditCard,
  Settings,
  Plus,
} from "lucide-react";

// =============================================================================
// NAV CONFIG
// =============================================================================

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Workflows", href: "/workflows", icon: Workflow },
  { label: "Executions", href: "/executions", icon: Zap },
  { label: "Templates", href: "/templates", icon: Sparkles },
];

const bottomItems = [
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 h-screen flex flex-col bg-zinc-950 border-r border-zinc-900">
      {/* Logo */}
      <Link 
        href="/dashboard" 
        className="h-14 px-4 flex items-center gap-2.5 border-b border-zinc-900"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-zinc-100">Flowsmith</span>
      </Link>

      {/* New Workflow */}
      <div className="p-3">
        <Link href="/workflows/new">
          <button className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-2 py-2">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-zinc-900 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                  )}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Nav */}
      <div className="px-2 py-2 border-t border-zinc-900">
        <div className="space-y-0.5">
          {bottomItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-zinc-900 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* User */}
      <div className="p-3 border-t border-zinc-900">
        <div className="flex items-center gap-2.5">
          <UserButton 
            afterSignOutUrl="/sign-in"
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
                userButtonPopoverCard: "bg-zinc-900 border border-zinc-800",
                userButtonPopoverActionButton: "text-zinc-300 hover:bg-zinc-800",
                userButtonPopoverActionButtonText: "text-zinc-300",
                userButtonPopoverFooter: "hidden",
              },
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-400 truncate">Account</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
