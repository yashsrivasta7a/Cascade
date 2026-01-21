// =============================================================================
// ACTIVITY PANEL TYPES
// =============================================================================

export interface NodeExecutionRecord {
  id: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  status: "PENDING" | "QUEUED" | "RUNNING" | "WAITING" | "COMPLETED" | "FAILED";
  providerUsed?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  actualCost?: number;
  durationMs?: number;
}

export interface ExecutionRecord {
  id: string;
  workflowName?: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  nodeExecutions: NodeExecutionRecord[];
  totalCost?: number;
  estimatedCost?: number;
  durationMs?: number;
}

export type ErrorSeverity = "critical" | "warning" | "info";

export interface WorkflowError {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  stackTrace?: string;
  timestamp: Date;
  inputs?: Record<string, unknown>;
  canRetry?: boolean;
  provider?: string;
  executionId?: string;
  triggerRunId?: string;
  httpStatus?: number;
  errorCode?: string;
  duration?: number;
  rawResponse?: unknown;
  suggestion?: string;
}

export interface ActivityPanelProps {
  workflowId?: string;
  isOpen: boolean;
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
  errors: WorkflowError[];
  onClearErrors: () => void;
  onRetryNode?: (nodeId: string) => void;
  initialTab?: "runs" | "versions";
  onVersionRestore?: (nodesJson: unknown[], edgesJson: unknown[], viewportJson?: unknown) => void;
}

export type ExecutionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "QUEUED" | "WAITING";
