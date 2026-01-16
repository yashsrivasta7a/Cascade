import { http, HttpResponse } from "msw";

// =============================================================================
// MSW HANDLERS FOR API MOCKING
// =============================================================================

// Mock data
const mockUser = {
  id: "user-123",
  email: "test@example.com",
  credits: 1000000,
};

const mockWorkflows = [
  {
    id: "workflow-1",
    name: "Test Workflow 1",
    nodesJson: [],
    edgesJson: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "workflow-2",
    name: "Test Workflow 2",
    nodesJson: [],
    edgesJson: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockExecutions = [
  {
    id: "exec-1",
    workflowId: "workflow-1",
    status: "COMPLETED",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    nodeExecutions: [],
  },
  {
    id: "exec-2",
    workflowId: "workflow-1",
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    nodeExecutions: [
      { nodeId: "node-1", status: "COMPLETED", outputJson: { url: "https://..." } },
      { nodeId: "node-2", status: "RUNNING" },
    ],
  },
];

export const handlers = [
  // =============================================================================
  // WORKFLOW ROUTES
  // =============================================================================
  
  // GET /api/workflows - List workflows
  http.get("/api/workflows", () => {
    return HttpResponse.json({ workflows: mockWorkflows });
  }),

  // GET /api/workflows/:id - Get single workflow
  http.get("/api/workflows/:id", ({ params }) => {
    const workflow = mockWorkflows.find((w) => w.id === params.id);
    if (!workflow) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    return HttpResponse.json({ workflow });
  }),

  // POST /api/workflows - Create workflow
  http.post("/api/workflows", async ({ request }) => {
    const body = await request.json() as { name?: string };
    const newWorkflow = {
      id: `workflow-${Date.now()}`,
      name: body.name || "New Workflow",
      nodesJson: [],
      edgesJson: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ workflow: newWorkflow }, { status: 201 });
  }),

  // PUT /api/workflows/:id - Update workflow
  http.put("/api/workflows/:id", async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const workflow = mockWorkflows.find((w) => w.id === params.id);
    if (!workflow) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    return HttpResponse.json({
      workflow: { ...workflow, ...body, updatedAt: new Date().toISOString() },
    });
  }),

  // DELETE /api/workflows/:id - Delete workflow
  http.delete("/api/workflows/:id", ({ params }) => {
    const workflow = mockWorkflows.find((w) => w.id === params.id);
    if (!workflow) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    return HttpResponse.json({ success: true });
  }),

  // =============================================================================
  // EXECUTION ROUTES
  // =============================================================================

  // GET /api/executions - List executions
  http.get("/api/executions", () => {
    return HttpResponse.json({ executions: mockExecutions });
  }),

  // GET /api/executions/:id - Get single execution
  http.get("/api/executions/:id", ({ params }) => {
    const execution = mockExecutions.find((e) => e.id === params.id);
    if (!execution) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    return HttpResponse.json({ execution });
  }),

  // POST /api/executions/:id/cancel - Cancel execution
  http.post("/api/executions/:id/cancel", ({ params }) => {
    const execution = mockExecutions.find((e) => e.id === params.id);
    if (!execution) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    return HttpResponse.json({ success: true, status: "CANCELLED" });
  }),

  // =============================================================================
  // NODE ROUTES
  // =============================================================================

  // POST /api/nodes/execute - Execute single node
  http.post("/api/nodes/execute", async ({ request }) => {
    const body = await request.json() as { nodeType?: string };
    return HttpResponse.json({
      executionId: `node-exec-${Date.now()}`,
      status: "queued",
      nodeType: body.nodeType,
    });
  }),

  // POST /api/nodes/execute-sync - Execute node synchronously
  http.post("/api/nodes/execute-sync", async ({ request }) => {
    const body = await request.json() as { nodeType?: string };
    return HttpResponse.json({
      success: true,
      result: { url: "https://example.com/result.png" },
      nodeType: body.nodeType,
    });
  }),

  // GET /api/nodes/status - Get node execution status
  http.get("/api/nodes/status", ({ request }) => {
    const url = new URL(request.url);
    const executionId = url.searchParams.get("executionId");
    return HttpResponse.json({
      executionId,
      status: "completed",
      output: { url: "https://example.com/result.png" },
    });
  }),

  // =============================================================================
  // CREDITS ROUTES
  // =============================================================================

  // POST /api/nodes/deduct-credits
  http.post("/api/nodes/deduct-credits", async ({ request }) => {
    const body = await request.json() as { amount?: number };
    return HttpResponse.json({
      success: true,
      creditsDeducted: body.amount || 0,
      remainingBalance: mockUser.credits - (body.amount || 0),
    });
  }),

  // =============================================================================
  // DASHBOARD ROUTES
  // =============================================================================

  // GET /api/dashboard/stats
  http.get("/api/dashboard/stats", () => {
    return HttpResponse.json({
      totalWorkflows: mockWorkflows.length,
      totalExecutions: mockExecutions.length,
      creditsUsed: 50000,
      creditsRemaining: mockUser.credits,
    });
  }),

  // =============================================================================
  // MEDIA ROUTES
  // =============================================================================

  // POST /api/media/upload
  http.post("/api/media/upload", () => {
    return HttpResponse.json({
      url: "https://example.com/uploaded-file.png",
      key: "uploads/file-123.png",
    });
  }),
];

// Re-export http so tests can define handlers locally if desired.
export { http, HttpResponse };
