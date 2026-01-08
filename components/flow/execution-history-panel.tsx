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
}

interface ExecutionRecord {
  id: string;
  workflowName?: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  createdAt: string;
  completedAt?: string;
  nodeExecutions: NodeExecutionRecord[];
  totalCost?: number;
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

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diff = end - start;
  
  if (diff < 1000) return `${diff}ms`;
  if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
  return `${(diff / 60000).toFixed(1)}m`;
}

// Get node category icon
function getNodeIcon(nodeType: string): React.ReactNode {
  const def = NODE_DEFINITIONS[nodeType as AINodeType];
  const category = def?.category;
  
  switch (category) {
    case "image":
      return <Image className="w-3 h-3" />;
    case "video":
      return <Film className="w-3 h-3" />;
    case "audio":
      return <Volume2 className="w-3 h-3" />;
    case "llm":
      return <Brain className="w-3 h-3" />;
    case "utility":
      return <Wrench className="w-3 h-3" />;
    default:
      return <Zap className="w-3 h-3" />;
  }
}

// Get category color
function getNodeColor(nodeType: string): string {
  const def = NODE_DEFINITIONS[nodeType as AINodeType];
  const color = def?.color;
  
  switch (color) {
    case "emerald":
      return "text-emerald-400 bg-emerald-500/15";
    case "violet":
      return "text-violet-400 bg-violet-500/15";
    case "amber":
      return "text-amber-400 bg-amber-500/15";
    case "blue":
      return "text-blue-400 bg-blue-500/15";
    default:
      return "text-zinc-400 bg-zinc-500/15";
  }
}

// Status config with icons, labels, and glow effects
const statusStyles = {
  PENDING: { 
    icon: <Clock className="w-3.5 h-3.5" />, 
    color: "text-zinc-400", 
    bg: "bg-zinc-500/20",
    border: "border-zinc-500/30",
    label: "Pending",
    glow: "",
    dotColor: "bg-zinc-400",
  },
  QUEUED: { 
    icon: <Clock className="w-3.5 h-3.5" />, 
    color: "text-zinc-400", 
    bg: "bg-zinc-500/20",
    border: "border-zinc-500/30",
    label: "Queued",
    glow: "",
    dotColor: "bg-zinc-400",
  },
  RUNNING: { 
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, 
    color: "text-cyan-400", 
    bg: "bg-cyan-500/20",
    border: "border-cyan-500/30",
    label: "Running",
    glow: "shadow-[0_0_12px_rgba(34,211,238,0.5)]",
    dotColor: "bg-cyan-400 animate-pulse",
  },
  WAITING: { 
    icon: <Pause className="w-3.5 h-3.5" />, 
    color: "text-amber-400", 
    bg: "bg-amber-500/20",
    border: "border-amber-500/30",
    label: "Waiting",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.4)]",
    dotColor: "bg-amber-400 animate-pulse",
  },
  COMPLETED: { 
    icon: <CheckCircle2 className="w-3.5 h-3.5" />, 
    color: "text-emerald-400", 
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
    label: "Completed",
    glow: "shadow-[0_0_8px_rgba(52,211,153,0.3)]",
    dotColor: "bg-emerald-400",
  },
  FAILED: { 
    icon: <XCircle className="w-3.5 h-3.5" />, 
    color: "text-red-400", 
    bg: "bg-red-500/20",
    border: "border-red-500/30",
    label: "Failed",
    glow: "shadow-[0_0_12px_rgba(248,113,113,0.4)]",
    dotColor: "bg-red-400",
  },
  CANCELLED: { 
    icon: <XCircle className="w-3.5 h-3.5" />, 
    color: "text-zinc-500", 
    bg: "bg-zinc-500/20",
    border: "border-zinc-500/30",
    label: "Cancelled",
    glow: "",
    dotColor: "bg-zinc-500",
  },
  TERMINATED: { 
    icon: <AlertCircle className="w-3.5 h-3.5" />, 
    color: "text-zinc-500", 
    bg: "bg-zinc-500/20",
    border: "border-zinc-500/30",
    label: "Terminated",
    glow: "",
    dotColor: "bg-zinc-500",
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
        
        const transformed: ExecutionRecord[] = (triggerData.executions || []).map((exec: any) => ({
          id: exec.id,
          workflowName: exec.workflowName || "Workflow Run",
          status: exec.status?.toUpperCase?.() ?? "PENDING",
          createdAt: exec.createdAt || exec.startedAt || new Date().toISOString(),
          completedAt: exec.completedAt,
          totalCost: exec.totalCost || 0,
          nodeExecutions: (exec.nodeExecutions || []).map((ne: any) => ({
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
          })),
        }));
        
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
      const transformed: ExecutionRecord[] = (data.executions || []).map((exec: any) => ({
        id: exec.id,
        workflowName: exec.workflowName,
        status: exec.status?.toUpperCase?.() ?? "PENDING",
        createdAt: exec.createdAt,
        completedAt: exec.completedAt,
        totalCost: exec.totalCost || 0,
        nodeExecutions: (exec.nodes || exec.nodeExecutions || []).map((ne: any) => ({
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
        })),
      }));
      
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

  // Flatten all node executions from all runs for display
  const allNodeExecutions = executions.flatMap(exec => 
    exec.nodeExecutions.map(node => ({
      ...node,
      executionTime: exec.createdAt,
      workflowStatus: exec.status,
    }))
  );

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
          className="fixed top-16 z-50 w-[340px] bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900 to-zinc-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Activity</h3>
                  <p className="text-[10px] text-zinc-600">Recent runs</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={fetchExecutions}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all"
                >
                  <RotateCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Content - Direct list of nodes with status */}
          <div className="max-h-[55vh] overflow-y-auto p-2">
            {isLoading && allNodeExecutions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                <p className="text-xs text-zinc-500 mt-2">Loading...</p>
              </div>
            ) : allNodeExecutions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3">
                  <Inbox className="w-5 h-5 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-400">No runs yet</p>
                <p className="text-xs text-zinc-600 mt-1">Run a workflow to see history</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {allNodeExecutions.map((node, index) => {
                  const status = statusStyles[node.status as keyof typeof statusStyles] || statusStyles.PENDING;
                  const nodeColor = getNodeColor(node.nodeType);
                  const displayName = getNodeDisplayName(node);
                  const def = NODE_DEFINITIONS[node.nodeType as AINodeType];
                  const provider = node.providerUsed || def?.provider || "—";
                  
                  return (
                    <motion.button
                      key={`${node.id}-${index}`}
                      onClick={() => handleNodeClick(node.nodeType, node.nodeId)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl transition-all group",
                        "bg-zinc-900/60 hover:bg-zinc-800/80",
                        "border hover:border-zinc-700/60",
                        status.border
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Status Icon with Glow */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-shadow",
                          status.bg,
                          status.glow
                        )}>
                          <div className={status.color}>{status.icon}</div>
                        </div>

                        {/* Node Info */}
                        <div className="flex-1 min-w-0">
                          {/* Node Name - PRIMARY */}
                          <div className="flex items-center gap-2">
                            <div className={cn("w-4 h-4 rounded flex items-center justify-center", nodeColor)}>
                              {getNodeIcon(node.nodeType)}
                            </div>
                            <span className="text-sm font-medium text-zinc-100 truncate">
                              {displayName}
                            </span>
                          </div>
                          
                          {/* Provider + Duration */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-violet-400 font-medium bg-violet-500/10 px-1.5 py-0.5 rounded">
                              {provider}
                            </span>
                            {node.startedAt && (
                              <span className="text-[10px] text-zinc-500">
                                {formatDuration(node.startedAt, node.completedAt)}
                              </span>
                            )}
                            {node.actualCost !== undefined && node.actualCost > 0 && (
                              <span className="text-[10px] text-amber-400/70 flex items-center gap-0.5">
                                <Coins className="w-2.5 h-2.5" />
                                {node.actualCost}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Label with Glow */}
                        <div className="shrink-0 text-right">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            status.bg,
                            status.glow
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", status.dotColor)} />
                            <span className={status.color}>{status.label}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <Target className="w-3 h-3 text-zinc-500" />
                            <span className="text-[9px] text-zinc-500">Focus</span>
                          </div>
                        </div>
                      </div>

                      {/* Error */}
                      {node.error && (
                        <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-[10px] text-red-400 line-clamp-2">{node.error}</p>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-zinc-800/80 bg-zinc-900/50">
            <p className="text-[10px] text-zinc-600 flex items-center justify-center gap-1.5">
              <Target className="w-3 h-3" />
              Click any node to focus on canvas
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ExecutionHistoryPanel;
