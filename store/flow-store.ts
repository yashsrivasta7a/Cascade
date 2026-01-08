import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
} from "reactflow";
import { runSingleNode } from "@/lib/workflow/run-workflow";

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  viewport?: { x: number; y: number; zoom: number };
  isWorkflowRunning: boolean;
  focusNodeId: string | null;
  
  // Actions
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[]) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number } | undefined) => void;
  setWorkflowRunning: (running: boolean) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  
  addNode: (node: Node) => void;
  updateNode: (id: string, data: Partial<Node["data"]>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  
  selectNode: (node: Node | null) => void;
  focusNode: (nodeId: string | null) => void;
  
  // Utilities
  clearFlow: () => void;
  loadFlow: (nodes: Node[], edges: Edge[]) => void;
  
  // Propagate output from a node to all connected downstream nodes
  propagateOutput: (sourceNodeId: string, output: string) => void;

  // Run a single node (for debugging)
  runNode: (nodeId: string) => Promise<void>;
}

export const useFlowStore = create<FlowState>()(
  devtools(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNode: null,
      viewport: undefined,
      isWorkflowRunning: false,
      focusNodeId: null,

      setWorkflowRunning: (running) => set({ isWorkflowRunning: running }),

      setNodes: (nodes) =>
        set((state) => ({
          nodes: typeof nodes === "function" ? nodes(state.nodes) : nodes,
        })),
      setEdges: (edges) => set({ edges }),
      setViewport: (viewport) => set({ viewport }),

      onNodesChange: (changes) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
      },

      onEdgesChange: (changes) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },

      onConnect: (connection: Connection) => {
        set({
          edges: addEdge(
            {
              ...connection,
              type: "smoothstep",
              animated: true,
            },
            get().edges
          ),
        });
      },

      addNode: (node) => {
        set({
          nodes: [...get().nodes, node],
        });
      },

      updateNode: (id, data) => {
        set({
          nodes: get().nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, ...data } }
              : node
          ),
        });
      },

      deleteNode: (id) => {
        set({
          nodes: get().nodes.filter((node) => node.id !== id),
          edges: get().edges.filter(
            (edge) => edge.source !== id && edge.target !== id
          ),
        });
      },

      duplicateNode: (id) => {
        const state = get();
        const original = state.nodes.find((n) => n.id === id);
        if (!original) return;

        const newId = `node-${Date.now()}-dup`;
        const newNode: Node = {
          ...original,
          id: newId,
          position: {
            x: original.position.x + 40,
            y: original.position.y + 40,
          },
          selected: false,
        };

        set({
          nodes: [...state.nodes, newNode],
          selectedNode: newNode,
        });
      },

      selectNode: (node) => set({ selectedNode: node }),

      focusNode: (nodeId) => {
        if (!nodeId) {
          set({ focusNodeId: null });
          return;
        }
        const state = get();
        let node: Node | undefined;
        
        // Check if it's the new format: "nodeType:index"
        if (nodeId.includes(":")) {
          const [nodeType, indexStr] = nodeId.split(":");
          const index = parseInt(indexStr, 10);
          
          if (!isNaN(index)) {
            // Find all nodes of this type and get the one at the specified index
            const nodesOfType = state.nodes.filter((n) => 
              n.type === nodeType || n.id.startsWith(nodeType)
            );
            if (index < nodesOfType.length) {
              node = nodesOfType[index];
            }
          }
          
          // If that didn't work, try using index directly on all nodes
          if (!node && !isNaN(index) && index < state.nodes.length) {
            node = state.nodes[index];
          }
        }
        
        // Try exact ID match
        if (!node) {
          node = state.nodes.find((n) => n.id === nodeId);
        }
        
        // Try matching by node type prefix
        if (!node && nodeId.includes("-")) {
          const nodeType = nodeId.split("-")[0];
          const nodesOfType = state.nodes.filter((n) => 
            n.type === nodeType || n.id.startsWith(nodeType)
          );
          if (nodesOfType.length === 1) {
            node = nodesOfType[0];
          }
        }
        
        if (node) {
          set({ focusNodeId: node.id, selectedNode: node });
        }
      },

      clearFlow: () => set({ nodes: [], edges: [], selectedNode: null }),

      loadFlow: (nodes, edges) => set({ nodes, edges, selectedNode: null }),

      propagateOutput: (sourceNodeId, output) => {
        const state = get();
        
        // Find the source node to get its prompt
        const sourceNode = state.nodes.find((n) => n.id === sourceNodeId);
        const sourceData = (sourceNode?.data ?? {}) as { prompt?: string };
        const sourcePrompt = sourceData.prompt;
        
        // Find all edges that start from this source node
        const outgoingEdges = state.edges.filter((e) => e.source === sourceNodeId);
        
        if (outgoingEdges.length === 0) return;
        
        // Build context that includes both the prompt and response
        const contextWithHistory = sourcePrompt
          ? `[Previous: "${sourcePrompt}"]\n[Response: "${output}"]`
          : output;
        
        // Update all target nodes based on which handle they're connected to
        const updatedNodes = state.nodes.map((node) => {
          const edge = outgoingEdges.find((e) => e.target === node.id);
          if (!edge) return node;
          
          const targetHandle = edge.targetHandle;
          const sourceHandle = edge.sourceHandle;
          const nodeData = { ...(node.data as Record<string, unknown>) };
          
          // Determine the type of output based on source handle
          const isImageOutput = sourceHandle === "image" || sourceHandle === "upscaled" || sourceHandle === "cropped";
          const isVideoOutput = sourceHandle === "video" || sourceHandle === "synced" || sourceHandle === "combined" || sourceHandle === "merged";
          const isAudioOutput = sourceHandle === "audio";
          
          // Map to appropriate field based on target handle and output type
          if (targetHandle === "image" || targetHandle === "frame") {
            nodeData.inputImage = output;
          } else if (targetHandle === "video" || targetHandle === "video1" || targetHandle === "video2") {
            nodeData.inputVideo = output;
          } else if (targetHandle === "audio") {
            nodeData.inputAudio = output;
          } else if (targetHandle === "prompt" && !isImageOutput && !isVideoOutput && !isAudioOutput) {
            // Text going to prompt - use context with history
            nodeData.context = contextWithHistory;
          } else if (targetHandle === "context" || !targetHandle) {
            nodeData.context = contextWithHistory;
          } else if (targetHandle === "text") {
            nodeData.text = output;
          } else {
            // For other handles, use the handle ID as the field name
            nodeData[targetHandle] = output;
          }
          
          return { ...node, data: nodeData };
        });
        
        set({ nodes: updatedNodes });
      },

      runNode: async (nodeId) => {
        const state = get();
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Reset status for this node only
        set({
          nodes: state.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...(n.data as any),
                    status: "queued",
                    progress: 0,
                    error: undefined,
                  },
                }
              : n
          ),
        });

        const applyStatus = (status: string, patch?: Record<string, unknown>) => {
          set((prev) => ({
            nodes: prev.nodes.map((n) =>
              n.id === nodeId ? { ...n, data: { ...(n.data as any), status, ...(patch ?? {}) } } : n
            ),
          }));
        };

        const applyResult = (resultText: string) => {
          set((prev) => ({
            nodes: prev.nodes.map((n) =>
              n.id === nodeId ? { ...n, data: { ...(n.data as any), result: resultText } } : n
            ),
          }));
        };

        await runSingleNode(nodeId, get().nodes, get().edges, {
          onNodeStatus: (id, status, patch) => {
            if (id !== nodeId) return;
            applyStatus(status, patch);
          },
          onNodeResult: (id, resultText) => {
            if (id !== nodeId) return;
            applyResult(resultText);
          },
        });
      },
    }),
    { name: "flow-store" }
  )
);

