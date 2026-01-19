"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import type { Node, Edge } from "reactflow";

// =============================================================================
// REALTIME WORKFLOW HOOK - Fast polling for production reliability
// =============================================================================
// This hook triggers workflows and provides real-time updates via fast polling.
// It's designed to work reliably on Vercel without SSE buffering issues.
// =============================================================================

export type NodeStatus = "queued" | "running" | "completed" | "failed";

export interface NodeStatusUpdate {
  nodeId: string;
  status: NodeStatus;
  nodeType?: string;
  output?: unknown;
  error?: string;
  progress?: number;
}

export interface RealtimeWorkflowCallbacks {
  onWorkflowStarted?: (data: { workflowExecutionId: string; triggerRunId: string; estimatedCost: number }) => void;
  onNodeQueued?: (nodeId: string, nodeType: string) => void;
  onNodeStarted?: (nodeId: string, nodeType: string) => void;
  onNodeProgress?: (nodeId: string, progress: number) => void;
  onNodeCompleted?: (nodeId: string, nodeType: string, output: unknown) => void;
  onNodeFailed?: (nodeId: string, nodeType: string, error: string) => void;
  onWorkflowCompleted?: (data: { successCount: number; failCount: number; status: string; workflowExecutionId?: string }) => void;
  onError?: (error: string) => void;
}

interface TriggerResponse {
  success: boolean;
  workflowExecutionId?: string;
  triggerRunId?: string;
  estimatedCost?: number;
  error?: string;
}

interface NodeExecution {
  nodeId: string;
  nodeType: string;
  status: string;
  error?: string;
  outputJson?: unknown;
}

interface WorkflowExecution {
  id: string;
  status: string;
  nodeExecutions: NodeExecution[];
}

export function useRealtimeWorkflow(workflowId: string, callbacks?: RealtimeWorkflowCallbacks) {
  const [isRunning, setIsRunning] = useState(false);
  const [workflowExecutionId, setWorkflowExecutionId] = useState<string | null>(null);
  const [triggerRunId, setTriggerRunId] = useState<string | null>(null);
  
  // Track processed events and previous statuses to detect changes
  const previousStatuses = useRef<Map<string, string>>(new Map());
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Poll for execution status updates
  useEffect(() => {
    if (!isRunning || !workflowExecutionId) return;

    let isCancelled = false;
    const pollInterval = 500; // Poll every 500ms for fast updates

    const pollStatus = async () => {
      if (isCancelled) return;

      try {
        const response = await fetch(`/api/workflow-executions/${workflowExecutionId}`);
        if (!response.ok) return;

        const data = await response.json();
        const execution: WorkflowExecution = data.execution;

        if (!execution) return;

        // Process node updates
        for (const ne of execution.nodeExecutions) {
          const prevStatus = previousStatuses.current.get(ne.nodeId);
          const newStatus = ne.status.toLowerCase();

          // Skip if status hasn't changed
          if (prevStatus === newStatus) continue;
          previousStatuses.current.set(ne.nodeId, newStatus);

          console.log(`[RealtimeWorkflow] Node ${ne.nodeId}: ${prevStatus ?? 'none'} → ${newStatus}`);

          if (newStatus === "running" || newStatus === "waiting") {
            callbacksRef.current?.onNodeStarted?.(ne.nodeId, ne.nodeType);
          } else if (newStatus === "completed") {
            callbacksRef.current?.onNodeCompleted?.(ne.nodeId, ne.nodeType, ne.outputJson);
          } else if (newStatus === "failed") {
            callbacksRef.current?.onNodeFailed?.(ne.nodeId, ne.nodeType, ne.error || "Unknown error");
          }
        }

        // Check workflow status
        const workflowStatus = execution.status.toUpperCase();
        if (workflowStatus === "COMPLETED" || workflowStatus === "FAILED") {
          const successCount = execution.nodeExecutions.filter(ne => ne.status.toUpperCase() === "COMPLETED").length;
          const failCount = execution.nodeExecutions.filter(ne => ne.status.toUpperCase() === "FAILED").length;

          console.log(`[RealtimeWorkflow] Workflow ${workflowStatus}: ${successCount} succeeded, ${failCount} failed`);

          callbacksRef.current?.onWorkflowCompleted?.({
            successCount,
            failCount,
            status: workflowStatus,
            workflowExecutionId,
          });

          setIsRunning(false);
        }
      } catch (error) {
        console.error("[RealtimeWorkflow] Poll error:", error);
      }

      // Schedule next poll if still running
      if (!isCancelled && isRunning) {
        setTimeout(pollStatus, pollInterval);
      }
    };

    // Start polling
    pollStatus();

    return () => {
      isCancelled = true;
    };
  }, [isRunning, workflowExecutionId]);

  // Trigger the workflow
  const runWorkflow = useCallback(async (nodes: Node[], edges: Edge[], overrideWorkflowId?: string) => {
    if (isRunning) {
      console.warn("[RealtimeWorkflow] Workflow already running");
      return;
    }

    const effectiveWorkflowId = overrideWorkflowId || workflowId;
    console.log("[RealtimeWorkflow] Starting workflow:", effectiveWorkflowId);

    // Reset state
    setIsRunning(true);
    setWorkflowExecutionId(null);
    setTriggerRunId(null);
    previousStatuses.current.clear();

    // Mark all nodes as queued initially
    for (const node of nodes) {
      callbacksRef.current?.onNodeQueued?.(node.id, node.type ?? "unknown");
    }

    try {
      // Trigger workflow via API
      const response = await fetch("/api/workflow/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: effectiveWorkflowId, nodes, edges }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error: ${response.status}`);
      }

      const data: TriggerResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to trigger workflow");
      }

      console.log("[RealtimeWorkflow] Workflow triggered:", data.workflowExecutionId);

      setWorkflowExecutionId(data.workflowExecutionId ?? null);
      setTriggerRunId(data.triggerRunId ?? null);

      // Notify that workflow started
      callbacksRef.current?.onWorkflowStarted?.({
        workflowExecutionId: data.workflowExecutionId!,
        triggerRunId: data.triggerRunId!,
        estimatedCost: data.estimatedCost ?? 0,
      });

    } catch (error) {
      console.error("[RealtimeWorkflow] Error:", error);
      callbacksRef.current?.onError?.(error instanceof Error ? error.message : "Unknown error");
      setIsRunning(false);
    }
  }, [workflowId, isRunning]);

  // Cancel the workflow
  const cancelWorkflow = useCallback(async () => {
    if (workflowExecutionId) {
      try {
        await fetch(`/api/executions/${workflowExecutionId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "workflow" }),
        });
      } catch (error) {
        console.error("[RealtimeWorkflow] Error cancelling:", error);
      }
    }
    setIsRunning(false);
  }, [workflowExecutionId]);

  return {
    runWorkflow,
    cancelWorkflow,
    isRunning,
    workflowExecutionId,
    triggerRunId,
  };
}
