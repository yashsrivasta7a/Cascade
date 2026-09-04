"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
 X,
 Coins,
 TrendingDown,
 CreditCard,
 ArrowRight,
 History,
 Loader2,
 Zap,
 Image,
 Film,
 Volume2,
 Brain,
 Crop,
 Scissors,
 Mic,
 Wallet,
 Calendar,
 TrendingUp,
 Target,
 Sparkles,
 AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { formatTimeAgo } from "@/lib/format";

// =============================================================================
// HELPERS
// =============================================================================

function formatCredits(credits?: number): string {
 if (credits === undefined || credits === null) return "0";
 if (credits >= 1000000) return `${(credits / 1000000).toFixed(2)}M`;
 if (credits >= 1000) return `${(credits / 1000).toFixed(1)}K`;
 if (credits < 1) return credits.toFixed(2);
 return credits.toLocaleString();
}

function getNodeIcon(nodeType: string) {
 switch (nodeType) {
 case "openrouter": return <Brain className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
 case "seedream": return <Image className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />;
 case "seedance": return <Film className="w-3 h-3 text-violet-600 dark:text-violet-400" />;
 case "seedvr": return <Film className="w-3 h-3 text-violet-600 dark:text-violet-400" />;
 case "lipsync": return <Mic className="w-3 h-3 text-amber-600 dark:text-amber-400" />;
 case "elevenlabs": return <Volume2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />;
 case "crop-image": return <Crop className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />;
 case "merge-videos": return <Film className="w-3 h-3 text-violet-600 dark:text-violet-400" />;
 case "merge-audio-video": return <Film className="w-3 h-3 text-violet-600 dark:text-violet-400" />;
 case "extract-audio": return <Scissors className="w-3 h-3 text-amber-600 dark:text-amber-400" />;
 default: return <Zap className="w-3 h-3 text-slate-700 dark:text-zinc-400" />;
 }
}

function getNodeColor(nodeType: string): string {
 switch (nodeType) {
 case "openrouter": return "bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-transparent";
 case "seedream": return "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-transparent";
 case "seedance": return "bg-violet-50 dark:bg-violet-500/15 border-violet-200 dark:border-transparent";
 case "seedvr": return "bg-violet-50 dark:bg-violet-500/15 border-violet-200 dark:border-transparent";
 case "lipsync": return "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-transparent";
 case "elevenlabs": return "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-transparent";
 case "crop-image": return "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-transparent";
 case "merge-videos": return "bg-violet-50 dark:bg-violet-500/15 border-violet-200 dark:border-transparent";
 case "merge-audio-video": return "bg-violet-50 dark:bg-violet-500/15 border-violet-200 dark:border-transparent";
 case "extract-audio": return "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-transparent";
 default: return "bg-white dark:bg-zinc-500/15 border-blue-100 dark:border-transparent";
 }
}

// =============================================================================
// TYPES
// =============================================================================

interface CreditHistoryItem {
 id: string;
 nodeName: string;
 nodeType: string;
 cost: number;
 createdAt: string;
 executionType: "single" | "pipeline";
 workflowName?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface CreditsPanelProps {
 workflowId?: string;
 isOpen: boolean;
 onClose: () => void;
}

export function CreditsPanel({ 
 workflowId,
 isOpen, 
 onClose,
}: CreditsPanelProps) {
 const [creditHistory, setCreditHistory] = useState<CreditHistoryItem[]>([]);
 const [isLoading, setIsLoading] = useState(false);
 const [totalSpent, setTotalSpent] = useState(0);

 const { data: creditsData } = trpc.credits.getBalance.useQuery(undefined, {
 enabled: isOpen,
 });

 const fetchHistory = useCallback(async () => {
 if (!isOpen) return;
 setIsLoading(true);
 
 try {
 const params = new URLSearchParams();
 params.set("limit", "50");
 if (workflowId && workflowId !== "new") {
 params.set("workflowId", workflowId);
 }
 
 const response = await fetch(`/api/workflow-executions?${params.toString()}`);
 
 if (response.ok) {
 const data = await response.json();
 const history: CreditHistoryItem[] = [];
 let total = 0;
 
 (data.executions || []).forEach((exec: any) => {
 const isMulti = (exec.nodeExecutions || []).length > 1;
 
 (exec.nodeExecutions || []).forEach((node: any) => {
 const cost = node.actualCost || 0;
 if (cost > 0) {
 const nodeDef = NODE_DEFINITIONS[node.nodeType as AINodeType];
 history.push({
 id: node.id,
 nodeName: nodeDef?.label || node.nodeLabel || node.nodeType,
 nodeType: node.nodeType,
 cost,
 createdAt: node.completedAt || node.startedAt || exec.createdAt,
 executionType: isMulti ? "pipeline" : "single",
 workflowName: exec.workflowName,
 });
 total += cost;
 }
 });
 });
 
 history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
 
 setCreditHistory(history);
 setTotalSpent(total);
 }
 } catch (err) {
 console.error("Failed to fetch credit history:", err);
 } finally {
 setIsLoading(false);
 }
 }, [isOpen, workflowId]);

 useEffect(() => {
 if (isOpen) {
 fetchHistory();
 }
 }, [isOpen, fetchHistory]);

 const balance = creditsData?.credits ?? 0;
 
 // Calculate usage statistics
 const usageStats = useMemo(() => {
 // Assume a starting balance based on current + spent (this is an approximation)
 // In a real app, you'd want to track the initial/total purchased amount
 const totalAvailable = balance + totalSpent;
 const usedPercent = totalAvailable > 0 ? (totalSpent / totalAvailable) * 100 : 0;
 const remainingPercent = 100 - usedPercent;
 
 // Calculate average cost per run
 const avgCostPerRun = creditHistory.length > 0 ? totalSpent / creditHistory.length : 0;
 
 // Estimate runs remaining
 const estimatedRunsRemaining = avgCostPerRun > 0 ? Math.floor(balance / avgCostPerRun) : 0;
 
 // Calculate spending by node type
 const spendingByType: Record<string, number> = {};
 creditHistory.forEach(item => {
 spendingByType[item.nodeType] = (spendingByType[item.nodeType] || 0) + item.cost;
 });
 
 // Sort by highest spending
 const topSpending = Object.entries(spendingByType)
 .sort(([, a], [, b]) => b - a)
 .slice(0, 3);
 
 // Balance status
 let balanceStatus: "healthy" | "warning" | "critical" = "healthy";
 if (balance < avgCostPerRun * 5) {
 balanceStatus = "critical";
 } else if (balance < avgCostPerRun * 20) {
 balanceStatus = "warning";
 }
 
 return {
 totalAvailable,
 usedPercent,
 remainingPercent,
 avgCostPerRun,
 estimatedRunsRemaining,
 topSpending,
 balanceStatus,
 };
 }, [balance, totalSpent, creditHistory]);

 return (
 <AnimatePresence>
 {isOpen && (
 <motion.div
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 20 }}
 transition={{ type: "spring", damping: 25, stiffness: 300 }}
 style={{ right: "16px" }}
 className="fixed top-16 z-50 w-[340px] bg-white dark:bg-black/60 rounded-2xl border border-blue-100 dark:border-white/[0.08] overflow-hidden shadow-xl shadow-gray-200/80 dark:shadow-black/40 flex flex-col max-h-[calc(100vh-90px)]"
 >
 {/* Header */}
 <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shrink-0">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-amber-500 dark:bg-amber-500/30 border border-amber-400 dark:border-amber-500/40 flex items-center justify-center">
 <Coins className="w-3.5 h-3.5 text-white dark:text-amber-300" />
 </div>
 <div>
 <span className="text-sm font-semibold text-slate-900 dark:text-white">Credits</span>
 <p className="text-[10px] text-slate-700 dark:text-zinc-500">Usage & Analytics</p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="p-1.5 rounded-lg text-slate-800 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/5 transition-all"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Balance Card with Usage Bar */}
 <div className="p-3 border-b border-gray-100 dark:border-white/[0.04] shrink-0">
 <div className={cn(
 "rounded-xl p-4 border-l-4 border",
 usageStats.balanceStatus === "critical" 
 ? "bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-500/10 dark:to-red-600/5 border-red-500 border-red-200 dark:border-red-500/20"
 : usageStats.balanceStatus === "warning"
 ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-amber-600/5 border-amber-500 border-amber-200 dark:border-amber-500/20"
 : "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-emerald-600/5 border-emerald-500 border-emerald-200 dark:border-emerald-500/20"
 )}>
 <div className="flex items-center justify-between mb-3">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <Wallet className={cn(
 "w-4 h-4",
 usageStats.balanceStatus === "critical" ? "text-red-600 dark:text-red-400" :
 usageStats.balanceStatus === "warning" ? "text-amber-600 dark:text-amber-400" :
 "text-emerald-600 dark:text-emerald-400"
 )} />
 <span className={cn(
 "text-[10px] uppercase tracking-wider font-semibold",
 usageStats.balanceStatus === "critical" ? "text-red-700 dark:text-red-400" :
 usageStats.balanceStatus === "warning" ? "text-amber-700 dark:text-amber-400" :
 "text-emerald-700 dark:text-emerald-400"
 )}>Balance</span>
 {usageStats.balanceStatus === "critical" && (
 <AlertTriangle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 animate-pulse" />
 )}
 </div>
 <p className={cn(
 "text-2xl font-bold",
 usageStats.balanceStatus === "critical" ? "text-red-700 dark:text-red-400" :
 usageStats.balanceStatus === "warning" ? "text-amber-700 dark:text-amber-400" :
 "text-emerald-700 dark:text-emerald-400"
 )}>
 {formatCredits(balance)} <span className="text-sm font-normal opacity-80">credits</span>
 </p>
 </div>
 <Link href="/billing">
 <button className="h-8 px-3 text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-gradient-to-r dark:from-[#1e3a5f] dark:to-[#2a4a6f] dark:hover:from-[#2a4a6f] dark:hover:to-[#3a5a7f] rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/25 dark:shadow-[#0f1f33]/50">
 <CreditCard className="w-3.5 h-3.5" />
 Top Up
 </button>
 </Link>
 </div>
 
 {/* Usage Bar */}
 {usageStats.totalAvailable > 0 && (
 <div className="space-y-1.5">
 <div className="flex items-center justify-between text-[9px]">
 <span className="text-slate-700 dark:text-zinc-500">Usage this session</span>
 <span className="font-medium text-slate-700 dark:text-zinc-300">
 {formatCredits(totalSpent)} / {formatCredits(usageStats.totalAvailable)}
 </span>
 </div>
 <div className="h-2 bg-gray-200 dark:bg-white/[0.1] rounded-full overflow-hidden">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${Math.min(usageStats.usedPercent, 100)}%` }}
 transition={{ duration: 0.8, ease: "easeOut" }}
 className={cn(
 "h-full rounded-full",
 usageStats.usedPercent > 80 
 ? "bg-gradient-to-r from-red-500 to-red-400"
 : usageStats.usedPercent > 50 
 ? "bg-gradient-to-r from-amber-500 to-amber-400"
 : "bg-gradient-to-r from-emerald-500 to-emerald-400"
 )}
 />
 </div>
 <div className="flex items-center justify-between text-[9px] text-slate-700 dark:text-zinc-500">
 <span>{usageStats.usedPercent.toFixed(1)}% used</span>
 <span>{usageStats.remainingPercent.toFixed(1)}% remaining</span>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Quick Stats */}
 <div className="p-3 border-b border-gray-100 dark:border-white/[0.04] shrink-0">
 <div className="grid grid-cols-2 gap-2">
 {/* Estimated Runs */}
 <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
 <div className="flex items-center gap-2 mb-1">
 <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
 <span className="text-[9px] text-slate-700 dark:text-zinc-400 uppercase font-semibold">Est. Runs Left</span>
 </div>
 <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
 {usageStats.estimatedRunsRemaining > 0 ? (
 usageStats.estimatedRunsRemaining > 100 ? "100+" : usageStats.estimatedRunsRemaining
 ) : (
 <span className="text-slate-800 dark:text-zinc-500">-</span>
 )}
 </p>
 <p className="text-[8px] text-slate-700 dark:text-zinc-500 mt-0.5">
 based on avg {formatCredits(usageStats.avgCostPerRun)}/run
 </p>
 </div>
 
 {/* Total Transactions */}
 <div className="p-3 bg-violet-50 dark:bg-violet-500/10 rounded-xl border border-violet-200 dark:border-violet-500/20">
 <div className="flex items-center gap-2 mb-1">
 <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
 <span className="text-[9px] text-slate-700 dark:text-zinc-400 uppercase font-semibold">Total Runs</span>
 </div>
 <p className="text-xl font-bold text-violet-700 dark:text-violet-400">{creditHistory.length}</p>
 <p className="text-[8px] text-slate-700 dark:text-zinc-500 mt-0.5">
 {workflowId && workflowId !== "new" ? "this workflow" : "all workflows"}
 </p>
 </div>
 </div>
 </div>

 {/* Top Spending Categories */}
 {usageStats.topSpending.length > 0 && (
 <div className="p-3 border-b border-gray-100 dark:border-white/[0.04] shrink-0">
 <div className="flex items-center gap-2 mb-2">
 <TrendingUp className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-400" />
 <span className="text-[9px] text-slate-800 dark:text-zinc-400 uppercase tracking-wider font-semibold">Top Spending</span>
 </div>
 <div className="space-y-1.5">
 {usageStats.topSpending.map(([nodeType, amount]) => {
 const nodeDef = NODE_DEFINITIONS[nodeType as AINodeType];
 const percentage = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
 
 return (
 <div key={nodeType} className="flex items-center gap-2">
 <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0 border", getNodeColor(nodeType))}>
 {getNodeIcon(nodeType)}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between mb-0.5">
 <span className="text-[10px] font-medium text-slate-700 dark:text-zinc-300 truncate">
 {nodeDef?.label || nodeType}
 </span>
 <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
 {formatCredits(amount)}
 </span>
 </div>
 <div className="h-1 bg-gray-200 dark:bg-white/[0.1] rounded-full overflow-hidden">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${percentage}%` }}
 transition={{ duration: 0.5, delay: 0.1 }}
 className="h-full bg-amber-400 dark:bg-amber-500 rounded-full"
 />
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* History */}
 <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10">
 <div className="flex items-center gap-2 px-1 mb-2">
 <History className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-400" />
 <span className="text-[9px] text-slate-800 dark:text-zinc-400 uppercase tracking-wider font-semibold">Recent Transactions</span>
 </div>
 
 {isLoading ? (
 <div className="flex flex-col items-center justify-center py-8">
 <Loader2 className="w-5 h-5 text-slate-800 dark:text-zinc-600 animate-spin" />
 <p className="text-xs text-slate-700 dark:text-zinc-500 mt-2">Loading...</p>
 </div>
 ) : creditHistory.length === 0 ? (
 <div className="text-center py-8">
 <p className="text-xs text-slate-700 dark:text-zinc-500">No spending history yet</p>
 <p className="text-[10px] text-slate-800 dark:text-zinc-600 mt-1">Run some nodes to see costs</p>
 </div>
 ) : (
 <div className="space-y-1.5">
 {creditHistory.slice(0, 15).map((item, idx) => (
 <motion.div
 key={`${item.id}-${idx}`}
 initial={{ opacity: 0, x: -8 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: idx * 0.02 }}
 className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-white/[0.02] border border-blue-100 dark:border-white/[0.04] hover:bg-white/70 dark:hover:bg-white/[0.04] transition-colors"
 >
 <div className="flex items-center gap-2.5 min-w-0">
 <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border", getNodeColor(item.nodeType))}>
 {getNodeIcon(item.nodeType)}
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-1.5">
 <span className="text-[10px] font-semibold text-slate-800 dark:text-zinc-300 truncate">{item.nodeName}</span>
 </div>
 <div className="flex items-center gap-1 mt-0.5">
 <Calendar className="w-2.5 h-2.5 text-slate-800 dark:text-zinc-600" />
 <p className="text-[8px] text-slate-700 dark:text-zinc-600">{formatTimeAgo(item.createdAt)}</p>
 </div>
 </div>
 </div>
 <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
 -{formatCredits(item.cost)}
 </span>
 </motion.div>
 ))}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="px-3 py-2.5 border-t border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shrink-0">
 <Link href="/billing">
 <div className="flex items-center justify-between p-2 bg-white dark:bg-white/[0.03] hover:bg-white/70 dark:hover:bg-white/[0.06] rounded-lg border border-blue-100 dark:border-white/[0.04] transition-colors cursor-pointer">
 <div className="flex items-center gap-2">
 <CreditCard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
 <span className="text-[10px] text-slate-700 dark:text-zinc-400 font-semibold">View Full Billing History</span>
 </div>
 <ArrowRight className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-500" />
 </div>
 </Link>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 );
}
