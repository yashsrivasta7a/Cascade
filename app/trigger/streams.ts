import { streams } from "@trigger.dev/sdk";

// =============================================================================
// TRIGGER.DEV STREAMS V2 - Shared stream definitions
// =============================================================================
// These streams are used for real-time communication between Trigger.dev tasks
// and the React frontend. Unlike metadata, streams properly propagate to
// React hooks via WebSocket.
//
// Usage:
// - Task: nodeStatusStream.append({ nodeId, status, ... })
// - React: useRealtimeRunWithStreams(runId, { accessToken })
// =============================================================================

export type NodeStatus = "queued" | "started" | "completed" | "failed";

export interface NodeStatusEvent {
  nodeId: string;
  status: NodeStatus;
  nodeType: string;
  nodeLabel?: string;
  output?: unknown;
  error?: string;
  timestamp: number;
}

export interface WorkflowStatusEvent {
  status: "started" | "completed" | "failed";
  successCount?: number;
  failCount?: number;
  finalStatus?: string;
  timestamp: number;
}

// Stream for node status updates (started, completed, failed)
export const nodeStatusStream = streams.define<NodeStatusEvent>({
  id: "node-status",
});

// Stream for workflow-level status updates
export const workflowStatusStream = streams.define<WorkflowStatusEvent>({
  id: "workflow-status",
});

// Type helpers for React hooks
export type NodeStatusStreamType = typeof nodeStatusStream;
export type WorkflowStatusStreamType = typeof workflowStatusStream;
