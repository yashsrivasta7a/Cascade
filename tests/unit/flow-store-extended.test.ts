import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Edge, Node } from "reactflow";

// Avoid pulling heavy workflow execution logic into unit tests.
vi.mock("@/lib/workflow/run-workflow", () => ({
  runSingleNode: vi.fn(),
  runNodeWithDependencies: vi.fn(),
}));

import { useFlowStore } from "@/store/flow-store";

describe("useFlowStore Extended Tests", () => {
  beforeEach(() => {
    // Reset store to initial state
    useFlowStore.setState({
      nodes: [],
      edges: [],
      selectedNode: null,
      selectedNodeIds: [],
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
      history: [],
      historyIndex: -1,
      clipboard: null,
    } as any);
  });

  describe("Node Operations", () => {
    it("adds a node to the store", () => {
      const node: Node = {
        id: "test-1",
        type: "seedream",
        position: { x: 0, y: 0 },
        data: { label: "Test Node" },
      };

      useFlowStore.getState().addNode(node);
      const nodes = useFlowStore.getState().nodes;

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe("test-1");
    });

    it("updates node data correctly", () => {
      const node: Node = {
        id: "test-1",
        type: "openrouter",
        position: { x: 0, y: 0 },
        data: { temperature: 0.5, prompt: "initial" },
      };

      useFlowStore.setState({ nodes: [node] } as any);
      useFlowStore.getState().updateNode("test-1", { temperature: 0.8, prompt: "updated" } as any);

      const updatedNode = useFlowStore.getState().nodes.find(n => n.id === "test-1");
      expect((updatedNode?.data as any).temperature).toBe(0.8);
      expect((updatedNode?.data as any).prompt).toBe("updated");
    });

    it("deletes a node and its connected edges", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 100, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "b" },
      ];

      useFlowStore.setState({ nodes, edges } as any);
      useFlowStore.getState().deleteNode("a");

      const state = useFlowStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe("b");
      expect(state.edges).toHaveLength(0);
    });

    it("duplicates a node with offset position", () => {
      const node: Node = {
        id: "original",
        type: "seedream",
        position: { x: 100, y: 100 },
        data: { prompt: "test" },
      };

      useFlowStore.setState({ nodes: [node] } as any);
      useFlowStore.getState().duplicateNode("original");

      const nodes = useFlowStore.getState().nodes;
      expect(nodes).toHaveLength(2);
      
      const duplicate = nodes.find(n => n.id !== "original");
      expect(duplicate).toBeDefined();
      expect(duplicate?.position.x).toBe(140); // 100 + 40 offset
      expect(duplicate?.position.y).toBe(140);
    });
  });

  describe("Setting Value Clamping", () => {
    it("clamps temperature to max of 2", () => {
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
        sourceHandle: "temperature-setting",
        targetHandle: "temperature",
      };

      useFlowStore.setState({ nodes: [a, b], edges: [edge] } as any);
      useFlowStore.getState().updateNode("a", { temperature: 999 } as any);

      const updatedB = useFlowStore.getState().nodes.find(n => n.id === "b")!;
      expect((updatedB.data as any).temperature).toBe(2);
    });

    it("clamps maxTokens to 128000", () => {
      const a: Node = {
        id: "a",
        type: "openrouter",
        position: { x: 0, y: 0 },
        data: { maxTokens: 1000 },
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
        sourceHandle: "maxTokens-setting",
        targetHandle: "maxTokens",
      };

      useFlowStore.setState({ nodes: [a, b], edges: [edge] } as any);
      useFlowStore.getState().updateNode("a", { maxTokens: 500000 } as any);

      const updatedB = useFlowStore.getState().nodes.find(n => n.id === "b")!;
      expect((updatedB.data as any).maxTokens).toBe(128000);
    });

    it("clamps seed to valid range", () => {
      const a: Node = {
        id: "a",
        type: "seedream",
        position: { x: 0, y: 0 },
        data: { seed: 100 },
      };
      const b: Node = {
        id: "b",
        type: "seedream",
        position: { x: 100, y: 0 },
        data: {},
      };

      const edge: Edge = {
        id: "e1",
        source: "a",
        target: "b",
        sourceHandle: "seed-setting",
        targetHandle: "seed",
      };

      useFlowStore.setState({ nodes: [a, b], edges: [edge] } as any);
      
      // Test negative value clamps to 0
      useFlowStore.getState().updateNode("a", { seed: -100 } as any);
      let updatedB = useFlowStore.getState().nodes.find(n => n.id === "b")!;
      expect((updatedB.data as any).seed).toBe(0);
    });
  });

  describe("Selection", () => {
    it("selects a node", () => {
      const node: Node = {
        id: "test-1",
        type: "seedream",
        position: { x: 0, y: 0 },
        data: {},
      };

      useFlowStore.setState({ nodes: [node] } as any);
      useFlowStore.getState().selectNode(node);

      expect(useFlowStore.getState().selectedNode?.id).toBe("test-1");
      expect(useFlowStore.getState().selectedNodeIds).toContain("test-1");
    });

    it("selects multiple nodes", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 100, y: 0 }, data: {} },
        { id: "c", type: "elevenlabs", position: { x: 200, y: 0 }, data: {} },
      ];

      useFlowStore.setState({ nodes } as any);
      useFlowStore.getState().setSelectedNodeIds(["a", "c"]);

      expect(useFlowStore.getState().selectedNodeIds).toEqual(["a", "c"]);
    });

    it("selects all nodes", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 100, y: 0 }, data: {} },
      ];

      useFlowStore.setState({ nodes } as any);
      useFlowStore.getState().selectAllNodes();

      expect(useFlowStore.getState().selectedNodeIds).toHaveLength(2);
    });
  });

  describe("Copy/Paste", () => {
    it("copies selected nodes to clipboard", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: { prompt: "test" } },
        { id: "b", type: "openrouter", position: { x: 100, y: 0 }, data: {} },
      ];

      useFlowStore.setState({ 
        nodes, 
        selectedNodeIds: ["a"],
        selectedNode: nodes[0],
      } as any);
      
      useFlowStore.getState().copySelectedNodes();

      const clipboard = useFlowStore.getState().clipboard;
      expect(clipboard).not.toBeNull();
      expect(clipboard?.nodes).toHaveLength(1);
      expect((clipboard?.nodes[0].data as any).prompt).toBe("test");
    });

    it("pastes nodes with new IDs", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
      ];

      useFlowStore.setState({ 
        nodes,
        selectedNodeIds: ["a"],
        selectedNode: nodes[0],
      } as any);
      
      useFlowStore.getState().copySelectedNodes();
      useFlowStore.getState().pasteNodes();

      const newNodes = useFlowStore.getState().nodes;
      expect(newNodes).toHaveLength(2);
      expect(newNodes[0].id).not.toBe(newNodes[1].id);
    });

    it("pastes nodes at specified position", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
      ];

      useFlowStore.setState({ 
        nodes,
        selectedNodeIds: ["a"],
        selectedNode: nodes[0],
      } as any);
      
      useFlowStore.getState().copySelectedNodes();
      useFlowStore.getState().pasteNodes({ x: 500, y: 500 });

      const pastedNode = useFlowStore.getState().nodes.find(n => n.id !== "a");
      expect(pastedNode?.position.x).toBe(500);
      expect(pastedNode?.position.y).toBe(500);
    });
  });

  describe("Undo/Redo", () => {
    it("records history when adding nodes", () => {
      const node: Node = {
        id: "test-1",
        type: "seedream",
        position: { x: 0, y: 0 },
        data: {},
      };

      useFlowStore.getState().addNode(node);

      expect(useFlowStore.getState().history.length).toBeGreaterThan(0);
    });

    it("can undo an operation", () => {
      // Set up initial state with one node
      const node1: Node = {
        id: "a",
        type: "seedream",
        position: { x: 0, y: 0 },
        data: {},
      };
      
      // Set initial state directly and record it
      useFlowStore.setState({ nodes: [node1], edges: [] } as any);
      useFlowStore.getState().recordHistory();

      // Add second node (this also records history before adding)
      const node2: Node = {
        id: "b",
        type: "openrouter",
        position: { x: 100, y: 0 },
        data: {},
      };
      useFlowStore.getState().addNode(node2);

      expect(useFlowStore.getState().nodes).toHaveLength(2);
      expect(useFlowStore.getState().canUndo()).toBe(true);

      // Undo - should go back to having 1 node
      useFlowStore.getState().undo();
      expect(useFlowStore.getState().nodes).toHaveLength(1);
      expect(useFlowStore.getState().nodes[0].id).toBe("a");
    });
    
    it("reports canUndo and canRedo correctly", () => {
      // Empty state - cannot undo
      expect(useFlowStore.getState().canUndo()).toBe(false);
      expect(useFlowStore.getState().canRedo()).toBe(false);
      
      // Record history and make a change
      useFlowStore.getState().recordHistory();
      
      const node: Node = {
        id: "a",
        type: "seedream",
        position: { x: 0, y: 0 },
        data: {},
      };
      useFlowStore.getState().addNode(node);
      
      // Now we should be able to undo
      expect(useFlowStore.getState().canUndo()).toBe(true);
    });
  });

  describe("Handle Connections", () => {
    it("detects connected handles", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 100, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "b", sourceHandle: "image", targetHandle: "context" },
      ];

      useFlowStore.setState({ nodes, edges } as any);

      expect(useFlowStore.getState().isHandleConnected("b", "context")).toBe(true);
      expect(useFlowStore.getState().isHandleConnected("b", "prompt")).toBe(false);
    });

    it("returns handle source information", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 100, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "b", sourceHandle: "image", targetHandle: "context" },
      ];

      useFlowStore.setState({ nodes, edges } as any);

      const source = useFlowStore.getState().getHandleSource("b", "context");
      expect(source).not.toBeNull();
      expect(source?.sourceNodeId).toBe("a");
      expect(source?.sourceHandle).toBe("image");
    });
  });

  describe("Highlighting", () => {
    it("highlights a pipeline of nodes", () => {
      const nodes: Node[] = [
        { id: "node-1", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "node-2", type: "openrouter", position: { x: 100, y: 0 }, data: {} },
        { id: "node-3", type: "elevenlabs", position: { x: 200, y: 0 }, data: {} },
      ];

      useFlowStore.setState({ nodes } as any);
      useFlowStore.getState().highlightPipeline(["node-1", "node-3"]);

      const highlighted = useFlowStore.getState().highlightedNodeIds;
      expect(highlighted).toContain("node-1");
      expect(highlighted).toContain("node-3");
      expect(highlighted).not.toContain("node-2");
    });

    it("clears highlights", () => {
      useFlowStore.setState({ highlightedNodeIds: ["a", "b", "c"] } as any);
      useFlowStore.getState().clearHighlight();

      expect(useFlowStore.getState().highlightedNodeIds).toHaveLength(0);
    });
  });

  describe("Flow Management", () => {
    it("clears all flow data", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "b" },
      ];

      useFlowStore.setState({ 
        nodes, 
        edges, 
        selectedNode: nodes[0],
        highlightedNodeIds: ["a"],
      } as any);
      
      useFlowStore.getState().clearFlow();

      const state = useFlowStore.getState();
      expect(state.nodes).toHaveLength(0);
      expect(state.edges).toHaveLength(0);
      expect(state.selectedNode).toBeNull();
      expect(state.highlightedNodeIds).toHaveLength(0);
    });

    it("loads flow data", () => {
      const nodes: Node[] = [
        { id: "new-a", type: "seedream", position: { x: 50, y: 50 }, data: { prompt: "loaded" } },
      ];
      const edges: Edge[] = [];

      useFlowStore.getState().loadFlow(nodes, edges);

      expect(useFlowStore.getState().nodes).toHaveLength(1);
      expect(useFlowStore.getState().nodes[0].id).toBe("new-a");
    });
  });

  describe("Workflow Execution State", () => {
    it("sets workflow running state", () => {
      useFlowStore.getState().setWorkflowRunning(true);
      expect(useFlowStore.getState().isWorkflowRunning).toBe(true);

      useFlowStore.getState().setWorkflowRunning(false);
      expect(useFlowStore.getState().isWorkflowRunning).toBe(false);
    });

    it("sets workflow ID", () => {
      useFlowStore.getState().setWorkflowId("workflow-123");
      expect(useFlowStore.getState().workflowId).toBe("workflow-123");
    });

    it("tracks node running state", () => {
      useFlowStore.getState().setNodeRunning("node-1", "exec-123", "run-456");
      
      const runningNodes = useFlowStore.getState().runningNodeIds;
      expect(runningNodes.get("node-1")).toEqual({
        executionId: "exec-123",
        triggerRunId: "run-456",
      });
    });

    it("clears node running state", () => {
      useFlowStore.getState().setNodeRunning("node-1", "exec-123");
      useFlowStore.getState().clearNodeRunning("node-1");

      expect(useFlowStore.getState().runningNodeIds.has("node-1")).toBe(false);
    });
  });

  describe("Connection State", () => {
    it("sets connecting from state", () => {
      useFlowStore.getState().setConnectingFrom({
        nodeId: "node-1",
        handleId: "output",
        handleType: "image",
      });

      const connectingFrom = useFlowStore.getState().connectingFrom;
      expect(connectingFrom?.nodeId).toBe("node-1");
      expect(connectingFrom?.handleType).toBe("image");
    });

    it("clears connecting from state", () => {
      useFlowStore.getState().setConnectingFrom({
        nodeId: "node-1",
        handleId: "output",
        handleType: "image",
      });
      useFlowStore.getState().setConnectingFrom(null);

      expect(useFlowStore.getState().connectingFrom).toBeNull();
    });
  });
});
