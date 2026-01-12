"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  RotateCcw,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  Zap,
  Image,
  Film,
  Volume2,
  Brain,
  Timer,
  Coins,
  AlertCircle,
  Pause,
  ChevronDown,
  Calendar,
  Activity,
  Bug,
  AlertTriangle,
  Info,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Lightbulb,
  Play,
  Crop,
  Scissors,
  Mic,
  Database,
  Focus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DotPattern } from "@/components/ui";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { useFlowStore } from "@/store";

// =============================================================================
// TYPES
// =============================================================================

interface NodeExecutionRecord {
  id: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  status: "PENDING" | "QUEUED" | "RUNNING" | "WAITING" | "COMPLETED" | "FAILED";
  providerUsed?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  actualCost?: number;
  durationMs?: number;
}

interface ExecutionRecord {
  id: string;
  workflowName?: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  nodeExecutions: NodeExecutionRecord[];
  totalCost?: number;
  estimatedCost?: number;
  durationMs?: number;
}

export type ErrorSeverity = "critical" | "warning" | "info";

export interface WorkflowError {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  stackTrace?: string;
  timestamp: Date;
  inputs?: Record<string, unknown>;
  canRetry?: boolean;
  provider?: string;
  executionId?: string;
  triggerRunId?: string;
  httpStatus?: number;
  errorCode?: string;
  duration?: number;
  rawResponse?: unknown;
  suggestion?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatExactTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", { 
    hour: "2-digit", 
    minute: "2-digit",
    second: "2-digit",
    hour12: false 
  });
}

function formatExactDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  
  if (isToday) return "Today";
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatCredits(credits?: number): string {
  if (credits === undefined || credits === null || credits === 0) return "0";
  if (credits >= 1000000) return `${(credits / 1000000).toFixed(2)}M`;
  if (credits >= 1000) return `${(credits / 1000).toFixed(1)}K`;
  if (credits < 1) return credits.toFixed(2);
  return credits.toLocaleString();
}

function getNodeIcon(nodeType: string) {
  switch (nodeType) {
    case "openrouter": return <Brain className="w-3 h-3 text-blue-400" />;
    case "seedream": return <Image className="w-3 h-3 text-emerald-400" />;
    case "seedance": return <Film className="w-3 h-3 text-violet-400" />;
    case "seedvr": return <Film className="w-3 h-3 text-violet-400" />;
    case "lipsync": return <Mic className="w-3 h-3 text-amber-400" />;
    case "elevenlabs": return <Volume2 className="w-3 h-3 text-amber-400" />;
    case "crop-image": return <Crop className="w-3 h-3 text-emerald-400" />;
    case "merge-videos": return <Film className="w-3 h-3 text-violet-400" />;
    case "merge-audio-video": return <Film className="w-3 h-3 text-violet-400" />;
    case "extract-audio": return <Scissors className="w-3 h-3 text-amber-400" />;
    default: return <Zap className="w-3 h-3 text-zinc-400" />;
  }
}

function getNodeColor(nodeType: string): string {
  switch (nodeType) {
    case "openrouter": return "bg-blue-500/15";
    case "seedream": return "bg-emerald-500/15";
    case "seedance": return "bg-violet-500/15";
    case "seedvr": return "bg-violet-500/15";
    case "lipsync": return "bg-amber-500/15";
    case "elevenlabs": return "bg-amber-500/15";
    case "crop-image": return "bg-emerald-500/15";
    case "merge-videos": return "bg-violet-500/15";
    case "merge-audio-video": return "bg-violet-500/15";
    case "extract-audio": return "bg-amber-500/15";
    default: return "bg-zinc-500/15";
  }
}

const statusStyles = {
  PENDING: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-zinc-400", bg: "bg-zinc-500/15", border: "border-zinc-500/30", label: "Pending", cardBg: "bg-zinc-900/40", accentBar: "bg-zinc-500" },
  QUEUED: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-zinc-400", bg: "bg-zinc-500/15", border: "border-zinc-500/30", label: "Queued", cardBg: "bg-zinc-900/40", accentBar: "bg-zinc-500" },
  RUNNING: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/30", label: "Running", cardBg: "bg-blue-950/20", accentBar: "bg-gradient-to-b from-blue-400 to-blue-600" },
  WAITING: { icon: <Pause className="w-3.5 h-3.5" />, color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30", label: "Waiting", cardBg: "bg-amber-950/20", accentBar: "bg-gradient-to-b from-amber-400 to-amber-600" },
  COMPLETED: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", label: "Success", cardBg: "bg-emerald-950/20", accentBar: "bg-gradient-to-b from-emerald-400 to-emerald-600" },
  FAILED: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30", label: "Failed", cardBg: "bg-red-950/20", accentBar: "bg-gradient-to-b from-red-400 to-red-600" },
  CANCELLED: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30", label: "Cancelled", cardBg: "bg-orange-950/20", accentBar: "bg-gradient-to-b from-orange-400 to-orange-600" },
};

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Critical", badgeBg: "bg-red-500/20", accentBar: "bg-gradient-to-b from-red-400 to-red-600" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Warning", badgeBg: "bg-amber-500/20", accentBar: "bg-gradient-to-b from-amber-400 to-amber-600" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Info", badgeBg: "bg-blue-500/20", accentBar: "bg-gradient-to-b from-blue-400 to-blue-600" },
};

// =============================================================================
// COMPONENT
// =============================================================================

interface ActivityPanelProps {
  workflowId?: string;
  isOpen: boolean;
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
  errors: WorkflowError[];
  onClearErrors: () => void;
  onRetryNode?: (nodeId: string) => void;
  initialTab?: "runs" | "errors";
}

export function ActivityPanel({ 
  workflowId, 
  isOpen, 
  onClose,
  onNodeClick,
  errors,
  onClearErrors,
  onRetryNode,
  initialTab = "runs",
}: ActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<"runs" | "errors">(initialTab);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const storeNodes = useFlowStore((s) => s.nodes);
  const storeEdges = useFlowStore((s) => s.edges);
  const highlightPipeline = useFlowStore((s) => s.highlightPipeline);
  const clearHighlight = useFlowStore((s) => s.clearHighlight);
  const highlightedNodeIds = useFlowStore((s) => s.highlightedNodeIds);
  
  // Find connected components (pipelines) from edges
  // Uses Union-Find algorithm to group connected nodes
  const findConnectedPipelines = useCallback((nodeIds: string[]): string[][] => {
    if (nodeIds.length === 0) return [];
    
    // Build adjacency from edges
    const parent = new Map<string, string>();
    const rank = new Map<string, number>();
    
    // Initialize each node as its own parent
    for (const id of nodeIds) {
      parent.set(id, id);
      rank.set(id, 0);
    }
    
    // Find with path compression
    const find = (x: string): string => {
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    };
    
    // Union by rank
    const union = (x: string, y: string) => {
      const px = find(x);
      const py = find(y);
      if (px === py) return;
      
      const rx = rank.get(px) || 0;
      const ry = rank.get(py) || 0;
      
      if (rx < ry) {
        parent.set(px, py);
      } else if (rx > ry) {
        parent.set(py, px);
      } else {
        parent.set(py, px);
        rank.set(px, rx + 1);
      }
    };
    
    // Connect nodes based on edges
    const nodeIdSet = new Set(nodeIds);
    for (const edge of storeEdges) {
      if (nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)) {
        union(edge.source, edge.target);
      }
    }
    
    // Group nodes by their root
    const groups = new Map<string, string[]>();
    for (const id of nodeIds) {
      const root = find(id);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(id);
    }
    
    // Convert to array and sort by size (largest first)
    return Array.from(groups.values()).sort((a, b) => b.length - a.length);
  }, [storeEdges]);

  const fetchExecutions = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (workflowId && workflowId !== "new") params.set("workflowId", workflowId);
      
      const response = await fetch(`/api/trigger-runs?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        const transformed: ExecutionRecord[] = (data.executions || []).map((exec: any) => {
          let durationMs: number | undefined;
          if (exec.startedAt && exec.completedAt) {
            durationMs = new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime();
          }
          
          return {
            id: exec.id,
            workflowName: exec.workflowName || "Workflow Run",
            status: exec.status?.toUpperCase?.() ?? "PENDING",
            createdAt: exec.createdAt || exec.startedAt || new Date().toISOString(),
            startedAt: exec.startedAt,
            completedAt: exec.completedAt,
            totalCost: exec.totalCost || exec.actualCost || 0,
            durationMs,
            nodeExecutions: (exec.nodeExecutions || []).map((ne: any) => ({
              id: ne.id || exec.id,
              nodeId: ne.nodeId || ne.id || exec.id,
              nodeLabel: ne.nodeLabel || ne.nodeType || "Node",
              nodeType: ne.nodeType || "unknown",
              status: ne.status?.toUpperCase?.() ?? "PENDING",
              providerUsed: ne.providerUsed || ne.provider,
              error: ne.error,
              startedAt: ne.startedAt,
              completedAt: ne.completedAt,
              actualCost: ne.actualCost || 0,
              durationMs: ne.startedAt && ne.completedAt ? new Date(ne.completedAt).getTime() - new Date(ne.startedAt).getTime() : undefined,
            })),
          };
        });
        
        setExecutions(transformed.filter(exec => exec.nodeExecutions.length > 0));
      }
    } catch (err) {
      console.error("Failed to fetch executions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, workflowId]);

  useEffect(() => {
    if (isOpen) {
      fetchExecutions();
      const interval = setInterval(fetchExecutions, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchExecutions]);

  const toggleWorkflow = (id: string) => {
    setExpandedWorkflows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleError = (id: string) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleNodeClick = useCallback((nodeType: string, nodeId: string) => {
    const match = storeNodes.find(n => n.id === nodeId) || storeNodes.find(n => n.type === nodeType);
    if (match) onNodeClick?.(match.id);
  }, [storeNodes, onNodeClick]);

  const getNodeDisplayName = (node: NodeExecutionRecord) => {
    const storeNode = storeNodes.find(n => n.id === node.nodeId || n.type === node.nodeType);
    if (storeNode) {
      const data = storeNode.data as { label?: string };
      if (data?.label) return data.label;
    }
    return NODE_DEFINITIONS[node.nodeType as AINodeType]?.label || node.nodeLabel;
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = useMemo(() => {
    const success = executions.filter(e => e.status === "COMPLETED").length;
    const failed = executions.filter(e => e.status === "FAILED").length;
    const running = executions.filter(e => e.status === "RUNNING").length;
    let totalCost = 0;
    executions.forEach(exec => {
      exec.nodeExecutions.forEach(node => { totalCost += node.actualCost || 0; });
    });
    return { success, failed, running, totalCost };
  }, [executions]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{ right: "16px" }}
          className="fixed top-16 z-50 w-[340px] bg-black/60 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/40 flex flex-col max-h-[calc(100vh-120px)]"
        >
          {/* Dot Pattern */}
          <DotPattern className="text-white/[0.03] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />

          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">Activity</span>
                  <p className="text-[10px] text-zinc-500">{executions.length} runs</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={fetchExecutions} disabled={isLoading} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
                  <RotateCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                </button>
                <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Stats */}
            {executions.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-3 bg-white/[0.03] backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Success</p>
                    <p className="text-xl font-bold text-emerald-400 -mt-0.5">{stats.success}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/[0.03] backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/20 flex items-center justify-center">
                    <XCircle className="w-4.5 h-4.5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Failed</p>
                    <p className="text-xl font-bold text-red-400 -mt-0.5">{stats.failed}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/[0.03] backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                    <Loader2 className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Running</p>
                    <p className="text-xl font-bold text-blue-400 -mt-0.5">{stats.running}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/[0.03] backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
                    <Coins className="w-4.5 h-4.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Credits</p>
                    <p className="text-lg font-bold text-amber-400 -mt-0.5">{formatCredits(stats.totalCost)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tab Switcher */}
          <div className="px-3 py-2 border-b border-white/[0.04] bg-white/[0.01] shrink-0">
            <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.04]">
              <button
                onClick={() => setActiveTab("runs")}
                className={cn("flex-1 h-7 px-2 text-[10px] font-medium rounded-md flex items-center justify-center gap-1 transition-all", activeTab === "runs" ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300")}
              >
                <Play className="w-3 h-3" />Runs
              </button>
              <button
                onClick={() => setActiveTab("errors")}
                className={cn("flex-1 h-7 px-2 text-[10px] font-medium rounded-md flex items-center justify-center gap-1 transition-all", activeTab === "errors" ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300")}
              >
                <Bug className="w-3 h-3" />Errors
                {errors.length > 0 && <span className="ml-0.5 px-1 py-0.5 text-[8px] font-bold bg-red-500/20 text-red-400 rounded-full">{errors.length}</span>}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
            {activeTab === "runs" ? (
              isLoading && executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12"><Loader2 className="w-5 h-5 text-zinc-600 animate-spin" /><p className="text-xs text-zinc-500 mt-2">Loading...</p></div>
              ) : executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3"><Inbox className="w-5 h-5 text-zinc-600" /></div>
                  <p className="text-sm text-zinc-400">No runs yet</p><p className="text-xs text-zinc-600 mt-1">Run a workflow to see history</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {executions.map((exec, idx) => {
                    const status = statusStyles[exec.status as keyof typeof statusStyles] || statusStyles.PENDING;
                    const isMulti = exec.nodeExecutions.length > 1;
                    const isExpanded = expandedWorkflows.has(exec.id);
                    const workflowCost = exec.nodeExecutions.reduce((sum, n) => sum + (n.actualCost || 0), 0);
                    const singleNode = !isMulti ? exec.nodeExecutions[0] : null;
                    const pipelineNumber = executions.length - idx; // Reverse numbering (newest = highest)
                    
                    return (
                      <motion.div key={exec.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className={cn("rounded-xl border overflow-hidden relative", status.cardBg, status.border)}>
                        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", status.accentBar)} />
                        
                        {isMulti ? (
                          <>
                            <button onClick={() => toggleWorkflow(exec.id)} className="w-full text-left p-3 pl-4 hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", status.bg)}><div className={status.color}>{status.icon}</div></div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded uppercase border border-violet-500/20">Pipeline #{pipelineNumber}</span>
                                    <span className="text-xs font-medium text-white truncate">{exec.workflowName || "Workflow Run"}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <div className="flex items-center gap-1 text-[9px] text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded"><Calendar className="w-2.5 h-2.5" />{formatExactDate(exec.createdAt)} • {formatExactTime(exec.createdAt)}</div>
                                    {exec.durationMs && <div className="flex items-center gap-1 text-[9px] text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded"><Timer className="w-2.5 h-2.5" />{formatDurationMs(exec.durationMs)}</div>}
                                    {workflowCost > 0 && <div className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded"><Coins className="w-2.5 h-2.5" />{formatCredits(workflowCost)}</div>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    {(() => {
                                      const nodeIds = exec.nodeExecutions.map(n => n.nodeId);
                                      const pipelines = findConnectedPipelines(nodeIds);
                                      return pipelines.length > 1 ? (
                                        <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{pipelines.length} chains</span>
                                      ) : null;
                                    })()}
                                    <span className="text-[9px] text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded">{exec.nodeExecutions.length} nodes</span>
                                    {exec.nodeExecutions.filter(n => n.status === "COMPLETED").length > 0 && <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />{exec.nodeExecutions.filter(n => n.status === "COMPLETED").length}</span>}
                                    {exec.nodeExecutions.filter(n => n.status === "FAILED").length > 0 && <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"><XCircle className="w-2.5 h-2.5" />{exec.nodeExecutions.filter(n => n.status === "FAILED").length}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nodeIds = exec.nodeExecutions.map(n => n.nodeId);
                                      const isCurrentlyHighlighted = nodeIds.some(id => highlightedNodeIds.includes(id));
                                      if (isCurrentlyHighlighted) {
                                        clearHighlight();
                                      } else {
                                        highlightPipeline(nodeIds);
                                        // Don't close - let user see the mapping
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-colors",
                                      exec.nodeExecutions.some(n => highlightedNodeIds.includes(n.nodeId))
                                        ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                                        : "hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300 border border-transparent"
                                    )}
                                    title="Highlight and fit view to all pipeline nodes"
                                  >
                                    <Focus className="w-3.5 h-3.5" />
                                    <span>{exec.nodeExecutions.some(n => highlightedNodeIds.includes(n.nodeId)) ? "Viewing" : "Focus"}</span>
                                  </button>
                                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-zinc-500"><ChevronDown className="w-4 h-4" /></motion.div>
                                </div>
                              </div>
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/[0.04]">
                                  <div className="p-2 space-y-2">
                                    {(() => {
                                      // Group nodes by connected pipelines (chains)
                                      const nodeIds = exec.nodeExecutions.map(n => n.nodeId);
                                      const pipelines = findConnectedPipelines(nodeIds);
                                      const hasManyPipelines = pipelines.length > 1;
                                      
                                      return pipelines.map((pipelineNodeIds, pIdx) => {
                                        const pipelineNodes = exec.nodeExecutions.filter(n => pipelineNodeIds.includes(n.nodeId));
                                        const isPipelineHighlighted = pipelineNodeIds.some(id => highlightedNodeIds.includes(id));
                                        const pipelineCost = pipelineNodes.reduce((sum, n) => sum + (n.actualCost || 0), 0);
                                        
                                        // Color palette for different pipelines
                                        const pipelineColors = [
                                          { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", accent: "bg-violet-500/20" },
                                          { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-400", accent: "bg-cyan-500/20" },
                                          { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", accent: "bg-amber-500/20" },
                                          { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", accent: "bg-emerald-500/20" },
                                          { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", accent: "bg-rose-500/20" },
                                        ];
                                        const pColor = pipelineColors[pIdx % pipelineColors.length];
                                        
                                        return (
                                          <div key={`pipeline-${pIdx}`} className={cn("rounded-lg border", hasManyPipelines ? pColor.border : "border-transparent")}>
                                            {/* Pipeline header (only show if multiple pipelines) */}
                                            {hasManyPipelines && (
                                              <div className={cn("flex items-center justify-between px-2 py-1.5 rounded-t-lg", pColor.bg)}>
                                                <div className="flex items-center gap-2">
                                                  <span className={cn("text-[8px] font-bold uppercase px-1.5 py-0.5 rounded", pColor.accent, pColor.text)}>
                                                    Chain {pIdx + 1}
                                                  </span>
                                                  <span className="text-[9px] text-zinc-500">{pipelineNodes.length} nodes</span>
                                                  {pipelineCost > 0 && (
                                                    <span className="text-[9px] text-amber-400 flex items-center gap-0.5">
                                                      <Coins className="w-2.5 h-2.5" />{formatCredits(pipelineCost)}
                                                    </span>
                                                  )}
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isPipelineHighlighted) {
                                                      clearHighlight();
                                                    } else {
                                                      highlightPipeline(pipelineNodeIds);
                                                    }
                                                  }}
                                                  className={cn(
                                                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-medium transition-colors",
                                                    isPipelineHighlighted
                                                      ? cn(pColor.accent, pColor.text, "border", pColor.border)
                                                      : "hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300"
                                                  )}
                                                >
                                                  <Focus className="w-3 h-3" />
                                                  {isPipelineHighlighted ? "Viewing" : "Focus"}
                                                </button>
                                              </div>
                                            )}
                                            
                                            {/* Nodes in this pipeline */}
                                            <div className={cn("space-y-1.5", hasManyPipelines ? "p-1.5" : "")}>
                                              {pipelineNodes.map((node, i) => {
                                                const ns = statusStyles[node.status as keyof typeof statusStyles] || statusStyles.PENDING;
                                                return (
                                                  <button key={`${node.id}-${i}`} onClick={() => handleNodeClick(node.nodeType, node.nodeId)} className="w-full text-left p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-all">
                                                    <div className="flex items-center gap-2.5">
                                                      <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", getNodeColor(node.nodeType))}>{getNodeIcon(node.nodeType)}</div>
                                                      <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5"><span className="text-[11px] font-medium text-zinc-200 truncate">{getNodeDisplayName(node)}</span>{node.providerUsed && (node.providerUsed === "cache" ? <span className="text-[8px] text-cyan-400 bg-cyan-500/15 px-1 py-0.5 rounded flex items-center gap-0.5"><Database className="w-2 h-2" />CACHED</span> : <span className="text-[8px] text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">{node.providerUsed}</span>)}</div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                          {node.providerUsed === "cache" ? (
                                                            <span className="text-[9px] text-cyan-400 flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" />0ms</span>
                                                          ) : node.durationMs && <span className="text-[9px] text-zinc-500 flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" />{formatDurationMs(node.durationMs)}</span>}
                                                          {node.providerUsed === "cache" ? (
                                                            <span className="text-[9px] text-cyan-400 flex items-center gap-0.5"><Coins className="w-2.5 h-2.5" />0</span>
                                                          ) : (node.actualCost ?? 0) > 0 && <span className="text-[9px] text-amber-400 flex items-center gap-0.5"><Coins className="w-2.5 h-2.5" />{formatCredits(node.actualCost!)}</span>}
                                                        </div>
                                                      </div>
                                                      <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-md", ns.bg)}><div className={cn("scale-75", ns.color)}>{ns.icon}</div><span className={cn("text-[9px] font-medium", ns.color)}>{ns.label}</span></div>
                                                    </div>
                                                    {node.error && <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20"><p className="text-[9px] text-red-400 line-clamp-2">{node.error}</p></div>}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        ) : (
                          <button onClick={() => singleNode && handleNodeClick(singleNode.nodeType, singleNode.nodeId)} className="w-full text-left p-3 pl-4 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", status.bg)}><div className={status.color}>{status.icon}</div></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded uppercase">Single</span>
                                  <div className={cn("w-5 h-5 rounded-lg flex items-center justify-center", getNodeColor(singleNode?.nodeType || ""))}>{singleNode && getNodeIcon(singleNode.nodeType)}</div>
                                  <span className="text-xs font-medium text-white truncate">{singleNode && getNodeDisplayName(singleNode)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <div className="flex items-center gap-1 text-[9px] text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded"><Calendar className="w-2.5 h-2.5" />{formatExactDate(exec.createdAt)} • {formatExactTime(exec.createdAt)}</div>
                                  {singleNode?.providerUsed === "cache" ? (
                                    <div className="flex items-center gap-1 text-[9px] text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded"><Timer className="w-2.5 h-2.5" />0ms</div>
                                  ) : singleNode?.durationMs && <div className="flex items-center gap-1 text-[9px] text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded"><Timer className="w-2.5 h-2.5" />{formatDurationMs(singleNode.durationMs)}</div>}
                                  {singleNode?.providerUsed === "cache" ? (
                                    <div className="flex items-center gap-1 text-[9px] text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded"><Coins className="w-2.5 h-2.5" />0</div>
                                  ) : (singleNode?.actualCost ?? 0) > 0 && <div className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded"><Coins className="w-2.5 h-2.5" />{formatCredits(singleNode!.actualCost)}</div>}
                                </div>
                                {singleNode?.providerUsed && <div className="mt-1">{singleNode.providerUsed === "cache" ? <span className="text-[9px] text-cyan-400 font-medium bg-cyan-500/15 px-1.5 py-0.5 rounded flex items-center gap-1 inline-flex"><Database className="w-2.5 h-2.5" />CACHED</span> : <span className="text-[9px] text-blue-400 font-medium bg-blue-500/10 px-1.5 py-0.5 rounded">{singleNode.providerUsed}</span>}</div>}
                              </div>
                              <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold uppercase border", status.bg, status.border)}><div className={status.color}>{status.icon}</div><span className={status.color}>{status.label}</span></div>
                            </div>
                            {singleNode?.error && <div className="mt-2.5 p-2 rounded-lg bg-red-500/10 border border-red-500/20"><p className="text-[9px] text-red-400 line-clamp-2">{singleNode.error}</p></div>}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )
            ) : (
              errors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3"><CheckCircle2 className="w-5 h-5 text-emerald-400" /></div>
                  <p className="text-sm text-zinc-400">All clear!</p><p className="text-xs text-zinc-600 mt-1">No errors in this session</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-end px-1"><button onClick={onClearErrors} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" />Clear all</button></div>
                  {errors.map((error, idx) => {
                    const severity = severityConfig[error.severity];
                    const SeverityIcon = severity.icon;
                    const isExpanded = expandedErrors.has(error.id);
                    return (
                      <motion.div key={error.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className={cn("rounded-xl border overflow-hidden relative", severity.bg, severity.border)}>
                        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", severity.accentBar)} />
                        <button onClick={() => toggleError(error.id)} className="w-full text-left p-3 pl-4 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", severity.bg)}><SeverityIcon className={cn("w-4 h-4", severity.color)} /></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2"><span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", severity.badgeBg, severity.color)}>{severity.label}</span><span className="text-xs font-medium text-white truncate">{error.nodeName}</span></div>
                              <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">{error.message}</p>
                              <div className="flex items-center gap-1.5 mt-1.5"><span className="text-[9px] text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded">{error.nodeType}</span>{error.provider && <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{error.provider}</span>}</div>
                            </div>
                            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-zinc-500 mt-1"><ChevronDown className="w-4 h-4" /></motion.div>
                          </div>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/[0.04]">
                              <div className="p-3 space-y-2">
                                {error.details && <div className="p-2 bg-white/[0.02] rounded-lg text-[10px] text-zinc-400 font-mono break-words border border-white/[0.04]">{error.details}</div>}
                                {error.suggestion && <div className="flex items-start gap-2 p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg"><Lightbulb className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" /><p className="text-[10px] text-blue-300">{error.suggestion}</p></div>}
                                <div className="flex items-center gap-1.5 pt-1">
                                  <button onClick={() => onNodeClick?.(error.nodeId)} className="h-6 px-2 text-[9px] font-medium text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded flex items-center gap-1 transition-colors"><Target className="w-2.5 h-2.5" />Focus</button>
                                  {error.canRetry && onRetryNode && <button onClick={() => onRetryNode(error.nodeId)} className="h-6 px-2 text-[9px] font-medium text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded flex items-center gap-1 transition-colors"><RefreshCw className="w-2.5 h-2.5" />Retry</button>}
                                  <button onClick={() => handleCopyId(error.id)} className="h-6 px-2 text-[9px] font-medium text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded flex items-center gap-1 transition-colors">{copiedId === error.id ? <><Check className="w-2.5 h-2.5 text-emerald-400" />Copied</> : <><Copy className="w-2.5 h-2.5" />ID</>}</button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-white/[0.06] bg-white/[0.02] shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-zinc-500 flex items-center gap-1.5"><Focus className="w-3 h-3" />Focus to highlight & fit view</p>
              <p className="text-[10px] text-zinc-600">Auto-refresh: 5s</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type { WorkflowError as ActivityPanelError };
