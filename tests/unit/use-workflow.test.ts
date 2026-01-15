import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWorkflow } from "@/hooks/use-workflow";

describe("useWorkflow()", () => {
  it("loads a workflow via GET /api/workflows/:id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            workflow: {
              id: "w1",
              name: "Test",
              nodesJson: [],
              edgesJson: [],
              version: 1,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const { result } = renderHook(() => useWorkflow());

    await act(async () => {
      await result.current.loadWorkflow("w1");
    });

    await waitFor(() => {
      expect(result.current.workflow?.id).toBe("w1");
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/workflows/w1");
    fetchMock.mockRestore();
  });

  it("sets error when executeWorkflow is called without an id", async () => {
    const { result } = renderHook(() => useWorkflow());
    await act(async () => {
      const res = await result.current.executeWorkflow();
      expect(res).toBeNull();
    });
    expect(result.current.error).toBe("No workflow ID provided");
  });
});

