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
  Trash2,
  Play,
  Crop,
  Scissors,
  Mic,
  Database,
  Focus,
  GitBranch,
  Layers,
  Download,
  History,
  ChevronRight,
  Lightbulb,
  Bug,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { trpc } from "@/lib/trpc/react";
import { format } from "date-fns";

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

function getSuggestion(errorMessage: string): string | undefined {
  const msg = (errorMessage || "").toLowerCase();
  for (const [pattern, suggestion] of Object.entries(errorSuggestions)) {
    if (msg.includes(pattern.toLowerCase())) return suggestion;
  }
  return undefined;
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

function formatVersionTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  if (date.toDateString() === now.toDateString()) {
    return format(date, "h:mm a");
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${format(date, "h:mm a")}`;
  }
  
  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    return format(date, "EEE h:mm a");
  }
  
  return format(date, "MMM d, h:mm a");
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
  initialTab?: "runs" | "versions";
  onVersionRestore?: (nodesJson: unknown[], edgesJson: unknown[], viewportJson?: unknown) => void;
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
  onVersionRestore,
}: ActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<"runs" | "versions">(initialTab);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [expandedNodeErrors, setExpandedNodeErrors] = useState<Set<string>>(new Set());
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  
  // Auto-expand RUNNING/PENDING executions
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
  
  // Version history queries
  const { data: versionsData, isLoading: isLoadingVersions, refetch: refetchVersions } = trpc.version.list.useQuery(
    { workflowId: workflowId || "" },
    { 
      enabled: isOpen && activeTab === "versions" && !!workflowId && workflowId !== "new",
    }
  );

  const restoreVersion = trpc.version.restore.useMutation({
    onSuccess: (data) => {
      if (data.workflow && onVersionRestore) {
        onVersionRestore(
          data.workflow.nodesJson as unknown[],
          data.workflow.edgesJson as unknown[],
          data.workflow.viewportJson
        );
      }
      setIsRestoring(false);
      setSelectedVersion(null);
      refetchVersions();
    },
    onError: () => {
      setIsRestoring(false);
    },
  });

  const deleteVersion = trpc.version.delete.useMutation({
    onSuccess: () => {
      refetchVersions();
      setExpandedVersionId(null);
    },
  });

  const handleRestoreVersion = (versionId: string) => {
    if (!workflowId || workflowId === "new") return;
    setIsRestoring(true);
    setSelectedVersion(versionId);
    restoreVersion.mutate({ workflowId, versionId });
  };

  const handleExportVersion = (version: {
    id: string;
    version: number;
    name: string;
    nodesJson: unknown;
    edgesJson: unknown;
    viewportJson?: unknown;
    createdAt: string;
    nodeCount: number;
  }) => {
    const exportData = {
      schemaVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      workflow: {
        name: version.name,
        version: version.version,
        nodes: version.nodesJson,
        edges: version.edgesJson,
        viewport: version.viewportJson ?? null,
        nodeCount: version.nodeCount,
        createdAt: version.createdAt,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-v${version.version}-${format(new Date(version.createdAt), "yyyy-MM-dd-HHmm")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const versions = versionsData?.versions ?? [];
  
  // Find connected components (pipelines) from edges
  const findConnectedPipelines = useCallback((nodeIds: string[]): string[][] => {
    if (nodeIds.length === 0) return [];
    
    const parent = new Map<string, string>();
    const rank = new Map<string, number>();
    
    for (const id of nodeIds) {
      parent.set(id, id);
      rank.set(id, 0);
    }
    
    const find = (x: string): string => {
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    };
    
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
    
    const nodeIdSet = new Set(nodeIds);
    for (const edge of storeEdges) {
      if (nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)) {
        union(edge.source, edge.target);
      }
    }
    
    const groups = new Map<string, string[]>();
    for (const id of nodeIds) {
      const root = find(id);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(id);
    }
    
    return Array.from(groups.values()).sort((a, b) => b.length - a.length);
  }, [storeEdges]);

  const fetchExecutions = useCallback(async () => {
    if (!isOpen || activeTab !== "runs") return;
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (workflowId) params.set("workflowId", workflowId);
      params.set("_t", Date.now().toString());
      
      const response = await fetch(`/api/workflow-executions?${params.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      
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
        
        const filtered = transformed.filter(exec => 
          exec.nodeExecutions.length > 0 || 
          exec.status === "RUNNING" || 
          exec.status === "PENDING"
        );
        
        const sorted = filtered.sort((a, b) => {
          const activeStatuses = ["RUNNING", "PENDING", "QUEUED"];
          const aIsActive = activeStatuses.includes(a.status) || 
            a.nodeExecutions.some(n => ["RUNNING", "WAITING", "QUEUED", "PENDING"].includes(n.status));
          const bIsActive = activeStatuses.includes(b.status) || 
            b.nodeExecutions.some(n => ["RUNNING", "WAITING", "QUEUED", "PENDING"].includes(n.status));
          
          if (aIsActive && !bIsActive) return -1;
          if (!aIsActive && bIsActive) return 1;
          
          const aTime = new Date(a.startedAt || a.createdAt).getTime();
          const bTime = new Date(b.startedAt || b.createdAt).getTime();
          return bTime - aTime;
        });
        
        setExecutions(sorted);
      }
    } catch {
      // Failed to fetch executions - silently ignore
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, workflowId, activeTab]);

  useEffect(() => {
    if (isOpen && activeTab === "runs") {
      fetchExecutions();
    }
  }, [isOpen, fetchExecutions, activeTab]);

  const toggleWorkflow = (id: string) => {
    setExpandedWorkflows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleNodeError = (nodeKey: string) => {
    setExpandedNodeErrors(prev => {
      const next = new Set(prev);
      next.has(nodeKey) ? next.delete(nodeKey) : next.add(nodeKey);
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

  const handleDeleteAllRuns = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
      return;
    }
    
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    
    try {
      const params = new URLSearchParams();
      if (workflowId) params.set("workflowId", workflowId);
      
      const response = await fetch(`/api/workflow-executions?${params.toString()}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setExecutions([]);
        setExpandedWorkflows(new Set());
      }
    } catch {
      // Failed to delete executions - silently ignore
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

  // Render node with collapsible error
  const renderNodeWithError = (node: NodeExecutionRecord, execId: string, idx: number) => {
    const ns = statusStyles[node.status as keyof typeof statusStyles] || statusStyles.PENDING;
    const isCached = node.providerUsed === "cache";
    const hasError = node.status === "FAILED" && node.error;
    const nodeKey = `${execId}-${node.id}-${idx}`;
    const isErrorExpanded = expandedNodeErrors.has(nodeKey);
    const suggestion = hasError ? getSuggestion(node.error!) : undefined;
    
    return (
      <div key={nodeKey} className="rounded-lg overflow-hidden">
        <button 
          onClick={() => {
            if (hasError) {
              toggleNodeError(nodeKey);
            } else {
              handleNodeClick(node.nodeType, node.nodeId);
            }
          }} 
          className="w-full text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all group"
        >
          <div className="flex items-center gap-2">
            <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", getNodeColor(node.nodeType))}>
              <div className="scale-75">{getNodeIcon(node.nodeType)}</div>
            </div>
            
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
            
            <div className="flex items-center gap-1">
              <div className={cn("scale-75", ns.color)}>{ns.icon}</div>
              {hasError && (
                <motion.div
                  animate={{ rotate: isErrorExpanded ? 180 : 0 }}
                  className="text-red-400 dark:text-red-500"
                >
                  <ChevronDown className="w-3 h-3" />
                </motion.div>
              )}
            </div>
          </div>
        </button>
        
        {/* Collapsible Error Details */}
        <AnimatePresence>
          {hasError && isErrorExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mx-2 mb-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 space-y-2">
                {/* Error message */}
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-600 dark:text-red-400 break-words">{node.error}</p>
                </div>
                
                {/* Suggestion */}
                {suggestion && (
                  <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-md">
                    <Lightbulb className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold text-blue-700 dark:text-blue-300">How to fix</p>
                      <p className="text-[9px] text-blue-600 dark:text-blue-300 mt-0.5 break-words">{suggestion}</p>
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node.nodeType, node.nodeId);
                    }} 
                    className="h-5 px-2 text-[8px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white bg-white dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] rounded flex items-center gap-1 transition-colors"
                  >
                    <Target className="w-2.5 h-2.5" />Focus
                  </button>
                  {onRetryNode && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryNode(node.nodeId);
                      }} 
                      className="h-5 px-2 text-[8px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white bg-white dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] rounded flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />Retry
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

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
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500 dark:bg-blue-500/30 border border-blue-400 dark:border-blue-500/40 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-white dark:text-blue-300" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Timeline</span>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-500">Runs & Versions</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {activeTab === "runs" && (
                  <button onClick={fetchExecutions} disabled={isLoading} className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                    <RotateCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Stats Cards - Runs Tab */}
            {activeTab === "runs" && executions.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-3 bg-emerald-500/10 dark:bg-emerald-500/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 dark:bg-emerald-500/30 border border-emerald-400 dark:border-emerald-500/40 flex items-center justify-center">
                    <CheckCircle2 className="w-[18px] h-[18px] text-white dark:text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wide font-medium">Success</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 -mt-0.5">{stats.success}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-red-500 dark:bg-red-500/30 border border-red-400 dark:border-red-500/40 flex items-center justify-center">
                    <XCircle className="w-[18px] h-[18px] text-white dark:text-red-300" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wide font-medium">Failed</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400 -mt-0.5">{stats.failed}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-500/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/15 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue-500 dark:bg-blue-500/30 border border-blue-400 dark:border-blue-500/40 flex items-center justify-center">
                    <Loader2 className="w-[18px] h-[18px] text-white dark:text-blue-300" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wide font-medium">Running</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400 -mt-0.5">{stats.running}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-500/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/15 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 dark:bg-amber-500/30 border border-amber-400 dark:border-amber-500/40 flex items-center justify-center">
                    <Coins className="w-[18px] h-[18px] text-white dark:text-amber-300" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wide font-medium">Credits</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400 -mt-0.5">{formatCredits(stats.totalCost)}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Stats Cards - Versions Tab */}
            {activeTab === "versions" && versions.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-500/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/15 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue-500 dark:bg-blue-500/30 border border-blue-400 dark:border-blue-500/40 flex items-center justify-center">
                    <GitBranch className="w-[18px] h-[18px] text-white dark:text-blue-300" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wide font-medium">Total</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400 -mt-0.5">{versions.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-500/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 dark:bg-emerald-500/30 border border-emerald-400 dark:border-emerald-500/40 flex items-center justify-center">
                    <CheckCircle2 className="w-[18px] h-[18px] text-white dark:text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wide font-medium">Current</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 -mt-0.5">v{versions[0]?.version || 1}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-violet-50 dark:bg-violet-500/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-violet-200 dark:border-violet-500/20 hover:bg-violet-100 dark:hover:bg-violet-500/15 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-violet-500 dark:bg-violet-500/30 border border-violet-400 dark:border-violet-500/40 flex items-center justify-center">
                    <Layers className="w-[18px] h-[18px] text-white dark:text-violet-300" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wide font-medium">Nodes</p>
                    <p className="text-xl font-bold text-violet-600 dark:text-violet-400 -mt-0.5">{versions[0]?.nodeCount || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-cyan-50 dark:bg-cyan-500/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/15 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500 dark:bg-cyan-500/30 border border-cyan-400 dark:border-cyan-500/40 flex items-center justify-center">
                    <History className="w-[18px] h-[18px] text-white dark:text-cyan-300" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wide font-medium">Latest</p>
                    <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 -mt-0.5">{versions[0] ? formatVersionTime(versions[0].createdAt) : "-"}</p>
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
                onClick={() => setActiveTab("versions")}
                className={cn("flex-1 h-7 px-2 text-[10px] font-medium rounded-md flex items-center justify-center gap-1 transition-all", activeTab === "versions" ? "bg-white dark:bg-white/[0.08] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300")}
              >
                <GitBranch className="w-3 h-3" />Versions
                {versions.length > 0 && <span className="ml-0.5 px-1 py-0.5 text-[8px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">{versions.length}</span>}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10">
            {activeTab === "runs" ? (
              // RUNS TAB
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
                    const isStarting = (exec.status === "RUNNING" || exec.status === "PENDING") && !hasNodes;
                    
                    return (
                      <motion.div key={exec.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className={cn("rounded-xl border overflow-hidden relative", status.cardBg, status.border)}>
                        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", status.accentBar)} />
                        
                        {isStarting ? (
                          <div className="p-3 pl-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", status.bg)}>
                                <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20 px-1.5 py-0.5 rounded uppercase border border-blue-300 dark:border-blue-500/30 flex items-center gap-1 animate-pulse w-fit">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-ping" />
                                  STARTING
                                </span>
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5">Initializing workflow...</p>
                              </div>
                            </div>
                          </div>
                        ) : isMulti ? (
                          <>
                            <button onClick={() => toggleWorkflow(exec.id)} className="w-full text-left p-3 pl-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-start gap-3">
                                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", status.bg)}>
                                  <div className={cn("scale-90", status.color)}>{status.icon}</div>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{exec.workflowName || "Workflow Run"}</span>
                                    {isCurrentlyRunning && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                                  </div>
                                  
                                  <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-zinc-500">
                                    <span>{formatExactDate(exec.createdAt)} • {formatExactTime(exec.createdAt)}</span>
                                    {exec.durationMs && <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{formatDurationMs(exec.durationMs)}</span>}
                                    {workflowCost > 0 && <span className="text-amber-600 dark:text-amber-400">{formatCredits(workflowCost)}</span>}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400 dark:text-zinc-600">
                                    <span>{exec.nodeExecutions.length} nodes</span>
                                    {exec.nodeExecutions.some(n => n.status === "FAILED") && (
                                      <span className="text-red-500 dark:text-red-400 flex items-center gap-0.5">
                                        <AlertCircle className="w-3 h-3" />
                                        {exec.nodeExecutions.filter(n => n.status === "FAILED").length} failed
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="p-1 text-gray-400 dark:text-zinc-600">
                                  <ChevronDown className="w-4 h-4" />
                                </motion.div>
                              </div>
                            </button>
                            
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-200 dark:border-white/[0.04]">
                                  <div className="p-2 space-y-2">
                                    {(() => {
                                      // Group nodes by chain (connected components)
                                      const nodeIds = exec.nodeExecutions.map(n => n.nodeId);
                                      const chains = findConnectedPipelines(nodeIds);
                                      
                                      // If only one chain or no edges, show flat list
                                      if (chains.length <= 1) {
                                        return (
                                          <div className="space-y-1">
                                            {exec.nodeExecutions.map((node, i) => renderNodeWithError(node, exec.id, i))}
                                          </div>
                                        );
                                      }
                                      
                                      // Multiple chains - group them
                                      return chains.map((chainNodeIds, chainIdx) => {
                                        const chainNodes = chainNodeIds
                                          .map(nodeId => exec.nodeExecutions.find(n => n.nodeId === nodeId))
                                          .filter(Boolean) as NodeExecutionRecord[];
                                        
                                        if (chainNodes.length === 0) return null;
                                        
                                        const chainStatus = chainNodes.every(n => n.status === "COMPLETED") ? "completed"
                                          : chainNodes.some(n => n.status === "FAILED") ? "failed"
                                          : chainNodes.some(n => n.status === "RUNNING" || n.status === "WAITING") ? "running"
                                          : "queued";
                                        
                                        const statusColors = {
                                          completed: "border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5",
                                          failed: "border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5",
                                          running: "border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5",
                                          queued: "border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02]",
                                        };
                                        
                                        return (
                                          <div 
                                            key={`chain-${chainIdx}`} 
                                            className={cn(
                                              "rounded-lg border p-1.5",
                                              statusColors[chainStatus]
                                            )}
                                          >
                                            <div className="flex items-center gap-1.5 px-1.5 pb-1 mb-1 border-b border-gray-200/50 dark:border-white/[0.04]">
                                              <GitBranch className="w-3 h-3 text-gray-400 dark:text-zinc-500" />
                                              <span className="text-[9px] font-medium text-gray-500 dark:text-zinc-500">
                                                Chain {chainIdx + 1}
                                              </span>
                                              <span className="text-[9px] text-gray-400 dark:text-zinc-600">
                                                ({chainNodes.length} node{chainNodes.length > 1 ? "s" : ""})
                                              </span>
                                            </div>
                                            <div className="space-y-0.5">
                                              {chainNodes.map((node, i) => renderNodeWithError(node, exec.id, i))}
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
                          // Single node execution or no nodes
                          <div className="p-3 pl-4">
                            {singleNode ? (
                              renderNodeWithError(singleNode, exec.id, 0)
                            ) : (
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-600">
                                <Clock className="w-3 h-3" />
                                <span>No node data available</span>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )
            ) : (
              // VERSIONS TAB
              isLoadingVersions && versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-gray-400 dark:text-zinc-600 animate-spin" />
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2">Loading versions...</p>
                </div>
              ) : !workflowId || workflowId === "new" ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center mb-3">
                    <GitBranch className="w-5 h-5 text-gray-400 dark:text-zinc-600" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Save workflow first</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Versions will appear after saving</p>
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center mb-3">
                    <GitBranch className="w-5 h-5 text-gray-400 dark:text-zinc-600" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">No versions yet</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Save your workflow to create the first version</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {versions.map((version, index) => {
                    const isExpanded = expandedVersionId === version.id;
                    const isLatest = index === 0;
                    
                    return (
                      <motion.div
                        key={version.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={cn(
                          "rounded-xl border transition-all overflow-hidden",
                          selectedVersion === version.id
                            ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"
                            : isExpanded
                            ? "bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08]"
                            : "bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.04] hover:border-gray-300 dark:hover:border-white/[0.08]"
                        )}
                      >
                        <button
                          onClick={() => setExpandedVersionId(isExpanded ? null : version.id)}
                          className="w-full text-left p-3 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              isLatest 
                                ? "bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30" 
                                : "bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]"
                            )}>
                              <span className={cn(
                                "text-sm font-bold font-mono",
                                isLatest ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-zinc-400"
                              )}>
                                {version.version}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                {isLatest && (
                                  <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded uppercase">
                                    Current
                                  </span>
                                )}
                                <span className="text-xs text-gray-700 dark:text-zinc-300 truncate">{version.name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-zinc-500">
                                <span>{formatVersionTime(version.createdAt)}</span>
                                <span className="text-gray-300 dark:text-zinc-700">•</span>
                                <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{version.nodeCount}</span>
                              </div>
                            </div>

                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              className="text-gray-400 dark:text-zinc-600"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </motion.div>
                          </div>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                            >
                              <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-white/[0.04]">
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-zinc-600 mb-3 px-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{format(new Date(version.createdAt), "EEEE, MMM d, yyyy 'at' h:mm a")}</span>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestoreVersion(version.id);
                                    }}
                                    disabled={isRestoring || isLatest}
                                    className={cn(
                                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                      isLatest
                                        ? "bg-gray-100 dark:bg-white/[0.03] text-gray-400 dark:text-zinc-600 cursor-not-allowed border border-gray-200 dark:border-white/[0.04]"
                                        : "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30"
                                    )}
                                  >
                                    {isRestoring && selectedVersion === version.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    )}
                                    {isLatest ? "Current" : "Restore"}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExportVersion(version);
                                    }}
                                    className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 transition-all"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteVersion.mutate({ versionId: version.id });
                                    }}
                                    disabled={deleteVersion.isPending}
                                    className="px-3 py-2 rounded-lg text-xs font-medium bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 transition-all disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
              <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                {activeTab === "runs" ? (
                  <span className="flex items-center gap-1.5">
                    <Focus className="w-3 h-3" />Click failed nodes to see details
                  </span>
                ) : (
                  <span>Auto-saved on every change</span>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type { WorkflowError as ActivityPanelError };
