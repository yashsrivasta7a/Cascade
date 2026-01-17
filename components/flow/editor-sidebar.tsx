"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Image,
  Film,
  Volume2,
  Brain,
  Wrench,
  Coins,
  History,
  Clock,
  Loader2,
  ChevronRight,
  RotateCcw,
  XCircle,
  Inbox,
  Sparkles,
  Layers,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NODE_DEFINITIONS,
  CATEGORY_META,
  type NodeCategory,
  type AINodeType,
} from "@/types/nodes";

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
// CONFIG
// =============================================================================

const categoryIcons: Record<NodeCategory, React.ReactNode> = {
  image: <Image className="w-3.5 h-3.5" />,
  video: <Film className="w-3.5 h-3.5" />,
  audio: <Volume2 className="w-3.5 h-3.5" />,
  llm: <Brain className="w-3.5 h-3.5" />,
  utility: <Wrench className="w-3.5 h-3.5" />,
};

const categoryOrder: NodeCategory[] = ["llm", "image", "video", "audio", "utility"];

const statusColors = {
  PENDING: "text-zinc-500",
  QUEUED: "text-zinc-500",
  RUNNING: "text-cyan-400",
  WAITING: "text-amber-400",
  COMPLETED: "text-emerald-400",
  FAILED: "text-red-400",
  CANCELLED: "text-zinc-500",
};

const statusDots = {
  PENDING: "bg-zinc-600",
  QUEUED: "bg-zinc-600",
  RUNNING: "bg-cyan-400",
  WAITING: "bg-amber-400",
  COMPLETED: "bg-emerald-400",
  FAILED: "bg-red-400",
  CANCELLED: "bg-zinc-600",
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatDuration(startStr?: string, endStr?: string): string {
  if (!startStr) return "—";
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const secs = Math.floor((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

// =============================================================================
// COMPONENT
// =============================================================================

type TabType = "nodes" | "history";

interface EditorSidebarProps {
  workflowId?: string;
  onDragStart?: (event: React.DragEvent, nodeType: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function EditorSidebar({ workflowId, onDragStart, isOpen, onToggle }: EditorSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("nodes");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<NodeCategory | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Node filtering
  const filteredNodes = Object.values(NODE_DEFINITIONS).filter((node) => {
    const matchesSearch = !search || 
      node.label.toLowerCase().includes(search.toLowerCase()) ||
      node.provider.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || node.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
    onDragStart?.(event, nodeType);
  };

  // Execution history fetching
  const fetchExecutions = useCallback(async () => {
    if (activeTab !== "history") return;
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams();
      if (workflowId && workflowId !== "new") params.set("workflowId", workflowId);
      params.set("limit", "20");
      
      const response = await fetch(`/api/executions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch");
      
      const data = await response.json();
      const transformed: ExecutionRecord[] = (data.executions || []).map((exec: any) => ({
        id: exec.id,
        status: exec.status?.toUpperCase?.() ?? "PENDING",
        createdAt: exec.createdAt,
        startedAt: exec.startedAt,
        completedAt: exec.completedAt,
        totalCost: exec.totalCost || 0,
        workflowName: exec.workflow?.name || "Workflow",
        nodeExecutions: (exec.nodes || exec.nodeExecutions || []).map((ne: any) => ({
          id: ne.id,
          nodeId: ne.nodeId || ne.id,
          nodeLabel: ne.label || ne.nodeLabel || ne.nodeType || "Node",
          nodeType: ne.nodeType,
          status: ne.status?.toUpperCase?.() ?? "PENDING",
          startedAt: ne.startedAt,
          completedAt: ne.completedAt,
          providerUsed: ne.provider || ne.providerUsed,
          actualCost: ne.cost || ne.actualCost,
          error: ne.error,
        })),
      }));
      
      setExecutions(transformed);
    } catch (err) {
      console.error("Failed to fetch executions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, workflowId]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchExecutions();
      const interval = setInterval(fetchExecutions, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchExecutions]);

  if (!isOpen) {
    return (
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onToggle}
        className="fixed left-3 top-20 z-40 w-10 h-10 rounded-xl bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-gray-200 dark:border-white/[0.08] flex items-center justify-center text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:border-gray-300 dark:hover:border-white/[0.15] transition-all shadow-md dark:shadow-none"
      >
        <Layers className="w-4 h-4" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="fixed left-3 top-16 bottom-3 z-40 w-72 bg-white dark:bg-black/40 backdrop-blur-2xl backdrop-saturate-150 border border-gray-200 dark:border-white/[0.08] rounded-2xl flex flex-col overflow-hidden shadow-xl shadow-gray-200/80 dark:shadow-2xl dark:shadow-black/40"
    >
      {/* Header with tabs */}
      <div className="flex items-center border-b border-gray-100 dark:border-zinc-800/50">
        <button
          onClick={() => setActiveTab("nodes")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-all border-b-2 -mb-px",
            activeTab === "nodes"
              ? "text-gray-900 dark:text-zinc-100 border-gray-900 dark:border-zinc-100"
              : "text-gray-500 dark:text-zinc-500 border-transparent hover:text-gray-700 dark:hover:text-zinc-300"
          )}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Nodes
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-all border-b-2 -mb-px",
            activeTab === "history"
              ? "text-gray-900 dark:text-zinc-100 border-gray-900 dark:border-zinc-100"
              : "text-gray-500 dark:text-zinc-500 border-transparent hover:text-gray-700 dark:hover:text-zinc-300"
          )}
        >
          <History className="w-3.5 h-3.5" />
          History
        </button>
        <button
          onClick={onToggle}
          className="p-2.5 mr-1 text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === "nodes" ? (
          <motion.div
            key="nodes"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Search & Filter */}
            <div className="p-3 space-y-2 border-b border-gray-100 dark:border-zinc-800/30">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-600" />
                <input
                  type="text"
                  placeholder="Search nodes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-gray-100 dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-800/50 text-xs text-gray-700 dark:text-zinc-300 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-gray-300 dark:focus:border-zinc-700 transition-colors"
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all",
                    !activeCategory
                      ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                      : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/50"
                  )}
                >
                  All
                </button>
                {categoryOrder.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      activeCategory === cat
                        ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                        : "text-gray-500 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50"
                    )}
                    title={CATEGORY_META[cat].label}
                  >
                    {categoryIcons[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Node List */}
            <div className="flex-1 overflow-y-auto p-2">
              {filteredNodes.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-gray-500 dark:text-zinc-600">No nodes found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredNodes.map((node) => (
                    <motion.div
                      key={node.type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, node.type)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="group flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-900/40 hover:bg-gray-100 dark:hover:bg-zinc-800/60 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700/50 cursor-grab active:cursor-grabbing transition-all"
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        "bg-gray-100 dark:bg-gradient-to-br dark:from-zinc-800 dark:to-zinc-900 border border-gray-200 dark:border-zinc-700/50",
                        "text-gray-500 dark:text-zinc-400 group-hover:text-gray-700 dark:group-hover:text-zinc-200 transition-colors"
                      )}>
                        {categoryIcons[node.category]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-200 truncate">
                          {node.label}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-zinc-500 truncate">
                          {node.provider}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Coins className="w-3 h-3" />
                        <span>{node.estimatedCost || 0}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-gray-100 dark:border-zinc-800/30">
              <p className="text-[10px] text-gray-500 dark:text-zinc-600 text-center">
                Drag nodes to canvas
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Refresh button */}
            <div className="px-3 py-2 border-b border-gray-100 dark:border-zinc-800/30 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 dark:text-zinc-500">
                {executions.length} executions
              </span>
              <button
                onClick={fetchExecutions}
                disabled={isLoading}
                className="p-1.5 rounded-md text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition-all disabled:opacity-50"
              >
                <RotateCcw className={cn("w-3 h-3", isLoading && "animate-spin")} />
              </button>
            </div>

            {/* Execution List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading && executions.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-4 h-4 text-gray-400 dark:text-zinc-600 animate-spin" />
                </div>
              ) : executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center px-8">
                  <Inbox className="w-8 h-8 text-gray-300 dark:text-zinc-800 mb-3" />
                  <p className="text-xs text-gray-500 dark:text-zinc-500">No runs yet</p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1">
                    Run your workflow to see history
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {executions.map((exec) => {
                    const statusKey = exec.status.toUpperCase() as keyof typeof statusColors;
                    const isExpanded = expandedId === exec.id;
                    const isRunning = statusKey === "RUNNING";

                    return (
                      <div key={exec.id} className="border-b border-gray-100 dark:border-zinc-800/20 last:border-0">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : exec.id)}
                          className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
                        >
                          {/* Status dot */}
                          <div className="relative flex-shrink-0">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              statusDots[statusKey] || statusDots.PENDING
                            )} />
                            {isRunning && (
                              <div className={cn(
                                "absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75",
                                statusDots[statusKey]
                              )} />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[11px] font-medium",
                                statusColors[statusKey] || statusColors.PENDING
                              )}>
                                {statusKey.charAt(0) + statusKey.slice(1).toLowerCase()}
                              </span>
                              <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                                {formatTimeAgo(exec.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                                {formatDuration(exec.startedAt, exec.completedAt)}
                              </span>
                              {(exec.totalCost ?? 0) > 0 && (
                                <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                                  {exec.totalCost}c
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Node count */}
                          <span className="text-[10px] text-gray-400 dark:text-zinc-600 flex-shrink-0">
                            {exec.nodeExecutions.length}n
                          </span>
                          <ChevronRight className={cn(
                            "w-3 h-3 text-gray-400 dark:text-zinc-600 transition-transform flex-shrink-0",
                            isExpanded && "rotate-90"
                          )} />
                        </button>

                        {/* Expanded nodes */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 pt-1 ml-4 border-l border-gray-200 dark:border-zinc-800/50">
                                {exec.nodeExecutions.map((node, idx) => {
                                  const nodeStatus = (node.status?.toUpperCase?.() ?? "PENDING") as keyof typeof statusColors;
                                  
                                  return (
                                    <div
                                      key={node.id}
                                      className="flex items-center gap-2 py-1.5 pl-2"
                                    >
                                      <div className={cn(
                                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                        statusDots[nodeStatus] || statusDots.PENDING
                                      )} />
                                      <span className="text-[10px] text-gray-500 dark:text-zinc-400 flex-1 truncate">
                                        {node.nodeLabel}
                                      </span>
                                      {node.error && (
                                        <XCircle className="w-3 h-3 text-red-500 dark:text-red-400 flex-shrink-0" />
                                      )}
                                    </div>
                                  );
                                })}
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
            <div className="px-3 py-2 border-t border-gray-100 dark:border-zinc-800/30">
              <p className="text-[10px] text-gray-500 dark:text-zinc-600 text-center flex items-center justify-center gap-1.5">
                <Clock className="w-3 h-3" />
                Auto-refreshes every 5s
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default EditorSidebar;


