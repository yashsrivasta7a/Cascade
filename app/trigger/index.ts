// =============================================================================
// TRIGGER.DEV - Shared exports (types and streams only)
// =============================================================================
// NOTE: Tasks (executeNode, executeWorkflow) are discovered automatically
// by Trigger.dev from their source files. Do NOT re-export them here
// or it will cause "duplicate output files" build errors.

// Stream definitions for realtime updates (Streams v2)
export { 
  nodeStatusStream, 
  workflowStatusStream,
  type NodeStatusEvent,
  type WorkflowStatusEvent,
  type NodeStatus,
} from "./streams";

