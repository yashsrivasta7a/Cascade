"use client";

import { useState, useEffect, useCallback } from "react";
import type { NodeExecutionStatus } from "@/lib/engine/types";

// =============================================================================
// EXECUTION STREAM HOOK - Real-time updates for workflow execution
// =============================================================================

interface NodeUpdate {
  nodeId: string;
  status: NodeExecutionStatus;
  progress?: number;
  output?: unknown;
  error?: string;
}

interface ExecutionState {
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
  nodeUpdates: Map<string, NodeUpdate>;
  error?: string;
}

export function useExecutionStream(executionId: string | null) {
  const [state, setState] = useState<ExecutionState>({
    status: "pending",
    nodeUpdates: new Map(),
  });
  const [isConnected, setIsConnected] = useState(false);

  // Fetch current execution state
  const fetchState = useCallback(async () => {
    if (!executionId) return;

    try {
      const response = await fetch(`/api/executions/${executionId}`);
      if (!response.ok) return;

      const data = await response.json();
      const execution = data.execution;

      setState((prev) => {
        const nodeUpdates = new Map(prev.nodeUpdates);

        for (const node of execution.nodeExecutions ?? []) {
          nodeUpdates.set(node.nodeId, {
            nodeId: node.nodeId,
            status: node.status.toLowerCase() as NodeExecutionStatus,
            output: node.outputJson,
            error: node.error,
          });
        }

        return {
          status: execution.status.toLowerCase() as ExecutionState["status"],
          nodeUpdates,
          error: execution.error,
        };
      });
    } catch (error) {
      console.error("Failed to fetch execution state:", error);
    }
  }, [executionId]);

  // Start polling for updates (until we have proper SSE/WebSocket)
  useEffect(() => {
    if (!executionId) return;

    // Initial fetch
    fetchState();
    setIsConnected(true);

    // Poll for updates every 2 seconds while execution is active
    const interval = setInterval(() => {
      if (["completed", "failed", "cancelled"].includes(state.status)) {
        clearInterval(interval);
        setIsConnected(false);
        return;
      }
      fetchState();
    }, 2000);

    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [executionId, state.status, fetchState]);

  // Get status for a specific node
  const getNodeStatus = useCallback(
    (nodeId: string): NodeUpdate | undefined => {
      return state.nodeUpdates.get(nodeId);
    },
    [state.nodeUpdates]
  );

  return {
    executionStatus: state.status,
    nodeUpdates: state.nodeUpdates,
    getNodeStatus,
    isConnected,
    error: state.error,
    refresh: fetchState,
  };
}

