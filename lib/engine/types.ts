import { z } from "zod";
import type { AINodeType } from "@/types/nodes";
import type { ProviderId } from "@/lib/providers/types";

// =============================================================================
// NODE EXECUTOR TYPES
// =============================================================================

// Execution context passed to every node executor
export interface NodeExecutionContext {
  nodeExecutionId: string;
  workflowExecutionId: string;
  nodeId: string;
  nodeType: AINodeType;
  webhookBaseUrl: string;
  attempt: number;
}

// Result of node execution
export interface NodeExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  providerUsed?: ProviderId;
  providerJobId?: string;
  actualCost?: number;
}

// Node execution configuration
export interface NodeExecutionConfig {
  // Maximum time to wait for this node to complete (default: "5m")
  timeout: string;
  // Number of retries per provider before trying next (default: 2)
  retryPerProvider: number;
  // Maximum total retries across all providers (default: 3)
  maxRetries: number;
}

// Default config for nodes
export const DEFAULT_NODE_CONFIG: NodeExecutionConfig = {
  timeout: "5m",
  retryPerProvider: 2,
  maxRetries: 3,
};

// Node executor definition - the black box contract
export interface NodeExecutor<TInput = unknown, TOutput = unknown> {
  type: AINodeType;
  version: string;
  
  // Zod schemas for validation
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  
  // Available providers for this node type (in priority order)
  providers: ProviderId[];
  
  // Execution configuration (timeout, retries)
  config: NodeExecutionConfig;
  
  // Execute the node - returns immediately if async, waits for webhook
  execute(
    input: TInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult>;
}

// Webhook callback data
export interface WebhookCallbackData {
  nodeExecutionId: string;
  waitToken: string;
  providerJobId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// =============================================================================
// EXECUTION STATE TYPES
// =============================================================================

export type WorkflowExecutionStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type NodeExecutionStatus =
  | "pending"
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "skipped";

// Events emitted during execution (for real-time updates)
export interface ExecutionEvent {
  type: "workflow" | "node";
  executionId: string;
  nodeId?: string;
  status: WorkflowExecutionStatus | NodeExecutionStatus;
  timestamp: Date;
  data?: Record<string, unknown>;
}

