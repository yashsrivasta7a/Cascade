"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui";
import {
 LayoutDashboard,
 Waypoints,
 Activity as ActivityIcon,
 Receipt,
 CreditCard,
 Settings2,
 Plus,
 ExternalLink,
 FileText,
 ChevronLeft,
} from "lucide-react";

// =============================================================================
// NAV CONFIG
// =============================================================================

const navItems = [
 { label: "Workflows", href: "/workflows", icon: Waypoints },
 { label: "Activity", href: "/executions", icon: ActivityIcon },
];

const bottomItems = [
 { label: "Billing", href: "/billing", icon: CreditCard },
 { label: "Settings", href: "/settings", icon: Settings2 },
];

const DOCS_URL = "/docs";

// =============================================================================
// COMPONENT
// =============================================================================

export function Sidebar() {
 const pathname = usePathname();
 const [isCollapsed, setIsCollapsed] = useState(false);

 return (
 <aside
 className={cn(
 "h-screen flex flex-col bg-[#e5eefb] dark:bg-[#09090b] border-r border-blue-100 dark:border-zinc-800/60 text-sm font-sans relative overflow-hidden transition-all duration-300 ease-in-out shrink-0",
 isCollapsed ? "w-[80px] xl:w-[260px]" : "w-[260px]"
 )}
 >
 {/* Decorative background glow */}
 <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-500/10 dark:from-blue-500/10 to-transparent pointer-events-none" />

 {/* Header */}
 <div className={cn("h-20 flex items-center relative z-10", isCollapsed ? "justify-center px-0 xl:justify-start xl:px-6" : "px-6")}>
 <Link href="/workflows" className="flex items-center gap-3 shrink-0 outline-none">
 <Logo className="w-8 h-8 text-slate-900 dark:text-zinc-100" />
 <span className={cn(
 "font-display font-bold text-[29px] text-slate-900 dark:text-zinc-100 uppercase tracking-[0.14em]",
 isCollapsed ? "hidden xl:block" : "block"
 )}>
 Cascade
 </span>
 </Link>
 </div>


 {/* Navigation */}
 <div className={cn("flex-1 space-y-8 overflow-y-auto relative z-10 pb-4 custom-scrollbar", isCollapsed ? "px-3 xl:px-4" : "px-4")}>
 <div>
 <div className={cn("px-3 text-[13px] font-bold text-slate-600 dark:text-zinc-500 mb-1 tracking-wider uppercase truncate", isCollapsed ? "hidden xl:block" : "block")}>
 Overview
 </div>
 <div className={cn("w-full border-t border-zinc-200 dark:border-zinc-800/60 my-2 xl:hidden", isCollapsed ? "block" : "hidden")} />

 <nav className="space-y-1.5">
 {navItems.map((item) => {
 const isActive = pathname.startsWith(item.href);
 const Icon = item.icon;

 return (
 <Link key={item.href} href={item.href} className="block outline-none">
 <div className="relative group">
 {isActive && (
 <motion.div
 layoutId="activeNav"
 className="absolute inset-0 bg-white dark:bg-zinc-800/80 rounded-lg shadow-sm border border-zinc-200/60 dark:border-zinc-700/50"
 initial={false}
 transition={{ type: "spring", stiffness: 400, damping: 30 }}
 />
 )}
 <div
 className={cn(
 "relative flex items-center gap-2 py-3 rounded-lg text-[15px] transition-colors duration-200",
 isCollapsed ? "justify-center px-0 xl:justify-start xl:px-3" : "px-3",
 isActive
 ? "text-slate-900 dark:text-zinc-100 font-semibold"
 : "text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40"
 )}
 >
 <motion.div
 className={cn(
 "w-9 h-9 rounded-md flex items-center justify-center transition-colors shrink-0",
 isActive
 ? " shadow-sm"
 : "text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-700"
 )}
 whileHover={{ scale: isActive ? 1 : 1.1 }}
 whileTap={{ scale: 0.95 }}
 >
 <Icon className="w-5 h-5" />
 </motion.div>
 <span className={cn("truncate", isCollapsed ? "hidden xl:inline" : "inline")}>{item.label}</span>
 </div>
 </div>
 </Link>
 );
 })}
 </nav>
 </div>

 <div>
 <div className={cn("px-3 text-[13px] font-bold text-slate-600 dark:text-zinc-500 mb-1 tracking-wider uppercase truncate", isCollapsed ? "hidden xl:block" : "block")}>
 Account
 </div>
 <div className={cn("w-full border-t border-zinc-200 dark:border-zinc-800/60 my-2 xl:hidden", isCollapsed ? "block" : "hidden")} />

 <nav className="space-y-1.5">
 {bottomItems.map((item) => {
 const isActive = pathname.startsWith(item.href);
 const Icon = item.icon;

 return (
 <Link key={item.href} href={item.href} className="block outline-none">
 <div className="relative group">
 {isActive && (
 <motion.div
 layoutId="activeNav"
 className="absolute inset-0 bg-white dark:bg-zinc-800/80 rounded-lg shadow-sm border border-zinc-200/60 dark:border-zinc-700/50"
 initial={false}
 transition={{ type: "spring", stiffness: 400, damping: 30 }}
 />
 )}
 <div
 className={cn(
 "relative flex items-center gap-2 py-3 rounded-lg text-[15px] transition-colors duration-200",
 isCollapsed ? "justify-center px-0 xl:justify-start xl:px-3" : "px-3",
 isActive
 ? "text-slate-900 dark:text-zinc-100 font-semibold"
 : "text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40"
 )}
 >
 <motion.div
 className={cn(
 "w-9 h-9 rounded-md flex items-center justify-center transition-colors shrink-0",
 isActive
 ? " shadow-sm"
 : "text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-700"
 )}
 whileHover={{ scale: isActive ? 1 : 1.1 }}
 whileTap={{ scale: 0.95 }}
 >
 <Icon className="w-5 h-5" />
 </motion.div>
 <span className={cn("truncate", isCollapsed ? "hidden xl:inline" : "inline")}>{item.label}</span>
 </div>
 </div>
 </Link>
 );
 })}
 </nav>
 </div>
 </div>

 {/* Footer / Docs */}
 <div className={cn("relative z-10 border-t border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-[#09090b]/80 space-y-2", isCollapsed ? "p-3 xl:p-4" : "p-4")}>
 {/* Collapse toggle. Sits on the same 9x9 icon rail as the docs card and
 every nav row below it, so the control never moves between states -
 only the chevron turns. Collapsing is a sub-xl affordance: at xl the
 sidebar is always 260px, so the button has nothing to do. */}
 <button
 type="button"
 onClick={() => setIsCollapsed(!isCollapsed)}
 aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
 aria-expanded={!isCollapsed}
 className={cn(
 "group w-full flex items-center rounded-lg text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40 transition-colors xl:hidden",
 isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2"
 )}
 >
 <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0">
 <ChevronLeft className={cn("w-5 h-5 transition-transform duration-300", isCollapsed && "rotate-180")} />
 </div>
 <span className={cn("font-medium text-[15px] truncate", isCollapsed ? "hidden" : "inline")}>Collapse</span>
 </button>

 <a
 href={DOCS_URL}
 target="_blank"
 rel="noopener noreferrer"
 className="block outline-none"
 >
 <motion.div
 whileHover={{ y: -2 }}
 whileTap={{ scale: 0.98 }}
 className={cn(
 "group flex items-center rounded-lg text-slate-700 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-blue-500/30 hover:shadow-md hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300",
 isCollapsed ? "justify-center p-2 xl:justify-start xl:p-3 xl:gap-3" : "gap-3 px-3 py-3"
 )}
 >
 <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-500/20 transition-colors shrink-0">
 <FileText className="w-5 h-5" />
 </div>

 <div className={cn("items-center flex-1", isCollapsed ? "hidden xl:flex" : "flex")}>
 <span className="font-semibold text-[15px] truncate">API Docs</span>
 <ExternalLink className="w-[18px] h-[18px] ml-auto opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
 </div>
 </motion.div>
 </a>
 </div>
 </aside>
 );
}
