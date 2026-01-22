"use client";

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { useRealtimeRunsWithTag, useRealtimeRun } from "@trigger.dev/react-hooks";
import type { Node, Edge } from "reactflow";

// =============================================================================
// WORKFLOW REALTIME SUBSCRIPTION HOOK
// =============================================================================
// Uses useRealtimeRunsWithTag to subscribe to ALL executions of a workflow.
// This allows the browser to see executions triggered from MCP or other sources
// in real-time, without polling.
//
// Flow:
// 1. Browser loads workflow page
// 2. Fetches realtime token for the workflow tag
// 3. Subscribes to all runs with that tag
// 4. When any execution starts (from UI, MCP, API), browser sees it immediately
// 5. Metadata updates (node statuses) are received in real-time
// =============================================================================

export type NodeStatus = "queued" | "running" | "completed" | "failed";

export interface WorkflowRealtimeCallbacks {
  onExecutionDiscovered?: (data: { 
    workflowExecutionId: string; 
    triggerRunId: string;
    isExternal: boolean; // true if triggered externally (MCP, API), false if from this browser
  }) => void;
  onNodeQueued?: (nodeId: string, nodeType: string) => void;
  onNodeStarted?: (nodeId: string, nodeType: string) => void;
  onNodeProgress?: (nodeId: string, progress: number) => void;
  onNodeCompleted?: (nodeId: string, nodeType: string, output: unknown) => void;
  onNodeFailed?: (nodeId: string, nodeType: string, error: string) => void;
  onWorkflowCompleted?: (data: { 
    successCount: number; 
    failCount: number; 
    status: string; 
    workflowExecutionId?: string;
    triggerRunId: string;
  }) => void;
  onError?: (error: string) => void;
}

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

// Track which runs we've already processed
interface TrackedRun {
  id: string;
  processedStatuses: Map<string, string>;
  hasCompleted: boolean;
}

// Inner component that subscribes to a specific run's metadata
function RunMetadataSubscriber({
  triggerRunId,
  publicToken,
  callbacks,
  onComplete,
  trackedRunRef,
}: {
  triggerRunId: string;
  publicToken: string;
  callbacks: React.MutableRefObject<WorkflowRealtimeCallbacks | undefined>;
  onComplete: (runId: string) => void;
  trackedRunRef: React.MutableRefObject<TrackedRun>;
}) {
  const { run, error } = useRealtimeRun(triggerRunId, {
    accessToken: publicToken,
  });

  // Process metadata updates
  useEffect(() => {
    if (!run) return;

    const metadata = run.metadata as Record<string, unknown> | undefined;
    const tracked = trackedRunRef.current;

    // Process node status updates from metadata
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (key.startsWith("node:") && value && typeof value === "object") {
          const nodeId = key.replace("node:", "");
          const nodeStatus = value as NodeStatusMetadata;
          
          // Check if status changed
          const previousStatus = tracked.processedStatuses.get(nodeId);
          if (previousStatus === nodeStatus.status) continue;
          tracked.processedStatuses.set(nodeId, nodeStatus.status);

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
      if (workflowMeta?.status === "completed" && !tracked.hasCompleted) {
        tracked.hasCompleted = true;
        callbacks.current?.onWorkflowCompleted?.({
          successCount: workflowMeta.successCount ?? 0,
          failCount: workflowMeta.failCount ?? 0,
          status: workflowMeta.finalStatus ?? "COMPLETED",
          triggerRunId,
        });
        onComplete(triggerRunId);
      }
    }

    // Check run-level completion status
    if (run.status === "COMPLETED" && !tracked.hasCompleted) {
      tracked.hasCompleted = true;
      
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
        triggerRunId,
      });
      onComplete(triggerRunId);
    } else if (run.status === "FAILED" && !tracked.hasCompleted) {
      tracked.hasCompleted = true;
      
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
        triggerRunId,
      });
      onComplete(triggerRunId);
    }
  }, [run, callbacks, onComplete, triggerRunId, trackedRunRef]);

  // Handle connection errors
  useEffect(() => {
    if (error) {
      callbacks.current?.onError?.(error.message);
    }
  }, [error, callbacks]);

  return null;
}

export function useWorkflowRealtimeSubscription(
  workflowId: string,
  callbacks?: WorkflowRealtimeCallbacks
) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [workflowTag, setWorkflowTag] = useState<string | null>(null);
  const [activeRuns, setActiveRuns] = useState<Map<string, TrackedRun>>(new Map());
  const [error, setError] = useState<string | null>(null);
  
  // Track runs we've triggered from this browser session
  const localTriggeredRuns = useRef<Set<string>>(new Set());
  
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Fetch realtime token on mount
  useEffect(() => {
    if (!workflowId || workflowId === "new" || workflowId === "unknown") return;

    let cancelled = false;

    async function fetchToken() {
      try {
        const response = await fetch(`/api/workflows/${workflowId}/realtime-token`);
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (!cancelled) {
          setPublicToken(data.token);
          setWorkflowTag(data.workflowTag);
          setIsSubscribed(true);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to get realtime token";
          setError(message);
          callbacksRef.current?.onError?.(message);
        }
      }
    }

    fetchToken();

    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  // Mark a run as locally triggered (so we know it's not external)
  const markAsLocalRun = useCallback((triggerRunId: string) => {
    localTriggeredRuns.current.add(triggerRunId);
  }, []);

  // Handle run completion
  const handleRunComplete = useCallback((runId: string) => {
    setActiveRuns(prev => {
      const next = new Map(prev);
      next.delete(runId);
      return next;
    });
    // Clean up local triggered runs tracking
    localTriggeredRuns.current.delete(runId);
  }, []);

  // Subscribe to runs with the workflow tag
  const { runs, error: subscriptionError } = useRealtimeRunsWithTag(
    workflowTag ?? "",
    {
      accessToken: publicToken ?? undefined,
      enabled: Boolean(publicToken && workflowTag),
    }
  );

  // Handle subscription errors
  useEffect(() => {
    if (subscriptionError) {
      setError(subscriptionError.message);
      callbacksRef.current?.onError?.(subscriptionError.message);
    }
  }, [subscriptionError]);

  // Track runs and notify when new ones appear
  useEffect(() => {
    if (!runs) return;

    for (const run of runs) {
      // Skip if already tracking this run
      if (activeRuns.has(run.id)) continue;

      // Check if this is a local run or external
      const isExternal = !localTriggeredRuns.current.has(run.id);

      // Only track EXECUTING or QUEUED runs
      if (run.status === "EXECUTING" || run.status === "QUEUED" || run.status === "REATTEMPTING") {
        // Create tracked run entry
        const trackedRun: TrackedRun = {
          id: run.id,
          processedStatuses: new Map(),
          hasCompleted: false,
        };

        setActiveRuns(prev => {
          const next = new Map(prev);
          next.set(run.id, trackedRun);
          return next;
        });

        // Notify about discovered execution
        // Extract workflowExecutionId from payload if available
        const payload = run.payload as { workflowExecutionId?: string } | undefined;
        callbacksRef.current?.onExecutionDiscovered?.({
          workflowExecutionId: payload?.workflowExecutionId ?? run.id,
          triggerRunId: run.id,
          isExternal,
        });

        // If external, also mark all nodes as queued (since we missed the initial trigger)
        if (isExternal) {
          const snapshot = (run.payload as { nodes?: Node[] })?.nodes;
          if (snapshot) {
            for (const node of snapshot) {
              callbacksRef.current?.onNodeQueued?.(node.id, node.type ?? "unknown");
            }
          }
        }
      }
    }
  }, [runs, activeRuns]);

  // Create refs for each active run
  const activeRunRefs = useRef<Map<string, React.MutableRefObject<TrackedRun>>>(new Map());

  // Update refs when activeRuns changes
  useEffect(() => {
    for (const [runId, tracked] of activeRuns) {
      if (!activeRunRefs.current.has(runId)) {
        activeRunRefs.current.set(runId, { current: tracked });
      } else {
        activeRunRefs.current.get(runId)!.current = tracked;
      }
    }
    // Clean up old refs
    for (const runId of activeRunRefs.current.keys()) {
      if (!activeRuns.has(runId)) {
        activeRunRefs.current.delete(runId);
      }
    }
  }, [activeRuns]);

  // Render subscribers for all active runs
  const RunSubscribers = useMemo(() => {
    if (!publicToken) return null;

    return Array.from(activeRuns.entries()).map(([runId, tracked]) => (
      <RunMetadataSubscriber
        key={runId}
        triggerRunId={runId}
        publicToken={publicToken}
        callbacks={callbacksRef}
        onComplete={handleRunComplete}
        trackedRunRef={{ current: tracked }}
      />
    ));
  }, [activeRuns, publicToken, handleRunComplete]);

  return {
    isSubscribed,
    activeRunCount: activeRuns.size,
    error,
    markAsLocalRun, // Call this when triggering from UI to mark as non-external
    RunSubscribers, // Render this in component tree to activate subscriptions
  };
}
