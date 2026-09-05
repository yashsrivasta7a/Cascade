"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import {
 User,
 CreditCard,
 LogOut,
 Moon,
 Sun,
 Settings,
} from "lucide-react";
import { useTheme } from "next-themes";

export function UserMenu() {
 const { user } = useUser();
 const { signOut } = useClerk();
 const { theme, setTheme, resolvedTheme } = useTheme();
 const [showDropdown, setShowDropdown] = useState(false);
 const [mounted, setMounted] = useState(false);

 // Avoid hydration mismatch
 useEffect(() => {
 setMounted(true);
 }, []);

 const currentTheme = mounted ? resolvedTheme : "dark";

 return (
 <div className="flex items-center gap-2">
 {/* Theme Toggle */}
 <button
 onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
 className="p-2 rounded-lg text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-white/70 dark:hover:bg-zinc-800/50 transition-colors"
 title={currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
 >
 {mounted && currentTheme === "dark" ? (
 <Sun className="w-4 h-4" />
 ) : (
 <Moon className="w-4 h-4" />
 )}
 </button>

 {/* User Profile Dropdown */}
 <div className="relative">
 <button
 onClick={() => setShowDropdown(!showDropdown)}
 className="flex items-center justify-center w-8 h-8 rounded-full overflow-hidden ring-2 ring-gray-200 dark:ring-zinc-800 hover:ring-gray-300 dark:hover:ring-zinc-700 transition-all"
 >
 {user?.imageUrl ? (
 <img
 src={user.imageUrl}
 alt={user.fullName || "User"}
 className="w-full h-full object-cover"
 />
 ) : (
 <div className="w-full h-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
 <User className="w-4 h-4 text-white" />
 </div>
 )}
 </button>
 <AnimatePresence>
 {showDropdown && (
 <>
 {/* Backdrop */}
 <div
 className="fixed inset-0 z-40"
 onClick={() => setShowDropdown(false)}
 />
 <motion.div
 initial={{ opacity: 0, y: -4, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: -4, scale: 0.95 }}
 className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 border border-blue-100 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50"
 >
 {/* User Info with Avatar */}
 <div className="px-4 py-4 border-b border-gray-100 dark:border-zinc-800">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-gray-100 dark:ring-zinc-700 shrink-0">
 {user?.imageUrl ? (
 <img
 src={user.imageUrl}
 alt={user.fullName || "User"}
 className="w-full h-full object-cover"
 />
 ) : (
 <div className="w-full h-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
 <User className="w-5 h-5 text-white" />
 </div>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-slate-900 dark:text-zinc-200 truncate">
 {user?.fullName || "User"}
 </p>
 <p className="text-xs text-slate-700 dark:text-zinc-500 truncate">
 {user?.primaryEmailAddress?.emailAddress}
 </p>
 </div>
 </div>
 </div>

 {/* Menu Items */}
 <div className="py-1">
 <Link href="/settings?tab=profile">
 <button
 onClick={() => setShowDropdown(false)}
 className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-slate-800 dark:text-zinc-400 hover:bg-white/60 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors"
 >
 <User className="w-4 h-4" />
 Profile
 </button>
 </Link>
 <Link href="/settings?tab=appearance">
 <button
 onClick={() => setShowDropdown(false)}
 className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-slate-800 dark:text-zinc-400 hover:bg-white/60 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors"
 >
 <Settings className="w-4 h-4" />
 Settings
 </button>
 </Link>
 <Link href="/billing">
 <button
 onClick={() => setShowDropdown(false)}
 className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-slate-800 dark:text-zinc-400 hover:bg-white/60 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors"
 >
 <CreditCard className="w-4 h-4" />
 Billing
 </button>
 </Link>
 </div>

 {/* Theme Toggle in Menu */}
 <div className="px-4 py-2 border-t border-gray-100 dark:border-zinc-800">
 <div className="flex items-center justify-between">
 <span className="text-xs text-slate-700 dark:text-zinc-500">Theme</span>
 <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-800 rounded-lg">
 <button
 onClick={() => setTheme("light")}
 className={`p-1.5 rounded-md transition-colors ${
 mounted && theme === "light"
 ? "bg-white dark:bg-zinc-700 text-amber-500 shadow-sm"
 : "text-slate-800 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-slate-700"
 }`}
 >
 <Sun className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={() => setTheme("dark")}
 className={`p-1.5 rounded-md transition-colors ${
 mounted && theme === "dark"
 ? "bg-white dark:bg-zinc-700 text-blue-500 shadow-sm"
 : "text-slate-800 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-slate-700"
 }`}
 >
 <Moon className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 </div>

 {/* Logout */}
 <div className="border-t border-gray-100 dark:border-zinc-800 py-1">
 <button
 onClick={() => {
 setShowDropdown(false);
 signOut({ redirectUrl: "/sign-in" });
 }}
 className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
 >
 <LogOut className="w-4 h-4" />
 Log out
 </button>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 </div>
 );
}
