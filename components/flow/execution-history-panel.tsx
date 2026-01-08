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
  providerUsed?: string;
  error?: string;
}

interface ExecutionRecord {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  createdAt: string;
  nodeExecutions: NodeExecutionRecord[];
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// Check if an execution is stuck (running for more than 5 minutes)
function isStuckExecution(status: string, createdAt: string): boolean {
  if (status !== "RUNNING" && status !== "PENDING" && status !== "QUEUED") return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const fiveMinutes = 5 * 60 * 1000;
  return ageMs > fiveMinutes;
}

// Check if any node in the execution failed
function hasFailedNode(nodes: NodeExecutionRecord[]): boolean {
  return nodes.some(n => n.status === "FAILED" || !!n.error);
}

// Get effective status (treating stuck executions as terminated, and detecting hidden failures)
function getEffectiveStatus(status: string, createdAt: string, nodes: NodeExecutionRecord[]): string {
  // If any node failed but execution shows as running, it's actually failed
  if ((status === "RUNNING" || status === "PENDING") && hasFailedNode(nodes)) {
    return "FAILED";
  }
  // If stuck for too long, treat as terminated
  if (isStuckExecution(status, createdAt)) {
    return "TERMINATED";
  }
  return status;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface ExecutionHistoryPanelProps {
  workflowId?: string;
  isOpen: boolean;
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
}

export function ExecutionHistoryPanel({ 
  workflowId, 
  isOpen, 
  onClose,
  onNodeClick 
}: ExecutionHistoryPanelProps) {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchExecutions = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    
    try {
      // Fetch directly from Trigger.dev for real-time accurate status
      const triggerResponse = await fetch(`/api/trigger-runs?limit=15`);
      
      if (triggerResponse.ok) {
        const triggerData = await triggerResponse.json();
        
        const transformed: ExecutionRecord[] = (triggerData.executions || []).map((exec: any) => ({
          id: exec.id,
          status: exec.status?.toUpperCase?.() ?? "PENDING",
          createdAt: exec.createdAt || exec.startedAt || new Date().toISOString(),
          nodeExecutions: (exec.nodeExecutions || []).map((ne: any) => ({
            id: ne.id || exec.id,
            nodeId: ne.nodeId || ne.id || exec.id,
            nodeLabel: ne.nodeLabel || ne.nodeType || exec.taskIdentifier || "Node",
            nodeType: ne.nodeType || exec.taskIdentifier,
            status: ne.status?.toUpperCase?.() ?? exec.status?.toUpperCase?.() ?? "PENDING",
            providerUsed: ne.providerUsed || ne.provider,
            error: ne.error || exec.error,
          })),
        }));
        
        // If no node executions from Trigger, create one from the run itself
        const withNodes = transformed.map(exec => {
          if (exec.nodeExecutions.length === 0) {
            return {
              ...exec,
              nodeExecutions: [{
                id: exec.id,
                nodeId: exec.id,
                nodeLabel: (exec as any).taskIdentifier || "Workflow",
                nodeType: (exec as any).taskIdentifier || "workflow",
                status: exec.status,
                providerUsed: undefined,
                error: (exec as any).error,
              }],
            };
          }
          return exec;
        });
        
        setExecutions(withNodes);
        return;
      }
      
      // Fallback to database if Trigger.dev API fails
      const params = new URLSearchParams();
      if (workflowId && workflowId !== "new") params.set("workflowId", workflowId);
      params.set("limit", "10");
      
      const response = await fetch(`/api/executions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch");
      
      const data = await response.json();
      const transformed: ExecutionRecord[] = (data.executions || []).map((exec: any) => ({
        id: exec.id,
        status: exec.status?.toUpperCase?.() ?? "PENDING",
        createdAt: exec.createdAt,
        nodeExecutions: (exec.nodes || exec.nodeExecutions || []).map((ne: any) => ({
          id: ne.id,
          nodeId: ne.nodeId || ne.id,
          nodeLabel: ne.label || ne.nodeLabel || ne.nodeType || "Node",
          nodeType: ne.nodeType,
          status: ne.status?.toUpperCase?.() ?? "PENDING",
          providerUsed: ne.provider || ne.providerUsed,
          error: ne.error,
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

  const handleNodeClick = (nodeId: string) => {
    onNodeClick?.(nodeId);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{ duration: 0.15 }}
          className="fixed right-3 top-16 z-50 w-72 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl"
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Run History</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={fetchExecutions}
                disabled={isLoading}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
              >
                <RotateCcw className={cn("w-3 h-3", isLoading && "animate-spin")} />
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[50vh] overflow-y-auto">
            {isLoading && executions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 text-zinc-600 animate-spin" />
              </div>
            ) : executions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Inbox className="w-5 h-5 text-zinc-700 mb-2" />
                <p className="text-[11px] text-zinc-500">No runs yet</p>
              </div>
            ) : (
              <div className="p-1.5 space-y-1">
                {executions.map((exec) => (
                  <ExecutionRow 
                    key={exec.id}
                    execution={exec} 
                    onNodeClick={handleNodeClick}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-zinc-800 bg-zinc-900/50">
            <p className="text-[9px] text-zinc-600 flex items-center gap-1">
              <Target className="w-2.5 h-2.5" />
              Click node to focus
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// EXECUTION ROW
// =============================================================================

interface ExecutionRowProps {
  execution: ExecutionRecord;
  onNodeClick: (nodeId: string) => void;
}

function ExecutionRow({ execution, onNodeClick }: ExecutionRowProps) {
  const effectiveStatus = getEffectiveStatus(execution.status, execution.createdAt, execution.nodeExecutions);
  const isCompleted = effectiveStatus === "COMPLETED";
  const isFailed = effectiveStatus === "FAILED";
  const isRunning = effectiveStatus === "RUNNING";
  const isTerminated = effectiveStatus === "TERMINATED";

  return (
    <div className="rounded-lg bg-zinc-800/40 p-2">
      {/* Status Row */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
        {isFailed && <XCircle className="w-3 h-3 text-red-500" />}
        {isTerminated && <XCircle className="w-3 h-3 text-zinc-500" />}
        {isRunning && <Loader2 className="w-3 h-3 text-cyan-500 animate-spin" />}
        {!isCompleted && !isFailed && !isRunning && !isTerminated && <Clock className="w-3 h-3 text-zinc-500" />}
        
        <span className={cn(
          "text-[10px] font-medium",
          isCompleted && "text-emerald-500",
          isFailed && "text-red-500",
          isTerminated && "text-zinc-500",
          isRunning && "text-cyan-500",
          !isCompleted && !isFailed && !isRunning && !isTerminated && "text-zinc-500"
        )}>
          {isTerminated ? "Terminated" : effectiveStatus.charAt(0) + effectiveStatus.slice(1).toLowerCase()}
        </span>
        
        <span className="text-[9px] text-zinc-600 ml-auto">
          {formatTimeAgo(execution.createdAt)}
        </span>
      </div>

      {/* Nodes - compact list */}
      <div className="flex flex-wrap gap-1">
        {execution.nodeExecutions.map((node, index) => {
          // Apply same stuck detection to nodes
          const nodeEffectiveStatus = isTerminated ? "TERMINATED" : node.status;
          const isNodeDone = nodeEffectiveStatus === "COMPLETED";
          const isNodeFailed = !!node.error || nodeEffectiveStatus === "FAILED";
          const isNodeRunning = nodeEffectiveStatus === "RUNNING" && !isTerminated;
          const isNodeTerminated = nodeEffectiveStatus === "TERMINATED" || 
            (node.status === "RUNNING" && isTerminated);
          
          // Pass nodeType with index for better matching
          const clickId = `${node.nodeType || 'node'}:${index}`;
          
          return (
            <button
              key={node.id}
              onClick={() => onNodeClick(clickId)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
                "hover:ring-1 hover:ring-white/20",
                // States
                isNodeDone && "bg-emerald-500/15 text-emerald-400",
                isNodeFailed && "bg-red-500/15 text-red-400",
                isNodeRunning && "bg-cyan-500/15 text-cyan-400",
                isNodeTerminated && "bg-zinc-700/30 text-zinc-500",
                !isNodeDone && !isNodeFailed && !isNodeRunning && !isNodeTerminated && "bg-zinc-700/50 text-zinc-400"
              )}
            >
              {node.providerUsed || node.nodeLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ExecutionHistoryPanel;
