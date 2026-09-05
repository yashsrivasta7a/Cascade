"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
 CheckCircle2,
 XCircle,
 AlertTriangle,
 ChevronDown,
 Search,
 Loader2,
 ExternalLink,
 Clock,
 Pause,
 AlertCircle,
 Play,
 RotateCcw,
 Filter,
 Calendar,
 Zap,
 ArrowRight,
 Circle,
 Timer,
 Coins,
 TrendingUp,
 Activity,
 Layers,
 GitBranch,
 Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/layout";
import { trpc } from "@/lib/trpc/react";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";

// =============================================================================
// TYPES
// =============================================================================

type ExecutionStatus = "running" | "completed" | "failed" | "cancelled" | "queued" | "waiting" | "pending" | "terminated";
type TabType = "runs" | "errors";

interface NodeExecution {
 id: string;
 nodeId: string;
 nodeType: string;
 label: string;
 status: ExecutionStatus;
 duration?: string;
 provider?: string | null;
 cost?: number;
 error?: string | null;
}

const STATUS_MAP = {
 running: { label: "Running", color: "bg-blue-500", text: "text-blue-400", icon: Loader2, spin: true },
 completed: { label: "Completed", color: "bg-emerald-500", text: "text-emerald-400", icon: CheckCircle2 },
 failed: { label: "Failed", color: "bg-red-500", text: "text-red-400", icon: XCircle },
 cancelled: { label: "Cancelled", color: "bg-zinc-500", text: "text-slate-600", icon: AlertTriangle },
 queued: { label: "Queued", color: "bg-zinc-500", text: "text-slate-600", icon: Clock },
 pending: { label: "Pending", color: "bg-zinc-500", text: "text-slate-600", icon: Clock },
 waiting: { label: "Waiting", color: "bg-amber-500", text: "text-amber-400", icon: Pause },
 terminated: { label: "Terminated", color: "bg-zinc-500", text: "text-slate-600", icon: AlertCircle },
} as const;

// =============================================================================
// BACKGROUND PATTERNS
// =============================================================================

function DotPattern({ className }: { className?: string }) {
 return (
 <svg
 className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
 xmlns="http://www.w3.org/2000/svg"
 >
 <defs>
 <pattern
 id="dot-pattern"
 x="0"
 y="0"
 width="16"
 height="16"
 patternUnits="userSpaceOnUse"
 >
 <circle cx="1" cy="1" r="1" fill="currentColor" />
 </pattern>
 </defs>
 <rect width="100%" height="100%" fill="url(#dot-pattern)" />
 </svg>
 );
}

function GridPattern({ className }: { className?: string }) {
 return (
 <svg
 className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
 xmlns="http://www.w3.org/2000/svg"
 >
 <defs>
 <pattern
 id="grid-pattern"
 x="0"
 y="0"
 width="40"
 height="40"
 patternUnits="userSpaceOnUse"
 >
 <path
 d="M 40 0 L 0 0 0 40"
 fill="none"
 stroke="currentColor"
 strokeWidth="0.5"
 />
 </pattern>
 </defs>
 <rect width="100%" height="100%" fill="url(#grid-pattern)" />
 </svg>
 );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ActivityPage() {
 const [activeTab, setActiveTab] = useState<TabType>("runs");
 const [statusFilter, setStatusFilter] = useState<"all" | "running" | "completed" | "failed">("all");
 const [searchQuery, setSearchQuery] = useState("");
 const [debouncedSearch, setDebouncedSearch] = useState("");
 const [expandedRun, setExpandedRun] = useState<string | null>(null);

 useEffect(() => {
 const timeout = setTimeout(() => setDebouncedSearch(searchQuery), 300);
 return () => clearTimeout(timeout);
 }, [searchQuery]);

 const { data, isLoading, refetch, isFetching } = trpc.execution.list.useQuery(
 { status: statusFilter !== "all" ? statusFilter : undefined, search: debouncedSearch || undefined },
 { refetchInterval: 8000 }
 );

 const runs = data?.executions ?? [];
 const stats = data?.stats ?? { totalRuns: 0, successRate: "0%", avgDuration: "—", creditsUsed: 0 };

 // Count by status
 const runningCount = runs.filter(r => r.status === "running").length;
 const failedCount = runs.filter(r => r.status === "failed").length;

 return (
 <div className="h-full flex flex-col bg-white dark:bg-[#09090b] relative overflow-hidden">
 {/* Top Bar */}
 <div className="relative z-10 shrink-0 px-4 sm:px-8 py-4 sm:py-6 flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 dark:border-zinc-800/60 bg-white dark:bg-[#09090b]/80 ">
 <div className="flex items-center gap-3">
 <h1 className="text-2xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Executions</h1>
 <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-zinc-400 border border-blue-100 dark:border-zinc-700/50">
 {stats.totalRuns}
 </span>
 </div>

 <div className="flex items-center gap-4">
 {runningCount > 0 && (
 <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-md">
 <span className="relative flex h-2.5 w-2.5">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
 </span>
 <span className="text-xs font-medium text-blue-700 dark:text-blue-400">{runningCount} running</span>
 </div>
 )}
 <button
 onClick={() => refetch()}
 disabled={isFetching}
 className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-blue-100 dark:border-zinc-800 hover:bg-white/60 dark:hover:bg-zinc-800/80 rounded-md shadow-sm transition-all disabled:opacity-50"
 >
 <RotateCcw className={cn("w-4 h-4 opacity-70", isFetching && "animate-spin")} />
 Refresh
 </button>
 <div className="pl-4 border-l border-blue-100 dark:border-zinc-800 ml-1">
 <UserMenu />
 </div>
 </div>
 </div>

 {/* Tabs & Stats Bar */}
 <div className="relative z-10 shrink-0 border-b border-blue-100 dark:border-zinc-800/60 bg-white dark:bg-black/10 ">
 <div className="px-4 sm:px-8 flex flex-wrap items-center justify-between gap-3">
 {/* Tabs */}
 <div className="flex flex-wrap gap-4 sm:gap-8">
 {(["runs", "errors"] as const).map((tab) => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 className={cn(
 "relative py-4 text-[15px] font-medium capitalize transition-colors",
 activeTab === tab ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-slate-700"
 )}
 >
 {tab}
 {tab === "errors" && failedCount > 0 && (
 <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 rounded-md border border-red-200 dark:border-red-500/20">
 {failedCount}
 </span>
 )}
 {activeTab === tab && (
 <motion.div
 layoutId="active-tab"
 className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 dark:bg-white"
 transition={{ type: "spring", stiffness: 500, damping: 35 }}
 />
 )}
 </button>
 ))}
 </div>

 {/* Quick Stats */}
 <div className="flex flex-wrap items-center gap-4 sm:gap-8 py-3">
 <div className="flex items-center gap-2.5">
 <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
 <span className="text-sm text-slate-700 dark:text-zinc-400">Success</span>
 <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{stats.successRate}</span>
 </div>
 <div className="flex items-center gap-2.5">
 <Timer className="w-4 h-4 text-blue-600 dark:text-blue-500" />
 <span className="text-sm text-slate-700 dark:text-zinc-400">Avg</span>
 <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{stats.avgDuration}</span>
 </div>
 <div className="flex items-center gap-2.5">
 <Coins className="w-4 h-4 text-amber-600 dark:text-amber-500" />
 <span className="text-sm text-slate-700 dark:text-zinc-400">Credits</span>
 <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{stats.creditsUsed}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Content Area */}
 <div className="relative flex-1 overflow-hidden">
 <AnimatePresence mode="wait">
 {activeTab === "runs" && (
 <motion.div
 key="runs"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="h-full flex flex-col"
 >
 <div className="shrink-0 px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 dark:border-zinc-800/40">
 <div className="relative flex-1 min-w-0 sm:flex-none">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-800 dark:text-zinc-500" />
 <input
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search workflows..."
 className="w-72 bg-white dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-sm"
 />
 </div>

 <div className="flex items-center bg-gray-100/50 dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800 rounded-lg p-1">
 {(["all", "running", "completed", "failed"] as const).map((status) => (
 <button
 key={status}
 onClick={() => setStatusFilter(status)}
 className={cn(
 "px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all",
 statusFilter === status
 ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
 : "text-slate-700 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-slate-700"
 )}
 >
 {status}
 </button>
 ))}
 </div>
 </div>

 {/* Runs List */}
 <div className="flex-1 overflow-auto">
 {isLoading ? (
 <div className="divide-y divide-[#6b6b6b] dark:divide-zinc-800/50">
 {[...Array(8)].map((_, i) => (
 <div
 key={i}
 className="px-5 py-4"
 style={{ animationDelay: `${i * 50}ms` }}
 >
 <div className="flex items-center gap-4">
 {/* Status icon skeleton */}
 <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 animate-pulse" />
 {/* Main content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-2">
 <div className="h-4 w-32 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 <div className="h-5 w-16 bg-white dark:bg-zinc-800/50 rounded-full animate-pulse" />
 </div>
 <div className="flex items-center gap-4">
 <div className="h-3 w-24 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 <div className="h-3 w-20 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 </div>
 {/* Right side */}
 <div className="flex items-center gap-4">
 <div className="h-3 w-12 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 <div className="h-3 w-16 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 animate-pulse" />
 </div>
 </div>
 </div>
 ))}
 </div>
 ) : runs.length === 0 ? (
 <div className="max-w-md mx-auto mt-24 flex flex-col items-center text-center">
 <div className="w-16 h-16 rounded-full bg-white dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800/80 flex items-center justify-center mb-6 shadow-sm">
 <Activity className="w-7 h-7 text-slate-800 dark:text-zinc-500" />
 </div>
 <h3 className="text-[17px] font-semibold text-slate-900 dark:text-zinc-100 mb-2">
 No workflow runs
 </h3>
 <p className="text-[14px] text-slate-700 dark:text-zinc-400 mb-8 max-w-[280px] leading-relaxed">
 Execute a workflow to see runs here
 </p>
 <Link href="/workflows">
 <motion.button 
 whileHover={{ opacity: 0.9 }} 
 whileTap={{ scale: 0.98 }} 
 className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-zinc-900 text-[14px] font-medium rounded-md shadow-sm transition-all"
 >
 <Play className="w-3.5 h-3.5 opacity-80" />
 Go to Workflows
 </motion.button>
 </Link>
 </div>
 ) : (
 <div className="divide-y divide-zinc-800/50">
 {runs.map((run, idx) => (
 <WorkflowRun
 key={run.id}
 run={run}
 isExpanded={expandedRun === run.id}
 onToggle={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
 index={idx}
 />
 ))}
 </div>
 )}
 </div>
 </motion.div>
 )}

 {activeTab === "errors" && (
 <motion.div
 key="errors"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="h-full overflow-auto"
 >
 <ErrorsPanel />
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 );
}

// =============================================================================
// WORKFLOW RUN COMPONENT
// =============================================================================

function WorkflowRun({
 run,
 isExpanded,
 onToggle,
 index,
}: {
 run: any;
 isExpanded: boolean;
 onToggle: () => void;
 index: number;
}) {
 const router = useRouter();
 const nodes = run.nodes as NodeExecution[];
 const status = STATUS_MAP[run.status as ExecutionStatus] || STATUS_MAP.pending;
 const StatusIcon = status.icon;
 const completedNodes = nodes.filter((n) => n.status === "completed").length;
 const progress = nodes.length > 0 ? Math.round((completedNodes / nodes.length) * 100) : 0;

 const formatTime = (dateStr: string) => {
 const date = new Date(dateStr);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 if (diffMins < 1) return "just now";
 if (diffMins < 60) return `${diffMins}m ago`;
 const diffHours = Math.floor(diffMins / 60);
 if (diffHours < 24) return `${diffHours}h ago`;
 return date.toLocaleDateString();
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.03 }}
 className="group"
 >
 {/* Run Header */}
 <button
 onClick={onToggle}
 className="w-full px-6 py-4 flex items-center gap-4 hover:bg-zinc-900/50 transition-colors text-left"
 >
 {/* Status Indicator */}
 <div className={cn(
 "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
 run.status === "running" ? "bg-blue-200 dark:bg-blue-500/10" :
 run.status === "completed" ? "bg-emerald-200 dark:bg-emerald-500/10" :
 run.status === "failed" ? "bg-red-200 dark:bg-red-500/10" :
 "bg-gray-200 dark:bg-zinc-800"
 )}>
 <StatusIcon className={cn(
 "w-4 h-4",
 run.status === "running" ? "text-blue-600 dark:text-blue-400" :
 run.status === "completed" ? "text-emerald-600 dark:text-emerald-400" :
 run.status === "failed" ? "text-red-600 dark:text-red-400" :
 "text-slate-800 dark:text-zinc-400",
 "spin" in status && status.spin && "animate-spin"
 )} />
 </div>

 {/* Workflow Info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium text-white truncate">{run.workflowName}</span>
 {run.status === "running" && (
 <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-400 rounded">
 Live
 </span>
 )}
 </div>
 <div className="flex items-center gap-2 mt-1">
 <span className="text-xs text-slate-700">
 {run.startedAt ? formatTime(run.startedAt) : "—"}
 </span>
 <span className="text-slate-800">·</span>
 <span className="text-xs text-slate-700">{nodes.length} nodes</span>
 {run.status === "running" && (
 <>
 <span className="text-slate-800">·</span>
 <span className="text-xs text-blue-400">{progress}%</span>
 </>
 )}
 </div>
 </div>

 {/* Duration */}
 <div className="text-right shrink-0">
 <div className="text-sm font-mono text-slate-600">{run.duration || "—"}</div>
 {run.totalCost > 0 && (
 <div className="text-xs text-slate-700 mt-0.5">{run.totalCost} credits</div>
 )}
 </div>

 {/* Progress/Status Badge */}
 <div className="w-20 shrink-0">
 {run.status === "running" ? (
 <div className="h-1.5 bg-gray-300 dark:bg-zinc-800 rounded-full overflow-hidden">
 <motion.div 
 className="h-full bg-blue-500"
 initial={{ width: 0 }}
 animate={{ width: `${progress}%` }}
 transition={{ duration: 0.3 }}
 />
 </div>
 ) : (
 <span className={cn(
 "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md",
 run.status === "completed" && "bg-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
 run.status === "failed" && "bg-red-200 text-red-700 dark:bg-red-500/10 dark:text-red-400",
 run.status === "cancelled" && "bg-gray-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-400",
 !["completed", "failed", "cancelled", "running"].includes(run.status) && "bg-gray-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-400"
 )}>
 {status.label}
 </span>
 )}
 </div>

 {/* Chevron */}
 <ChevronDown className={cn(
 "w-4 h-4 text-slate-700 transition-transform shrink-0",
 isExpanded && "rotate-180"
 )} />
 </button>

 {/* Expanded Node Timeline */}
 <AnimatePresence>
 {isExpanded && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: "auto", opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="overflow-hidden"
 >
 <div className="px-6 pb-4">
 {/* Quick Actions */}
 <div className="flex items-center gap-2 mb-4 ml-[52px]">
 {run.workflowId && (
 <Link href={`/workflows/${run.workflowId}`}>
 <button className="h-7 px-3 text-xs font-medium text-slate-800 hover:text-slate-900 bg-white hover:bg-gray-200 border border-gray-300 dark:text-zinc-400 dark:hover:text-white dark:bg-zinc-800/80 dark:hover:bg-zinc-800 dark:border-zinc-700/50 rounded-md flex items-center gap-1.5 transition-all">
 <ExternalLink className="w-3 h-3" />
 View Workflow
 </button>
 </Link>
 )}
 {run.status === "failed" && (
 <button className="h-7 px-3 text-xs font-medium text-slate-800 hover:text-slate-900 bg-white hover:bg-gray-200 border border-gray-300 dark:text-zinc-400 dark:hover:text-white dark:bg-zinc-800/80 dark:hover:bg-zinc-800 dark:border-zinc-700/50 rounded-md flex items-center gap-1.5 transition-all">
 <RotateCcw className="w-3 h-3" />
 Retry
 </button>
 )}
 </div>

 {/* Node Timeline */}
 <div className="relative ml-[52px]">
 {/* Timeline Line */}
 <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-300 dark:bg-zinc-800" />

 <div className="space-y-1">
 {nodes.map((node, nodeIdx) => {
 const nodeStatus = STATUS_MAP[node.status as ExecutionStatus] || STATUS_MAP.pending;
 const NodeIcon = nodeStatus.icon;
 const nodeDef = NODE_DEFINITIONS[node.nodeType as AINodeType];

 return (
 <motion.div
 key={node.id}
 initial={{ opacity: 0, x: -8 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: nodeIdx * 0.03 }}
 className="relative flex items-center gap-3 py-2 px-3 -ml-3 rounded-lg hover:bg-gray-200/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group/node"
 onClick={() => run.workflowId && router.push(`/workflows/${run.workflowId}`)}
 >
 {/* Node Status Dot */}
 <div className={cn(
 "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 z-10",
 node.status === "completed" ? "border-emerald-500 bg-emerald-500" :
 node.status === "failed" ? "border-red-500 bg-red-500" :
 node.status === "running" ? "border-blue-500 bg-white dark:bg-[#09090b]" :
 "border-zinc-700 bg-white dark:bg-[#09090b]"
 )}>
 {node.status === "running" && (
 <Loader2 className="w-2 h-2 text-blue-500 animate-spin" />
 )}
 {node.status === "completed" && (
 <CheckCircle2 className="w-2.5 h-2.5 text-white" />
 )}
 {node.status === "failed" && (
 <XCircle className="w-2.5 h-2.5 text-white" />
 )}
 </div>

 {/* Node Info */}
 <div className="flex-1 min-w-0 flex items-center gap-2">
 <Box className="w-3.5 h-3.5 text-slate-700" />
 <span className="text-sm text-slate-600 group-hover/node:text-white transition-colors">
 {nodeDef?.label || node.label}
 </span>
 {node.provider && (
 <span className="text-[10px] text-slate-800 bg-gray-200 dark:text-zinc-600 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded">
 {node.provider}
 </span>
 )}
 </div>

 {/* Node Meta */}
 <div className="flex items-center gap-4 shrink-0">
 {node.duration && (
 <span className="text-xs font-mono text-slate-700">{node.duration}</span>
 )}
 {node.cost !== undefined && node.cost > 0 && (
 <span className="text-xs text-slate-700">{node.cost}c</span>
 )}
 {node.error && (
 <span className="text-[10px] px-1.5 py-0.5 bg-red-200 text-red-700 dark:bg-red-500/10 dark:text-red-400 rounded font-medium">
 Error
 </span>
 )}
 <ArrowRight className="w-3.5 h-3.5 text-slate-800 opacity-0 group-hover/node:opacity-100 transition-opacity" />
 </div>
 </motion.div>
 );
 })}
 </div>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
}

// =============================================================================
// ERRORS PANEL
// =============================================================================

function ErrorsPanel() {
 const { data, isLoading } = trpc.execution.errors.useQuery(undefined, { refetchInterval: 30000 });
 const errors = data?.errors ?? [];
 const stats = data?.stats ?? { total: 0, critical: 0, warning: 0 };

 if (isLoading) {
 return (
 <div className="p-6 space-y-6">
 {/* Stats skeleton */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {[0, 1, 2].map((i) => (
 <div key={i} className="p-4 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <div className="flex items-center gap-2 mb-2">
 <div className="w-4 h-4 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
 <div className="h-3 w-16 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 <div className="h-7 w-12 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 </div>
 ))}
 </div>
 {/* Error list skeleton */}
 <div className="space-y-3">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="p-4 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 animate-pulse" />
 <div className="flex-1 space-y-2">
 <div className="flex items-center gap-2">
 <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 <div className="h-5 w-16 bg-white dark:bg-zinc-800/50 rounded-full animate-pulse" />
 </div>
 <div className="h-3 w-3/4 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
 }

 return (
 <div className="p-6">
 {/* Error Stats */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800/60 rounded-xl transition-colors">
 <div className="flex items-center gap-2 mb-2">
 <AlertCircle className="w-4 h-4 text-slate-700 dark:text-zinc-500" />
 <span className="text-xs text-slate-700 dark:text-zinc-500">Total Errors</span>
 </div>
 <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</span>
 </div>
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800/60 rounded-xl transition-colors">
 <div className="flex items-center gap-2 mb-2">
 <XCircle className="w-4 h-4 text-red-600 dark:text-red-500" />
 <span className="text-xs text-slate-700 dark:text-zinc-500">Critical</span>
 </div>
 <span className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.critical}</span>
 </div>
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800/60 rounded-xl transition-colors">
 <div className="flex items-center gap-2 mb-2">
 <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500" />
 <span className="text-xs text-slate-700 dark:text-zinc-500">Warnings</span>
 </div>
 <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.warning}</span>
 </div>
 </div>

 {/* Error List */}
 {errors.length === 0 ? (
 <div className="max-w-md mx-auto mt-16 flex flex-col items-center text-center">
 <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center mb-6 shadow-sm">
 <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-500" />
 </div>
 <h3 className="text-[17px] font-semibold text-slate-900 dark:text-zinc-100 mb-2">
 All systems operational
 </h3>
 <p className="text-[14px] text-slate-700 dark:text-zinc-400">
 No errors in the last 7 days
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {errors.map((err, idx) => {
 const nodeDef = NODE_DEFINITIONS[err.nodeType as AINodeType];
 const isCritical = err.severity === "critical";

 return (
 <motion.div
 key={err.id}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: idx * 0.03 }}
 className="p-4 bg-zinc-900/50 border border-zinc-800/60 rounded-xl hover:border-zinc-700/60 transition-colors"
 >
 <div className="flex items-start gap-3">
 <div className={cn(
 "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
 isCritical ? "bg-red-200 dark:bg-red-500/10" : "bg-amber-200 dark:bg-amber-500/10"
 )}>
 {isCritical ? (
 <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
 ) : (
 <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-sm font-medium text-white">
 {nodeDef?.label || err.nodeType}
 </span>
 <span className={cn(
 "px-1.5 py-0.5 text-[10px] font-medium uppercase rounded",
 isCritical ? "bg-red-200 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-amber-200 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
 )}>
 {err.severity}
 </span>
 </div>
 <p className="text-sm text-slate-600 break-words">{err.message}</p>
 {err.workflowName && (
 <p className="text-xs text-slate-700 mt-2 flex items-center gap-1">
 <GitBranch className="w-3 h-3" />
 {err.workflowName}
 </p>
 )}
 </div>
 </div>
 </motion.div>
 );
 })}
 </div>
 )}
 </div>
 );
}

// =============================================================================
// HEALTH PANEL
// =============================================================================

function HealthPanel() {
 const { data, isLoading } = trpc.execution.health.useQuery(undefined, { refetchInterval: 60000 });

 if (isLoading) {
 return (
 <div className="p-6 space-y-8">
 {/* Overview Stats skeleton */}
 <div>
 <div className="h-3 w-20 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse mb-4" />
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {[0, 1, 2, 3].map((i) => (
 <div key={i} className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <div className="flex items-center gap-2 mb-3">
 <div className="w-4 h-4 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
 <div className="h-3 w-20 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 <div className="h-8 w-16 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 </div>
 ))}
 </div>
 </div>
 {/* Providers skeleton */}
 <div>
 <div className="h-3 w-24 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse mb-4" />
 <div className="space-y-3">
 {[0, 1, 2].map((i) => (
 <div key={i} className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 animate-pulse" />
 <div className="space-y-2">
 <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 <div className="h-3 w-32 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 </div>
 <div className="h-6 w-20 bg-white dark:bg-zinc-800/50 rounded-full animate-pulse" />
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
 }

 const health = data ?? {
 credits: { balance: 0, usedToday: 0, usedThisWeek: 0 },
 cache: { entries: 0, hitRate: "—" },
 system: { workflows: 0, executions: 0, uptime: "—" },
 providers: [],
 };

 return (
 <div className="p-6 space-y-8">
 {/* Overview Stats */}
 <div>
 <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-4">Overview</h3>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800/60 rounded-xl transition-colors">
 <div className="flex items-center gap-2 mb-3">
 <Coins className="w-4 h-4 text-amber-500" />
 <span className="text-xs text-slate-700 dark:text-zinc-500">Credit Balance</span>
 </div>
 <span className="text-3xl font-semibold text-slate-900 dark:text-white tabular-nums">
 {health.credits.balance.toLocaleString()}
 </span>
 </div>
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800/60 rounded-xl transition-colors">
 <div className="flex items-center gap-2 mb-3">
 <Layers className="w-4 h-4 text-violet-500" />
 <span className="text-xs text-slate-700 dark:text-zinc-500">Workflows</span>
 </div>
 <span className="text-3xl font-semibold text-slate-900 dark:text-white tabular-nums">
 {health.system.workflows}
 </span>
 </div>
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800/60 rounded-xl transition-colors">
 <div className="flex items-center gap-2 mb-3">
 <Activity className="w-4 h-4 text-blue-500" />
 <span className="text-xs text-slate-700 dark:text-zinc-500">Total Runs</span>
 </div>
 <span className="text-3xl font-semibold text-slate-900 dark:text-white tabular-nums">
 {health.system.executions.toLocaleString()}
 </span>
 </div>
 <div className="p-5 bg-white dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800/60 rounded-xl transition-colors">
 <div className="flex items-center gap-2 mb-3">
 <Zap className="w-4 h-4 text-emerald-500" />
 <span className="text-xs text-slate-700 dark:text-zinc-500">Cache Entries</span>
 </div>
 <span className="text-3xl font-semibold text-slate-900 dark:text-white tabular-nums">
 {health.cache.entries.toLocaleString()}
 </span>
 </div>
 </div>
 </div>

 {/* API Providers */}
 <div>
 <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-4">API Providers</h3>
 <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
 {health.providers.length === 0 ? (
 <div className="p-8 text-center text-slate-700 text-sm">No provider data available</div>
 ) : (
 <div className="divide-y divide-zinc-800/60">
 {health.providers.map((provider) => (
 <div key={provider.name} className="px-5 py-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
 <div className="flex items-center gap-3">
 <div className={cn(
 "w-2 h-2 rounded-full",
 provider.status === "healthy" ? "bg-emerald-500" :
 provider.status === "degraded" ? "bg-amber-500" : "bg-red-500"
 )} />
 <span className="text-sm font-medium text-white">{provider.name}</span>
 </div>
 <div className="flex items-center gap-4">
 <span className="text-xs text-slate-700">{provider.lastSuccess || "No data"}</span>
 <span className={cn(
 "px-2 py-1 text-[11px] font-medium rounded capitalize",
 provider.status === "healthy" ? "bg-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
 provider.status === "degraded" ? "bg-amber-200 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" :
 "bg-red-200 text-red-700 dark:bg-red-500/10 dark:text-red-400"
 )}>
 {provider.status}
 </span>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 {/* Credit Usage */}
 <div>
 <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-4">Credit Usage</h3>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs text-slate-700">Today</span>
 <span className="text-lg font-semibold text-white tabular-nums">
 {health.credits.usedToday.toLocaleString()}
 </span>
 </div>
 <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
 <div 
 className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full"
 style={{ width: `${Math.min((health.credits.usedToday / (health.credits.balance + health.credits.usedToday || 1)) * 100, 100)}%` }}
 />
 </div>
 </div>
 <div className="p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs text-slate-700">This Week</span>
 <span className="text-lg font-semibold text-white tabular-nums">
 {health.credits.usedThisWeek.toLocaleString()}
 </span>
 </div>
 <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
 <div 
 className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full"
 style={{ width: `${Math.min((health.credits.usedThisWeek / (health.credits.balance + health.credits.usedThisWeek || 1)) * 100, 100)}%` }}
 />
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
