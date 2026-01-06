"use client";

import { useState, useEffect } from "react";
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
}

// =============================================================================
// MOCK DATA (Replace with API calls)
// =============================================================================

const mockExecutions: ExecutionRecord[] = [
  {
    id: "exec-1",
    status: "COMPLETED",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 3500000).toISOString(),
    totalCost: 15,
    nodeExecutions: [
      {
        id: "ne-1",
        nodeId: "node-1",
        nodeLabel: "Generate Script",
        nodeType: "openrouter",
        status: "COMPLETED",
        providerUsed: "openrouter",
        actualCost: 2,
      },
      {
        id: "ne-2",
        nodeId: "node-2",
        nodeLabel: "Generate Image",
        nodeType: "seedream",
        status: "COMPLETED",
        providerUsed: "fal",
        actualCost: 8,
      },
      {
        id: "ne-3",
        nodeId: "node-3",
        nodeLabel: "Upscale Image",
        nodeType: "seedvr",
        status: "COMPLETED",
        providerUsed: "fal",
        actualCost: 5,
      },
    ],
  },
  {
    id: "exec-2",
    status: "FAILED",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    completedAt: new Date(Date.now() - 7100000).toISOString(),
    totalCost: 2,
    nodeExecutions: [
      {
        id: "ne-4",
        nodeId: "node-1",
        nodeLabel: "Generate Script",
        nodeType: "openrouter",
        status: "COMPLETED",
        providerUsed: "openrouter",
        actualCost: 2,
      },
      {
        id: "ne-5",
        nodeId: "node-2",
        nodeLabel: "Generate Image",
        nodeType: "seedream",
        status: "FAILED",
        providerUsed: "fal",
        error: "Provider timeout after 5m",
      },
    ],
  },
  {
    id: "exec-3",
    status: "RUNNING",
    createdAt: new Date(Date.now() - 60000).toISOString(),
    startedAt: new Date(Date.now() - 60000).toISOString(),
    totalCost: 0,
    nodeExecutions: [
      {
        id: "ne-6",
        nodeId: "node-1",
        nodeLabel: "Generate Script",
        nodeType: "openrouter",
        status: "COMPLETED",
        providerUsed: "openrouter",
        actualCost: 2,
      },
      {
        id: "ne-7",
        nodeId: "node-2",
        nodeLabel: "Generate Image",
        nodeType: "seedream",
        status: "RUNNING",
        providerUsed: "fal",
      },
    ],
  },
];

// =============================================================================
// STATUS HELPERS
// =============================================================================

const executionStatusConfig = {
  PENDING: { icon: Clock, color: "text-zinc-500", bg: "bg-zinc-500/10" },
  RUNNING: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/10", spin: true },
  COMPLETED: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  FAILED: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  CANCELLED: { icon: XCircle, color: "text-zinc-400", bg: "bg-zinc-500/10" },
};

const nodeStatusConfig = {
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

  // Load executions (mock for now)
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        setExecutions(mockExecutions);
        setIsLoading(false);
      }, 300);
    }
  }, [isOpen, workflowId]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed right-4 top-20 z-40",
          "h-10 px-3 rounded-xl",
          "bg-zinc-900/80 backdrop-blur-xl border border-white/10",
          "text-zinc-300 hover:text-white hover:bg-zinc-800/80",
          "flex items-center gap-2 transition-all",
          "shadow-lg",
          className
        )}
      >
        <History className="w-4 h-4" />
        <span className="text-xs font-medium">History</span>
      </button>

      {/* Slide-out Panel */}
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
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-[420px] z-50 bg-zinc-950 border-l border-white/10 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                    <History className="w-4 h-4 text-zinc-300" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Execution History</h2>
                    <p className="text-[10px] text-zinc-500">{executions.length} runs</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl border border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                  </div>
                ) : executions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center px-8">
                    <History className="w-8 h-8 text-zinc-600 mb-3" />
                    <p className="text-sm text-zinc-400">No executions yet</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Run your workflow to see execution history
                    </p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {executions.map((exec) => {
                      const statusCfg = executionStatusConfig[exec.status];
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
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-zinc-200">
                                  {exec.status === "RUNNING" ? "Running..." : exec.status}
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
                                  {exec.nodeExecutions.map((node, idx) => {
                                    const nodeCfg = nodeStatusConfig[node.status];
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
                                          <span className="text-[9px] text-red-400 truncate max-w-[100px]">
                                            {node.error}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}

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
              <div className="px-5 py-3 border-t border-white/10 bg-zinc-900/50">
                <p className="text-[10px] text-zinc-500 text-center">
                  Powered by Trigger.dev Realtime
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

