"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import {
  LayoutDashboard,
  Workflow,
  Zap,
  Sparkles,
  CreditCard,
  Settings,
  Plus,
  BookOpen,
  Activity,
} from "lucide-react";

// =============================================================================
// NAV CONFIG
// =============================================================================

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Workflows", href: "/workflows", icon: Workflow },
  { label: "Activity", href: "/executions", icon: Activity },
  { label: "Templates", href: "/templates", icon: Sparkles },
];

const bottomItems = [
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Pricing", href: "/ledger", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 h-screen flex flex-col bg-[#09090b] border-r border-zinc-800/60">
      {/* Logo */}
      <Link 
        href="/dashboard" 
        className="h-14 px-4 flex items-center gap-2.5 border-b border-zinc-800/60"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-zinc-100">Flowsmith</span>
      </Link>

      {/* New Workflow */}
      <div className="p-3">
        <Link href="/workflows/new">
          <Button variant="primary" size="sm" className="w-full" leftIcon={<Plus className="w-4 h-4" />}>
            New Workflow
          </Button>
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
                      ? "bg-zinc-800/80 text-white"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  )}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className={cn("w-4 h-4", isActive && "text-blue-400")} />
                  <span className="font-medium">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Nav */}
      <div className="px-2 py-2 border-t border-zinc-800/60">
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
                      ? "bg-zinc-800/80 text-white"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
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
      <div className="p-3 border-t border-zinc-800/60">
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
