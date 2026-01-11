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
import { trpc } from "@/lib/trpc/react";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";

// =============================================================================
// TYPES
// =============================================================================

type ExecutionStatus = "running" | "completed" | "failed" | "cancelled" | "queued" | "waiting" | "pending" | "terminated";
type TabType = "runs" | "errors" | "health";

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
  cancelled: { label: "Cancelled", color: "bg-zinc-500", text: "text-zinc-400", icon: AlertTriangle },
  queued: { label: "Queued", color: "bg-zinc-500", text: "text-zinc-400", icon: Clock },
  pending: { label: "Pending", color: "bg-zinc-500", text: "text-zinc-400", icon: Clock },
  waiting: { label: "Waiting", color: "bg-amber-500", text: "text-amber-400", icon: Pause },
  terminated: { label: "Terminated", color: "bg-zinc-500", text: "text-zinc-400", icon: AlertCircle },
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
    <div className="h-full flex flex-col bg-[#09090b] relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <DotPattern className="text-zinc-800/40 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black_70%)]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-600/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/[0.03] rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      {/* Top Bar */}
      <div className="relative shrink-0 h-14 px-6 flex items-center justify-between border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Workflow Runs</h1>
            <p className="text-[11px] text-zinc-500">{stats.totalRuns} total executions</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {runningCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-[11px] font-medium text-blue-400">{runningCount} running</span>
            </div>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 px-3 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg flex items-center gap-1.5 transition-all"
          >
            <RotateCcw className={cn("w-3 h-3", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs & Stats Bar */}
      <div className="relative shrink-0 border-b border-zinc-800/60">
        <div className="px-6 flex items-center justify-between">
          {/* Tabs */}
          <div className="flex">
            {(["runs", "errors", "health"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium capitalize transition-colors",
                  activeTab === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {tab}
                {tab === "errors" && failedCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400 rounded">
                    {failedCount}
                  </span>
                )}
                {activeTab === tab && (
                  <motion.div
                    layoutId="active-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-6 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs text-zinc-400">Success</span>
              <span className="text-xs font-semibold text-white">{stats.successRate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs text-zinc-400">Avg</span>
              <span className="text-xs font-semibold text-white">{stats.avgDuration}</span>
            </div>
            <div className="flex items-center gap-2">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-zinc-400">Credits</span>
              <span className="text-xs font-semibold text-white">{stats.creditsUsed}</span>
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
          {/* Filters */}
              <div className="shrink-0 px-6 py-4 flex items-center gap-3 border-b border-zinc-800/40">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search workflows..."
                    className="w-full h-9 pl-10 pr-4 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700/50 transition-all"
                />
              </div>

                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                {(["all", "running", "completed", "failed"] as const).map((status) => (
                  <button
                    key={status}
                      onClick={() => setStatusFilter(status)}
                    className={cn(
                        "h-8 px-3 text-xs font-medium rounded-md capitalize transition-all",
                        statusFilter === status
                          ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
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
                  <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
                      <span className="text-sm text-zinc-600">Loading runs...</span>
                    </div>
                  </div>
                ) : runs.length === 0 ? (
                  <div className="relative flex items-center justify-center h-64 overflow-hidden">
                    <DotPattern className="text-zinc-800/60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
                    <div className="relative flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center shadow-xl">
                        <Layers className="w-7 h-7 text-zinc-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-zinc-300">No workflow runs</p>
                        <p className="text-xs text-zinc-600 mt-1">Execute a workflow to see runs here</p>
                      </div>
                      <Link href="/workflows">
                        <button className="mt-2 h-9 px-5 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg flex items-center gap-1.5 transition-all shadow-lg shadow-blue-500/25">
                          <Play className="w-3 h-3" />
                          Go to Workflows
                        </button>
                      </Link>
            </div>
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

          {activeTab === "health" && (
            <motion.div
              key="health"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-auto"
            >
              <HealthPanel />
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
          run.status === "running" ? "bg-blue-500/10" :
          run.status === "completed" ? "bg-emerald-500/10" :
          run.status === "failed" ? "bg-red-500/10" :
          "bg-zinc-800"
        )}>
          <StatusIcon className={cn(
            "w-4 h-4",
            status.text,
            status.spin && "animate-spin"
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
            <span className="text-xs text-zinc-500">
              {run.startedAt ? formatTime(run.startedAt) : "—"}
                            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-500">{nodes.length} nodes</span>
            {run.status === "running" && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-blue-400">{progress}%</span>
              </>
            )}
                        </div>
                      </div>

        {/* Duration */}
        <div className="text-right shrink-0">
          <div className="text-sm font-mono text-zinc-300">{run.duration || "—"}</div>
          {run.totalCost > 0 && (
            <div className="text-xs text-zinc-600 mt-0.5">{run.totalCost} credits</div>
          )}
                      </div>

        {/* Progress/Status Badge */}
        <div className="w-20 shrink-0">
          {run.status === "running" ? (
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
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
              run.status === "completed" && "bg-emerald-500/10 text-emerald-400",
              run.status === "failed" && "bg-red-500/10 text-red-400",
              run.status === "cancelled" && "bg-zinc-800 text-zinc-400",
              !["completed", "failed", "cancelled", "running"].includes(run.status) && "bg-zinc-800 text-zinc-400"
            )}>
              {status.label}
            </span>
          )}
                      </div>

        {/* Chevron */}
        <ChevronDown className={cn(
          "w-4 h-4 text-zinc-600 transition-transform shrink-0",
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
                    <button className="h-7 px-3 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/50 rounded-md flex items-center gap-1.5 transition-all">
                      <ExternalLink className="w-3 h-3" />
                      View Workflow
                    </button>
                                  </Link>
                                )}
                {run.status === "failed" && (
                  <button className="h-7 px-3 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/50 rounded-md flex items-center gap-1.5 transition-all">
                    <RotateCcw className="w-3 h-3" />
                    Retry
                  </button>
                )}
                              </div>

              {/* Node Timeline */}
              <div className="relative ml-[52px]">
                {/* Timeline Line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-800" />

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
                        className="relative flex items-center gap-3 py-2 px-3 -ml-3 rounded-lg hover:bg-zinc-800/40 transition-colors cursor-pointer group/node"
                        onClick={() => run.workflowId && router.push(`/workflows/${run.workflowId}`)}
                      >
                        {/* Node Status Dot */}
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 z-10",
                          node.status === "completed" ? "border-emerald-500 bg-emerald-500" :
                          node.status === "failed" ? "border-red-500 bg-red-500" :
                          node.status === "running" ? "border-blue-500 bg-[#09090b]" :
                          "border-zinc-700 bg-[#09090b]"
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
                          <Box className="w-3.5 h-3.5 text-zinc-600" />
                          <span className="text-sm text-zinc-300 group-hover/node:text-white transition-colors">
                            {nodeDef?.label || node.label}
                          </span>
                          {node.provider && (
                            <span className="text-[10px] text-zinc-600 bg-zinc-800/80 px-1.5 py-0.5 rounded">
                              {node.provider}
                            </span>
                          )}
                        </div>

                        {/* Node Meta */}
                        <div className="flex items-center gap-4 shrink-0">
                          {node.duration && (
                            <span className="text-xs font-mono text-zinc-500">{node.duration}</span>
                          )}
                          {node.cost !== undefined && node.cost > 0 && (
                            <span className="text-xs text-zinc-600">{node.cost}c</span>
                          )}
                          {node.error && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded font-medium">
                              Error
                            </span>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-700 opacity-0 group-hover/node:opacity-100 transition-opacity" />
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Error Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="relative p-4 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group hover:border-zinc-700/60 transition-colors">
          <DotPattern className="text-zinc-500/5 group-hover:text-zinc-500/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Total Errors</span>
            </div>
            <span className="text-2xl font-semibold text-white">{stats.total}</span>
          </div>
        </div>
        <div className="relative p-4 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group hover:border-red-500/20 transition-colors">
          <DotPattern className="text-red-500/5 group-hover:text-red-500/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-zinc-500">Critical</span>
            </div>
            <span className="text-2xl font-semibold text-red-400">{stats.critical}</span>
          </div>
        </div>
        <div className="relative p-4 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group hover:border-amber-500/20 transition-colors">
          <DotPattern className="text-amber-500/5 group-hover:text-amber-500/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-zinc-500">Warnings</span>
            </div>
            <span className="text-2xl font-semibold text-amber-400">{stats.warning}</span>
          </div>
        </div>
      </div>

      {/* Error List */}
      {errors.length === 0 ? (
        <div className="relative flex flex-col items-center justify-center py-20 overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/30">
          <DotPattern className="text-emerald-500/5 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
          <div className="relative flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-zinc-200">All systems operational</p>
            <p className="text-xs text-zinc-600 mt-1">No errors in the last 7 days</p>
          </div>
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
                    isCritical ? "bg-red-500/10" : "bg-amber-500/10"
                  )}>
                    {isCritical ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        {nodeDef?.label || err.nodeType}
                      </span>
                      <span className={cn(
                        "px-1.5 py-0.5 text-[10px] font-medium uppercase rounded",
                        isCritical ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                      )}>
                        {err.severity}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 break-words">{err.message}</p>
                    {err.workflowName && (
                      <p className="text-xs text-zinc-600 mt-2 flex items-center gap-1">
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
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
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Overview</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="relative p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group hover:border-amber-500/20 transition-colors">
            <DotPattern className="text-amber-500/5 group-hover:text-amber-500/10 transition-colors" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-zinc-500">Credit Balance</span>
              </div>
              <span className="text-3xl font-semibold text-white tabular-nums">
                {health.credits.balance.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="relative p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group hover:border-violet-500/20 transition-colors">
            <DotPattern className="text-violet-500/5 group-hover:text-violet-500/10 transition-colors" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-violet-500" />
                <span className="text-xs text-zinc-500">Workflows</span>
              </div>
              <span className="text-3xl font-semibold text-white tabular-nums">
                {health.system.workflows}
              </span>
            </div>
          </div>
          <div className="relative p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group hover:border-blue-500/20 transition-colors">
            <DotPattern className="text-blue-500/5 group-hover:text-blue-500/10 transition-colors" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-zinc-500">Total Runs</span>
              </div>
              <span className="text-3xl font-semibold text-white tabular-nums">
                {health.system.executions.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="relative p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group hover:border-emerald-500/20 transition-colors">
            <DotPattern className="text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-zinc-500">Cache Entries</span>
              </div>
              <span className="text-3xl font-semibold text-white tabular-nums">
                {health.cache.entries.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* API Providers */}
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">API Providers</h3>
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
          {health.providers.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">No provider data available</div>
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
                    <span className="text-xs text-zinc-500">{provider.lastSuccess || "No data"}</span>
                    <span className={cn(
                      "px-2 py-1 text-[11px] font-medium rounded capitalize",
                      provider.status === "healthy" ? "bg-emerald-500/10 text-emerald-400" :
                      provider.status === "degraded" ? "bg-amber-500/10 text-amber-400" :
                      "bg-red-500/10 text-red-400"
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
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Credit Usage</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">Today</span>
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
              <span className="text-xs text-zinc-500">This Week</span>
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
