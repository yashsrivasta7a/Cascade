"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
 Workflow,
 Zap,
 Clock,
 TrendingUp,
 ArrowUpRight,
 Plus,
 Play,
 CheckCircle2,
 AlertTriangle,
 XCircle,
 RefreshCw,
 Loader2,
 Coins,
 Activity,
 Layers,
 Sparkles,
} from "lucide-react";
import { Button, Badge, DotPattern, PageBackground } from "@/components/ui";
import { UserMenu } from "@/components/layout";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";

const statConfig = [
 { key: "totalWorkflows", label: "Total Workflows", icon: Layers, color: "violet" },
 { key: "executionsToday", label: "Executions Today", icon: Zap, color: "blue" },
 { key: "avgRuntime", label: "Avg. Runtime", icon: Clock, color: "emerald" },
 { key: "successRate", label: "Success Rate", icon: TrendingUp, color: "amber" },
] as const;

export default function DashboardPage() {
 const { data, isLoading, error, refetch, isFetching } = trpc.dashboard.stats.useQuery(
 undefined,
 {
 staleTime: 2 * 60 * 1000,
 refetchInterval: 60000,
 }
 );

 if (isLoading) {
 return (
 <PageBackground>
 {/* Header Skeleton */}
 <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b border-[#6b6b6b] dark:border-zinc-800/60">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-zinc-800 animate-pulse" />
 <div className="space-y-1.5">
 <div className="h-3.5 w-20 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 <div className="h-2.5 w-16 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="h-8 w-20 bg-gray-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
 <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 animate-pulse" />
 </div>
 </div>

 {/* Content Skeleton */}
 <div className="flex-1 overflow-auto p-6 space-y-6">
 {/* Stats Grid Skeleton */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {[0, 1, 2, 3].map((i) => (
 <div
 key={i}
 className="relative p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl overflow-hidden"
 style={{ animationDelay: `${i * 100}ms` }}
 >
 <div className="relative">
 <div className="flex items-center justify-between mb-4">
 <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 animate-pulse" />
 <div className="w-4 h-4 rounded bg-white dark:bg-zinc-800/50 animate-pulse" />
 </div>
 <div className="space-y-2">
 <div className="h-3 w-24 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 <div className="h-7 w-16 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 <div className="flex items-center gap-2">
 <div className="h-3 w-12 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 <div className="h-3 w-20 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 </div>
 </div>
 {/* Shimmer overlay */}
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-pulse" />
 </div>
 ))}
 </div>

 {/* Main Content Grid Skeleton */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Recent Activity Skeleton */}
 <div className="col-span-2">
 <div className="bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl overflow-hidden">
 <div className="p-5 border-b border-[#6b6b6b] dark:border-zinc-800/60 flex items-center justify-between">
 <div className="space-y-1.5">
 <div className="h-4 w-28 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 <div className="h-3 w-36 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 <div className="h-3 w-16 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 <div className="divide-y divide-[#6b6b6b] dark:divide-zinc-800/50">
 {[0, 1, 2, 3, 4].map((i) => (
 <div 
 key={i} 
 className="px-5 py-4 flex items-center justify-between"
 style={{ animationDelay: `${i * 50}ms` }}
 >
 <div className="flex items-center gap-4">
 <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 animate-pulse" />
 <div className="space-y-1.5">
 <div className="h-3.5 w-32 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 <div className="h-2.5 w-20 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 </div>
 <div className="flex items-center gap-4">
 <div className="h-5 w-14 bg-white dark:bg-zinc-800 rounded animate-pulse" />
 <div className="h-3 w-10 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Sidebar Skeleton */}
 <div className="space-y-4">
 {/* Quick Actions */}
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse mb-4" />
 <div className="space-y-2">
 <div className="h-10 w-full bg-gray-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
 <div className="h-10 w-full bg-white dark:bg-zinc-800/50 rounded-lg animate-pulse" />
 </div>
 </div>

 {/* Active Workflows */}
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <div className="flex items-center gap-2 mb-3">
 <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-zinc-700 animate-pulse" />
 <div className="h-3.5 w-16 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 </div>
 <div className="h-3 w-28 bg-white dark:bg-zinc-800/50 rounded animate-pulse mb-4" />
 <div className="h-9 w-full bg-gray-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
 </div>

 {/* Credits */}
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <div className="w-4 h-4 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
 <div className="h-3 w-16 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 <div className="h-5 w-10 bg-white dark:bg-zinc-800 rounded animate-pulse" />
 </div>
 <div className="mb-2">
 <div className="flex items-center justify-between mb-1">
 <div className="h-4 w-16 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 <div className="h-3 w-8 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 <div className="h-1.5 rounded-full bg-gray-300 dark:bg-zinc-800 overflow-hidden">
 <div className="h-full w-2/3 bg-gray-300 dark:bg-zinc-700 rounded-full animate-pulse" />
 </div>
 </div>
 <div className="h-2.5 w-24 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 </div>
 </div>
 </div>
 </PageBackground>
 );
 }

 if (error) {
 return (
 <PageBackground>
 <div className="flex-1 flex flex-col items-center justify-center gap-4">
 <p className="text-slate-600">{error.message}</p>
 <Button variant="outline" onClick={() => refetch()}>
 <RefreshCw className="w-4 h-4 mr-2" />
 Retry
 </Button>
 </div>
 </PageBackground>
 );
 }

 const stats = data?.stats;
 const recentActivity = data?.recentActivity ?? [];
 const activeWorkflows = data?.activeWorkflows ?? 0;
 const credits = data?.credits ?? { used: 0, total: 5000, remaining: 5000 };
 const creditPercent = Math.round((credits.used / credits.total) * 100);

 return (
 <PageBackground>
 {/* Header */}
 <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b border-[#6b6b6b] dark:border-zinc-800/60">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800/50 flex items-center justify-center">
 <Sparkles className="w-4 h-4 text-slate-800 dark:text-zinc-400" />
 </div>
 <div>
 <h1 className="text-sm font-semibold text-slate-900 dark:text-white">Dashboard</h1>
 <p className="text-[11px] text-slate-700 dark:text-zinc-500">Welcome back</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={() => refetch()}
 disabled={isFetching}
 className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-zinc-800/50 hover:bg-gray-200 dark:hover:bg-zinc-800 border border-[#6b6b6b] dark:border-zinc-700/50 rounded-lg flex items-center gap-1.5 transition-all"
 >
 <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
 Refresh
 </button>
 <UserMenu />
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-auto p-6 space-y-6">
 {/* Stats Grid */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {statConfig.map((config, i) => {
 const stat = stats?.[config.key];
 const colorClasses = {
 violet: { 
 bg: "bg-violet-100 dark:bg-violet-500/10", 
 text: "text-violet-600 dark:text-violet-400", 
 hover: "hover:border-violet-300 dark:hover:border-violet-500/20",
 dot: "text-violet-300/50 group-hover:text-violet-400/50 dark:text-violet-500/5 dark:group-hover:text-violet-500/10",
 cardBg: "bg-violet-100 dark:bg-zinc-900/50"
 },
 blue: { 
 bg: "bg-blue-100 dark:bg-blue-500/10", 
 text: "text-blue-600 dark:text-blue-400", 
 hover: "hover:border-blue-300 dark:hover:border-blue-500/20",
 dot: "text-blue-300/50 group-hover:text-blue-400/50 dark:text-blue-500/5 dark:group-hover:text-blue-500/10",
 cardBg: "bg-blue-100 dark:bg-zinc-900/50"
 },
 emerald: { 
 bg: "bg-emerald-100 dark:bg-emerald-500/10", 
 text: "text-emerald-600 dark:text-emerald-400", 
 hover: "hover:border-emerald-300 dark:hover:border-emerald-500/20",
 dot: "text-emerald-300/50 group-hover:text-emerald-400/50 dark:text-emerald-500/5 dark:group-hover:text-emerald-500/10",
 cardBg: "bg-emerald-100 dark:bg-zinc-900/50"
 },
 amber: { 
 bg: "bg-amber-100 dark:bg-amber-500/10", 
 text: "text-amber-600 dark:text-amber-400", 
 hover: "hover:border-amber-300 dark:hover:border-amber-500/20",
 dot: "text-amber-300/50 group-hover:text-amber-400/50 dark:text-amber-500/5 dark:group-hover:text-amber-500/10",
 cardBg: "bg-amber-100 dark:bg-zinc-900/50"
 },
 }[config.color];

 return (
 <motion.div
 key={config.key}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.05 }}
 >
 <div className={cn(
 "relative p-5 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl overflow-hidden group transition-colors shadow-md dark:shadow-none",
 colorClasses.cardBg,
 colorClasses.hover
 )}>
 <DotPattern className={cn("transition-colors", colorClasses.dot)} />
 <div className="relative">
 <div className="flex items-center justify-between mb-4">
 <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colorClasses.bg)}>
 <config.icon className={cn("w-5 h-5", colorClasses.text)} />
 </div>
 <ArrowUpRight className="w-4 h-4 text-slate-700 dark:text-zinc-600" />
 </div>
 <p className="text-xs text-slate-700 dark:text-zinc-500 mb-1">{config.label}</p>
 <p className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">{stat?.value ?? "—"}</p>
 <p className="text-xs">
 <span className={stat?.change?.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : stat?.change?.startsWith("-") ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-zinc-500"}>
 {stat?.change ?? "—"}
 </span>{" "}
 <span className="text-slate-700 dark:text-zinc-600">{stat?.changeLabel ?? ""}</span>
 </p>
 </div>
 </div>
 </motion.div>
 );
 })}
 </div>

 {/* Main Content Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Recent Activity */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2 }}
 className="col-span-2"
 >
 <div className="bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl overflow-hidden shadow-md dark:shadow-none">
 <div className="p-5 border-b border-[#6b6b6b] dark:border-zinc-800/60 flex items-center justify-between">
 <div>
 <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
 <p className="text-xs text-slate-700 dark:text-zinc-500 mt-0.5">Latest workflow executions</p>
 </div>
 <Link href="/executions">
 <button className="text-xs text-slate-700 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
 View All →
 </button>
 </Link>
 </div>

 <div className="divide-y divide-[#6b6b6b] dark:divide-zinc-800/50">
 {recentActivity.length === 0 ? (
 <div className="px-5 py-12 text-center text-slate-700 dark:text-zinc-500 text-sm">
 No recent activity. Run a workflow to see results here.
 </div>
 ) : (
 recentActivity.map((activity: { id: string; workflow: string; status: string; time: string; duration?: string }, i: number) => (
 <motion.div
 key={activity.id}
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: 0.3 + i * 0.03 }}
 className="px-5 py-4 flex items-center justify-between hover:bg-white/60 dark:hover:bg-zinc-800/30 transition-colors"
 >
 <div className="flex items-center gap-4">
 <div className={cn(
 "w-8 h-8 rounded-lg flex items-center justify-center",
 activity.status === "success" ? "bg-emerald-200 dark:bg-emerald-500/10" :
 activity.status === "error" ? "bg-red-200 dark:bg-red-500/10" :
 "bg-amber-200 dark:bg-amber-500/10"
 )}>
 {activity.status === "success" ? (
 <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
 ) : activity.status === "error" ? (
 <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
 ) : (
 <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
 )}
 </div>
 <div>
 <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.workflow}</p>
 <p className="text-xs text-slate-700 dark:text-zinc-500">{activity.time}</p>
 </div>
 </div>
 <div className="flex items-center gap-4">
 <span className={cn(
 "px-2.5 py-1 text-[11px] font-semibold rounded-md",
 activity.status === "success" ? "bg-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
 activity.status === "error" ? "bg-red-200 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
 "bg-amber-200 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
 )}>
 {activity.status === "success" ? "Success" : activity.status === "error" ? "Failed" : "Warning"}
 </span>
 {activity.duration && (
 <span className="text-xs text-slate-700 dark:text-zinc-500 w-12 text-right font-mono">{activity.duration}</span>
 )}
 </div>
 </motion.div>
 ))
 )}
 </div>
 </div>
 </motion.div>

 {/* Sidebar */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.3 }}
 className="space-y-4"
 >
 {/* Quick Actions */}
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl shadow-md dark:shadow-none">
 <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
 <div className="space-y-2">
 <Link href="/workflows/new" className="block">
 <button className="w-full h-10 px-4 bg-blue-100 hover:bg-blue-200 text-blue-600 text-sm font-bold rounded-xl flex items-center justify-center gap-2 border-2 border-blue-400 hover:border-blue-500 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 dark:text-blue-400 dark:border-blue-500/50 dark:hover:border-blue-500/70 transition-all">
 <Plus className="w-4 h-4" />
 New Workflow
 </button>
 </Link>
 <Link href="/workflows" className="block">
 <button className="w-full h-10 px-4 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 text-sm font-bold rounded-xl flex items-center justify-center gap-2 border-2 border-emerald-400 hover:border-emerald-500 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 dark:text-emerald-400 dark:border-emerald-500/50 dark:hover:border-emerald-500/70 transition-all">
 <Workflow className="w-4 h-4" />
 View All
 </button>
 </Link>
 </div>
 </div>

 {/* Active Workflows */}
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl shadow-md dark:shadow-none">
 <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Active Workflows</h2>
 <div className="flex items-center gap-2 mb-3">
 {activeWorkflows > 0 && (
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
 </span>
 )}
 <span className="text-sm font-medium text-slate-900 dark:text-white">
 {activeWorkflows} Active
 </span>
 </div>
 <p className="text-xs text-slate-700 dark:text-zinc-500 mb-4">
 {activeWorkflows > 0
 ? `Success rate: ${stats?.successRate?.value ?? "—"}`
 : "No workflows currently running."}
 </p>
 <Link href="/executions" className="block">
 <button className="w-full h-9 px-4 text-xs font-medium text-slate-700 dark:text-white bg-white dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 border border-[#6b6b6b] dark:border-zinc-700/50 rounded-lg flex items-center justify-center gap-2 transition-colors">
 <Activity className="w-3.5 h-3.5" />
 Monitor
 </button>
 </Link>
 </div>

 {/* Credits */}
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl group hover:border-amber-300 dark:hover:border-amber-500/20 transition-colors shadow-md dark:shadow-none">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-sm font-semibold text-slate-900 dark:text-white">AI Credits</h2>
 <Badge variant="accent">Pro</Badge>
 </div>
 <div className="mb-3">
 <div className="flex items-center justify-between text-sm mb-1">
 <span className="text-slate-900 dark:text-white font-medium">
 {credits.remaining.toLocaleString()}
 </span>
 <span className="text-slate-700 dark:text-zinc-500">{100 - creditPercent}%</span>
 </div>
 <div className="h-2.5 rounded-full bg-gray-300 dark:bg-zinc-800 overflow-hidden">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${100 - creditPercent}%` }}
 transition={{ delay: 0.5, duration: 0.8 }}
 className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
 />
 </div>
 </div>
 <p className="text-[11px] text-slate-700 dark:text-zinc-600">of {credits.total.toLocaleString()} credits</p>
 </div>
 </motion.div>
 </div>
 </div>
 </PageBackground>
 );
}
