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
  
  // Connection dragging state for highlighting compatible nodes
  connectingFrom: {
    nodeId: string;
    handleId: string | null;
    handleType: string | null; // data type: "text", "image", "video", etc.
  } | null;
  
  // Actions
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[]) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number } | undefined) => void;
  setWorkflowRunning: (running: boolean) => void;
  setConnectingFrom: (info: FlowState["connectingFrom"]) => void;
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
      connectingFrom: null,

      setWorkflowRunning: (running) => set({ isWorkflowRunning: running }),
      setConnectingFrom: (info) => set({ connectingFrom: info }),

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
        const state = get();
        const newEdges = applyEdgeChanges(changes, state.edges);
        
        // Check for removed edges that were inheritance connections
        const removedChanges = changes.filter((c) => c.type === "remove");
        if (removedChanges.length > 0) {
          const removedEdgeIds = new Set(removedChanges.map((c) => c.id));
          const removedEdges = state.edges.filter((e) => removedEdgeIds.has(e.id));
          
          // Find edges that were settings or full inheritance connections
          const inheritanceEdges = removedEdges.filter((e) => {
            const edgeData = e.data as Record<string, unknown> | undefined;
            return edgeData?.isFullInheritance === true || edgeData?.isSettingsConnection === true;
          });
          
          // Clear inheritance from affected target nodes
          if (inheritanceEdges.length > 0) {
            const updatedNodes = state.nodes.map((n) => {
              const edgesForNode = inheritanceEdges.filter((e) => e.target === n.id);
              if (edgesForNode.length === 0) return n;
              
              const nodeData = { ...(n.data as Record<string, unknown>) };
              const existingInherited = nodeData._inheritedFrom as Record<string, unknown> | undefined;
              
              // For full inheritance, remove all
              const hasFullInheritance = edgesForNode.some((e) => {
                const edgeData = e.data as Record<string, unknown> | undefined;
                return edgeData?.isFullInheritance === true;
              });
              
              if (hasFullInheritance) {
                delete nodeData._inheritedFrom;
              } else {
                // For settings connections, remove only the specific settings
                const settingsToRemove = edgesForNode
                  .filter((e) => {
                    const edgeData = e.data as Record<string, unknown> | undefined;
                    return edgeData?.isSettingsConnection === true;
                  })
                  .map((e) => e.targetHandle)
                  .filter(Boolean) as string[];
                
                if (existingInherited && settingsToRemove.length > 0) {
                  const existingSettings = (existingInherited.settings as Record<string, unknown>) || {};
                  const newSettings = { ...existingSettings };
                  for (const key of settingsToRemove) {
                    delete newSettings[key];
                  }
                  
                  if (Object.keys(newSettings).length === 0) {
                    delete nodeData._inheritedFrom;
                  } else {
                    nodeData._inheritedFrom = {
                      ...existingInherited,
                      settings: newSettings,
                    };
                  }
                }
              }
              
              return { ...n, data: nodeData };
            });
            set({ edges: newEdges, nodes: updatedNodes });
            return;
          }
        }
        
        set({ edges: newEdges });
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
        
        // Strategy 1: Exact ID match (most reliable)
        node = state.nodes.find((n) => n.id === nodeId);
        
        // Strategy 2: Check if it's "nodeType:index" format
        if (!node && nodeId.includes(":")) {
          const [nodeType, indexStr] = nodeId.split(":");
          const index = parseInt(indexStr, 10);
          
          if (!isNaN(index)) {
            // Find all nodes of this type
            const nodesOfType = state.nodes.filter((n) => 
              n.type === nodeType || n.id.startsWith(nodeType)
            );
            if (index < nodesOfType.length) {
              node = nodesOfType[index];
            }
          }
        }
        
        // Strategy 3: Match by node type (if only one of that type exists)
        if (!node) {
          const nodesOfType = state.nodes.filter((n) => n.type === nodeId);
          if (nodesOfType.length >= 1) {
            node = nodesOfType[0];
          }
        }
        
        // Strategy 4: Match by ID prefix (e.g., "openrouter-123456")
        if (!node && nodeId.includes("-")) {
          const nodeType = nodeId.split("-")[0];
          const nodesOfType = state.nodes.filter((n) => 
            n.type === nodeType || n.id.startsWith(nodeType)
          );
          if (nodesOfType.length >= 1) {
            node = nodesOfType[0];
          }
        }
        
        // Strategy 5: Partial match on ID
        if (!node) {
          node = state.nodes.find((n) => 
            n.id.includes(nodeId) || nodeId.includes(n.id)
          );
        }
        
        if (node) {
          console.log(`[focusNode] Found node: ${node.id} (type: ${node.type})`);
          set({ focusNodeId: node.id, selectedNode: node });
        } else {
          console.warn(`[focusNode] Could not find node matching: ${nodeId}`);
        }
      },

      clearFlow: () => set({ nodes: [], edges: [], selectedNode: null }),

      loadFlow: (nodes, edges) => set({ nodes, edges, selectedNode: null }),

      propagateOutput: (sourceNodeId, output) => {
        const state = get();
        
        // Find the source node to get its data
        const sourceNode = state.nodes.find((n) => n.id === sourceNodeId);
        if (!sourceNode) return;
        
        const sourceData = sourceNode.data as Record<string, unknown>;
        const sourceNodeType = sourceNode.type;
        const sourcePrompt = sourceData.prompt as string | undefined;
        
        // Find all edges that start from this source node
        const outgoingEdges = state.edges.filter((e) => e.source === sourceNodeId);
        
        if (outgoingEdges.length === 0) return;
        
        // Build context that includes both the prompt and response
        const contextWithHistory = sourcePrompt
          ? `[Previous: "${sourcePrompt}"]\n[Response: "${output}"]`
          : output;

        // Build complete settings bundle from source node data
        const sourceBundle: Record<string, unknown> = {
          // Include the primary output
          result: output,
          // Include all settings from the source node
          prompt: sourceData.prompt,
          negativePrompt: sourceData.negativePrompt,
          aspectRatio: sourceData.aspectRatio,
          seed: sourceData.seed,
          numInferenceSteps: sourceData.numInferenceSteps,
          guidanceScale: sourceData.guidanceScale,
          temperature: sourceData.temperature,
          model: sourceData.model,
          voiceId: sourceData.voiceId,
          duration: sourceData.duration,
          systemPrompt: sourceData.systemPrompt,
          maxTokens: sourceData.maxTokens,
          stability: sourceData.stability,
          clarity: sourceData.clarity,
          // Merge videos settings
          transition: sourceData.transition,
          transitionDuration: sourceData.transitionDuration,
          // Media outputs
          image: sourceData.result ?? output,
          video: sourceData.result ?? output,
          audio: sourceData.result ?? output,
        };
        
        // Update all target nodes based on edge configuration
        const updatedNodes = state.nodes.map((node) => {
          const edge = outgoingEdges.find((e) => e.target === node.id);
          if (!edge) return node;
          
          const targetHandle = edge.targetHandle;
          const sourceHandle = edge.sourceHandle;
          const edgeData = edge.data as Record<string, unknown> | undefined;
          const isSettingsConnection = edgeData?.isSettingsConnection === true;
          const isFullInheritance = edgeData?.isFullInheritance === true;
          const settingKey = edgeData?.settingKey as string | undefined;
          const nodeData = { ...(node.data as Record<string, unknown>) };
          
          // Handle FULL inheritance: pass ALL settings to target node
          if (isFullInheritance) {
            // Copy all matching settings from source to target
            const settingsToInherit = [
              "prompt", "negativePrompt", "aspectRatio", "seed",
              "numInferenceSteps", "guidanceScale", "temperature",
              "model", "voiceId", "duration", "systemPrompt", "maxTokens",
              "stability", "clarity", "transition", "transitionDuration"
            ];
            
            const inheritedSettings: Record<string, unknown> = {};
            for (const key of settingsToInherit) {
              if (sourceBundle[key] !== undefined) {
                nodeData[key] = sourceBundle[key];
                inheritedSettings[key] = sourceBundle[key];
              }
            }
            
            // Update the inheritance metadata
            nodeData._inheritedFrom = {
              sourceNodeId,
              sourceNodeType,
              settings: inheritedSettings,
              fullInheritance: true,
            };
            
            // Also set the appropriate media input
            if (targetHandle === "image" || targetHandle === "inputImage") {
              nodeData.inputImage = output;
            } else if (targetHandle === "video" || targetHandle === "inputVideo") {
              nodeData.inputVideo = output;
            } else if (targetHandle === "audio" || targetHandle === "inputAudio") {
              nodeData.inputAudio = output;
            } else if (targetHandle === "prompt" || targetHandle === "context") {
              nodeData.context = contextWithHistory;
            }
            
            return { ...node, data: nodeData };
          }
          
          // Handle specific settings connections: out -> specific setting
          if (isSettingsConnection && sourceBundle[targetHandle ?? ""] !== undefined) {
            const key = targetHandle ?? "";
            nodeData[key] = sourceBundle[key];
            
            // Update inheritance metadata for this specific setting
            const existingInherited = nodeData._inheritedFrom as Record<string, unknown> | undefined;
            const existingSettings = (existingInherited?.settings as Record<string, unknown>) || {};
            nodeData._inheritedFrom = {
              sourceNodeId,
              sourceNodeType,
              settings: {
                ...existingSettings,
                [key]: sourceBundle[key],
              },
              fullInheritance: false,
            };
            
            return { ...node, data: nodeData };
          }
          
          // Determine the type of output based on source handle
          const isImageOutput = sourceHandle === "image" || sourceHandle === "upscaled" || sourceHandle === "cropped" || sourceHandle === "out";
          const isVideoOutput = sourceHandle === "video" || sourceHandle === "synced" || sourceHandle === "combined" || sourceHandle === "merged";
          const isAudioOutput = sourceHandle === "audio";
          
          // Map to appropriate field based on target handle and output type
          if (targetHandle === "image" || targetHandle === "inputImage" || targetHandle === "frame" || targetHandle === "inputFrame") {
            nodeData.inputImage = output;
          } else if (targetHandle === "video" || targetHandle === "inputVideo" || targetHandle === "inputVideo1") {
            nodeData.inputVideo = output;
          } else if (targetHandle === "inputVideo2") {
            nodeData.inputVideo2 = output;
          } else if (targetHandle === "audio" || targetHandle === "inputAudio") {
            nodeData.inputAudio = output;
          } else if (targetHandle === "prompt" && !isImageOutput && !isVideoOutput && !isAudioOutput) {
            nodeData.context = contextWithHistory;
          } else if (targetHandle === "context" || !targetHandle) {
            nodeData.context = contextWithHistory;
          } else if (targetHandle === "text") {
            nodeData.text = output;
          } else if (sourceHandle === "out" && targetHandle && sourceBundle[targetHandle] !== undefined) {
            // Settings override via bundle output
            nodeData[targetHandle] = sourceBundle[targetHandle];
          } else if (targetHandle) {
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

        // Async nodes that need polling (fal.ai based)
        const asyncNodeTypes = ["seedream", "seedvr", "seedance", "elevenlabs", "lipsync"];
        const isAsyncNode = asyncNodeTypes.includes(node.type ?? "");

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
          // Enable polling for async nodes
          isWorkflowRunning: isAsyncNode ? true : state.isWorkflowRunning,
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
            // If async node finished (completed/failed), stop polling
            if (isAsyncNode && (status === "completed" || status === "failed")) {
              set({ isWorkflowRunning: false });
            }
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

