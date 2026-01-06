"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Coins,
  Timer,
  RotateCcw,
  ExternalLink,
  Play,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface NodeExecutionRecord {
  id: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  status: "QUEUED" | "RUNNING" | "WAITING" | "COMPLETED" | "FAILED";
  startedAt?: string;
  completedAt?: string;
  providerUsed?: string;
  actualCost?: number;
  error?: string;
}

interface ExecutionRecord {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  totalCost?: number;
  nodeExecutions: NodeExecutionRecord[];
  workflowName?: string;
}

// =============================================================================
// STATUS HELPERS
// =============================================================================

const executionStatusConfig = {
  PENDING: { icon: Clock, color: "text-zinc-500", bg: "bg-zinc-500/10", label: "Pending" },
  RUNNING: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/10", spin: true, label: "Running" },
  COMPLETED: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Completed" },
  FAILED: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Failed" },
  CANCELLED: { icon: XCircle, color: "text-zinc-400", bg: "bg-zinc-500/10", label: "Cancelled" },
};

const nodeStatusConfig = {
  PENDING: { icon: Clock, color: "text-zinc-500" },
  QUEUED: { icon: Clock, color: "text-zinc-500" },
  RUNNING: { icon: Loader2, color: "text-blue-400", spin: true },
  WAITING: { icon: Clock, color: "text-amber-400" },
  COMPLETED: { icon: CheckCircle2, color: "text-emerald-400" },
  FAILED: { icon: XCircle, color: "text-red-400" },
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(startStr?: string, endStr?: string): string {
  if (!startStr) return "—";
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const secs = Math.floor((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins}m ${remainingSecs}s`;
}

// =============================================================================
// COMPONENTS
// =============================================================================

interface ExecutionHistoryPanelProps {
  workflowId?: string;
  className?: string;
}

export function ExecutionHistoryPanel({ workflowId, className }: ExecutionHistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Check if there are stuck executions (running for more than 2 minutes)
  const hasStuckExecutions = executions.some(exec => {
    const status = typeof exec.status === "string" ? exec.status.toUpperCase() : "";
    if (status !== "RUNNING") return false;
    if (!exec.startedAt) return false;
    const startedAt = new Date(exec.startedAt).getTime();
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    return startedAt < twoMinutesAgo;
  });

  // Fetch real executions from API
  const fetchExecutions = useCallback(async () => {
    if (!isOpen) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (workflowId) params.set("workflowId", workflowId);
      params.set("limit", "20");
      
      const response = await fetch(`/api/executions?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch executions");
      }
      
      const data = await response.json();
      
      // Transform API data to our format
      const transformed: ExecutionRecord[] = (data.executions || []).map((exec: any) => ({
        id: exec.id,
        status: exec.status,
        createdAt: exec.createdAt,
        startedAt: exec.startedAt,
        completedAt: exec.completedAt,
        totalCost: exec.totalCost || 0,
        workflowName: exec.workflow?.name || "Workflow",
        nodeExecutions: (exec.nodeExecutions || []).map((ne: any) => ({
          id: ne.id,
          nodeId: ne.nodeId,
          nodeLabel: ne.nodeLabel || ne.nodeType || "Node",
          nodeType: ne.nodeType,
          status: ne.status,
          startedAt: ne.startedAt,
          completedAt: ne.completedAt,
          providerUsed: ne.providerUsed,
          actualCost: ne.actualCost,
          error: ne.error,
        })),
      }));
      
      setExecutions(transformed);
    } catch (err) {
      console.error("Failed to fetch executions:", err);
      setError(err instanceof Error ? err.message : "Failed to load executions");
      setExecutions([]);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, workflowId]);

  useEffect(() => {
    fetchExecutions();
    
    // Auto-refresh every 5 seconds when open
    if (isOpen) {
      const interval = setInterval(fetchExecutions, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, workflowId, fetchExecutions]);

  // Cancel stuck executions
  const cancelStuck = useCallback(async () => {
    setIsCancelling(true);
    try {
      const response = await fetch("/api/executions/cancel-stuck", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        // Refresh the list
        fetchExecutions();
      }
    } catch (err) {
      console.error("Failed to cancel stuck executions:", err);
    } finally {
      setIsCancelling(false);
    }
  }, [fetchExecutions]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <>
      {/* Toggle Button - styled like Node Inspector */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed right-4 top-20 z-40",
          "h-10 px-3 rounded-xl",
          "bg-zinc-950/80 backdrop-blur-xl border border-white/10",
          "text-zinc-300 hover:text-white hover:bg-zinc-900/80",
          "flex items-center gap-2 transition-all",
          "shadow-lg hover:shadow-xl",
          className
        )}
      >
        <History className="w-4 h-4" />
        <span className="text-xs font-medium">History</span>
      </button>

      {/* Slide-out Panel - styled like Node Inspector */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-4 top-20 bottom-4 w-[380px] max-w-[90vw] z-50 bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-white/10 bg-white/5">
                    <History className="w-3.5 h-3.5 text-zinc-300" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                      Executions
                    </span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 bg-white/5">
                    <History className="w-4 h-4 text-zinc-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-white">Execution History</h2>
                    <p className="text-[10px] text-zinc-500">
                      {executions.length} {executions.length === 1 ? "run" : "runs"}
                      {workflowId ? " for this workflow" : " total"}
                    </p>
                  </div>
                  {hasStuckExecutions && (
                    <button
                      onClick={cancelStuck}
                      disabled={isCancelling}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all disabled:opacity-50"
                      title="Cancel executions stuck for more than 2 minutes"
                    >
                      {isCancelling ? "Cancelling..." : "Cancel Stuck"}
                    </button>
                  )}
                  <button
                    onClick={fetchExecutions}
                    disabled={isLoading}
                    className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
                  >
                    <RotateCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading && executions.length === 0 ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center px-8">
                    <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
                    <p className="text-sm text-red-400">{error}</p>
                    <button
                      onClick={fetchExecutions}
                      className="mt-3 text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                ) : executions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center px-8">
                    <Inbox className="w-10 h-10 text-zinc-700 mb-3" />
                    <p className="text-sm text-zinc-400 font-medium">No executions yet</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Run your workflow to see execution history here
                    </p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {executions.map((exec) => {
                      // Handle both uppercase and lowercase status
                      const statusKey = exec.status.toUpperCase() as keyof typeof executionStatusConfig;
                      const statusCfg = executionStatusConfig[statusKey] ?? executionStatusConfig.PENDING;
                      const StatusIcon = statusCfg.icon;
                      const isExpanded = expandedId === exec.id;

                      return (
                        <div
                          key={exec.id}
                          className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
                        >
                          {/* Execution Header */}
                          <button
                            onClick={() => toggleExpand(exec.id)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", statusCfg.bg)}>
                              <StatusIcon
                                className={cn("w-4 h-4", statusCfg.color, statusCfg.spin && "animate-spin")}
                              />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-zinc-200">
                                  {statusCfg.label}
                                </span>
                                <span className="text-[10px] text-zinc-500">
                                  {formatTimeAgo(exec.createdAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                  <Timer className="w-3 h-3" />
                                  {formatDuration(exec.startedAt, exec.completedAt)}
                                </span>
                                {exec.totalCost !== undefined && exec.totalCost > 0 && (
                                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                    <Coins className="w-3 h-3" />
                                    {exec.totalCost} credits
                                  </span>
                                )}
                                <span className="text-[10px] text-zinc-600">
                                  {exec.nodeExecutions.length} nodes
                                </span>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-zinc-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            )}
                          </button>

                          {/* Node Executions (Expanded) */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-3 space-y-1.5 border-t border-white/5 pt-3">
                                  {exec.nodeExecutions.length === 0 ? (
                                    <p className="text-[10px] text-zinc-600 text-center py-2">
                                      No node execution details available
                                    </p>
                                  ) : (
                                    exec.nodeExecutions.map((node, idx) => {
                                      // Handle both uppercase and lowercase status
                                      const nodeStatusKey = (node.status?.toUpperCase?.() ?? "PENDING") as keyof typeof nodeStatusConfig;
                                      const nodeCfg = nodeStatusConfig[nodeStatusKey] ?? nodeStatusConfig.PENDING;
                                      const NodeIcon = nodeCfg.icon;

                                      return (
                                        <div
                                          key={node.id}
                                          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5"
                                        >
                                          <span className="text-[10px] text-zinc-600 font-mono w-4">
                                            {idx + 1}
                                          </span>
                                          <NodeIcon
                                            className={cn(
                                              "w-3.5 h-3.5",
                                              nodeCfg.color,
                                              nodeCfg.spin && "animate-spin"
                                            )}
                                          />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-zinc-300 truncate">
                                              {node.nodeLabel}
                                            </p>
                                            <p className="text-[9px] text-zinc-600">{node.nodeType}</p>
                                          </div>
                                          {node.providerUsed && (
                                            <span className="text-[9px] text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded">
                                              {node.providerUsed}
                                            </span>
                                          )}
                                          {node.actualCost !== undefined && node.actualCost > 0 && (
                                            <span className="text-[9px] text-zinc-500 flex items-center gap-0.5">
                                              <Coins className="w-2.5 h-2.5" />
                                              {node.actualCost}
                                            </span>
                                          )}
                                          {node.error && (
                                            <span className="text-[9px] text-red-400 truncate max-w-[100px]" title={node.error}>
                                              {node.error}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}

                                  {/* Actions */}
                                  <div className="flex items-center gap-2 pt-2">
                                    <button className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
                                      <RotateCcw className="w-3 h-3" />
                                      Replay
                                    </button>
                                    <button className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
                                      <ExternalLink className="w-3 h-3" />
                                      View in Trigger.dev
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-white/10 bg-zinc-900/30">
                <p className="text-[10px] text-zinc-500 text-center">
                  Powered by Trigger.dev Realtime • Auto-refreshing
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default ExecutionHistoryPanel;
