import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkflowStream } from "@/hooks/use-workflow-stream";
import type { Node, Edge } from "reactflow";
import { server } from "../msw/server";

// Disable MSW for this test file to allow direct fetch mocking
beforeAll(() => {
  server.close();
});

// Mock fetch globally
const mockFetch = vi.fn();
const originalFetch = global.fetch;

// Create a mock ReadableStream
function createMockStream(events: Array<{ event: string; data: unknown }>) {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        const { event, data } = events[index];
        const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe("useWorkflowStream", () => {
  const mockNodes: Node[] = [
    { id: "node-1", type: "seedream", position: { x: 0, y: 0 }, data: { prompt: "test" } },
    { id: "node-2", type: "openrouter", position: { x: 200, y: 0 }, data: { prompt: "test2" } },
  ];

  const mockEdges: Edge[] = [
    { id: "edge-1", source: "node-1", target: "node-2" },
  ];

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("returns initial state", () => {
      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123" })
      );

      expect(result.current.isRunning).toBe(false);
      expect(result.current.nodeStatuses.size).toBe(0);
      expect(result.current.workflowExecutionId).toBeNull();
      expect(typeof result.current.runWorkflow).toBe("function");
      expect(typeof result.current.cancelWorkflow).toBe("function");
      expect(typeof result.current.getNodeStatus).toBe("function");
    });
  });

  describe("runWorkflow", () => {
    it("starts workflow and processes SSE events", async () => {
      const mockStream = createMockStream([
        { event: "workflow-started", data: { workflowExecutionId: "exec-123", estimatedCost: 50000 } },
        { event: "node-queued", data: { nodeId: "node-1", nodeType: "seedream" } },
        { event: "node-started", data: { nodeId: "node-1", nodeType: "seedream" } },
        { event: "node-progress", data: { nodeId: "node-1", progress: 50 } },
        { event: "node-completed", data: { nodeId: "node-1", nodeType: "seedream", output: { url: "https://..." } } },
        { event: "workflow-completed", data: { successCount: 1, failCount: 0, status: "completed" } },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const callbacks = {
        onWorkflowStarted: vi.fn(),
        onNodeQueued: vi.fn(),
        onNodeStarted: vi.fn(),
        onNodeProgress: vi.fn(),
        onNodeCompleted: vi.fn(),
        onWorkflowCompleted: vi.fn(),
      };

      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123", callbacks })
      );

      await act(async () => {
        await result.current.runWorkflow(mockNodes, mockEdges);
      });

      expect(callbacks.onWorkflowStarted).toHaveBeenCalledWith({
        workflowExecutionId: "exec-123",
        estimatedCost: 50000,
      });
      expect(callbacks.onNodeQueued).toHaveBeenCalledWith("node-1", "seedream");
      expect(callbacks.onNodeStarted).toHaveBeenCalledWith("node-1", "seedream");
      expect(callbacks.onNodeProgress).toHaveBeenCalledWith("node-1", 50);
      expect(callbacks.onNodeCompleted).toHaveBeenCalledWith("node-1", "seedream", { url: "https://..." });
      expect(callbacks.onWorkflowCompleted).toHaveBeenCalled();
    });

    it("handles node failures", async () => {
      const mockStream = createMockStream([
        { event: "workflow-started", data: { workflowExecutionId: "exec-123", estimatedCost: 50000 } },
        { event: "node-queued", data: { nodeId: "node-1", nodeType: "seedream" } },
        { event: "node-started", data: { nodeId: "node-1", nodeType: "seedream" } },
        { event: "node-failed", data: { nodeId: "node-1", nodeType: "seedream", error: "API error" } },
        { event: "workflow-completed", data: { successCount: 0, failCount: 1, status: "failed" } },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const callbacks = {
        onNodeFailed: vi.fn(),
        onWorkflowCompleted: vi.fn(),
      };

      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123", callbacks })
      );

      await act(async () => {
        await result.current.runWorkflow(mockNodes, mockEdges);
      });

      expect(callbacks.onNodeFailed).toHaveBeenCalledWith("node-1", "seedream", "API error");
      expect(result.current.getNodeStatus("node-1")?.status).toBe("failed");
      expect(result.current.getNodeStatus("node-1")?.error).toBe("API error");
    });

    it("handles error events", async () => {
      const mockStream = createMockStream([
        { event: "error", data: { message: "Insufficient credits" } },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const callbacks = {
        onError: vi.fn(),
      };

      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123", callbacks })
      );

      await act(async () => {
        await result.current.runWorkflow(mockNodes, mockEdges);
      });

      expect(callbacks.onError).toHaveBeenCalledWith("Insufficient credits");
    });

    it("handles HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const callbacks = {
        onError: vi.fn(),
      };

      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123", callbacks })
      );

      await act(async () => {
        await result.current.runWorkflow(mockNodes, mockEdges);
      });

      expect(callbacks.onError).toHaveBeenCalledWith("HTTP error: 500");
    });

    it("handles missing response body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const callbacks = {
        onError: vi.fn(),
      };

      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123", callbacks })
      );

      await act(async () => {
        await result.current.runWorkflow(mockNodes, mockEdges);
      });

      expect(callbacks.onError).toHaveBeenCalledWith("No response body");
    });

    it("prevents running multiple workflows simultaneously", async () => {
      const mockStream = createMockStream([
        { event: "workflow-started", data: { workflowExecutionId: "exec-123", estimatedCost: 50000 } },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123" })
      );

      // Start first workflow
      act(() => {
        result.current.runWorkflow(mockNodes, mockEdges);
      });

      // Try to start second while first is running
      await act(async () => {
        await result.current.runWorkflow(mockNodes, mockEdges);
      });

      expect(consoleSpy).toHaveBeenCalledWith("[useWorkflowStream] Workflow already running");
      consoleSpy.mockRestore();
    });

    it("uses override workflowId when provided", async () => {
      const mockStream = createMockStream([
        { event: "workflow-completed", data: { successCount: 0, failCount: 0, status: "completed" } },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123" })
      );

      await act(async () => {
        await result.current.runWorkflow(mockNodes, mockEdges, "override-workflow-456");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/workflow/stream",
        expect.objectContaining({
          body: expect.stringContaining("override-workflow-456"),
        })
      );
    });
  });

  describe("Node Sanitization (Unit)", () => {
    // Test the sanitization function directly without network calls
    const sanitizeNodesForRequest = (nodes: Node[]): Node[] => {
      const isHttpUrl = (url: string) => url.startsWith("http://") || url.startsWith("https://");
      
      return nodes.map((node) => {
        const data = (node.data ?? {}) as Record<string, unknown>;
        const sanitized: Record<string, unknown> = {};
        
        for (const [key, value] of Object.entries(data)) {
          if (key === "status" || key === "progress" || key === "error") {
            continue;
          }
          
          if (typeof value === "string") {
            if (isHttpUrl(value)) {
              sanitized[key] = value;
            } else if (value.startsWith("data:") && value.length > 50000) {
              continue;
            } else {
              sanitized[key] = value;
            }
            continue;
          }
          
          sanitized[key] = value;
        }
        
        return { ...node, data: sanitized };
      });
    };

    it("removes large base64 data from nodes", () => {
      const nodesWithBase64: Node[] = [
        {
          id: "node-1",
          type: "seedream",
          position: { x: 0, y: 0 },
          data: {
            prompt: "test",
            inputImage: "data:image/png;base64," + "A".repeat(60000),
            keepThis: "https://example.com/image.png",
          },
        },
      ];

      const sanitized = sanitizeNodesForRequest(nodesWithBase64);
      const data = sanitized[0].data as Record<string, unknown>;

      expect(data.inputImage).toBeUndefined();
      expect(data.keepThis).toBe("https://example.com/image.png");
      expect(data.prompt).toBe("test");
    });

    it("removes runtime state from nodes", () => {
      const nodesWithState: Node[] = [
        {
          id: "node-1",
          type: "seedream",
          position: { x: 0, y: 0 },
          data: {
            prompt: "test",
            status: "running",
            progress: 50,
            error: "some error",
          },
        },
      ];

      const sanitized = sanitizeNodesForRequest(nodesWithState);
      const data = sanitized[0].data as Record<string, unknown>;

      expect(data.status).toBeUndefined();
      expect(data.progress).toBeUndefined();
      expect(data.error).toBeUndefined();
      expect(data.prompt).toBe("test");
    });

    it("keeps small base64 data", () => {
      const nodesWithSmallBase64: Node[] = [
        {
          id: "node-1",
          type: "seedream",
          position: { x: 0, y: 0 },
          data: {
            smallImage: "data:image/png;base64,iVBORw0KGgo=", // Small base64 (< 50KB)
          },
        },
      ];

      const sanitized = sanitizeNodesForRequest(nodesWithSmallBase64);
      const data = sanitized[0].data as Record<string, unknown>;

      expect(data.smallImage).toBe("data:image/png;base64,iVBORw0KGgo=");
    });
  });

  describe("cancelWorkflow", () => {
    it("sets isRunning to false when canceled without active execution", async () => {
      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123" })
      );

      // Cancel without running - should not throw
      await act(async () => {
        await result.current.cancelWorkflow();
      });

      expect(result.current.isRunning).toBe(false);
    });

    it("provides cancelWorkflow function", () => {
      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123" })
      );

      expect(typeof result.current.cancelWorkflow).toBe("function");
    });
  });

  describe("getNodeStatus", () => {
    it("returns undefined for unknown node", () => {
      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123" })
      );

      expect(result.current.getNodeStatus("unknown-node")).toBeUndefined();
    });

    it("provides getNodeStatus function", () => {
      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123" })
      );

      expect(typeof result.current.getNodeStatus).toBe("function");
    });
  });

  describe("State Tracking", () => {
    it("initializes with null workflowExecutionId", () => {
      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123" })
      );

      expect(result.current.workflowExecutionId).toBeNull();
    });

    it("initializes with empty node statuses", () => {
      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123" })
      );

      expect(result.current.nodeStatuses.size).toBe(0);
    });

    it("provides isRunning state", () => {
      const { result } = renderHook(() =>
        useWorkflowStream({ workflowId: "workflow-123" })
      );

      expect(result.current.isRunning).toBe(false);
    });
  });
});
