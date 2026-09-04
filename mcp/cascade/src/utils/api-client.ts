import { logger } from "./logger.js";

// =============================================================================
// API CLIENT
// HTTP client for communicating with Cascade TRPC/REST APIs
// =============================================================================

const API_BASE = process.env.CASCADE_API_URL || "https://cascade.vercel.app";
const API_KEY = process.env.CASCADE_API_KEY || "";

// =============================================================================
// AUTH CHECK
// =============================================================================

/**
 * Check if API key is configured and throw helpful error if not
 */
export function requireAuth(operation: string): void {
  if (!API_KEY) {
    throw new Error(
      `AUTHENTICATION REQUIRED: Cannot ${operation} without an API key. ` +
      `Please use the "setup_auth" tool to authenticate first. ` +
      `This will open a browser where you can sign in and get a code.`
    );
  }
}

/**
 * Check if error is an auth error and enhance the message
 */
function handleAuthError(status: number, errorText: string, operation: string): never {
  if (status === 401 || status === 403 || status === 404) {
    // Check if it's likely an auth issue
    if (!API_KEY || errorText.includes("Unauthorized") || errorText.includes("Not found")) {
      throw new Error(
        `AUTHENTICATION FAILED: ${operation} failed (${status}). ` +
        `Your API key may be missing, invalid, or expired. ` +
        `Please use the "setup_auth" tool to re-authenticate.`
      );
    }
  }
  throw new Error(`API call failed: ${status} ${errorText}`);
}

/**
 * Make a TRPC query call (GET)
 */
export async function trpcQuery<T>(
  procedure: string,
  input?: unknown
): Promise<T> {
  const url = new URL(`${API_BASE}/api/v1/${procedure}`);
  
  if (input !== undefined) {
    url.searchParams.set("input", JSON.stringify({ json: input }));
  }

  logger.debug(`TRPC Query: ${procedure}`, { input });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "Authorization": `Bearer ${API_KEY}` } : {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`TRPC Query failed: ${procedure}`, { status: response.status, error: errorText });
    handleAuthError(response.status, errorText, `query ${procedure}`);
  }

  const result = await response.json() as Record<string, unknown>;
  
  // TRPC wraps responses in { result: { data: { json: ... } } }
  const trpcResult = result?.result as Record<string, unknown> | undefined;
  const trpcData = trpcResult?.data as Record<string, unknown> | undefined;
  if (trpcData?.json !== undefined) {
    return trpcData.json as T;
  }
  
  return result as T;
}

/**
 * Make a TRPC mutation call (POST)
 */
export async function trpcMutation<T>(
  procedure: string,
  input: unknown
): Promise<T> {
  // Mutations always require authentication
  requireAuth(`perform ${procedure}`);
  
  const url = `${API_BASE}/api/v1/${procedure}`;

  logger.debug(`TRPC Mutation: ${procedure}`, { input });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ json: input }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`TRPC Mutation failed: ${procedure}`, { status: response.status, error: errorText });
    handleAuthError(response.status, errorText, `mutation ${procedure}`);
  }

  const result = await response.json() as Record<string, unknown>;
  
  // TRPC wraps responses in { result: { data: { json: ... } } }
  const trpcResult = result?.result as Record<string, unknown> | undefined;
  const trpcData = trpcResult?.data as Record<string, unknown> | undefined;
  if (trpcData?.json !== undefined) {
    return trpcData.json as T;
  }
  
  return result as T;
}

/**
 * Make a REST API call
 */
export async function restCall<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown
): Promise<T> {
  // Non-GET requests require authentication
  if (method !== "GET") {
    requireAuth(`${method} ${path}`);
  }
  
  const url = `${API_BASE}${path}`;

  logger.debug(`REST ${method}: ${path}`, { body });

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "Authorization": `Bearer ${API_KEY}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`REST call failed: ${path}`, { status: response.status, error: errorText });
    handleAuthError(response.status, errorText, `${method} ${path}`);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

// =============================================================================
// WORKFLOW API CALLS
// =============================================================================

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { executions: number };
}

export interface WorkflowFull {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  nodesJson: unknown;
  edgesJson: unknown;
  viewportJson: unknown;
}

export async function listWorkflows(): Promise<{ workflows: WorkflowListItem[] }> {
  // REST endpoint: GET /api/v1/workflows
  return restCall<{ workflows: WorkflowListItem[] }>("/api/v1/workflows", "GET");
}

export async function getWorkflow(id: string): Promise<{ workflow: WorkflowFull }> {
  // REST endpoint: GET /api/v1/workflows/{id}
  return restCall<{ workflow: WorkflowFull }>(`/api/v1/workflows/${id}`, "GET");
}

export async function getWorkflowByName(name: string): Promise<{ workflow: WorkflowFull }> {
  // REST endpoint: GET /api/workflows/by-name/{name}
  // Note: Using non-versioned endpoint as this is a new feature
  return restCall<{ workflow: WorkflowFull }>(`/api/workflows/by-name/${encodeURIComponent(name)}`, "GET");
}

export async function createWorkflow(data: {
  name: string;
  description?: string;
  nodesJson: unknown[];
  edgesJson: unknown[];
  viewportJson?: { x: number; y: number; zoom: number };
}): Promise<{ workflow: WorkflowFull }> {
  // REST endpoint: POST /api/v1/workflows
  return restCall<{ workflow: WorkflowFull }>("/api/v1/workflows", "POST", data);
}

export async function updateWorkflow(data: {
  id: string;
  name?: string;
  description?: string;
  nodesJson?: unknown[];
  edgesJson?: unknown[];
  viewportJson?: { x: number; y: number; zoom: number };
  isPublished?: boolean;
}): Promise<{ workflow: WorkflowFull }> {
  // REST endpoint: PATCH /api/v1/workflows/{id}
  const { id, ...updateData } = data;
  return restCall<{ workflow: WorkflowFull }>(`/api/v1/workflows/${id}`, "PATCH", updateData);
}

export async function deleteWorkflow(id: string): Promise<{ success: boolean }> {
  // REST endpoint: DELETE /api/v1/workflows/{id}
  return restCall<{ success: boolean }>(`/api/v1/workflows/${id}`, "DELETE");
}

export async function duplicateWorkflow(id: string): Promise<WorkflowFull> {
  // REST endpoint: POST /api/v1/workflows/{id}/duplicate
  return restCall<WorkflowFull>(`/api/v1/workflows/${id}/duplicate`, "POST");
}

// =============================================================================
// EXECUTION API CALLS
// =============================================================================

export interface ExecutionListItem {
  id: string;
  type: "workflow" | "quick";
  workflowId: string | null;
  workflowName: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  duration: string | null;
  totalCost: number;
  nodeCount: number;
}

export interface ExecutionNodeDetail {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string | null;
  status: string;
  error?: string | null;
  inputJson?: unknown;
  outputJson?: unknown;
  providerUsed?: string | null;
  estimatedCost?: number;
  actualCost?: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface ExecutionDetail extends ExecutionListItem {
  nodes: Array<{
    id: string;
    nodeType: string;
    label: string;
    status: string;
    error?: string | null;
    output?: unknown;
  }>;
  // Raw node executions from API
  nodeExecutions?: ExecutionNodeDetail[];
  // Workflow snapshot from execution
  workflowSnapshot?: {
    nodes?: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: Record<string, unknown>;
    }>;
    edges?: Array<{
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
    }>;
  };
  workflow?: {
    id: string;
    name: string;
  };
}

export interface ExecutionStatus {
  execution: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  nodeStatuses: Array<{
    nodeId: string;
    nodeType: string;
    nodeLabel: string | null;
    status: string;
    error: string | null;
    providerUsed: string | null;
  }>;
}

export async function listExecutions(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ executions: ExecutionListItem[] }> {
  // REST endpoint: GET /api/executions
  let url = "/api/executions";
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  if (params.toString()) url += `?${params.toString()}`;
  return restCall<{ executions: ExecutionListItem[] }>(url, "GET");
}

export async function getExecution(id: string): Promise<{ execution: ExecutionDetail }> {
  // REST endpoint: GET /api/executions/{id}
  const result = await restCall<{ execution: Record<string, unknown> }>(`/api/executions/${id}`, "GET");
  
  const exec = result.execution;
  const nodeExecutions = (exec.nodeExecutions || []) as ExecutionNodeDetail[];
  
  // Map node executions to the expected format
  const nodes = nodeExecutions.map((n) => ({
    id: n.nodeId || n.id,
    nodeType: n.nodeType,
    label: n.nodeLabel || n.nodeType,
    status: n.status?.toLowerCase() || "unknown",
    error: n.error,
    output: n.outputJson,
  }));
  
  return {
    execution: {
      id: exec.id as string,
      type: ((exec.type as string) || "workflow") as "workflow" | "quick",
      workflowId: exec.workflowId as string | null,
      workflowName: (exec.workflow as { name?: string })?.name || "Workflow",
      status: (exec.status as string)?.toLowerCase() || "unknown",
      startedAt: exec.startedAt as string | null,
      completedAt: exec.completedAt as string | null,
      createdAt: exec.createdAt as string | null,
      duration: null,
      totalCost: (exec.actualCost as number) || (exec.estimatedCost as number) || 0,
      nodeCount: nodeExecutions.length,
      nodes,
      nodeExecutions,
      workflowSnapshot: exec.workflowSnapshot as ExecutionDetail["workflowSnapshot"],
      workflow: exec.workflow as { id: string; name: string },
    },
  };
}

export async function getLatestExecutionStatus(workflowId: string): Promise<ExecutionStatus> {
  // Use the latest execution for this workflow
  const result = await listExecutions({ limit: 1 });
  if (result.executions.length === 0) {
    return { execution: null, nodeStatuses: [] };
  }
  const exec = result.executions.find(e => e.workflowId === workflowId);
  if (!exec) {
    return { execution: null, nodeStatuses: [] };
  }
  const detail = await getExecution(exec.id);
  return {
    execution: {
      id: detail.execution.id,
      status: detail.execution.status,
      startedAt: detail.execution.startedAt,
      completedAt: detail.execution.completedAt,
    },
    nodeStatuses: detail.execution.nodes.map(n => ({
      nodeId: n.id,
      nodeType: n.nodeType,
      nodeLabel: n.label,
      status: n.status,
      error: n.error || null,
      providerUsed: null,
    })),
  };
}

export async function triggerWorkflowExecution(
  workflowId: string,
  inputs?: Record<string, unknown>
): Promise<{ executionId: string }> {
  // Use the REST API endpoint for triggering workflows
  const result = await restCall<{ 
    success: boolean; 
    workflowExecutionId?: string;
    executionId?: string;
    error?: string;
  }>(
    `/api/workflow/trigger`,
    "POST",
    { workflowId, inputs }
  );
  
  if (!result.success) {
    throw new Error(result.error || "Failed to trigger workflow");
  }
  
  return { executionId: result.workflowExecutionId || result.executionId || "" };
}

export async function cancelExecution(executionId: string): Promise<{ success: boolean }> {
  return restCall<{ success: boolean }>(
    `/api/executions/${executionId}/cancel`,
    "POST"
  );
}

// =============================================================================
// CREDITS API CALLS
// =============================================================================

export interface CreditBalance {
  credits: number;
  formatted: string;
  dollarValue: string;
}

export interface CreditStats {
  currentBalance: number;
  formattedBalance: string;
  dollarValue: string;
  memberSince: string;
  totalSpent: number;
  totalPurchased: number;
  totalBonuses: number;
  transactionCount: number;
  recentTransactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string | null;
    createdAt: string;
  }>;
}

export async function getCreditBalance(): Promise<CreditBalance> {
  return restCall<CreditBalance>("/api/v1/credits/balance", "GET");
}

export async function getCreditStats(): Promise<CreditStats> {
  return restCall<CreditStats>("/api/v1/credits/stats", "GET");
}

// =============================================================================
// MEDIA UPLOAD API CALLS
// =============================================================================

export interface MediaUploadResult {
  url: string;
  mimeType?: string;
}

/**
 * Upload base64 media to CDN and get a permanent URL
 * @param dataUrl - Base64 data URL (e.g., "data:image/png;base64,iVBORw0...")
 * @param options - Optional type hint and filename
 * @returns CDN URL of the uploaded file
 */
export async function uploadMedia(
  dataUrl: string,
  options?: {
    type?: "image" | "video" | "audio";
    filename?: string;
  }
): Promise<MediaUploadResult> {
  // If already an HTTP URL, return as-is
  if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
    return { url: dataUrl };
  }

  return restCall<MediaUploadResult>("/api/media/upload", "POST", {
    dataUrl,
    type: options?.type,
    filename: options?.filename,
  });
}

// =============================================================================
// WORKFLOW TEMPLATE API CALLS (for caching)
// =============================================================================

export interface WorkflowTemplate {
  id: string;
  structureHash: string;
  name: string;
  description: string | null;
  nodes: unknown[];
  edges: unknown[];
  usageCount: number;
  createdAt?: string;
}

export interface TemplateCheckResult {
  found: boolean;
  template?: WorkflowTemplate;
}

export interface TemplateCreateResult {
  created: boolean;
  cached: boolean;
  template: WorkflowTemplate;
}

/**
 * Check if a workflow template exists by structure hash
 */
export async function checkWorkflowTemplate(structureHash: string): Promise<TemplateCheckResult> {
  return restCall<TemplateCheckResult>(`/api/workflow-templates?hash=${structureHash}`, "GET");
}

/**
 * Create or get a workflow template (increments usage if exists)
 */
export async function createOrGetWorkflowTemplate(data: {
  structureHash: string;
  name: string;
  description?: string;
  nodesJson: unknown[];
  edgesJson: unknown[];
}): Promise<TemplateCreateResult> {
  return restCall<TemplateCreateResult>("/api/workflow-templates", "POST", data);
}
