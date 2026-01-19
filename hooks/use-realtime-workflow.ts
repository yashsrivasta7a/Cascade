"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import type { Node, Edge } from "reactflow";

// =============================================================================
// REALTIME WORKFLOW HOOK - Fast polling approach
// =============================================================================
// Since Trigger.dev's useRealtimeRun doesn't propagate metadata updates,
// and useRealtimeTaskTrigger requires a token upfront, we use fast polling
// to get node status updates from the database.
//
// This provides near-real-time updates (500ms) while being reliable.
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
  publicToken?: string;
  estimatedCost?: number;
  error?: string;
}

export function useRealtimeWorkflow(workflowId: string, callbacks?: RealtimeWorkflowCallbacks) {
  const [isRunning, setIsRunning] = useState(false);
  const [workflowExecutionId, setWorkflowExecutionId] = useState<string | null>(null);
  const [triggerRunId, setTriggerRunId] = useState<string | null>(null);
  
  // Track node statuses to detect changes
  const processedNodeStatuses = useRef<Map<string, string>>(new Map());
  const workflowCompleted = useRef(false);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Fast polling for node status updates
  useEffect(() => {
    if (!isRunning || !workflowExecutionId) return;

    let isCancelled = false;
    const POLL_INTERVAL = 500; // 500ms for responsive updates

    const pollNodeStatuses = async () => {
      if (isCancelled || workflowCompleted.current) return;

      try {
        const response = await fetch(`/api/workflow-executions/${workflowExecutionId}`);
        if (!response.ok) {
          if (!isCancelled) setTimeout(pollNodeStatuses, POLL_INTERVAL);
          return;
        }

        const data = await response.json();
        const execution = data.execution;
        if (!execution) {
          if (!isCancelled) setTimeout(pollNodeStatuses, POLL_INTERVAL);
          return;
        }

        // Process node status updates
        for (const ne of execution.nodeExecutions || []) {
          const dbStatus = ne.status?.toUpperCase();
          let status: string;
          
          switch (dbStatus) {
            case "RUNNING":
            case "WAITING":
              status = "running";
              break;
            case "COMPLETED":
              status = "completed";
              break;
            case "FAILED":
              status = "failed";
              break;
            default:
              status = "queued";
          }

          const previousStatus = processedNodeStatuses.current.get(ne.nodeId);
          if (previousStatus === status) continue;
          
          processedNodeStatuses.current.set(ne.nodeId, status);
          console.log(`[RealtimeWorkflow] Node ${ne.nodeId}: ${previousStatus ?? 'queued'} → ${status}`);

          if (status === "running") {
            callbacksRef.current?.onNodeStarted?.(ne.nodeId, ne.nodeType);
          } else if (status === "completed") {
            callbacksRef.current?.onNodeCompleted?.(ne.nodeId, ne.nodeType, ne.outputJson);
          } else if (status === "failed") {
            callbacksRef.current?.onNodeFailed?.(ne.nodeId, ne.nodeType, ne.error || "Unknown error");
          }
        }

        // Check workflow completion
        const workflowStatus = execution.status?.toUpperCase();
        if ((workflowStatus === "COMPLETED" || workflowStatus === "FAILED") && !workflowCompleted.current) {
          workflowCompleted.current = true;
          
          const nodeExecutions = execution.nodeExecutions || [];
          const successCount = nodeExecutions.filter((ne: { status: string }) => 
            ne.status?.toUpperCase() === "COMPLETED"
          ).length;
          const failCount = nodeExecutions.filter((ne: { status: string }) => 
            ne.status?.toUpperCase() === "FAILED"
          ).length;

          console.log(`[RealtimeWorkflow] Workflow ${workflowStatus}: ${successCount} succeeded, ${failCount} failed`);
          
          callbacksRef.current?.onWorkflowCompleted?.({
            successCount,
            failCount,
            status: workflowStatus,
            workflowExecutionId,
          });
          
          setIsRunning(false);
          return; // Stop polling
        }

        // Continue polling
        if (!isCancelled && !workflowCompleted.current) {
          setTimeout(pollNodeStatuses, POLL_INTERVAL);
        }
      } catch (error) {
        console.error("[RealtimeWorkflow] Poll error:", error);
        if (!isCancelled && !workflowCompleted.current) {
          setTimeout(pollNodeStatuses, POLL_INTERVAL);
        }
      }
    };

    // Start polling immediately
    pollNodeStatuses();

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
    processedNodeStatuses.current.clear();
    workflowCompleted.current = false;

    // Mark all nodes as queued initially
    for (const node of nodes) {
      callbacksRef.current?.onNodeQueued?.(node.id, node.type ?? "unknown");
    }

    try {
      // Trigger workflow via our API
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

      if (!data.success || !data.triggerRunId) {
        throw new Error(data.error || "Failed to trigger workflow");
      }

      console.log("[RealtimeWorkflow] Workflow triggered:", data.triggerRunId);

      // Store IDs
      setWorkflowExecutionId(data.workflowExecutionId ?? null);
      setTriggerRunId(data.triggerRunId);

      // Notify that workflow started
      callbacksRef.current?.onWorkflowStarted?.({
        workflowExecutionId: data.workflowExecutionId!,
        triggerRunId: data.triggerRunId,
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
    workflowCompleted.current = true;
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
