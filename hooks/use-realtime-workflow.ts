"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import type { Node, Edge } from "reactflow";

// =============================================================================
// REALTIME WORKFLOW HOOK - Uses Trigger.dev React hooks
// =============================================================================
// Triggers workflow via our API, then uses useRealtimeRun to subscribe to
// real-time updates directly from Trigger.dev. This bypasses Vercel's SSE
// buffering by connecting the browser directly to Trigger.dev.
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

interface NodeStatusFromMetadata {
  status: "queued" | "started" | "completed" | "failed";
  nodeType: string;
  nodeLabel?: string;
  output?: unknown;
  error?: string;
  timestamp: number;
}

export function useRealtimeWorkflow(workflowId: string, callbacks?: RealtimeWorkflowCallbacks) {
  const [isRunning, setIsRunning] = useState(false);
  const [triggerRunId, setTriggerRunId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [workflowExecutionId, setWorkflowExecutionId] = useState<string | null>(null);
  
  // Track which events we've already processed (by nodeId, not by timestamp)
  // This prevents duplicates while ensuring we don't miss status changes
  const processedNodeStatuses = useRef<Map<string, string>>(new Map());
  const workflowCompleted = useRef(false);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Subscribe to Trigger.dev run updates using their React hook
  // This connects directly to Trigger.dev, bypassing Vercel
  const { run, error: realtimeError } = useRealtimeRun(triggerRunId ?? undefined, {
    accessToken: publicToken ?? undefined,
    enabled: Boolean(triggerRunId && publicToken),
  });

  // Process metadata updates - called for each run update
  const processMetadata = useCallback((metadata: Record<string, unknown> | undefined) => {
    if (!metadata) return;

    for (const [key, value] of Object.entries(metadata)) {
      // Node status keys are like "node:nodeId"
      if (key.startsWith("node:")) {
        const nodeId = key.replace("node:", "");
        const nodeStatus = value as NodeStatusFromMetadata;
        
        // Check if we've already processed this exact status for this node
        const previousStatus = processedNodeStatuses.current.get(nodeId);
        if (previousStatus === nodeStatus.status) continue;
        
        // Update our tracking
        processedNodeStatuses.current.set(nodeId, nodeStatus.status);

        console.log(`[RealtimeWorkflow] Node ${nodeId}: ${previousStatus ?? 'none'} → ${nodeStatus.status}`);

        if (nodeStatus.status === "queued") {
          callbacksRef.current?.onNodeQueued?.(nodeId, nodeStatus.nodeType);
        } else if (nodeStatus.status === "started") {
          callbacksRef.current?.onNodeStarted?.(nodeId, nodeStatus.nodeType);
        } else if (nodeStatus.status === "completed") {
          callbacksRef.current?.onNodeCompleted?.(nodeId, nodeStatus.nodeType, nodeStatus.output);
        } else if (nodeStatus.status === "failed") {
          callbacksRef.current?.onNodeFailed?.(nodeId, nodeStatus.nodeType, nodeStatus.error || "Unknown error");
        }
      }

      // Workflow completion status
      if (key === "workflow" && !workflowCompleted.current) {
        const workflowStatus = value as { status: string; successCount: number; failCount: number };
        if (workflowStatus.status === "completed") {
          console.log(`[RealtimeWorkflow] Workflow completed: ${workflowStatus.successCount} succeeded, ${workflowStatus.failCount} failed`);
          workflowCompleted.current = true;
          callbacksRef.current?.onWorkflowCompleted?.({
            successCount: workflowStatus.successCount,
            failCount: workflowStatus.failCount,
            status: "COMPLETED",
            workflowExecutionId: workflowExecutionId ?? undefined,
          });
          setIsRunning(false);
        }
      }
    }
  }, [workflowExecutionId]);

  // Process run updates from Trigger.dev realtime
  useEffect(() => {
    if (!run || !isRunning) return;

    console.log(`[RealtimeWorkflow] Run update: status=${run.status}, metadata keys=${Object.keys(run.metadata || {}).length}`);

    // Process all metadata
    processMetadata(run.metadata as Record<string, unknown> | undefined);

    // Check for terminal states
    const terminalStates = ["COMPLETED", "FAILED", "CRASHED", "SYSTEM_FAILURE", "CANCELED", "TIMED_OUT"];
    if (terminalStates.includes(run.status) && !workflowCompleted.current) {
      console.log(`[RealtimeWorkflow] Run reached terminal state: ${run.status}`);
      
      workflowCompleted.current = true;
      callbacksRef.current?.onWorkflowCompleted?.({
        successCount: 0,
        failCount: 1,
        status: run.status,
        workflowExecutionId: workflowExecutionId ?? undefined,
      });
      
      setIsRunning(false);
    }
  }, [run, isRunning, workflowExecutionId, processMetadata]);

  // Handle realtime errors OR missing token - fall back to polling
  useEffect(() => {
    // Fall back to polling if:
    // 1. We're running AND have workflowExecutionId AND triggerRunId (API returned), AND
    // 2. Either there's a realtime error OR no public token (token creation failed on server)
    const apiReturned = isRunning && workflowExecutionId && triggerRunId;
    const needsFallback = apiReturned && (realtimeError || !publicToken);
    
    if (!needsFallback) return;
    
    console.log("[RealtimeWorkflow] Starting fallback polling", { 
      realtimeError: !!realtimeError, 
      publicToken: !!publicToken,
      triggerRunId
    });
    
    // Start polling as fallback
    const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/workflow-executions/${workflowExecutionId}`);
          if (!response.ok) return;
          
          const data = await response.json();
          const execution = data.execution;
          if (!execution) return;

          // Process node statuses
          for (const ne of execution.nodeExecutions || []) {
            const status = ne.status?.toLowerCase();
            const previousStatus = processedNodeStatuses.current.get(ne.nodeId);
            
            if (previousStatus === status) continue;
            processedNodeStatuses.current.set(ne.nodeId, status);

            if (status === "running" || status === "waiting") {
              callbacksRef.current?.onNodeStarted?.(ne.nodeId, ne.nodeType);
            } else if (status === "completed") {
              callbacksRef.current?.onNodeCompleted?.(ne.nodeId, ne.nodeType, ne.outputJson);
            } else if (status === "failed") {
              callbacksRef.current?.onNodeFailed?.(ne.nodeId, ne.nodeType, ne.error || "Unknown error");
            }
          }

          // Check workflow status
          if ((execution.status === "COMPLETED" || execution.status === "FAILED") && !workflowCompleted.current) {
            workflowCompleted.current = true;
            const successCount = (execution.nodeExecutions || []).filter((ne: { status: string }) => ne.status === "COMPLETED").length;
            const failCount = (execution.nodeExecutions || []).filter((ne: { status: string }) => ne.status === "FAILED").length;
            
            callbacksRef.current?.onWorkflowCompleted?.({
              successCount,
              failCount,
              status: execution.status,
              workflowExecutionId,
            });
            setIsRunning(false);
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error("[RealtimeWorkflow] Fallback poll error:", error);
        }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [realtimeError, isRunning, workflowExecutionId, triggerRunId, publicToken]);

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
    setTriggerRunId(null);
    setPublicToken(null);
    setWorkflowExecutionId(null);
    processedNodeStatuses.current.clear();
    workflowCompleted.current = false;

    // Mark all nodes as queued initially
    for (const node of nodes) {
      callbacksRef.current?.onNodeQueued?.(node.id, node.type ?? "unknown");
    }

    try {
      // Trigger workflow via our API - this starts the Trigger.dev task
      // and returns the run ID + public token for realtime subscription
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

      if (!data.success || !data.triggerRunId || !data.publicToken) {
        throw new Error(data.error || "Failed to trigger workflow");
      }

      console.log("[RealtimeWorkflow] Workflow triggered, runId:", data.triggerRunId);

      // Store IDs for subscription
      setWorkflowExecutionId(data.workflowExecutionId ?? null);
      setTriggerRunId(data.triggerRunId);
      setPublicToken(data.publicToken);

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
    setIsRunning(false);
    setTriggerRunId(null);
    setPublicToken(null);
  }, [workflowExecutionId]);

  return {
    runWorkflow,
    cancelWorkflow,
    isRunning,
    workflowExecutionId,
    triggerRunId,
  };
}
