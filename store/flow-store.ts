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

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  viewport?: { x: number; y: number; zoom: number };
  
  // Actions
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[]) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number } | undefined) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  
  addNode: (node: Node) => void;
  updateNode: (id: string, data: Partial<Node["data"]>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  
  selectNode: (node: Node | null) => void;
  
  // Utilities
  clearFlow: () => void;
  loadFlow: (nodes: Node[], edges: Edge[]) => void;
  
  // Propagate output from a node to all connected downstream nodes
  propagateOutput: (sourceNodeId: string, output: string) => void;
}

export const useFlowStore = create<FlowState>()(
  devtools(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNode: null,
      viewport: undefined,

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

      clearFlow: () => set({ nodes: [], edges: [], selectedNode: null }),

      loadFlow: (nodes, edges) => set({ nodes, edges, selectedNode: null }),

      propagateOutput: (sourceNodeId, output) => {
        const state = get();
        
        // Find all edges that start from this source node
        const outgoingEdges = state.edges.filter((e) => e.source === sourceNodeId);
        
        if (outgoingEdges.length === 0) return;
        
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
            // Text going to prompt - use as context
            nodeData.context = output;
          } else if (targetHandle === "context" || !targetHandle) {
            nodeData.context = output;
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
    }),
    { name: "flow-store" }
  )
);

