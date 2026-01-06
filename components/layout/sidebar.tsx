"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Workflow,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Zap,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Workflows",
    href: "/workflows",
    icon: <Workflow className="w-5 h-5" />,
  },
  {
    label: "Executions",
    href: "/executions",
    icon: <Zap className="w-5 h-5" />,
  },
  {
    label: "Templates",
    href: "/templates",
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    label: "Billing",
    href: "/billing",
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Settings className="w-5 h-5" />,
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="h-screen flex flex-col bg-zinc-950 border-r border-zinc-800/50"
    >
      {/* Logo */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-zinc-800/50">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="font-bold text-lg text-zinc-100"
              >
                Flowsmith
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* New Workflow Button */}
      <div className="p-4">
        <Link href="/workflows/new">
          <Button
            className={cn(
              "w-full justify-center gap-2",
              collapsed && "px-0"
            )}
            variant="primary"
          >
            <Plus className="w-4 h-4" />
            {!collapsed && <span>New Workflow</span>}
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="px-3 mb-2">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Main Menu</p>
        </div>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-white/[0.03] text-white shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset]"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                )}
                whileTap={{ scale: 0.98 }}
              >
                <span className={cn(
                  "transition-colors duration-200",
                  isActive ? "text-zinc-200" : "group-hover:text-zinc-300"
                )}>
                  {item.icon}
                </span>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="font-medium text-sm"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 w-1 h-4 bg-white/20 rounded-r-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}

        {!collapsed && (
          <div className="mt-8 px-3">
             <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1 mb-2">Library</p>
             <div className="space-y-1">
                {['Templates', 'Assets', 'Logs'].map((subItem) => (
                  <button key={subItem} className="w-full flex items-center px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-white/[0.02]">
                    {subItem}
                  </button>
                ))}
             </div>
          </div>
        )}
      </nav>

      {/* Pro Upgrade Card */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-transparent border border-cyan-500/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-zinc-100">Upgrade to Pro</span>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              Unlock unlimited workflows and advanced AI nodes.
            </p>
            <Button size="sm" variant="outline" className="w-full">
              Learn More
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User */}
      <div className="p-4 border-t border-zinc-800/50">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <span className="text-sm font-semibold text-white">U</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-zinc-100 truncate">User</p>
                <p className="text-xs text-zinc-500 truncate">user@example.com</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}

