"use client";

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import type { Node, Edge } from "reactflow";

// =============================================================================
// REALTIME WORKFLOW HOOK V2 - Using Trigger.dev Realtime API with metadata
// =============================================================================
// This hook uses Trigger.dev's Realtime API to subscribe to run updates.
// The task uses metadata.set() to update node statuses, and this hook
// reads from run.metadata to get real-time updates.
//
// Key features:
// - Direct WebSocket connection from browser to Trigger.dev
// - No polling, no serverless buffering issues
// - Bypasses Vercel entirely for realtime updates
// =============================================================================

export type NodeStatus = "queued" | "running" | "completed" | "failed";

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

// Metadata structure from the workflow executor
interface NodeStatusMetadata {
  status: "queued" | "started" | "completed" | "failed";
  nodeType: string;
  nodeLabel?: string;
  output?: unknown;
  error?: string;
  timestamp: number;
}

interface WorkflowMetadata {
  status?: string;
  successCount?: number;
  failCount?: number;
  finalStatus?: string;
  timestamp?: number;
}

// Inner component that handles the realtime subscription
// This is needed because useRealtimeRun requires accessToken immediately
function RealtimeSubscriber({
  triggerRunId,
  publicToken,
  workflowExecutionId,
  callbacks,
  onComplete,
}: {
  triggerRunId: string;
  publicToken: string;
  workflowExecutionId: string;
  callbacks: React.MutableRefObject<RealtimeWorkflowCallbacks | undefined>;
  onComplete: () => void;
}) {
  const processedStatuses = useRef<Map<string, string>>(new Map());
  const hasCompleted = useRef(false);

  // Subscribe to the run using useRealtimeRun
  const { run, error } = useRealtimeRun(triggerRunId, {
    accessToken: publicToken,
  });

  // Process metadata updates
  useEffect(() => {
    if (!run) return;

    const metadata = run.metadata as Record<string, unknown> | undefined;
    
    console.log(`[RealtimeSubscriber] Run status: ${run.status}, metadata keys: ${metadata ? Object.keys(metadata).length : 0}`);
    
    if (metadata) {
      console.log(`[RealtimeSubscriber] Metadata:`, JSON.stringify(metadata, null, 2));
    }

    // Process node status updates from metadata
    // Metadata keys are like "node:abc123" with value { status, nodeType, output, error, timestamp }
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (key.startsWith("node:") && value && typeof value === "object") {
          const nodeId = key.replace("node:", "");
          const nodeStatus = value as NodeStatusMetadata;
          
          // Check if status changed
          const previousStatus = processedStatuses.current.get(nodeId);
          if (previousStatus === nodeStatus.status) continue;
          processedStatuses.current.set(nodeId, nodeStatus.status);

          console.log(`[RealtimeSubscriber] Node ${nodeId}: ${previousStatus} -> ${nodeStatus.status}`);

          if (nodeStatus.status === "started") {
            callbacks.current?.onNodeStarted?.(nodeId, nodeStatus.nodeType);
          } else if (nodeStatus.status === "completed") {
            callbacks.current?.onNodeCompleted?.(nodeId, nodeStatus.nodeType, nodeStatus.output);
          } else if (nodeStatus.status === "failed") {
            callbacks.current?.onNodeFailed?.(nodeId, nodeStatus.nodeType, nodeStatus.error ?? "Unknown error");
          }
        }
      }

      // Check workflow-level metadata
      const workflowMeta = metadata.workflow as WorkflowMetadata | undefined;
      if (workflowMeta?.status === "completed" && !hasCompleted.current) {
        hasCompleted.current = true;
        callbacks.current?.onWorkflowCompleted?.({
          successCount: workflowMeta.successCount ?? 0,
          failCount: workflowMeta.failCount ?? 0,
          status: workflowMeta.finalStatus ?? "COMPLETED",
          workflowExecutionId,
        });
        onComplete();
      }
    }

    // Also check run-level completion status
    if (run.status === "COMPLETED" && !hasCompleted.current) {
      hasCompleted.current = true;
      
      // Count successes and failures from metadata
      let successCount = 0;
      let failCount = 0;
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          if (key.startsWith("node:") && value && typeof value === "object") {
            const nodeStatus = value as NodeStatusMetadata;
            if (nodeStatus.status === "completed") successCount++;
            if (nodeStatus.status === "failed") failCount++;
          }
        }
      }
      
      callbacks.current?.onWorkflowCompleted?.({
        successCount,
        failCount,
        status: "COMPLETED",
        workflowExecutionId,
      });
      onComplete();
    } else if (run.status === "FAILED" && !hasCompleted.current) {
      hasCompleted.current = true;
      
      let successCount = 0;
      let failCount = 0;
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          if (key.startsWith("node:") && value && typeof value === "object") {
            const nodeStatus = value as NodeStatusMetadata;
            if (nodeStatus.status === "completed") successCount++;
            if (nodeStatus.status === "failed") failCount++;
          }
        }
      }
      
      callbacks.current?.onWorkflowCompleted?.({
        successCount,
        failCount,
        status: "FAILED",
        workflowExecutionId,
      });
      onComplete();
    }
  }, [run, workflowExecutionId, callbacks, onComplete]);

  // Handle connection errors
  useEffect(() => {
    if (error) {
      console.error("[RealtimeSubscriber] Error:", error);
      callbacks.current?.onError?.(error.message);
    }
  }, [error, callbacks]);

  return null;
}

export function useRealtimeWorkflowV2(workflowId: string, callbacks?: RealtimeWorkflowCallbacks) {
  const [isRunning, setIsRunning] = useState(false);
  const [workflowExecutionId, setWorkflowExecutionId] = useState<string | null>(null);
  const [triggerRunId, setTriggerRunId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Handle workflow completion
  const handleComplete = useCallback(() => {
    setIsRunning(false);
  }, []);

  // Trigger the workflow
  const runWorkflow = useCallback(async (nodes: Node[], edges: Edge[], overrideWorkflowId?: string) => {
    if (isRunning) {
      return;
    }

    const effectiveWorkflowId = overrideWorkflowId || workflowId;

    // Reset state
    setIsRunning(true);
    setWorkflowExecutionId(null);
    setTriggerRunId(null);
    setPublicToken(null);

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

      if (!data.publicToken) {
        throw new Error("No public token returned - cannot subscribe to realtime updates");
      }

      // Store IDs and token
      setWorkflowExecutionId(data.workflowExecutionId ?? null);
      setTriggerRunId(data.triggerRunId);
      setPublicToken(data.publicToken);

      console.log("[useRealtimeWorkflowV2] Workflow triggered, subscribing to realtime...", {
        triggerRunId: data.triggerRunId,
        hasPublicToken: !!data.publicToken,
      });

      // Notify that workflow started
      callbacksRef.current?.onWorkflowStarted?.({
        workflowExecutionId: data.workflowExecutionId!,
        triggerRunId: data.triggerRunId,
        estimatedCost: data.estimatedCost ?? 0,
      });

    } catch (error) {
      console.error("[useRealtimeWorkflowV2] Error:", error);
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
      } catch {
        // Ignore cancel errors
      }
    }
    setIsRunning(false);
    setPublicToken(null);
  }, [workflowExecutionId]);

  // Memoize the RealtimeSubscriber component
  const RealtimeSubscriberComponent = useMemo(() => {
    if (!isRunning || !triggerRunId || !publicToken || !workflowExecutionId) {
      return null;
    }
    return (
      <RealtimeSubscriber
        triggerRunId={triggerRunId}
        publicToken={publicToken}
        workflowExecutionId={workflowExecutionId}
        callbacks={callbacksRef}
        onComplete={handleComplete}
      />
    );
  }, [isRunning, triggerRunId, publicToken, workflowExecutionId, handleComplete]);

  return {
    runWorkflow,
    cancelWorkflow,
    isRunning,
    workflowExecutionId,
    triggerRunId,
    // The caller should render this component to enable realtime subscription
    RealtimeSubscriber: RealtimeSubscriberComponent,
  };
}
