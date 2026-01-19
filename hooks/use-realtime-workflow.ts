"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import type { Node, Edge } from "reactflow";

// =============================================================================
// REALTIME WORKFLOW HOOK - Uses Trigger.dev React hooks for real-time updates
// =============================================================================
// This bypasses Vercel's SSE buffering by subscribing directly to Trigger.dev
// from the client side.
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

interface TriggerWorkflowResponse {
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
  
  // Track which events we've already processed to avoid duplicates
  const processedEvents = useRef<Set<string>>(new Set());

  // Subscribe to the Trigger.dev run using their React hook
  // This connects DIRECTLY to Trigger.dev, bypassing our Vercel serverless function
  const { run, error: realtimeError } = useRealtimeRun(triggerRunId ?? undefined, {
    accessToken: publicToken ?? undefined,
    enabled: Boolean(triggerRunId && publicToken),
  });

  // Process run updates from Trigger.dev
  useEffect(() => {
    if (!run || !isRunning) return;

    console.log(`[RealtimeWorkflow] Run update: status=${run.status}`);

    // Process metadata for node updates
    const metadata = run.metadata as Record<string, unknown> | undefined;
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        // Node status keys are like "node:nodeId"
        if (key.startsWith("node:")) {
          const nodeId = key.replace("node:", "");
          const nodeStatus = value as NodeStatusFromMetadata;
          const eventKey = `${nodeId}-${nodeStatus.status}-${nodeStatus.timestamp}`;

          // Skip if we've already processed this event
          if (processedEvents.current.has(eventKey)) continue;
          processedEvents.current.add(eventKey);

          console.log(`[RealtimeWorkflow] Node ${nodeId}: ${nodeStatus.status}`);

          if (nodeStatus.status === "queued") {
            callbacks?.onNodeQueued?.(nodeId, nodeStatus.nodeType);
          } else if (nodeStatus.status === "started") {
            callbacks?.onNodeStarted?.(nodeId, nodeStatus.nodeType);
          } else if (nodeStatus.status === "completed") {
            callbacks?.onNodeCompleted?.(nodeId, nodeStatus.nodeType, nodeStatus.output);
          } else if (nodeStatus.status === "failed") {
            callbacks?.onNodeFailed?.(nodeId, nodeStatus.nodeType, nodeStatus.error || "Unknown error");
          }
        }

        // Workflow completion status
        if (key === "workflow") {
          const workflowStatus = value as { status: string; successCount: number; failCount: number };
          if (workflowStatus.status === "completed") {
            console.log(`[RealtimeWorkflow] Workflow completed: ${workflowStatus.successCount} succeeded, ${workflowStatus.failCount} failed`);
            callbacks?.onWorkflowCompleted?.({
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
    if (terminalStates.includes(run.status)) {
      console.log(`[RealtimeWorkflow] Run reached terminal state: ${run.status}`);
      
      if (run.status !== "COMPLETED") {
        // Workflow failed
        callbacks?.onWorkflowCompleted?.({
          successCount: 0,
          failCount: 1,
          status: run.status,
          workflowExecutionId: workflowExecutionId ?? undefined,
        });
      }
      
      setIsRunning(false);
    }
  }, [run, isRunning, callbacks, workflowExecutionId]);

  // Handle realtime errors
  useEffect(() => {
    if (realtimeError) {
      console.error("[RealtimeWorkflow] Realtime subscription error:", realtimeError);
      // Don't stop - we'll fall back to polling in the page component
    }
  }, [realtimeError]);

  // Trigger the workflow and get the run ID + public token
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
    processedEvents.current.clear();

    try {
      // Call API to trigger workflow and get realtime credentials
      const response = await fetch("/api/workflow/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: effectiveWorkflowId, nodes, edges }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error: ${response.status}`);
      }

      const data: TriggerWorkflowResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to trigger workflow");
      }

      console.log("[RealtimeWorkflow] Workflow triggered:", {
        workflowExecutionId: data.workflowExecutionId,
        triggerRunId: data.triggerRunId,
        hasToken: Boolean(data.publicToken),
      });

      // Store the run info
      setWorkflowExecutionId(data.workflowExecutionId ?? null);
      setTriggerRunId(data.triggerRunId ?? null);
      setPublicToken(data.publicToken ?? null);

      // Notify that workflow started
      callbacks?.onWorkflowStarted?.({
        workflowExecutionId: data.workflowExecutionId!,
        triggerRunId: data.triggerRunId!,
        estimatedCost: data.estimatedCost ?? 0,
      });

      // Mark all nodes as queued initially
      for (const node of nodes) {
        callbacks?.onNodeQueued?.(node.id, node.type ?? "unknown");
      }

    } catch (error) {
      console.error("[RealtimeWorkflow] Error:", error);
      callbacks?.onError?.(error instanceof Error ? error.message : "Unknown error");
      setIsRunning(false);
    }
  }, [workflowId, isRunning, callbacks]);

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
