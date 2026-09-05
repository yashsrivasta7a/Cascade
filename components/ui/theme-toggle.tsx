"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

interface ThemeToggleProps {
 className?: string;
 size?: "sm" | "md" | "lg";
}

export function ThemeToggle({ className, size = "md" }: ThemeToggleProps) {
 const [theme, setTheme] = useState<Theme>("dark");
 const [mounted, setMounted] = useState(false);

 // Only run on client
 useEffect(() => {
 setMounted(true);
 // Check localStorage or system preference
 const stored = localStorage.getItem("theme") as Theme | null;
 if (stored) {
 setTheme(stored);
 document.documentElement.classList.remove("light", "dark");
 document.documentElement.classList.add(stored);
 } else {
 // Default to dark
 setTheme("dark");
 }
 }, []);

 const toggleTheme = () => {
 const newTheme = theme === "dark" ? "light" : "dark";
 setTheme(newTheme);
 localStorage.setItem("theme", newTheme);
 document.documentElement.classList.remove("light", "dark");
 document.documentElement.classList.add(newTheme);
 };

 const sizes = {
 sm: "h-8 w-8",
 md: "h-9 w-9",
 lg: "h-10 w-10",
 };

 const iconSizes = {
 sm: "w-4 h-4",
 md: "w-[18px] h-[18px]",
 lg: "w-5 h-5",
 };

 // Prevent hydration mismatch
 if (!mounted) {
 return (
 <div
 className={cn(
 sizes[size],
 "rounded-xl bg-zinc-800/50 border border-zinc-700/50",
 className
 )}
 />
 );
 }

 return (
 <motion.button
 onClick={toggleTheme}
 whileTap={{ scale: 0.95 }}
 className={cn(
 sizes[size],
 "relative flex items-center justify-center rounded-xl transition-all duration-300",
 "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
 theme === "dark"
 ? "bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-700/50 hover:border-zinc-600/50 text-slate-600 hover:text-zinc-200 focus-visible:ring-zinc-500 focus-visible:ring-offset-zinc-900"
 : "bg-white border border-blue-100 hover:bg-white/60 hover:border-gray-300 text-slate-700 hover:text-slate-900 shadow-sm focus-visible:ring-indigo-500 focus-visible:ring-offset-white",
 className
 )}
 title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
 aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
 >
 <AnimatePresence mode="wait" initial={false}>
 {theme === "dark" ? (
 <motion.div
 key="sun"
 initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
 animate={{ opacity: 1, rotate: 0, scale: 1 }}
 exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
 transition={{ duration: 0.2, ease: "easeInOut" }}
 >
 <Sun className={iconSizes[size]} />
 </motion.div>
 ) : (
 <motion.div
 key="moon"
 initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
 animate={{ opacity: 1, rotate: 0, scale: 1 }}
 exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
 transition={{ duration: 0.2, ease: "easeInOut" }}
 >
 <Moon className={iconSizes[size]} />
 </motion.div>
 )}
 </AnimatePresence>
 </motion.button>
 );
}
