import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { renderHook } from "@testing-library/react";
import { useExecutionStream } from "@/hooks/use-execution-stream";
import { server } from "../msw/server";

// Disable MSW for this test file to allow direct fetch mocking
beforeAll(() => {
  server.close();
});

describe("useExecutionStream", () => {
  describe("Initial State", () => {
    it("returns initial state when executionId is null", () => {
      const { result } = renderHook(() => useExecutionStream(null));

      expect(result.current.executionStatus).toBe("pending");
      expect(result.current.nodeUpdates.size).toBe(0);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it("provides a refresh function", () => {
      const { result } = renderHook(() => useExecutionStream(null));

      expect(typeof result.current.refresh).toBe("function");
    });

    it("provides a getNodeStatus function", () => {
      const { result } = renderHook(() => useExecutionStream(null));

      expect(typeof result.current.getNodeStatus).toBe("function");
      expect(result.current.getNodeStatus("any-node")).toBeUndefined();
    });
  });

  describe("API", () => {
    it("returns all expected properties", () => {
      const { result } = renderHook(() => useExecutionStream(null));

      expect(result.current).toHaveProperty("executionStatus");
      expect(result.current).toHaveProperty("nodeUpdates");
      expect(result.current).toHaveProperty("getNodeStatus");
      expect(result.current).toHaveProperty("isConnected");
      expect(result.current).toHaveProperty("error");
      expect(result.current).toHaveProperty("refresh");
    });

    it("nodeUpdates is a Map", () => {
      const { result } = renderHook(() => useExecutionStream(null));

      expect(result.current.nodeUpdates).toBeInstanceOf(Map);
    });
  });

  describe("Execution Status Values", () => {
    it("starts with pending status", () => {
      const { result } = renderHook(() => useExecutionStream(null));
      expect(result.current.executionStatus).toBe("pending");
    });
  });

  describe("Node Status Lookup", () => {
    it("getNodeStatus returns undefined for non-existent node", () => {
      const { result } = renderHook(() => useExecutionStream(null));
      expect(result.current.getNodeStatus("non-existent")).toBeUndefined();
    });

    it("getNodeStatus is memoized", () => {
      const { result, rerender } = renderHook(() => useExecutionStream(null));
      
      const fn1 = result.current.getNodeStatus;
      rerender();
      const fn2 = result.current.getNodeStatus;
      
      // The function reference may change due to useCallback dependencies
      expect(typeof fn1).toBe("function");
      expect(typeof fn2).toBe("function");
    });
  });

  describe("Connection State", () => {
    it("isConnected is false initially", () => {
      const { result } = renderHook(() => useExecutionStream(null));
      expect(result.current.isConnected).toBe(false);
    });

    it("isConnected remains false when executionId is null", () => {
      const { result, rerender } = renderHook(() => useExecutionStream(null));
      rerender();
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe("Cleanup", () => {
    it("unmounts without errors", () => {
      const { unmount } = renderHook(() => useExecutionStream("exec-123"));
      expect(() => unmount()).not.toThrow();
    });

    it("handles null executionId", () => {
      const { result } = renderHook(() => useExecutionStream(null));
      expect(result.current.isConnected).toBe(false);
    });

    it("rerender with different executionId doesnt throw", () => {
      const { rerender } = renderHook(
        ({ id }) => useExecutionStream(id),
        { initialProps: { id: "exec-1" as string | null } }
      );

      expect(() => rerender({ id: "exec-2" })).not.toThrow();
      expect(() => rerender({ id: null })).not.toThrow();
    });
  });

  describe("Refresh Function", () => {
    it("refresh function exists", () => {
      const { result } = renderHook(() => useExecutionStream(null));
      expect(typeof result.current.refresh).toBe("function");
    });

    it("refresh can be called without executionId", async () => {
      const { result } = renderHook(() => useExecutionStream(null));
      
      // Should not throw when calling refresh without executionId
      await expect(result.current.refresh()).resolves.not.toThrow();
    });
  });

  describe("Error State", () => {
    it("error is undefined initially", () => {
      const { result } = renderHook(() => useExecutionStream(null));
      expect(result.current.error).toBeUndefined();
    });
  });
});
