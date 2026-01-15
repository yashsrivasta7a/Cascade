import { describe, expect, it, vi } from "vitest";

// Avoid pulling heavy workflow execution logic into unit tests.
vi.mock("@/lib/workflow/run-workflow", () => ({
  runSingleNode: vi.fn(),
  runNodeWithDependencies: vi.fn(),
}));

import type { Edge, Node } from "reactflow";
import { useFlowStore } from "@/store/flow-store";

describe("useFlowStore (Zustand)", () => {
  it("clamps propagated setting values to valid ranges", () => {
    const a: Node = {
      id: "a",
      type: "openrouter",
      position: { x: 0, y: 0 },
      data: { temperature: 0.5 },
    };
    const b: Node = {
      id: "b",
      type: "openrouter",
      position: { x: 100, y: 0 },
      data: {},
    };

    const edge: Edge = {
      id: "e1",
      source: "a",
      target: "b",
      sourceHandle: "out",
      targetHandle: "temperature",
    };

    useFlowStore.setState({
      nodes: [a, b],
      edges: [edge],
      selectedNode: null,
      viewport: undefined,
      isWorkflowRunning: false,
      focusNodeId: null,
      workflowId: null,
      highlightedNodeIds: [],
      currentWorkflowExecutionId: null,
      currentTriggerRunId: null,
      runningNodeIds: new Map(),
      nodeAbortControllers: new Map(),
      connectingFrom: null,
    } as any);

    // Source sets temperature above max (2.0). Target should get clamped to 2.
    useFlowStore.getState().updateNode("a", { temperature: 999 } as any);
    const updatedB = useFlowStore.getState().nodes.find((n: Node) => n.id === "b")!;
    expect((updatedB.data as any).temperature).toBe(2);
  });
});

