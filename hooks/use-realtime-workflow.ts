"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRealtimeTaskTrigger } from "@trigger.dev/react-hooks";
import type { Node, Edge } from "reactflow";
import type { executeWorkflow } from "@/app/trigger/workflow-executor";

// =============================================================================
// REALTIME WORKFLOW HOOK - Direct frontend trigger
// =============================================================================
// Uses useRealtimeTaskTrigger to trigger the workflow directly from the frontend.
// This should properly receive metadata updates since the subscription is
// established at the moment of triggering.
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

interface PrepareResponse {
  success: boolean;
  triggerToken?: string;
  workflowExecutionId?: string;
  workflowId?: string;
  userId?: string;
  processedNodes?: Node[];
  edges?: Edge[];
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
  const [triggerToken, setTriggerToken] = useState<string | null>(null);
  const [workflowExecutionId, setWorkflowExecutionId] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<Parameters<typeof executeWorkflow.trigger>[0] | null>(null);
  const [estimatedCost, setEstimatedCost] = useState(0);
  
  // Track processed events
  const processedNodeStatuses = useRef<Map<string, string>>(new Map());
  const workflowCompleted = useRef(false);
  const hasSubmitted = useRef(false);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Use Trigger.dev's useRealtimeTaskTrigger - triggers AND subscribes in one step
  const { 
    submit, 
    run, 
    error: triggerError, 
    isLoading 
  } = useRealtimeTaskTrigger<typeof executeWorkflow>("execute-workflow", {
    accessToken: triggerToken ?? undefined,
  });

  // Submit the task when we have a token and payload
  useEffect(() => {
    if (triggerToken && pendingPayload && !run && !isLoading && !hasSubmitted.current) {
      console.log("[RealtimeWorkflow] Submitting task via useRealtimeTaskTrigger");
      hasSubmitted.current = true;
      submit(pendingPayload);
    }
  }, [triggerToken, pendingPayload, run, isLoading, submit]);

  // Notify when we get a run (task triggered successfully)
  useEffect(() => {
    if (run && workflowExecutionId && !workflowCompleted.current) {
      console.log("[RealtimeWorkflow] Task triggered, run:", run.id);
      
      // Update the workflow execution with the trigger run ID
      fetch(`/api/workflow-executions/${workflowExecutionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerRunId: run.id }),
      }).catch(() => {});
      
      callbacksRef.current?.onWorkflowStarted?.({
        workflowExecutionId,
        triggerRunId: run.id,
        estimatedCost,
      });
    }
  }, [run, workflowExecutionId, estimatedCost]);

  // Process run updates - check both metadata AND output
  useEffect(() => {
    if (!run || !isRunning) return;

    console.log(`[RealtimeWorkflow] Run update: status=${run.status}`);
    console.log(`[RealtimeWorkflow] Metadata keys:`, Object.keys(run.metadata || {}));
    
    // Process metadata for node updates
    const metadata = run.metadata as Record<string, unknown> | undefined;
    if (metadata && Object.keys(metadata).length > 0) {
      console.log("[RealtimeWorkflow] Processing metadata:", metadata);
      
      for (const [key, value] of Object.entries(metadata)) {
        if (key.startsWith("node:")) {
          const nodeId = key.replace("node:", "");
          const nodeStatus = value as NodeStatusFromMetadata;
          
          const previousStatus = processedNodeStatuses.current.get(nodeId);
          if (previousStatus === nodeStatus.status) continue;
          
          processedNodeStatuses.current.set(nodeId, nodeStatus.status);
          console.log(`[RealtimeWorkflow] Node ${nodeId}: ${previousStatus ?? 'none'} → ${nodeStatus.status}`);

          if (nodeStatus.status === "started") {
            callbacksRef.current?.onNodeStarted?.(nodeId, nodeStatus.nodeType);
          } else if (nodeStatus.status === "completed") {
            callbacksRef.current?.onNodeCompleted?.(nodeId, nodeStatus.nodeType, nodeStatus.output);
          } else if (nodeStatus.status === "failed") {
            callbacksRef.current?.onNodeFailed?.(nodeId, nodeStatus.nodeType, nodeStatus.error || "Unknown error");
          }
        }

        if (key === "workflow") {
          const workflowStatus = value as { status: string; successCount: number; failCount: number };
          if (workflowStatus.status === "completed" && !workflowCompleted.current) {
            workflowCompleted.current = true;
            console.log(`[RealtimeWorkflow] Workflow completed: ${workflowStatus.successCount} succeeded, ${workflowStatus.failCount} failed`);
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
    }

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
  }, [run, isRunning, workflowExecutionId]);

  // Fallback polling if metadata is empty after 3 seconds
  useEffect(() => {
    if (!isRunning || !workflowExecutionId || !run) return;
    
    // Wait 3 seconds to see if metadata comes through
    const timeoutId = setTimeout(() => {
      const metadataKeys = Object.keys(run.metadata || {});
      if (metadataKeys.length === 0 && !workflowCompleted.current) {
        console.log("[RealtimeWorkflow] No metadata after 3s, starting fallback polling");
        startFallbackPolling();
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
    
    function startFallbackPolling() {
      const pollInterval = setInterval(async () => {
        if (workflowCompleted.current) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const response = await fetch(`/api/workflow-executions/${workflowExecutionId}`);
          if (!response.ok) return;

          const data = await response.json();
          const execution = data.execution;
          if (!execution) return;

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

            if (status === "running") {
              callbacksRef.current?.onNodeStarted?.(ne.nodeId, ne.nodeType);
            } else if (status === "completed") {
              callbacksRef.current?.onNodeCompleted?.(ne.nodeId, ne.nodeType, ne.outputJson);
            } else if (status === "failed") {
              callbacksRef.current?.onNodeFailed?.(ne.nodeId, ne.nodeType, ne.error || "Unknown error");
            }
          }

          const workflowStatus = execution.status?.toUpperCase();
          if ((workflowStatus === "COMPLETED" || workflowStatus === "FAILED") && !workflowCompleted.current) {
            workflowCompleted.current = true;
            clearInterval(pollInterval);
            
            const nodeExecutions = execution.nodeExecutions || [];
            const successCount = nodeExecutions.filter((ne: { status: string }) => 
              ne.status?.toUpperCase() === "COMPLETED"
            ).length;
            const failCount = nodeExecutions.filter((ne: { status: string }) => 
              ne.status?.toUpperCase() === "FAILED"
            ).length;
            
            callbacksRef.current?.onWorkflowCompleted?.({
              successCount,
              failCount,
              status: workflowStatus,
              workflowExecutionId: workflowExecutionId ?? undefined,
            });
            
            setIsRunning(false);
          }
        } catch (error) {
          console.error("[RealtimeWorkflow] Fallback poll error:", error);
        }
      }, 500);

      return () => clearInterval(pollInterval);
    }
  }, [isRunning, workflowExecutionId, run]);

  // Handle trigger errors
  useEffect(() => {
    if (triggerError && isRunning) {
      console.error("[RealtimeWorkflow] Trigger error:", triggerError);
      callbacksRef.current?.onError?.(triggerError.message || "Failed to trigger workflow");
      setIsRunning(false);
    }
  }, [triggerError, isRunning]);

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
    setTriggerToken(null);
    setWorkflowExecutionId(null);
    setPendingPayload(null);
    setEstimatedCost(0);
    processedNodeStatuses.current.clear();
    workflowCompleted.current = false;
    hasSubmitted.current = false;

    // Mark all nodes as queued initially
    for (const node of nodes) {
      callbacksRef.current?.onNodeQueued?.(node.id, node.type ?? "unknown");
    }

    try {
      // Prepare workflow - this preprocesses nodes and creates a trigger token
      const response = await fetch("/api/workflow/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: effectiveWorkflowId, nodes, edges }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error: ${response.status}`);
      }

      const data: PrepareResponse = await response.json();

      if (!data.success || !data.triggerToken) {
        throw new Error(data.error || "Failed to prepare workflow");
      }

      console.log("[RealtimeWorkflow] Workflow prepared, executionId:", data.workflowExecutionId);

      // Store execution ID and cost
      setWorkflowExecutionId(data.workflowExecutionId ?? null);
      setEstimatedCost(data.estimatedCost ?? 0);

      // Set up the task payload
      setPendingPayload({
        workflowExecutionId: data.workflowExecutionId!,
        workflowId: data.workflowId!,
        userId: data.userId!,
        nodes: data.processedNodes!,
        edges: data.edges!,
      });

      // Set the trigger token - this enables the useRealtimeTaskTrigger hook
      setTriggerToken(data.triggerToken);

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
    setTriggerToken(null);
    setPendingPayload(null);
    hasSubmitted.current = false;
  }, [workflowExecutionId]);

  return {
    runWorkflow,
    cancelWorkflow,
    isRunning: isRunning || isLoading,
    workflowExecutionId,
    triggerRunId: run?.id ?? null,
  };
}
