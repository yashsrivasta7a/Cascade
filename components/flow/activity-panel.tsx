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

// -----------------------------------------------------------------------------
// Error explanations (user-facing)
// -----------------------------------------------------------------------------
const errorSuggestions: Record<string, string> = {
  "Not Found": "The endpoint/model may not exist. Verify the model name and that the provider is available.",
  "Unauthorized": "Missing/invalid API key. Check your env vars (e.g. OPENROUTER_API_KEY, FAL_KEY).",
  "Rate limit": "You hit a rate limit. Wait a bit and retry.",
  "timeout": "The request took too long. Try smaller inputs or increase timeouts.",
  "ECONNREFUSED": "Could not reach the server. Check provider status/network.",
  "Invalid": "Your input is malformed. Ensure required fields exist and types match.",
  "quota": "You ran out of quota/credits at the provider. Check billing/limits.",
  "expected object, received undefined": "A required input is missing. Usually the parent node didn't run or produced no output.",
  "received undefined": "A required input is missing. Run upstream nodes first or connect the correct handle.",
  "Unexpected token": "The server returned non-JSON (often an HTML error page). This can happen on 413 Request Entity Too Large.",
  "Request Entity Too Large": "Your input is too big for the API route. Upload media to CDN/Transloadit or use smaller files.",
  "can't view images": "The selected LLM/model may not support vision, or the image URL isn't accessible.",
};

function getSuggestion(error: WorkflowError): string | undefined {
  if (error.suggestion) return error.suggestion;
  const msg = (error.message || "").toLowerCase();
  for (const [pattern, suggestion] of Object.entries(errorSuggestions)) {
    if (msg.includes(pattern.toLowerCase())) return suggestion;
  }
  return undefined;
}

function formatTimeAgo(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function sanitizeForDisplay(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("data:")) return "[base64 data url]";
    if (value.startsWith("blob:")) return "[blob url]";
    if (value.length > 2000) return `${value.slice(0, 2000)}…(truncated)`;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 50).map(sanitizeForDisplay);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 80);
    for (const [k, v] of entries) out[k] = sanitizeForDisplay(v);
    return out;
  }
  return value;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(sanitizeForDisplay(value), null, 2);
  } catch {
    return String(value);
  }
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
    default: return <Zap className="w-3 h-3 text-gray-500 dark:text-zinc-400" />;
  }
}

function getNodeColor(nodeType: string): string {
  switch (nodeType) {
    case "openrouter": return "bg-blue-100 dark:bg-blue-500/15";
    case "seedream": return "bg-emerald-100 dark:bg-emerald-500/15";
    case "seedance": return "bg-violet-100 dark:bg-violet-500/15";
    case "seedvr": return "bg-violet-100 dark:bg-violet-500/15";
    case "lipsync": return "bg-amber-100 dark:bg-amber-500/15";
    case "elevenlabs": return "bg-amber-100 dark:bg-amber-500/15";
    case "crop-image": return "bg-emerald-100 dark:bg-emerald-500/15";
    case "merge-videos": return "bg-violet-100 dark:bg-violet-500/15";
    case "merge-audio-video": return "bg-violet-100 dark:bg-violet-500/15";
    case "extract-audio": return "bg-amber-100 dark:bg-amber-500/15";
    default: return "bg-gray-100 dark:bg-zinc-500/15";
  }
}

const statusStyles = {
  PENDING: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-gray-500 dark:text-zinc-400", bg: "bg-gray-100 dark:bg-zinc-500/15", border: "border-gray-300 dark:border-zinc-500/30", label: "Pending", cardBg: "bg-gray-50 dark:bg-zinc-900/40", accentBar: "bg-gray-400 dark:bg-zinc-500" },
  QUEUED: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-gray-500 dark:text-zinc-400", bg: "bg-gray-100 dark:bg-zinc-500/15", border: "border-gray-300 dark:border-zinc-500/30", label: "Queued", cardBg: "bg-gray-50 dark:bg-zinc-900/40", accentBar: "bg-gray-400 dark:bg-zinc-500" },
  RUNNING: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/15", border: "border-blue-300 dark:border-blue-500/30", label: "Running", cardBg: "bg-blue-50 dark:bg-blue-950/20", accentBar: "bg-blue-500 dark:bg-gradient-to-b dark:from-blue-400 dark:to-blue-600" },
  WAITING: { icon: <Pause className="w-3.5 h-3.5" />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/15", border: "border-amber-300 dark:border-amber-500/30", label: "Waiting", cardBg: "bg-amber-50 dark:bg-amber-950/20", accentBar: "bg-amber-500 dark:bg-gradient-to-b dark:from-amber-400 dark:to-amber-600" },
  COMPLETED: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/15", border: "border-emerald-300 dark:border-emerald-500/30", label: "Success", cardBg: "bg-emerald-50 dark:bg-emerald-950/20", accentBar: "bg-emerald-500 dark:bg-gradient-to-b dark:from-emerald-400 dark:to-emerald-600" },
  FAILED: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/15", border: "border-red-300 dark:border-red-500/30", label: "Failed", cardBg: "bg-red-50 dark:bg-red-950/20", accentBar: "bg-red-500 dark:bg-gradient-to-b dark:from-red-400 dark:to-red-600" },
  CANCELLED: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-500/15", border: "border-orange-300 dark:border-orange-500/30", label: "Cancelled", cardBg: "bg-orange-50 dark:bg-orange-950/20", accentBar: "bg-orange-500 dark:bg-gradient-to-b dark:from-orange-400 dark:to-orange-600" },
};

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/10", border: "border-red-300 dark:border-red-500/30", label: "Critical", badgeBg: "bg-red-200 dark:bg-red-500/20", accentBar: "bg-red-500 dark:bg-gradient-to-b dark:from-red-400 dark:to-red-600" },
  warning: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/10", border: "border-amber-300 dark:border-amber-500/30", label: "Warning", badgeBg: "bg-amber-200 dark:bg-amber-500/20", accentBar: "bg-amber-500 dark:bg-gradient-to-b dark:from-amber-400 dark:to-amber-600" },
  info: { icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/10", border: "border-blue-300 dark:border-blue-500/30", label: "Info", badgeBg: "bg-blue-200 dark:bg-blue-500/20", accentBar: "bg-blue-500 dark:bg-gradient-to-b dark:from-blue-400 dark:to-blue-600" },
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Auto-expand RUNNING/PENDING executions so user can see real-time status
  useEffect(() => {
    const activeIds = executions
      .filter(e => 
        e.status === "RUNNING" || 
        e.status === "PENDING" || 
        e.nodeExecutions.some(n => 
          n.status === "RUNNING" || n.status === "WAITING" || n.status === "QUEUED"
        )
      )
      .map(e => e.id);
    
    if (activeIds.length > 0) {
      setExpandedWorkflows(prev => {
        const next = new Set(prev);
        activeIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [executions]);
  
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
      // Pass through workflowId, including "new" (unsaved workflows)
      if (workflowId) params.set("workflowId", workflowId);
      // Add cache-busting timestamp to ensure fresh data
      params.set("_t", Date.now().toString());
      
      const response = await fetch(`/api/trigger-runs?${params.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("[ActivityPanel] Raw executions from API:", data.executions?.map((e: any) => ({ 
          id: e.id?.slice(-6), 
          status: e.status, 
          nodes: e.nodeExecutions?.map((n: any) => `${n.nodeType}:${n.status}`)
        })));
        
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
        
        // Keep RUNNING/PENDING executions even if they have no nodes yet (nodes are created by Trigger.dev task)
        // Sort: Active executions first, then by start time (most recent first)
        const filtered = transformed.filter(exec => 
          exec.nodeExecutions.length > 0 || 
          exec.status === "RUNNING" || 
          exec.status === "PENDING"
        );
        
        const sorted = filtered.sort((a, b) => {
          // Check if execution is active (running, pending, or has active nodes)
          const activeStatuses = ["RUNNING", "PENDING", "QUEUED"];
          const aIsActive = activeStatuses.includes(a.status) || 
            a.nodeExecutions.some(n => ["RUNNING", "WAITING", "QUEUED", "PENDING"].includes(n.status));
          const bIsActive = activeStatuses.includes(b.status) || 
            b.nodeExecutions.some(n => ["RUNNING", "WAITING", "QUEUED", "PENDING"].includes(n.status));
          
          // Active executions come first
          if (aIsActive && !bIsActive) return -1;
          if (!aIsActive && bIsActive) return 1;
          
          // Then sort by start time (most recent first)
          const aTime = new Date(a.startedAt || a.createdAt).getTime();
          const bTime = new Date(b.startedAt || b.createdAt).getTime();
          return bTime - aTime;
        });
        
        console.log("[ActivityPanel] Sorted executions:", sorted.map(e => ({ 
          id: e.id?.slice(-6), 
          status: e.status, 
          hasRunningNodes: e.nodeExecutions.some(n => n.status === "RUNNING" || n.status === "WAITING"),
          nodes: e.nodeExecutions.map(n => `${n.nodeType}:${n.status}`)
        })));
        
        setExecutions(sorted);
      }
    } catch (err) {
      console.error("Failed to fetch executions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, workflowId]);

  // Check if any execution is currently active (running or pending)
  const hasRunningExecution = useMemo(() => 
    executions.some(e => 
      e.status === "RUNNING" || 
      e.status === "PENDING" || 
      e.nodeExecutions.some(n => 
        n.status === "RUNNING" || n.status === "WAITING" || n.status === "QUEUED"
      )
    ),
    [executions]
  );

  useEffect(() => {
    if (isOpen) {
      fetchExecutions();
      // Poll faster when workflows are running (every 1.5s), slower otherwise (every 5s)
      const interval = setInterval(fetchExecutions, hasRunningExecution ? 1500 : 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchExecutions, hasRunningExecution]);

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

  const handleDeleteAllRuns = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => setShowDeleteConfirm(false), 3000);
      return;
    }
    
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    
    try {
      // Delete all executions for this workflow (or all if no workflowId)
      const params = new URLSearchParams();
      if (workflowId) params.set("workflowId", workflowId);
      
      const response = await fetch(`/api/workflow-executions?${params.toString()}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setExecutions([]);
        setExpandedWorkflows(new Set());
        console.log("[ActivityPanel] Deleted all executions");
      } else {
        console.error("[ActivityPanel] Failed to delete executions:", await response.text());
      }
    } catch (error) {
      console.error("[ActivityPanel] Error deleting executions:", error);
    } finally {
      setIsDeleting(false);
    }
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
          className="fixed top-16 z-50 w-[340px] bg-white dark:bg-black/60 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl border border-gray-200 dark:border-white/[0.08] overflow-hidden shadow-xl shadow-gray-300/50 dark:shadow-2xl dark:shadow-black/40 flex flex-col max-h-[calc(100vh-120px)]"
        >
          {/* Dots removed - now only on ReactFlow background */}

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500 dark:bg-gradient-to-br dark:from-blue-500/20 dark:to-blue-600/10 border border-blue-400 dark:border-blue-500/20 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-white dark:text-blue-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Activity</span>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-500">{executions.length} runs</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={fetchExecutions} disabled={isLoading} className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                  <RotateCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                </button>
                <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Stats */}
            {executions.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-3 bg-emerald-500/10 dark:bg-white/[0.03] backdrop-blur-sm rounded-xl px-3 py-2.5 border border-emerald-200 dark:border-white/[0.06] hover:bg-emerald-100 dark:hover:bg-white/[0.05] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 dark:bg-gradient-to-br dark:from-emerald-500/20 dark:to-emerald-600/10 border border-emerald-400 dark:border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4.5 h-4.5 text-white dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide font-medium">Success</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 -mt-0.5">{stats.success}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-red-50 dark:bg-white/[0.03] backdrop-blur-sm rounded-xl px-3 py-2.5 border border-red-200 dark:border-white/[0.06] hover:bg-red-100 dark:hover:bg-white/[0.05] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-red-500 dark:bg-gradient-to-br dark:from-red-500/20 dark:to-red-600/10 border border-red-400 dark:border-red-500/20 flex items-center justify-center">
                    <XCircle className="w-4.5 h-4.5 text-white dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide font-medium">Failed</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400 -mt-0.5">{stats.failed}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-blue-50 dark:bg-white/[0.03] backdrop-blur-sm rounded-xl px-3 py-2.5 border border-blue-200 dark:border-white/[0.06] hover:bg-blue-100 dark:hover:bg-white/[0.05] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue-500 dark:bg-gradient-to-br dark:from-blue-500/20 dark:to-blue-600/10 border border-blue-400 dark:border-blue-500/20 flex items-center justify-center">
                    <Loader2 className="w-4.5 h-4.5 text-white dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide font-medium">Running</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400 -mt-0.5">{stats.running}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-amber-50 dark:bg-white/[0.03] backdrop-blur-sm rounded-xl px-3 py-2.5 border border-amber-200 dark:border-white/[0.06] hover:bg-amber-100 dark:hover:bg-white/[0.05] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 dark:bg-gradient-to-br dark:from-amber-500/20 dark:to-amber-600/10 border border-amber-400 dark:border-amber-500/20 flex items-center justify-center">
                    <Coins className="w-4.5 h-4.5 text-white dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide font-medium">Credits</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400 -mt-0.5">{formatCredits(stats.totalCost)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tab Switcher */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-white/[0.04] bg-white dark:bg-white/[0.01] shrink-0">
            <div className="flex items-center bg-gray-100 dark:bg-white/[0.03] rounded-lg p-0.5 border border-gray-200 dark:border-white/[0.04]">
              <button
                onClick={() => setActiveTab("runs")}
                className={cn("flex-1 h-7 px-2 text-[10px] font-medium rounded-md flex items-center justify-center gap-1 transition-all", activeTab === "runs" ? "bg-white dark:bg-white/[0.08] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300")}
              >
                <Play className="w-3 h-3" />Runs
              </button>
              <button
                onClick={() => setActiveTab("errors")}
                className={cn("flex-1 h-7 px-2 text-[10px] font-medium rounded-md flex items-center justify-center gap-1 transition-all", activeTab === "errors" ? "bg-white dark:bg-white/[0.08] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300")}
              >
                <Bug className="w-3 h-3" />Errors
                {errors.length > 0 && <span className="ml-0.5 px-1 py-0.5 text-[8px] font-bold bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full">{errors.length}</span>}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10">
            {activeTab === "runs" ? (
              isLoading && executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12"><Loader2 className="w-5 h-5 text-gray-400 dark:text-zinc-600 animate-spin" /><p className="text-xs text-gray-500 dark:text-zinc-500 mt-2">Loading...</p></div>
              ) : executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center mb-3"><Inbox className="w-5 h-5 text-gray-400 dark:text-zinc-600" /></div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">No runs yet</p><p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Run a workflow to see history</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Delete All Button */}
                  <div className="flex justify-end px-1">
                    <button 
                      onClick={handleDeleteAllRuns} 
                      disabled={isDeleting}
                      className={cn(
                        "flex items-center gap-1 text-[10px] transition-colors",
                        showDeleteConfirm 
                          ? "text-red-500 dark:text-red-400 font-medium" 
                          : "text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400"
                      )}
                    >
                      {isDeleting ? (
                        <><Loader2 className="w-3 h-3 animate-spin" />Deleting...</>
                      ) : showDeleteConfirm ? (
                        <><Trash2 className="w-3 h-3" />Click again to confirm</>
                      ) : (
                        <><Trash2 className="w-3 h-3" />Delete all</>
                      )}
                    </button>
                  </div>
                  {executions.map((exec, idx) => {
                    const status = statusStyles[exec.status as keyof typeof statusStyles] || statusStyles.PENDING;
                    const hasNodes = exec.nodeExecutions.length > 0;
                    const isMulti = exec.nodeExecutions.length > 1;
                    const isExpanded = expandedWorkflows.has(exec.id);
                    const workflowCost = exec.nodeExecutions.reduce((sum, n) => sum + (n.actualCost || 0), 0);
                    const singleNode = !isMulti && hasNodes ? exec.nodeExecutions[0] : null;
                    const isCurrentlyRunning = exec.status === "RUNNING" || exec.status === "PENDING" || exec.nodeExecutions.some(n => n.status === "RUNNING" || n.status === "WAITING" || n.status === "QUEUED");
                    const isStarting = (exec.status === "RUNNING" || exec.status === "PENDING") && !hasNodes; // Just started, nodes not created yet
                    
                    return (
                      <motion.div key={exec.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className={cn("rounded-xl border overflow-hidden relative", status.cardBg, status.border)}>
                        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", status.accentBar)} />
                        
                        {/* Starting execution (no nodes yet) */}
                        {isStarting ? (
                          <div className="p-3 pl-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", status.bg)}>
                                <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20 px-1.5 py-0.5 rounded uppercase border border-blue-300 dark:border-blue-500/30 flex items-center gap-1 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-ping" />
                                    STARTING
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5">Initializing workflow execution...</p>
                                <div className="flex items-center gap-1 text-[9px] text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-white/[0.03] px-1.5 py-0.5 rounded mt-1.5 w-fit">
                                  <Calendar className="w-2.5 h-2.5" />{formatExactDate(exec.createdAt)} • {formatExactTime(exec.createdAt)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : isMulti ? (
                          <>
                            <button onClick={() => toggleWorkflow(exec.id)} className="w-full text-left p-3 pl-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-start gap-3">
                                {/* Status icon */}
                                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", status.bg)}>
                                  <div className={cn("scale-90", status.color)}>{status.icon}</div>
                                </div>
                                
                                {/* Main content */}
                                <div className="flex-1 min-w-0">
                                  {/* Title row */}
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{exec.workflowName || "Workflow Run"}</span>
                                    {isCurrentlyRunning && (
                                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Running" />
                                    )}
                                  </div>
                                  
                                  {/* Meta row - clean single line */}
                                  <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-zinc-500">
                                    <span>{formatExactDate(exec.createdAt)} • {formatExactTime(exec.createdAt)}</span>
                                    {exec.durationMs && <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{formatDurationMs(exec.durationMs)}</span>}
                                    {workflowCost > 0 && <span className="text-amber-600 dark:text-amber-400">{formatCredits(workflowCost)}</span>}
                                  </div>
                                  
                                  {/* Stats row - compact indicators */}
                                  <div className="flex items-center gap-3 mt-1.5">
                                    {(() => {
                                      const nodeIds = exec.nodeExecutions.map(n => n.nodeId);
                                      const pipelines = findConnectedPipelines(nodeIds);
                                      const runningCount = exec.nodeExecutions.filter(n => n.status === "RUNNING" || n.status === "WAITING").length;
                                      const completedCount = exec.nodeExecutions.filter(n => n.status === "COMPLETED").length;
                                      const failedCount = exec.nodeExecutions.filter(n => n.status === "FAILED").length;
                                      
                                      return (
                                        <>
                                          <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                                            {pipelines.length > 1 && <>{pipelines.length} chains · </>}
                                            {exec.nodeExecutions.length} nodes
                                          </span>
                                          
                                          {/* Status dots - only show if there's activity */}
                                          {(runningCount > 0 || completedCount > 0 || failedCount > 0) && (
                                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.03]">
                                              {runningCount > 0 && (
                                                <span className="flex items-center gap-0.5 text-[10px] text-blue-500 dark:text-blue-400">
                                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />{runningCount}
                                                </span>
                                              )}
                                              {completedCount > 0 && (
                                                <span className="flex items-center gap-0.5 text-[10px] text-emerald-500 dark:text-emerald-400">
                                                  <CheckCircle2 className="w-2.5 h-2.5" />{completedCount}
                                                </span>
                                              )}
                                              {failedCount > 0 && (
                                                <span className="flex items-center gap-0.5 text-[10px] text-red-500 dark:text-red-400">
                                                  <XCircle className="w-2.5 h-2.5" />{failedCount}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                                
                                {/* Right actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nodeIds = exec.nodeExecutions.map(n => n.nodeId);
                                      const isCurrentlyHighlighted = nodeIds.some(id => highlightedNodeIds.includes(id));
                                      if (isCurrentlyHighlighted) {
                                        clearHighlight();
                                      } else {
                                        highlightPipeline(nodeIds);
                                      }
                                    }}
                                    className={cn(
                                      "p-1.5 rounded-md transition-colors",
                                      exec.nodeExecutions.some(n => highlightedNodeIds.includes(n.nodeId))
                                        ? "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400"
                                        : "hover:bg-gray-100 dark:hover:bg-white/[0.05] text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400"
                                    )}
                                    title="Focus on pipeline nodes"
                                  >
                                    <Focus className="w-3.5 h-3.5" />
                                  </button>
                                  <motion.div 
                                    animate={{ rotate: isExpanded ? 180 : 0 }} 
                                    className="p-1 text-gray-400 dark:text-zinc-600"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </motion.div>
                                </div>
                              </div>
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-200 dark:border-white/[0.04]">
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
                                          { bg: "bg-violet-100 dark:bg-violet-500/10", border: "border-violet-300 dark:border-violet-500/20", text: "text-violet-600 dark:text-violet-400", accent: "bg-violet-200 dark:bg-violet-500/20" },
                                          { bg: "bg-cyan-100 dark:bg-cyan-500/10", border: "border-cyan-300 dark:border-cyan-500/20", text: "text-cyan-600 dark:text-cyan-400", accent: "bg-cyan-200 dark:bg-cyan-500/20" },
                                          { bg: "bg-amber-100 dark:bg-amber-500/10", border: "border-amber-300 dark:border-amber-500/20", text: "text-amber-600 dark:text-amber-400", accent: "bg-amber-200 dark:bg-amber-500/20" },
                                          { bg: "bg-emerald-100 dark:bg-emerald-500/10", border: "border-emerald-300 dark:border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", accent: "bg-emerald-200 dark:bg-emerald-500/20" },
                                          { bg: "bg-rose-100 dark:bg-rose-500/10", border: "border-rose-300 dark:border-rose-500/20", text: "text-rose-600 dark:text-rose-400", accent: "bg-rose-200 dark:bg-rose-500/20" },
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
                                                  <span className="text-[9px] text-gray-500 dark:text-zinc-500">{pipelineNodes.length} nodes</span>
                                                  {pipelineCost > 0 && (
                                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
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
                                                      : "hover:bg-gray-100 dark:hover:bg-white/[0.05] text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
                                                  )}
                                                >
                                                  <Focus className="w-3 h-3" />
                                                  {isPipelineHighlighted ? "Viewing" : "Focus"}
                                                </button>
                                              </div>
                                            )}
                                            
                                            {/* Nodes in this pipeline */}
                                            <div className={cn("space-y-1", hasManyPipelines ? "p-1.5" : "")}>
                                              {pipelineNodes.map((node, i) => {
                                                const ns = statusStyles[node.status as keyof typeof statusStyles] || statusStyles.PENDING;
                                                const isCached = node.providerUsed === "cache";
                                                return (
                                                  <button 
                                                    key={`${node.id}-${i}`} 
                                                    onClick={() => handleNodeClick(node.nodeType, node.nodeId)} 
                                                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all group"
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      {/* Node icon */}
                                                      <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", getNodeColor(node.nodeType))}>
                                                        <div className="scale-75">{getNodeIcon(node.nodeType)}</div>
                                                      </div>
                                                      
                                                      {/* Name and meta */}
                                                      <div className="flex-1 min-w-0 flex items-center gap-2">
                                                        <span className="text-[11px] font-medium text-gray-800 dark:text-zinc-200 truncate">
                                                          {getNodeDisplayName(node)}
                                                        </span>
                                                        <span className="text-[9px] text-gray-400 dark:text-zinc-600">
                                                          {isCached ? (
                                                            <span className="text-cyan-500 dark:text-cyan-400">cached</span>
                                                          ) : (
                                                            <>
                                                              {node.durationMs && formatDurationMs(node.durationMs)}
                                                              {(node.actualCost ?? 0) > 0 && <> · <span className="text-amber-500 dark:text-amber-400">{formatCredits(node.actualCost!)}</span></>}
                                                            </>
                                                          )}
                                                        </span>
                                                      </div>
                                                      
                                                      {/* Status indicator */}
                                                      <div className={cn("scale-75", ns.color)}>{ns.icon}</div>
                                                    </div>
                                                    
                                                    {node.error && (
                                                      <div className="mt-1.5 ml-7 p-1.5 rounded bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                                                        <p className="text-[9px] text-red-600 dark:text-red-400 line-clamp-2">{node.error}</p>
                                                      </div>
                                                    )}
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
                          <button onClick={() => singleNode && handleNodeClick(singleNode.nodeType, singleNode.nodeId)} className="w-full text-left p-3 pl-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-start gap-3">
                              {/* Node icon */}
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", getNodeColor(singleNode?.nodeType || ""))}>
                                {singleNode && getNodeIcon(singleNode.nodeType)}
                              </div>
                              
                              {/* Main content */}
                              <div className="flex-1 min-w-0">
                                {/* Title row */}
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[13px] font-medium text-gray-900 dark:text-white truncate">
                                    {singleNode && getNodeDisplayName(singleNode)}
                                  </span>
                                  {singleNode?.providerUsed === "cache" && (
                                    <span className="text-[9px] text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                      <Database className="w-2.5 h-2.5" />cache
                                    </span>
                                  )}
                                </div>
                                
                                {/* Meta row */}
                                <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-zinc-500">
                                  <span>{formatExactDate(exec.createdAt)} • {formatExactTime(exec.createdAt)}</span>
                                  {singleNode?.providerUsed === "cache" ? (
                                    <span className="text-cyan-600 dark:text-cyan-400">0ms</span>
                                  ) : singleNode?.durationMs && (
                                    <span className="flex items-center gap-1">
                                      <Timer className="w-3 h-3" />{formatDurationMs(singleNode.durationMs)}
                                    </span>
                                  )}
                                  {singleNode?.providerUsed === "cache" ? (
                                    <span className="text-cyan-600 dark:text-cyan-400">0 credits</span>
                                  ) : (singleNode?.actualCost ?? 0) > 0 && (
                                    <span className="text-amber-600 dark:text-amber-400">{formatCredits(singleNode!.actualCost)}</span>
                                  )}
                                  {singleNode?.providerUsed && singleNode.providerUsed !== "cache" && (
                                    <span className="text-blue-500 dark:text-blue-400">{singleNode.providerUsed}</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Status badge */}
                              <div className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-md shrink-0",
                                status.bg
                              )}>
                                <div className={cn("scale-90", status.color)}>{status.icon}</div>
                                <span className={cn("text-[10px] font-medium", status.color)}>{status.label}</span>
                              </div>
                            </div>
                            
                            {singleNode?.error && (
                              <div className="mt-2 ml-10 p-2 rounded-lg bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/20">
                                <p className="text-[10px] text-red-600 dark:text-red-400 line-clamp-2">{singleNode.error}</p>
                              </div>
                            )}
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
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center mb-3"><CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /></div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">All clear!</p><p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">No errors in this session</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-end px-1"><button onClick={onClearErrors} className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" />Clear all</button></div>
                  {errors.map((error, idx) => {
                    const severity = severityConfig[error.severity];
                    const SeverityIcon = severity.icon;
                    const isExpanded = expandedErrors.has(error.id);
                    const suggestion = getSuggestion(error);
                    return (
                      <motion.div key={error.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className={cn("rounded-xl border overflow-hidden relative", severity.bg, severity.border)}>
                        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", severity.accentBar)} />
                        <button onClick={() => toggleError(error.id)} className="w-full text-left p-3 pl-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", severity.bg)}><SeverityIcon className={cn("w-4 h-4", severity.color)} /></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2"><span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", severity.badgeBg, severity.color)}>{severity.label}</span><span className="text-xs font-medium text-gray-800 dark:text-white truncate">{error.nodeName}</span></div>
                              <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">{error.message}</p>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className="text-[9px] text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-white/[0.03] px-1.5 py-0.5 rounded">{error.nodeType}</span>
                                {error.provider && <span className="text-[9px] text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">{error.provider}</span>}
                                {error.httpStatus && <span className="text-[9px] text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-white/[0.03] px-1.5 py-0.5 rounded">HTTP {error.httpStatus}</span>}
                                <span className="text-[9px] text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-white/[0.03] px-1.5 py-0.5 rounded">{formatTimeAgo(error.timestamp)}</span>
                              </div>
                            </div>
                            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-gray-400 dark:text-zinc-500 mt-1"><ChevronDown className="w-4 h-4" /></motion.div>
                          </div>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-200 dark:border-white/[0.04]">
                              <div className="p-3 space-y-2">
                                {/* What happened (user-facing) */}
                                <div className="p-2 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04]">
                                  <div className="flex items-center gap-2">
                                    <Bug className="w-3 h-3 text-gray-500 dark:text-zinc-400" />
                                    <span className="text-[10px] font-semibold text-gray-700 dark:text-zinc-300">What happened</span>
                                  </div>
                                  <p className="mt-1 text-[10px] text-gray-600 dark:text-zinc-400">
                                    {error.message}
                                  </p>
                                </div>

                                {/* Suggested fix / next steps */}
                                {suggestion && (
                                  <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-lg">
                                    <Lightbulb className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">How to fix</p>
                                      <p className="text-[10px] text-blue-600 dark:text-blue-300 mt-0.5 break-words">{suggestion}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Technical details */}
                                <div className="rounded-lg border border-gray-200 dark:border-white/[0.04] bg-gray-50 dark:bg-white/[0.02] overflow-hidden">
                                  <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-2">
                                    <Info className="w-3 h-3 text-gray-500 dark:text-zinc-400" />
                                    Technical details
                                  </div>
                                  <div className="px-2 pb-2 space-y-1.5">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="text-[9px] text-gray-500 dark:text-zinc-500">Node</div>
                                      <div className="text-[9px] text-gray-700 dark:text-zinc-300 font-mono break-all">{error.nodeId}</div>
                                      {error.provider && (
                                        <>
                                          <div className="text-[9px] text-gray-500 dark:text-zinc-500">Provider</div>
                                          <div className="text-[9px] text-gray-700 dark:text-zinc-300 font-mono break-all">{error.provider}</div>
                                        </>
                                      )}
                                      {error.httpStatus && (
                                        <>
                                          <div className="text-[9px] text-gray-500 dark:text-zinc-500">HTTP status</div>
                                          <div className="text-[9px] text-gray-700 dark:text-zinc-300 font-mono">{error.httpStatus}</div>
                                        </>
                                      )}
                                      {error.errorCode && (
                                        <>
                                          <div className="text-[9px] text-gray-500 dark:text-zinc-500">Code</div>
                                          <div className="text-[9px] text-gray-700 dark:text-zinc-300 font-mono break-all">{error.errorCode}</div>
                                        </>
                                      )}
                                      {error.executionId && (
                                        <>
                                          <div className="text-[9px] text-gray-500 dark:text-zinc-500">Execution ID</div>
                                          <div className="text-[9px] text-gray-700 dark:text-zinc-300 font-mono break-all">{error.executionId}</div>
                                        </>
                                      )}
                                      {error.triggerRunId && (
                                        <>
                                          <div className="text-[9px] text-gray-500 dark:text-zinc-500">Trigger run</div>
                                          <div className="text-[9px] text-gray-700 dark:text-zinc-300 font-mono break-all">{error.triggerRunId}</div>
                                        </>
                                      )}
                                      {error.duration !== undefined && (
                                        <>
                                          <div className="text-[9px] text-gray-500 dark:text-zinc-500">Duration</div>
                                          <div className="text-[9px] text-gray-700 dark:text-zinc-300 font-mono">{formatDurationMs(error.duration)}</div>
                                        </>
                                      )}
                                    </div>
                                    {error.details && (
                                      <div className="mt-2">
                                        <div className="text-[9px] text-gray-500 dark:text-zinc-500 mb-1">Details</div>
                                        <pre className="p-2 rounded-lg bg-white dark:bg-black/30 border border-gray-200 dark:border-white/[0.06] text-[10px] text-gray-700 dark:text-zinc-300 font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">{error.details}</pre>
                                      </div>
                                    )}
                                    {error.inputs && (
                                      <div className="mt-2">
                                        <div className="text-[9px] text-gray-500 dark:text-zinc-500 mb-1">Inputs (sanitized)</div>
                                        <pre className="p-2 rounded-lg bg-white dark:bg-black/30 border border-gray-200 dark:border-white/[0.06] text-[10px] text-gray-700 dark:text-zinc-300 font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">{safeJson(error.inputs)}</pre>
                                      </div>
                                    )}
                                    {error.rawResponse !== undefined && (
                                      <div className="mt-2">
                                        <div className="text-[9px] text-gray-500 dark:text-zinc-500 mb-1">Raw response (sanitized)</div>
                                        <pre className="p-2 rounded-lg bg-white dark:bg-black/30 border border-gray-200 dark:border-white/[0.06] text-[10px] text-gray-700 dark:text-zinc-300 font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">{safeJson(error.rawResponse)}</pre>
                                      </div>
                                    )}
                                    {error.stackTrace && (
                                      <div className="mt-2">
                                        <div className="text-[9px] text-gray-500 dark:text-zinc-500 mb-1">Stack trace</div>
                                        <pre className="p-2 rounded-lg bg-white dark:bg-black/30 border border-gray-200 dark:border-white/[0.06] text-[10px] text-gray-700 dark:text-zinc-300 font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">{error.stackTrace}</pre>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 pt-1">
                                  <button onClick={() => onNodeClick?.(error.nodeId)} className="h-6 px-2 text-[9px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white bg-gray-100 dark:bg-white/[0.03] hover:bg-gray-200 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] rounded flex items-center gap-1 transition-colors"><Target className="w-2.5 h-2.5" />Focus</button>
                                  {error.canRetry && onRetryNode && <button onClick={() => onRetryNode(error.nodeId)} className="h-6 px-2 text-[9px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white bg-gray-100 dark:bg-white/[0.03] hover:bg-gray-200 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] rounded flex items-center gap-1 transition-colors"><RefreshCw className="w-2.5 h-2.5" />Retry</button>}
                                  <button onClick={() => handleCopyId(error.id)} className="h-6 px-2 text-[9px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white bg-gray-100 dark:bg-white/[0.03] hover:bg-gray-200 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] rounded flex items-center gap-1 transition-colors">{copiedId === error.id ? <><Check className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400" />Copied</> : <><Copy className="w-2.5 h-2.5" />ID</>}</button>
                                  <button
                                    onClick={async () => {
                                      const payload = {
                                        ...error,
                                        timestamp: error.timestamp?.toISOString?.() ?? String(error.timestamp),
                                      };
                                      await navigator.clipboard.writeText(safeJson(payload));
                                      setCopiedId(error.id);
                                      setTimeout(() => setCopiedId(null), 2000);
                                    }}
                                    className="h-6 px-2 text-[9px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white bg-gray-100 dark:bg-white/[0.03] hover:bg-gray-200 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] rounded flex items-center gap-1 transition-colors"
                                    title="Copy full error payload"
                                  >
                                    <Copy className="w-2.5 h-2.5" />Copy JSON
                                  </button>
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
          <div className="px-3 py-2.5 border-t border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 flex items-center gap-1.5"><Focus className="w-3 h-3" />Focus to highlight & fit view</p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 flex items-center gap-1.5">
                {hasRunningExecution && <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500 dark:text-blue-400" />}
                Auto-refresh: {hasRunningExecution ? "1.5s" : "5s"}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type { WorkflowError as ActivityPanelError };
