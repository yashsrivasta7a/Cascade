"use client";

import { useState, useEffect, useCallback } from "react";
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
  Wrench,
  Timer,
  Coins,
  AlertCircle,
  Pause,
  ChevronDown,
  Calendar,
  TrendingUp,
  Activity,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

// =============================================================================
// HELPERS
// =============================================================================

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

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
  
  if (isToday) {
    return "Today";
  }
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric" 
  });
}

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diff = end - start;
  
  if (diff < 1000) return `${diff}ms`;
  if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
  return `${(diff / 60000).toFixed(1)}m`;
}

function formatDurationMs(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatCredits(credits?: number): string {
  if (!credits || credits === 0) return "-";
  if (credits >= 1_000_000) {
    return `${(credits / 1_000_000).toFixed(2)}M`;
  }
  if (credits >= 1_000) {
    return `${(credits / 1_000).toFixed(1)}K`;
  }
  return credits.toString();
}

function formatCost(credits?: number): string {
  if (!credits || credits === 0) return "$0.00";
  // 1 credit = $0.000001 (1M credits = $1)
  const dollars = credits / 1_000_000;
  if (dollars < 0.01) {
    return `$${dollars.toFixed(4)}`;
  }
  return `$${dollars.toFixed(2)}`;
}

// Get node category icon
function getNodeIcon(nodeType: string): React.ReactNode {
  const def = NODE_DEFINITIONS[nodeType as AINodeType];
  const category = def?.category;
  
  switch (category) {
    case "image":
      return <Image className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />;
    case "video":
      return <Film className="w-3 h-3 text-violet-600 dark:text-violet-400" />;
    case "audio":
      return <Volume2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />;
    case "llm":
      return <Brain className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
    case "utility":
      return <Wrench className="w-3 h-3 text-slate-600 dark:text-zinc-400" />;
    default:
      return <Zap className="w-3 h-3 text-slate-600 dark:text-zinc-400" />;
  }
}

// Get category color
function getNodeColor(nodeType: string): string {
  const def = NODE_DEFINITIONS[nodeType as AINodeType];
  const color = def?.color;
  
  switch (color) {
    case "emerald":
      return "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-transparent";
    case "violet":
      return "text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/15 border border-violet-200 dark:border-transparent";
    case "amber":
      return "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-transparent";
    case "blue":
      return "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-transparent";
    default:
      return "text-gray-600 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-500/15 border border-gray-200 dark:border-transparent";
  }
}

// Status config with icons, labels, and enhanced visual effects
const statusStyles = {
  PENDING: { 
    icon: <Clock className="w-3.5 h-3.5" />, 
    color: "text-gray-600 dark:text-zinc-400", 
    bg: "bg-gray-100 dark:bg-zinc-500/20",
    border: "border-gray-200 dark:border-zinc-500/40",
    label: "Pending",
    glow: "",
    dotColor: "bg-gray-400 dark:bg-zinc-400",
    cardBg: "bg-white dark:bg-zinc-900/60",
    accentBar: "bg-gray-400 dark:bg-zinc-500",
  },
  QUEUED: { 
    icon: <Clock className="w-3.5 h-3.5" />, 
    color: "text-gray-600 dark:text-zinc-400", 
    bg: "bg-gray-100 dark:bg-zinc-500/20",
    border: "border-gray-200 dark:border-zinc-500/40",
    label: "Queued",
    glow: "",
    dotColor: "bg-gray-400 dark:bg-zinc-400",
    cardBg: "bg-white dark:bg-zinc-900/60",
    accentBar: "bg-gray-400 dark:bg-zinc-500",
  },
  RUNNING: { 
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, 
    color: "text-cyan-700 dark:text-cyan-400", 
    bg: "bg-cyan-100 dark:bg-cyan-500/25",
    border: "border-cyan-200 dark:border-cyan-500/50",
    label: "Running",
    glow: "dark:shadow-[0_0_15px_rgba(34,211,238,0.4)]",
    dotColor: "bg-cyan-500 dark:bg-cyan-400 animate-pulse",
    cardBg: "bg-gradient-to-r from-cyan-50 to-sky-50 dark:bg-cyan-950/30",
    accentBar: "bg-cyan-500 dark:bg-gradient-to-b dark:from-cyan-400 dark:to-cyan-600",
  },
  WAITING: { 
    icon: <Pause className="w-3.5 h-3.5" />, 
    color: "text-amber-700 dark:text-amber-400", 
    bg: "bg-amber-100 dark:bg-amber-500/25",
    border: "border-amber-200 dark:border-amber-500/50",
    label: "Waiting",
    glow: "dark:shadow-[0_0_15px_rgba(251,191,36,0.3)]",
    dotColor: "bg-amber-500 dark:bg-amber-400 animate-pulse",
    cardBg: "bg-gradient-to-r from-amber-50 to-yellow-50 dark:bg-amber-950/20",
    accentBar: "bg-amber-500 dark:bg-gradient-to-b dark:from-amber-400 dark:to-amber-600",
  },
  COMPLETED: { 
    icon: <CheckCircle2 className="w-3.5 h-3.5" />, 
    color: "text-emerald-700 dark:text-emerald-400", 
    bg: "bg-emerald-100 dark:bg-emerald-500/25",
    border: "border-emerald-200 dark:border-emerald-500/50",
    label: "Success",
    glow: "dark:shadow-[0_0_12px_rgba(52,211,153,0.3)]",
    dotColor: "bg-emerald-500 dark:bg-emerald-400",
    cardBg: "bg-gradient-to-r from-emerald-50 to-teal-50 dark:bg-emerald-950/20",
    accentBar: "bg-emerald-500 dark:bg-gradient-to-b dark:from-emerald-400 dark:to-emerald-600",
  },
  FAILED: { 
    icon: <XCircle className="w-3.5 h-3.5" />, 
    color: "text-red-700 dark:text-red-400", 
    bg: "bg-red-100 dark:bg-red-500/30",
    border: "border-red-200 dark:border-red-500/60",
    label: "Failed",
    glow: "dark:shadow-[0_0_15px_rgba(248,113,113,0.4)]",
    dotColor: "bg-red-500 dark:bg-red-400",
    cardBg: "bg-gradient-to-r from-red-50 to-rose-50 dark:bg-red-950/25",
    accentBar: "bg-red-500 dark:bg-gradient-to-b dark:from-red-400 dark:to-red-600",
  },
  CANCELLED: { 
    icon: <XCircle className="w-3.5 h-3.5" />, 
    color: "text-orange-700 dark:text-orange-400", 
    bg: "bg-orange-100 dark:bg-orange-500/20",
    border: "border-orange-200 dark:border-orange-500/40",
    label: "Cancelled",
    glow: "",
    dotColor: "bg-orange-500 dark:bg-orange-400",
    cardBg: "bg-gradient-to-r from-orange-50 to-amber-50 dark:bg-orange-950/15",
    accentBar: "bg-orange-500 dark:bg-gradient-to-b dark:from-orange-400 dark:to-orange-600",
  },
  TERMINATED: { 
    icon: <AlertCircle className="w-3.5 h-3.5" />, 
    color: "text-gray-600 dark:text-zinc-500", 
    bg: "bg-gray-100 dark:bg-zinc-500/20",
    border: "border-gray-200 dark:border-zinc-500/40",
    label: "Terminated",
    glow: "",
    dotColor: "bg-gray-500 dark:bg-zinc-500",
    cardBg: "bg-white dark:bg-zinc-900/60",
    accentBar: "bg-gray-500 dark:bg-zinc-500",
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

interface ExecutionHistoryPanelProps {
  workflowId?: string;
  isOpen: boolean;
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
  /** Offset position when another panel is open */
  offsetRight?: number;
}

export function ExecutionHistoryPanel({ 
  workflowId, 
  isOpen, 
  onClose,
  onNodeClick,
  offsetRight = 0,
}: ExecutionHistoryPanelProps) {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get nodes from the store to match by actual node IDs
  const storeNodes = useFlowStore((s) => s.nodes);

  const fetchExecutions = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    
    try {
      // Build query params - include workflowId if available
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (workflowId && workflowId !== "new") {
        params.set("workflowId", workflowId);
      }
      
      // Fetch from API with workflow filtering
      const triggerResponse = await fetch(`/api/trigger-runs?${params.toString()}`);
      
      if (triggerResponse.ok) {
        const triggerData = await triggerResponse.json();
        
        const transformed: ExecutionRecord[] = (triggerData.executions || []).map((exec: any) => {
          // Calculate duration
          let durationMs: number | undefined;
          if (exec.startedAt && exec.completedAt) {
            durationMs = new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime();
          } else if (exec.createdAt && exec.completedAt) {
            durationMs = new Date(exec.completedAt).getTime() - new Date(exec.createdAt).getTime();
          }
          
          return {
            id: exec.id,
            workflowName: exec.workflowName || "Workflow Run",
            status: exec.status?.toUpperCase?.() ?? "PENDING",
            createdAt: exec.createdAt || exec.startedAt || new Date().toISOString(),
            startedAt: exec.startedAt,
            completedAt: exec.completedAt,
            totalCost: exec.totalCost || exec.actualCost || 0,
            estimatedCost: exec.estimatedCost || 0,
            durationMs,
            nodeExecutions: (exec.nodeExecutions || []).map((ne: any) => {
              let nodeDuration: number | undefined;
              if (ne.startedAt && ne.completedAt) {
                nodeDuration = new Date(ne.completedAt).getTime() - new Date(ne.startedAt).getTime();
              }
              
              return {
                id: ne.id || exec.id,
                nodeId: ne.nodeId || ne.id || exec.id,
                nodeLabel: ne.nodeLabel || ne.nodeType || "Node",
                nodeType: ne.nodeType || "unknown",
                status: ne.status?.toUpperCase?.() ?? exec.status?.toUpperCase?.() ?? "PENDING",
                providerUsed: ne.providerUsed || ne.provider,
                error: ne.error || exec.error,
                startedAt: ne.startedAt,
                completedAt: ne.completedAt,
                actualCost: ne.actualCost || 0,
                durationMs: nodeDuration || ne.durationMs,
              };
            }),
          };
        });
        
        // If no node executions from database, skip this run (it's likely an internal task)
        // Only show runs that have actual node execution records
        const withNodes = transformed.filter(exec => exec.nodeExecutions.length > 0);
        
        setExecutions(withNodes);
        return;
      }
      
      // Fallback to database
      const fallbackParams = new URLSearchParams();
      if (workflowId && workflowId !== "new") fallbackParams.set("workflowId", workflowId);
      fallbackParams.set("limit", "15");
      
      const response = await fetch(`/api/executions?${fallbackParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch");
      
      const data = await response.json();
      const transformed: ExecutionRecord[] = (data.executions || []).map((exec: any) => {
        let durationMs: number | undefined;
        if (exec.startedAt && exec.completedAt) {
          durationMs = new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime();
        }
        
        return {
          id: exec.id,
          workflowName: exec.workflowName,
          status: exec.status?.toUpperCase?.() ?? "PENDING",
          createdAt: exec.createdAt,
          startedAt: exec.startedAt,
          completedAt: exec.completedAt,
          totalCost: exec.totalCost || exec.actualCost || 0,
          estimatedCost: exec.estimatedCost || 0,
          durationMs,
          nodeExecutions: (exec.nodes || exec.nodeExecutions || []).map((ne: any) => {
            let nodeDuration: number | undefined;
            if (ne.startedAt && ne.completedAt) {
              nodeDuration = new Date(ne.completedAt).getTime() - new Date(ne.startedAt).getTime();
            }
            
            return {
              id: ne.id,
              nodeId: ne.nodeId || ne.id,
              nodeLabel: ne.label || ne.nodeLabel || ne.nodeType || "Node",
              nodeType: ne.nodeType || "openrouter",
              status: ne.status?.toUpperCase?.() ?? "PENDING",
              providerUsed: ne.provider || ne.providerUsed,
              error: ne.error,
              startedAt: ne.startedAt,
              completedAt: ne.completedAt,
              actualCost: ne.actualCost || 0,
              durationMs: nodeDuration || ne.durationMs,
            };
          }),
        };
      });
      
      setExecutions(transformed);
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

  // Find the actual node in the store by matching node type and position
  const handleNodeClick = useCallback((nodeType: string, nodeId: string) => {
    // First try exact ID match
    const exactMatch = storeNodes.find(n => n.id === nodeId);
    if (exactMatch) {
      onNodeClick?.(exactMatch.id);
      return;
    }
    
    // Try matching by node type
    const nodesOfType = storeNodes.filter(n => n.type === nodeType);
    if (nodesOfType.length === 1) {
      onNodeClick?.(nodesOfType[0].id);
      return;
    }
    
    // If multiple nodes of same type, just focus on first one
    if (nodesOfType.length > 0) {
      onNodeClick?.(nodesOfType[0].id);
      return;
    }
    
    // Fallback: try to find by type prefix in ID
    const prefixMatch = storeNodes.find(n => n.id.startsWith(nodeType));
    if (prefixMatch) {
      onNodeClick?.(prefixMatch.id);
    }
  }, [storeNodes, onNodeClick]);

  // Track which workflow sections are expanded
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  
  const toggleWorkflow = (id: string) => {
    setExpandedWorkflows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  // Determine if an execution is a workflow run (multiple nodes) or individual node run
  const isWorkflowRun = (exec: ExecutionRecord) => exec.nodeExecutions.length > 1;

  // Get the node's actual label from the store if available
  const getNodeDisplayName = (node: NodeExecutionRecord) => {
    // Try to find the actual node in the store
    const storeNode = storeNodes.find(n => n.id === node.nodeId);
    if (storeNode) {
      const nodeData = storeNode.data as { label?: string };
      if (nodeData?.label) return nodeData.label;
    }
    
    // Try to find by type
    const nodesByType = storeNodes.filter(n => n.type === node.nodeType);
    if (nodesByType.length > 0) {
      const nodeData = nodesByType[0].data as { label?: string };
      if (nodeData?.label) return nodeData.label;
    }
    
    // Fallback to node definition label or the provided label
    const def = NODE_DEFINITIONS[node.nodeType as AINodeType];
    return def?.label || node.nodeLabel || node.nodeType;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 16, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 16, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          style={{ right: `${16 + offsetRight}px` }}
          className="fixed top-16 z-50 w-[340px] bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl shadow-gray-200/80 dark:shadow-black/50"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50 dark:bg-gradient-to-r dark:from-zinc-900 dark:to-zinc-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:via-violet-500/15 dark:to-emerald-500/20 flex items-center justify-center ring-1 ring-cyan-600 dark:ring-white/5">
                  <Activity className="w-4 h-4 text-white dark:text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Activity</h3>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                    {executions.length > 0 ? `${executions.length} recent runs` : "No runs yet"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={fetchExecutions}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition-all"
                  title="Refresh"
                >
                  <RotateCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Stats Summary */}
            {executions.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {/* Success */}
                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-2 py-1.5 border border-emerald-200 dark:border-emerald-500/20">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[9px] text-emerald-700 dark:text-emerald-400/70 font-semibold">Success</span>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {executions.filter(e => e.status === "COMPLETED").length}
                  </p>
                </div>
                
                {/* Failed */}
                <div className="bg-red-50 dark:bg-red-500/10 rounded-lg px-2 py-1.5 border border-red-200 dark:border-red-500/20">
                  <div className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                    <span className="text-[9px] text-red-700 dark:text-red-400/70 font-semibold">Failed</span>
                  </div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400 mt-0.5">
                    {executions.filter(e => e.status === "FAILED").length}
                  </p>
                </div>
                
                {/* Running */}
                <div className="bg-cyan-50 dark:bg-cyan-500/10 rounded-lg px-2 py-1.5 border border-cyan-200 dark:border-cyan-500/20">
                  <div className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-[9px] text-cyan-700 dark:text-cyan-400/70 font-semibold">Running</span>
                  </div>
                  <p className="text-sm font-bold text-cyan-700 dark:text-cyan-400 mt-0.5">
                    {executions.filter(e => e.status === "RUNNING").length}
                  </p>
                </div>
                
                {/* Total Cost */}
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2 py-1.5 border border-amber-200 dark:border-amber-500/20">
                  <div className="flex items-center gap-1">
                    <Coins className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span className="text-[9px] text-amber-700 dark:text-amber-400/70 font-semibold">Cost</span>
                  </div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                    {formatCost(executions.reduce((sum, e) => sum + (e.totalCost || 0), 0))}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Content - All executions in chronological order */}
          <div className="max-h-[55vh] overflow-y-auto p-2">
            {isLoading && executions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-gray-400 dark:text-zinc-600 animate-spin" />
                <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2">Loading...</p>
              </div>
            ) : executions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center mb-3">
                  <Inbox className="w-5 h-5 text-gray-400 dark:text-zinc-600" />
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-400">No runs yet</p>
                <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Run a workflow to see history</p>
              </div>
            ) : (
              <div className="space-y-2">
                {executions.map((exec, execIndex) => {
                  const status = statusStyles[exec.status as keyof typeof statusStyles] || statusStyles.PENDING;
                  const isMultiNode = isWorkflowRun(exec);
                  const isExpanded = expandedWorkflows.has(exec.id);
                  const nodeCount = exec.nodeExecutions.length;
                  const completedNodes = exec.nodeExecutions.filter(n => n.status === "COMPLETED").length;
                  const failedNodes = exec.nodeExecutions.filter(n => n.status === "FAILED").length;
                  
                  // For single node runs, get the node info
                  const singleNode = !isMultiNode ? exec.nodeExecutions[0] : null;
                  const singleNodeColor = singleNode ? getNodeColor(singleNode.nodeType) : "";
                  const singleNodeName = singleNode ? getNodeDisplayName(singleNode) : "";
                  const singleNodeDef = singleNode ? NODE_DEFINITIONS[singleNode.nodeType as AINodeType] : null;
                  const singleNodeProvider = singleNode?.providerUsed || singleNodeDef?.provider || "—";
                  
                  return (
                    <motion.div
                      key={exec.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: execIndex * 0.03 }}
                      className={cn(
                        "rounded-xl border transition-all overflow-hidden relative",
                        status.cardBg,
                        status.border
                      )}
                    >
                      {/* Status accent bar on left */}
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
                        status.accentBar
                      )} />
                      {isMultiNode ? (
                        /* Workflow Run - Multiple connected nodes, expandable */
                        <>
                          <button
                            onClick={() => toggleWorkflow(exec.id)}
                            className="w-full text-left p-3 pl-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {/* Status Icon */}
                              <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-shadow",
                                status.bg,
                                status.glow
                              )}>
                                <div className={status.color}>{status.icon}</div>
                              </div>

                              {/* Workflow Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/15 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Pipeline
                                  </span>
                                  <span className="text-sm font-semibold text-gray-800 dark:text-zinc-100 truncate">
                                    Workflow Run
                                  </span>
                                </div>
                                
                                {/* Time and Stats Row */}
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  {/* Exact Time */}
                                  <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded">
                                    <Calendar className="w-2.5 h-2.5" />
                                    <span>{formatExactDate(exec.createdAt)}</span>
                                    <span className="text-gray-400 dark:text-zinc-600">•</span>
                                    <span>{formatExactTime(exec.createdAt)}</span>
                                  </div>
                                  
                                  {/* Duration */}
                                  {exec.durationMs && (
                                    <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded">
                                      <Timer className="w-2.5 h-2.5" />
                                      <span>{formatDurationMs(exec.durationMs)}</span>
                                    </div>
                                  )}
                                  
                                  {/* Cost */}
                                  {(exec.totalCost ?? 0) > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                                      <Coins className="w-2.5 h-2.5" />
                                      <span>{formatCost(exec.totalCost)}</span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Node Stats */}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-gray-600 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-semibold">
                                    {nodeCount} node{nodeCount !== 1 ? "s" : ""}
                                  </span>
                                  {completedNodes > 0 && (
                                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-semibold">
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      {completedNodes}
                                    </span>
                                  )}
                                  {failedNodes > 0 && (
                                    <span className="text-[10px] text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-semibold">
                                      <XCircle className="w-2.5 h-2.5" />
                                      {failedNodes}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Expand/Collapse Icon */}
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                className="text-gray-400 dark:text-zinc-500"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </motion.div>
                            </div>
                          </button>

                          {/* Node Executions - Expandable */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-gray-200 dark:border-zinc-800/50"
                              >
                                <div className="p-2 space-y-1.5 bg-gray-50/50 dark:bg-transparent">
                                  {exec.nodeExecutions.map((node, nodeIndex) => {
                                    const nodeStatus = statusStyles[node.status as keyof typeof statusStyles] || statusStyles.PENDING;
                                    const nodeColor = getNodeColor(node.nodeType);
                                    const displayName = getNodeDisplayName(node);
                                    const nodeDef = NODE_DEFINITIONS[node.nodeType as AINodeType];
                                    
                                    return (
                                      <button
                                        key={`${node.id}-${nodeIndex}`}
                                        onClick={() => handleNodeClick(node.nodeType, node.nodeId)}
                                        className={cn(
                                          "w-full text-left p-2.5 rounded-lg transition-all group",
                                          "bg-white dark:bg-zinc-800/40 hover:bg-gray-50 dark:hover:bg-zinc-800/70",
                                          "border border-gray-200 dark:border-zinc-700/30 hover:border-gray-300 dark:hover:border-zinc-600/50"
                                        )}
                                      >
                                        <div className="flex items-center gap-2.5">
                                          {/* Node Icon */}
                                          <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0", nodeColor)}>
                                            {getNodeIcon(node.nodeType)}
                                          </div>
                                          
                                          {/* Node Info */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate">
                                                {displayName}
                                              </span>
                                              {node.providerUsed && (
                                                <span className="text-[8px] text-violet-700 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/10 px-1 py-0.5 rounded font-semibold">
                                                  {node.providerUsed}
                                                </span>
                                              )}
                                            </div>
                                            
                                            {/* Node Stats */}
                                            <div className="flex items-center gap-1.5 mt-1">
                                              {/* Duration */}
                                              {(node.durationMs || node.startedAt) && (
                                                <span className="text-[9px] text-gray-500 dark:text-zinc-500 flex items-center gap-0.5">
                                                  <Timer className="w-2.5 h-2.5" />
                                                  {node.durationMs 
                                                    ? formatDurationMs(node.durationMs)
                                                    : formatDuration(node.startedAt, node.completedAt)
                                                  }
                                                </span>
                                              )}
                                              
                                              {/* Cost - show actual or estimated from definition */}
                                              {(() => {
                                                const actualCost = node.actualCost ?? 0;
                                                const estimatedCost = nodeDef?.estimatedCost ?? 0;
                                                const displayCost = actualCost > 0 ? actualCost : estimatedCost;
                                                const isEstimate = actualCost <= 0 && estimatedCost > 0;
                                                
                                                if (displayCost > 0) {
                                                  return (
                                                    <span className={cn(
                                                      "text-[9px] flex items-center gap-0.5 font-medium",
                                                      isEstimate ? "text-gray-500 dark:text-zinc-500" : "text-amber-700 dark:text-amber-400"
                                                    )}>
                                                      <Coins className="w-2.5 h-2.5" />
                                                      {isEstimate ? "~" : ""}{formatCredits(displayCost)}
                                                    </span>
                                                  );
                                                }
                                                return null;
                                              })()}
                                              
                                              {/* Exact Time */}
                                              {node.startedAt && (
                                                <span className="text-[9px] text-gray-400 dark:text-zinc-600">
                                                  {formatExactTime(node.startedAt)}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {/* Status Badge */}
                                          <div className={cn(
                                            "flex items-center gap-1 px-1.5 py-0.5 rounded-md shrink-0",
                                            nodeStatus.bg
                                          )}>
                                            <div className={cn("scale-75", nodeStatus.color)}>{nodeStatus.icon}</div>
                                            <span className={cn("text-[9px] font-semibold", nodeStatus.color)}>
                                              {nodeStatus.label}
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {/* Error */}
                                        {node.error && (
                                          <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                                            <p className="text-[9px] text-red-700 dark:text-red-400 line-clamp-2">{node.error}</p>
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      ) : (
                        /* Individual Node Run - Single node (Play button) */
                        <button
                          onClick={() => singleNode && handleNodeClick(singleNode.nodeType, singleNode.nodeId)}
                          className="w-full text-left p-3 pl-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {/* Status Icon */}
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-shadow",
                              status.bg,
                              status.glow
                            )}>
                              <div className={status.color}>{status.icon}</div>
                            </div>

                            {/* Node Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-gray-600 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Single
                                </span>
                                <div className={cn("w-5 h-5 rounded-lg flex items-center justify-center", singleNodeColor)}>
                                  {singleNode && getNodeIcon(singleNode.nodeType)}
                                </div>
                                <span className="text-sm font-semibold text-gray-800 dark:text-zinc-100 truncate">
                                  {singleNodeName}
                                </span>
                              </div>
                              
                              {/* Time and Stats Row */}
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {/* Exact Time */}
                                <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded">
                                  <Calendar className="w-2.5 h-2.5" />
                                  <span>{formatExactDate(exec.createdAt)}</span>
                                  <span className="text-gray-400 dark:text-zinc-600">•</span>
                                  <span>{formatExactTime(exec.createdAt)}</span>
                                </div>
                                
                                {/* Duration */}
                                {(singleNode?.durationMs || singleNode?.startedAt) && (
                                  <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded">
                                    <Timer className="w-2.5 h-2.5" />
                                    <span>
                                      {singleNode?.durationMs 
                                        ? formatDurationMs(singleNode.durationMs)
                                        : formatDuration(singleNode?.startedAt, singleNode?.completedAt)
                                      }
                                    </span>
                                  </div>
                                )}
                                
                                {/* Cost - show actual or estimated from definition */}
                                {(() => {
                                  const singleNodeDef = singleNode ? NODE_DEFINITIONS[singleNode.nodeType as AINodeType] : undefined;
                                  const actualCost = singleNode?.actualCost ?? 0;
                                  const estimatedCost = singleNodeDef?.estimatedCost ?? 0;
                                  const displayCost = actualCost > 0 ? actualCost : estimatedCost;
                                  const isEstimate = actualCost <= 0 && estimatedCost > 0;
                                  
                                  if (displayCost > 0) {
                                    return (
                                      <div className={cn(
                                        "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium",
                                        isEstimate 
                                          ? "text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800/60" 
                                          : "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10"
                                      )}>
                                        <Coins className="w-2.5 h-2.5" />
                                        <span>{isEstimate ? "~" : ""}{formatCost(displayCost)}</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              
                              {/* Provider */}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-violet-700 dark:text-violet-400 font-semibold bg-violet-100 dark:bg-violet-500/10 px-1.5 py-0.5 rounded">
                                  {singleNodeProvider}
                                </span>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase shrink-0 border",
                              status.bg,
                              status.border,
                              status.glow
                            )}>
                              <div className={status.color}>{status.icon}</div>
                              <span className={status.color}>{status.label}</span>
                            </div>
                          </div>

                          {/* Error */}
                          {singleNode?.error && (
                            <div className="mt-2.5 p-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                              <p className="text-[10px] text-red-700 dark:text-red-400 line-clamp-2">{singleNode.error}</p>
                            </div>
                          )}
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-gray-100 dark:border-zinc-800/80 bg-gray-50 dark:bg-gradient-to-r dark:from-zinc-900/80 dark:to-zinc-950/80">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-500 dark:text-zinc-500 flex items-center gap-1.5 font-medium">
                <Target className="w-3 h-3" />
                Click to focus node
              </p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-600">
                Auto-refresh: 5s
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ExecutionHistoryPanel;
