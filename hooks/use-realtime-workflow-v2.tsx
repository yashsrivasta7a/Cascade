"use client";

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";
import type { Node, Edge } from "reactflow";
import type { NodeStatusEvent, WorkflowStatusEvent } from "@/app/trigger/streams";

// =============================================================================
// REALTIME WORKFLOW HOOK V2 - Using Trigger.dev Streams v2
// =============================================================================
// This hook uses Trigger.dev's Streams v2 API which should properly propagate
// real-time updates to React hooks via direct WebSocket connection.
//
// Key differences from v1 (polling):
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

// Define the stream types for useRealtimeRunWithStreams
type WorkflowStreams = {
  "node-status": NodeStatusEvent;
  "workflow-status": WorkflowStatusEvent;
};

// Inner component that handles the stream subscription
// This is needed because useRealtimeRunWithStreams requires accessToken immediately
function StreamSubscriber({
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
  const processedEvents = useRef<Set<string>>(new Set());
  const hasCompleted = useRef(false);

  // Subscribe to the run with streams
  const { run, streams, error } = useRealtimeRunWithStreams<unknown, WorkflowStreams>(
    triggerRunId,
    {
      accessToken: publicToken,
      enabled: true,
    }
  );

  // Process stream events
  useEffect(() => {
    if (!run) return;

    const nodeEvents = streams?.["node-status"] ?? [];
    const workflowEvents = streams?.["workflow-status"] ?? [];

    console.log(`[StreamSubscriber] Run status: ${run.status}, nodeEvents: ${nodeEvents.length}, workflowEvents: ${workflowEvents.length}`);

    // Process node status events
    for (const event of nodeEvents) {
      const eventKey = `node:${event.nodeId}:${event.status}:${event.timestamp}`;
      if (processedEvents.current.has(eventKey)) continue;
      processedEvents.current.add(eventKey);

      console.log(`[StreamSubscriber] Node event: ${event.nodeId} -> ${event.status}`);

      if (event.status === "started") {
        callbacks.current?.onNodeStarted?.(event.nodeId, event.nodeType);
      } else if (event.status === "completed") {
        callbacks.current?.onNodeCompleted?.(event.nodeId, event.nodeType, event.output);
      } else if (event.status === "failed") {
        callbacks.current?.onNodeFailed?.(event.nodeId, event.nodeType, event.error ?? "Unknown error");
      }
    }

    // Process workflow status events
    for (const event of workflowEvents) {
      const eventKey = `workflow:${event.status}:${event.timestamp}`;
      if (processedEvents.current.has(eventKey)) continue;
      processedEvents.current.add(eventKey);

      console.log(`[StreamSubscriber] Workflow event: ${event.status}`);

      if (event.status === "completed" && !hasCompleted.current) {
        hasCompleted.current = true;
        callbacks.current?.onWorkflowCompleted?.({
          successCount: event.successCount ?? 0,
          failCount: event.failCount ?? 0,
          status: event.finalStatus ?? "COMPLETED",
          workflowExecutionId,
        });
        onComplete();
      }
    }

    // Also check run-level completion (fallback)
    if (run.status === "COMPLETED" && !hasCompleted.current) {
      hasCompleted.current = true;
      const lastWorkflowEvent = workflowEvents[workflowEvents.length - 1];
      callbacks.current?.onWorkflowCompleted?.({
        successCount: lastWorkflowEvent?.successCount ?? nodeEvents.filter(e => e.status === "completed").length,
        failCount: lastWorkflowEvent?.failCount ?? nodeEvents.filter(e => e.status === "failed").length,
        status: "COMPLETED",
        workflowExecutionId,
      });
      onComplete();
    } else if (run.status === "FAILED" && !hasCompleted.current) {
      hasCompleted.current = true;
      callbacks.current?.onWorkflowCompleted?.({
        successCount: nodeEvents.filter(e => e.status === "completed").length,
        failCount: nodeEvents.filter(e => e.status === "failed").length,
        status: "FAILED",
        workflowExecutionId,
      });
      onComplete();
    }
  }, [run, streams, workflowExecutionId, callbacks, onComplete]);

  // Handle connection errors
  useEffect(() => {
    if (error) {
      console.error("[StreamSubscriber] Error:", error);
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

      console.log("[useRealtimeWorkflowV2] Workflow triggered, subscribing to streams...", {
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

  // Memoize the StreamSubscriber component
  const StreamSubscriberComponent = useMemo(() => {
    if (!isRunning || !triggerRunId || !publicToken || !workflowExecutionId) {
      return null;
    }
    return (
      <StreamSubscriber
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
    // The caller should render this component to enable stream subscription
    StreamSubscriber: StreamSubscriberComponent,
  };
}
