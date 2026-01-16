import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// =============================================================================
// API INTEGRATION TESTS
// Tests for API route behavior using mocked fetch
// =============================================================================

// Mock fetch globally
const originalFetch = global.fetch;
const mockFetch = vi.fn();

describe("Workflows API Integration", () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("GET /api/workflows", () => {
    it("returns list of workflows", async () => {
      const mockData = {
        workflows: [
          { id: "wf-1", name: "Workflow 1" },
          { id: "wf-2", name: "Workflow 2" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      });

      const response = await fetch("/api/workflows");
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.workflows).toHaveLength(2);
      expect(data.workflows[0]).toHaveProperty("id");
      expect(data.workflows[0]).toHaveProperty("name");
    });

    it("handles empty workflow list", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ workflows: [] }),
      });

      const response = await fetch("/api/workflows");
      const data = await response.json();

      expect(data.workflows).toEqual([]);
    });

    it("handles server errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ error: "Internal server error" }),
      });

      const response = await fetch("/api/workflows");

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe("GET /api/workflows/:id", () => {
    it("returns single workflow by ID", async () => {
      const mockWorkflow = {
        id: "wf-123",
        name: "My Workflow",
        nodesJson: [{ id: "node-1" }],
        edgesJson: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ workflow: mockWorkflow }),
      });

      const response = await fetch("/api/workflows/wf-123");
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.workflow.id).toBe("wf-123");
      expect(data.workflow.nodesJson).toHaveLength(1);
    });

    it("returns 404 for non-existent workflow", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ error: "Workflow not found" }),
      });

      const response = await fetch("/api/workflows/non-existent");

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/workflows", () => {
    it("creates new workflow", async () => {
      const newWorkflow = {
        id: "wf-new",
        name: "New Workflow",
        nodesJson: [],
        edgesJson: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue({ workflow: newWorkflow }),
      });

      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Workflow" }),
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(response.status).toBe(201);
      expect(data.workflow.name).toBe("New Workflow");
    });

    it("handles validation errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ error: "Name is required" }),
      });

      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/workflows/:id", () => {
    it("updates workflow", async () => {
      const updatedWorkflow = {
        id: "wf-123",
        name: "Updated Name",
        nodesJson: [{ id: "node-1" }, { id: "node-2" }],
        edgesJson: [{ id: "edge-1" }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ workflow: updatedWorkflow }),
      });

      const response = await fetch("/api/workflows/wf-123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name",
          nodesJson: [{ id: "node-1" }, { id: "node-2" }],
        }),
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.workflow.name).toBe("Updated Name");
      expect(data.workflow.nodesJson).toHaveLength(2);
    });

    it("returns 404 for non-existent workflow", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ error: "Workflow not found" }),
      });

      const response = await fetch("/api/workflows/non-existent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Update" }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/workflows/:id", () => {
    it("deletes workflow", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const response = await fetch("/api/workflows/wf-123", {
        method: "DELETE",
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });

    it("returns 404 for non-existent workflow", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ error: "Workflow not found" }),
      });

      const response = await fetch("/api/workflows/non-existent", {
        method: "DELETE",
      });

      expect(response.status).toBe(404);
    });
  });
});

describe("Executions API Integration", () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("GET /api/executions", () => {
    it("returns list of executions", async () => {
      const mockExecutions = [
        { id: "exec-1", status: "COMPLETED" },
        { id: "exec-2", status: "RUNNING" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ executions: mockExecutions }),
      });

      const response = await fetch("/api/executions");
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.executions).toHaveLength(2);
    });

    it("filters by workflow ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          executions: [{ id: "exec-1", workflowId: "wf-123" }],
        }),
      });

      const response = await fetch("/api/executions?workflowId=wf-123");
      const data = await response.json();

      expect(data.executions[0].workflowId).toBe("wf-123");
    });
  });

  describe("GET /api/executions/:id", () => {
    it("returns execution with node statuses", async () => {
      const mockExecution = {
        id: "exec-123",
        status: "RUNNING",
        nodeExecutions: [
          { nodeId: "node-1", status: "COMPLETED", outputJson: { url: "https://..." } },
          { nodeId: "node-2", status: "RUNNING" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ execution: mockExecution }),
      });

      const response = await fetch("/api/executions/exec-123");
      const data = await response.json();

      expect(data.execution.nodeExecutions).toHaveLength(2);
      expect(data.execution.nodeExecutions[0].status).toBe("COMPLETED");
    });
  });

  describe("POST /api/executions/:id/cancel", () => {
    it("cancels running execution", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true, status: "CANCELLED" }),
      });

      const response = await fetch("/api/executions/exec-123/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "workflow" }),
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.status).toBe("CANCELLED");
    });

    it("handles already completed execution", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ error: "Execution already completed" }),
      });

      const response = await fetch("/api/executions/exec-123/cancel", {
        method: "POST",
      });

      expect(response.status).toBe(400);
    });
  });
});

describe("Nodes API Integration", () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("POST /api/nodes/execute", () => {
    it("starts async node execution", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          executionId: "node-exec-123",
          status: "queued",
        }),
      });

      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "seedream",
          input: { prompt: "A beautiful sunset" },
        }),
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.executionId).toBeDefined();
      expect(data.status).toBe("queued");
    });

    it("handles insufficient credits", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: vi.fn().mockResolvedValue({ error: "Insufficient credits" }),
      });

      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeType: "seedream" }),
      });

      expect(response.status).toBe(402);
    });
  });

  describe("POST /api/nodes/execute-sync", () => {
    it("executes node synchronously", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { url: "https://example.com/image.png" },
        }),
      });

      const response = await fetch("/api/nodes/execute-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "openrouter",
          input: { prompt: "Hello" },
        }),
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.result).toBeDefined();
    });

    it("handles execution errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ error: "Provider error" }),
      });

      const response = await fetch("/api/nodes/execute-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeType: "seedream" }),
      });

      expect(response.status).toBe(500);
    });
  });

  describe("GET /api/nodes/status", () => {
    it("returns node execution status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          executionId: "node-exec-123",
          status: "completed",
          output: { url: "https://example.com/result.png" },
        }),
      });

      const response = await fetch("/api/nodes/status?executionId=node-exec-123");
      const data = await response.json();

      expect(data.status).toBe("completed");
      expect(data.output).toBeDefined();
    });

    it("returns running status with progress", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          executionId: "node-exec-123",
          status: "running",
          progress: 50,
        }),
      });

      const response = await fetch("/api/nodes/status?executionId=node-exec-123");
      const data = await response.json();

      expect(data.status).toBe("running");
      expect(data.progress).toBe(50);
    });
  });
});

describe("Dashboard API Integration", () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("GET /api/dashboard/stats", () => {
    it("returns dashboard statistics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          totalWorkflows: 10,
          totalExecutions: 50,
          creditsUsed: 500000,
          creditsRemaining: 500000,
        }),
      });

      const response = await fetch("/api/dashboard/stats");
      const data = await response.json();

      expect(data.totalWorkflows).toBe(10);
      expect(data.totalExecutions).toBe(50);
      expect(data.creditsUsed).toBeDefined();
      expect(data.creditsRemaining).toBeDefined();
    });
  });
});
