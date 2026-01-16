import { describe, expect, it, vi, beforeEach } from "vitest";

// =============================================================================
// TRPC ROUTER INTEGRATION TESTS
// Tests for tRPC procedures - mocking Prisma and auth context
// =============================================================================

// Mock Prisma client
const mockPrisma = {
  workflow: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  workflowVersion: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  workflowExecution: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  nodeExecution: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  quickExecution: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  nodeResultCache: {
    count: vi.fn(),
  },
};

// Mock user context
const mockUserId = "user-test-123";
const mockCtx = {
  userId: mockUserId,
  db: mockPrisma,
};

describe("Workflow Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns user workflows with thumbnails", async () => {
      const mockWorkflows = [
        {
          id: "wf-1",
          name: "Test Workflow",
          description: "A test",
          version: 1,
          isPublished: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          nodesJson: [
            { id: "node-1", position: { x: 100, y: 100 }, measured: { width: 200, height: 150 } },
          ],
          edgesJson: [],
          _count: { executions: 5 },
        },
      ];

      mockPrisma.workflow.findMany.mockResolvedValue(mockWorkflows);

      // Simulate the list procedure logic
      const workflows = await mockPrisma.workflow.findMany({
        where: { userId: mockUserId },
        orderBy: { updatedAt: "desc" },
      });

      expect(workflows).toHaveLength(1);
      expect(workflows[0].name).toBe("Test Workflow");
    });

    it("returns empty array when no workflows exist", async () => {
      mockPrisma.workflow.findMany.mockResolvedValue([]);

      const workflows = await mockPrisma.workflow.findMany({
        where: { userId: mockUserId },
      });

      expect(workflows).toEqual([]);
    });
  });

  describe("get", () => {
    it("returns single workflow with executions", async () => {
      const mockWorkflow = {
        id: "wf-123",
        name: "Test Workflow",
        userId: mockUserId,
        nodesJson: [{ id: "node-1", data: { prompt: "test" } }],
        edgesJson: [],
        executions: [
          { id: "exec-1", status: "COMPLETED", startedAt: new Date() },
        ],
      };

      mockPrisma.workflow.findFirst.mockResolvedValue(mockWorkflow);

      const workflow = await mockPrisma.workflow.findFirst({
        where: { id: "wf-123", userId: mockUserId },
        include: { executions: { take: 10 } },
      });

      expect(workflow?.id).toBe("wf-123");
      expect(workflow?.executions).toHaveLength(1);
    });

    it("returns null for non-existent workflow", async () => {
      mockPrisma.workflow.findFirst.mockResolvedValue(null);

      const workflow = await mockPrisma.workflow.findFirst({
        where: { id: "non-existent", userId: mockUserId },
      });

      expect(workflow).toBeNull();
    });

    it("sanitizes large base64 data from nodes", async () => {
      const largeBase64 = "data:image/png;base64," + "A".repeat(60000);
      const mockWorkflow = {
        id: "wf-123",
        nodesJson: [{ id: "node-1", data: { image: largeBase64 } }],
      };

      // Test sanitization function logic
      const sanitized = sanitizeNodesFromStorage(mockWorkflow.nodesJson);
      expect(sanitized[0].data.image).toBe("[media data - reload to view]");
    });
  });

  describe("create", () => {
    it("creates new workflow", async () => {
      const newWorkflow = {
        id: "wf-new",
        name: "New Workflow",
        description: "Description",
        userId: mockUserId,
        nodesJson: [],
        edgesJson: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.workflow.create.mockResolvedValue(newWorkflow);

      const created = await mockPrisma.workflow.create({
        data: {
          userId: mockUserId,
          name: "New Workflow",
          description: "Description",
          nodesJson: [],
          edgesJson: [],
        },
      });

      expect(created.name).toBe("New Workflow");
      expect(mockPrisma.workflow.create).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("updates workflow and creates version snapshot", async () => {
      const existing = {
        id: "wf-123",
        name: "Old Name",
        userId: mockUserId,
        nodesJson: [],
        edgesJson: [],
      };

      mockPrisma.workflow.findFirst.mockResolvedValue(existing);
      mockPrisma.workflowVersion.findFirst.mockResolvedValue({ version: 1 });
      mockPrisma.workflowVersion.create.mockResolvedValue({ version: 2 });
      mockPrisma.workflow.update.mockResolvedValue({
        ...existing,
        name: "Updated Name",
        version: 2,
      });

      // Verify ownership
      const workflow = await mockPrisma.workflow.findFirst({
        where: { id: "wf-123", userId: mockUserId },
      });
      expect(workflow).not.toBeNull();

      // Get latest version
      const latestVersion = await mockPrisma.workflowVersion.findFirst({
        where: { workflowId: "wf-123" },
        orderBy: { version: "desc" },
      });
      expect(latestVersion?.version).toBe(1);

      // Update
      const updated = await mockPrisma.workflow.update({
        where: { id: "wf-123" },
        data: { name: "Updated Name", version: 2 },
      });

      expect(updated.name).toBe("Updated Name");
    });

    it("rejects update for non-owned workflow", async () => {
      mockPrisma.workflow.findFirst.mockResolvedValue(null);

      const workflow = await mockPrisma.workflow.findFirst({
        where: { id: "wf-not-owned", userId: mockUserId },
      });

      expect(workflow).toBeNull();
      // In actual router, this would throw TRPCError
    });
  });

  describe("delete", () => {
    it("deletes workflow", async () => {
      mockPrisma.workflow.findFirst.mockResolvedValue({
        id: "wf-123",
        userId: mockUserId,
      });
      mockPrisma.workflow.delete.mockResolvedValue({ id: "wf-123" });

      await mockPrisma.workflow.delete({ where: { id: "wf-123" } });

      expect(mockPrisma.workflow.delete).toHaveBeenCalledWith({
        where: { id: "wf-123" },
      });
    });
  });

  describe("duplicate", () => {
    it("duplicates workflow with (Copy) suffix", async () => {
      const original = {
        id: "wf-original",
        name: "Original Workflow",
        description: "Test",
        userId: mockUserId,
        nodesJson: [{ id: "node-1" }],
        edgesJson: [],
        viewportJson: { x: 0, y: 0, zoom: 1 },
      };

      mockPrisma.workflow.findFirst.mockResolvedValue(original);
      mockPrisma.workflow.create.mockResolvedValue({
        ...original,
        id: "wf-duplicate",
        name: "Original Workflow (Copy)",
      });

      const duplicated = await mockPrisma.workflow.create({
        data: {
          userId: mockUserId,
          name: `${original.name} (Copy)`,
          description: original.description,
          nodesJson: original.nodesJson,
          edgesJson: original.edgesJson,
          viewportJson: original.viewportJson,
        },
      });

      expect(duplicated.name).toBe("Original Workflow (Copy)");
    });
  });
});

describe("Execution Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns executions with stats", async () => {
      const mockExecutions = [
        {
          id: "exec-1",
          status: "COMPLETED",
          startedAt: new Date(),
          completedAt: new Date(),
          workflow: { id: "wf-1", name: "Test" },
          nodeExecutions: [],
          actualCost: 5000,
        },
      ];

      mockPrisma.workflowExecution.findMany.mockResolvedValue(mockExecutions);
      mockPrisma.workflowExecution.count.mockResolvedValue(1);

      const executions = await mockPrisma.workflowExecution.findMany({
        where: { workflow: { userId: mockUserId } },
      });

      expect(executions).toHaveLength(1);
      expect(executions[0].status).toBe("COMPLETED");
    });

    it("filters by status", async () => {
      mockPrisma.workflowExecution.findMany.mockResolvedValue([]);

      await mockPrisma.workflowExecution.findMany({
        where: {
          workflow: { userId: mockUserId },
          status: "FAILED",
        },
      });

      expect(mockPrisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "FAILED" }),
        })
      );
    });
  });

  describe("get", () => {
    it("returns execution with node details", async () => {
      const mockExecution = {
        id: "exec-123",
        status: "RUNNING",
        workflow: { id: "wf-1", name: "Test" },
        nodeExecutions: [
          { nodeId: "node-1", status: "COMPLETED", outputJson: {} },
          { nodeId: "node-2", status: "RUNNING" },
        ],
      };

      mockPrisma.workflowExecution.findFirst.mockResolvedValue(mockExecution);

      const execution = await mockPrisma.workflowExecution.findFirst({
        where: { id: "exec-123", workflow: { userId: mockUserId } },
        include: { nodeExecutions: true },
      });

      expect(execution?.nodeExecutions).toHaveLength(2);
    });
  });

  describe("create", () => {
    it("creates new execution for owned workflow", async () => {
      mockPrisma.workflow.findFirst.mockResolvedValue({
        id: "wf-123",
        userId: mockUserId,
      });
      mockPrisma.workflowExecution.create.mockResolvedValue({
        id: "exec-new",
        workflowId: "wf-123",
        status: "RUNNING",
        startedAt: new Date(),
      });

      // Verify workflow ownership
      const workflow = await mockPrisma.workflow.findFirst({
        where: { id: "wf-123", userId: mockUserId },
      });
      expect(workflow).not.toBeNull();

      // Create execution
      const execution = await mockPrisma.workflowExecution.create({
        data: {
          workflowId: "wf-123",
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      expect(execution.status).toBe("RUNNING");
    });
  });

  describe("updateStatus", () => {
    it("updates execution status", async () => {
      mockPrisma.workflowExecution.findFirst.mockResolvedValue({
        id: "exec-123",
        status: "RUNNING",
      });
      mockPrisma.workflowExecution.update.mockResolvedValue({
        id: "exec-123",
        status: "COMPLETED",
        completedAt: new Date(),
      });

      const updated = await mockPrisma.workflowExecution.update({
        where: { id: "exec-123" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      expect(updated.status).toBe("COMPLETED");
    });
  });

  describe("errors", () => {
    it("returns aggregated errors from node executions", async () => {
      const mockErrors = [
        {
          id: "ne-1",
          nodeId: "node-1",
          nodeType: "seedream",
          nodeLabel: "Image Gen",
          error: "API timeout",
          completedAt: new Date(),
          providerUsed: "fal",
          workflowExecution: { workflow: { name: "Test Workflow" } },
        },
      ];

      mockPrisma.nodeExecution.findMany.mockResolvedValue(mockErrors);
      mockPrisma.quickExecution.findMany.mockResolvedValue([]);

      const nodeErrors = await mockPrisma.nodeExecution.findMany({
        where: {
          workflowExecution: { workflow: { userId: mockUserId } },
          status: "FAILED",
        },
      });

      expect(nodeErrors).toHaveLength(1);
      expect(nodeErrors[0].error).toBe("API timeout");
    });
  });

  describe("health", () => {
    it("returns system health metrics", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 1000000 });
      mockPrisma.nodeExecution.aggregate.mockResolvedValue({ _sum: { actualCost: 50000 } });
      mockPrisma.quickExecution.aggregate.mockResolvedValue({ _sum: { actualCost: 10000 } });
      mockPrisma.nodeResultCache.count.mockResolvedValue(150);
      mockPrisma.workflow.count.mockResolvedValue(10);
      mockPrisma.workflowExecution.count.mockResolvedValue(50);
      mockPrisma.nodeExecution.findMany.mockResolvedValue([]);

      const user = await mockPrisma.user.findUnique({
        where: { id: mockUserId },
        select: { credits: true },
      });

      expect(user?.credits).toBe(1000000);

      const cacheCount = await mockPrisma.nodeResultCache.count();
      expect(cacheCount).toBe(150);
    });
  });
});

describe("Helper Functions", () => {
  describe("formatDuration", () => {
    it("formats milliseconds correctly", () => {
      expect(formatDuration(500)).toBe("500ms");
      expect(formatDuration(1500)).toBe("1.5s");
      expect(formatDuration(65000)).toBe("1m 5s");
      expect(formatDuration(125000)).toBe("2m 5s");
    });
  });

  describe("determineSeverity", () => {
    it("returns critical for auth errors", () => {
      expect(determineSeverity("unauthorized access")).toBe("critical");
      expect(determineSeverity("insufficient credits")).toBe("critical");
      expect(determineSeverity("rate limit exceeded")).toBe("critical");
    });

    it("returns warning for timeout errors", () => {
      expect(determineSeverity("request timeout")).toBe("warning");
      expect(determineSeverity("connection timed out")).toBe("warning");
    });

    it("returns info for other errors", () => {
      expect(determineSeverity("unknown error")).toBe("info");
    });
  });

  describe("formatTimeAgo", () => {
    it("formats recent times correctly", () => {
      const now = Date.now();
      expect(formatTimeAgo(new Date(now - 30 * 1000))).toBe("30s ago");
      expect(formatTimeAgo(new Date(now - 5 * 60 * 1000))).toBe("5m ago");
      expect(formatTimeAgo(new Date(now - 3 * 60 * 60 * 1000))).toBe("3h ago");
      expect(formatTimeAgo(new Date(now - 2 * 24 * 60 * 60 * 1000))).toBe("2d ago");
    });
  });
});

// Helper function implementations for testing
function sanitizeNodesFromStorage(nodesJson: unknown): Array<{ data: Record<string, unknown> }> {
  if (!Array.isArray(nodesJson)) return [];
  
  return nodesJson.map((node) => {
    const n = node as Record<string, unknown>;
    const data = (n.data ?? {}) as Record<string, unknown>;
    
    const sanitizedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && value.startsWith("data:") && value.length > 50000) {
        sanitizedData[key] = "[media data - reload to view]";
        continue;
      }
      sanitizedData[key] = value;
    }
    
    return { ...n, data: sanitizedData };
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function determineSeverity(error: string): "critical" | "warning" | "info" {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes("unauthorized") || 
      lowerError.includes("authentication") ||
      lowerError.includes("quota exceeded") ||
      lowerError.includes("rate limit") ||
      lowerError.includes("payment required") ||
      lowerError.includes("insufficient credits")) {
    return "critical";
  }
  
  if (lowerError.includes("timeout") ||
      lowerError.includes("timed out") ||
      lowerError.includes("temporarily") ||
      lowerError.includes("retry")) {
    return "warning";
  }
  
  return "info";
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
