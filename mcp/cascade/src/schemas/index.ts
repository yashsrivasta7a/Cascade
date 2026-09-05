import { z } from "zod";

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

export const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const NodeDataSchema = z.record(z.unknown());

export const NodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: NodePositionSchema,
  data: NodeDataSchema,
});

export const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

// =============================================================================
// PRESET SCHEMAS
// =============================================================================

export const PresetInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  nodeCount: z.number(),
});

export const PresetDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});

// =============================================================================
// NODE INFO SCHEMAS
// =============================================================================

export const NodeInputOutputSchema = z.object({
  type: z.string(),
  label: z.string(),
});

export const NodeInfoSchema = z.object({
  type: z.string(),
  label: z.string(),
  description: z.string(),
  category: z.string(),
  provider: z.string(),
  action: z.string(),
  estimatedCost: z.number(),
  inputs: z.array(NodeInputOutputSchema),
  outputs: z.array(NodeInputOutputSchema),
});

export const NodeDetailSchema = NodeInfoSchema.extend({
  estimatedTime: z.string().optional(),
  aspectRatios: z.array(z.string()).optional(),
  resolutions: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  models: z.array(z.string()).optional(),
});

// =============================================================================
// WORKFLOW BUILDER SCHEMAS
// =============================================================================

export const NodeSpecSchema = z.object({
  type: z.string(),
  inputType: z.enum(["text", "image", "video", "audio"]).optional(),
  config: z.record(z.unknown()).optional(),
});

export const BuildWorkflowInputSchema = z.object({
  name: z.string(),
  nodes: z.array(NodeSpecSchema),
});

export const WorkflowDataSchema = z.object({
  name: z.string(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});

// =============================================================================
// WORKFLOW CRUD SCHEMAS
// =============================================================================

export const WorkflowSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number(),
  isPublished: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  executionCount: z.number(),
});

export const WorkflowFullSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number(),
  isPublished: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  viewport: ViewportSchema.nullable(),
});

export const CreateWorkflowInputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  viewport: ViewportSchema.optional(),
});

export const UpdateWorkflowInputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  nodes: z.array(NodeSchema).optional(),
  edges: z.array(EdgeSchema).optional(),
  viewport: ViewportSchema.optional(),
  isPublished: z.boolean().optional(),
});

// =============================================================================
// EXECUTION SCHEMAS
// =============================================================================

export const ExecuteWorkflowInputSchema = z.object({
  workflowId: z.string(),
  inputs: z.record(z.unknown()).optional(),
});

export const ExecutionStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const NodeExecutionStatusSchema = z.object({
  nodeId: z.string(),
  nodeType: z.string(),
  nodeLabel: z.string().nullable(),
  status: z.string(),
  error: z.string().nullable(),
  providerUsed: z.string().nullable(),
});

export const ExecutionSummarySchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowName: z.string(),
  status: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  totalCost: z.number().nullable(),
  nodeCount: z.number(),
});

export const ExecutionDetailSchema = ExecutionSummarySchema.extend({
  nodes: z.array(NodeExecutionStatusSchema),
  error: z.string().nullable(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Node = z.infer<typeof NodeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type PresetInfo = z.infer<typeof PresetInfoSchema>;
export type PresetData = z.infer<typeof PresetDataSchema>;
export type NodeInfo = z.infer<typeof NodeInfoSchema>;
export type NodeDetail = z.infer<typeof NodeDetailSchema>;
export type NodeSpec = z.infer<typeof NodeSpecSchema>;
export type WorkflowData = z.infer<typeof WorkflowDataSchema>;
export type WorkflowSummary = z.infer<typeof WorkflowSummarySchema>;
export type WorkflowFull = z.infer<typeof WorkflowFullSchema>;
export type ExecutionSummary = z.infer<typeof ExecutionSummarySchema>;
export type ExecutionDetail = z.infer<typeof ExecutionDetailSchema>;
