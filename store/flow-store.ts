import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
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
import { runSingleNode, runNodeWithDependencies } from "@/lib/workflow/run-workflow";

// =============================================================================
// Setting Value Clamping - ensures values stay within valid ranges
// =============================================================================

// Define min/max values for settings that should be clamped
const SETTING_RANGES: Record<string, { min: number; max: number }> = {
  // 0-2 range settings
  "temperature": { min: 0, max: 2 },
  // -2 to 2 range settings
  "frequencyPenalty": { min: -2, max: 2 },
  "presencePenalty": { min: -2, max: 2 },
  // 0-1 range settings
  "topP": { min: 0, max: 1 },
  // Other bounded settings
  "topK": { min: 0, max: 100 },
  // 0-100 percentage settings
  "xPercent": { min: 0, max: 100 },
  "yPercent": { min: 0, max: 100 },
  "widthPercent": { min: 0, max: 100 },
  "heightPercent": { min: 0, max: 100 },
  // Seedream/image gen settings
  "numInferenceSteps": { min: 1, max: 60 },
  "guidanceScale": { min: 1, max: 12 },
  // Merge videos transition duration
  "transitionDuration": { min: 0, max: 5 },
  // ElevenLabs settings
  "stability": { min: 0, max: 1 },
  "similarityBoost": { min: 0, max: 1 },
  "clarity": { min: 0, max: 1 },
};

// Helper to clamp a value to its range if defined
function clampSettingValue(key: string, value: unknown): unknown {
  if (typeof value !== "number") return value;
  const range = SETTING_RANGES[key];
  if (range !== undefined) {
    return Math.min(Math.max(range.min, value), range.max);
  }
  return value;
}

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  viewport?: { x: number; y: number; zoom: number };
  isWorkflowRunning: boolean;
  focusNodeId: string | null;
  workflowId: string | null; // Current workflow ID for Activity tracking
  highlightedNodeIds: string[]; // IDs of nodes to highlight (for pipeline view)
  
  // Execution tracking for cancel functionality
  currentWorkflowExecutionId: string | null;
  currentTriggerRunId: string | null;
  runningNodeIds: Map<string, { executionId: string; triggerRunId?: string }>; // node ID -> execution info
  nodeAbortControllers: Map<string, AbortController>; // node ID -> AbortController for cancellation

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
  setWorkflowId: (workflowId: string | null) => void;
  setConnectingFrom: (info: FlowState["connectingFrom"]) => void;
  
  // Execution tracking actions
  setWorkflowExecution: (executionId: string | null, triggerRunId?: string | null) => void;
  setNodeRunning: (nodeId: string, executionId: string, triggerRunId?: string) => void;
  clearNodeRunning: (nodeId: string) => void;
  cancelWorkflow: () => Promise<boolean>;
  cancelNode: (nodeId: string) => Promise<boolean>;
  
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  
  addNode: (node: Node) => void;
  updateNode: (id: string, data: Partial<Node["data"]>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  
  selectNode: (node: Node | null) => void;
  focusNode: (nodeId: string | null) => void;
  
  // Pipeline highlighting (for Activity panel)
  highlightPipeline: (nodeIds: string[]) => void;
  clearHighlight: () => void;
  
  // Utilities
  clearFlow: () => void;
  loadFlow: (nodes: Node[], edges: Edge[]) => void;
  
  // Propagate output from a node to all connected downstream nodes
  propagateOutput: (sourceNodeId: string, output: string) => void;

  // Check if a handle on a node has an incoming connection
  isHandleConnected: (nodeId: string, handleId: string) => boolean;
  
  // Get the source of a connected handle (returns source node id and handle)
  getHandleSource: (nodeId: string, handleId: string) => { sourceNodeId: string; sourceHandle: string } | null;

  // Run a single node (for debugging)
  runNode: (nodeId: string) => Promise<void>;
}

export const useFlowStore = create<FlowState>()(
  devtools(
    persist(
      (set, get) => ({
        nodes: [],
        edges: [],
        selectedNode: null,
        viewport: undefined,
        isWorkflowRunning: false,
        focusNodeId: null,
        workflowId: null,
        highlightedNodeIds: [],
        connectingFrom: null,
        
        // Execution tracking
        currentWorkflowExecutionId: null,
        currentTriggerRunId: null,
        runningNodeIds: new Map(),
        // AbortController map for cancelling running nodes
        nodeAbortControllers: new Map<string, AbortController>(),

        setWorkflowRunning: (running) => set({ isWorkflowRunning: running }),
        setWorkflowId: (workflowId) => set({ workflowId }),
        setConnectingFrom: (info) => set({ connectingFrom: info }),
        
        // Execution tracking actions
        setWorkflowExecution: (executionId, triggerRunId) => set({ 
          currentWorkflowExecutionId: executionId,
          currentTriggerRunId: triggerRunId ?? null,
        }),
        
        setNodeRunning: (nodeId, executionId, triggerRunId) => {
          const state = get();
          const newMap = new Map(state.runningNodeIds);
          newMap.set(nodeId, { executionId, triggerRunId });
          set({ runningNodeIds: newMap });
        },
        
        clearNodeRunning: (nodeId) => {
          const state = get();
          const newMap = new Map(state.runningNodeIds);
          newMap.delete(nodeId);
          set({ runningNodeIds: newMap });
        },
      
      cancelWorkflow: async () => {
        const state = get();
        const { currentWorkflowExecutionId, currentTriggerRunId } = state;
        
        if (!currentWorkflowExecutionId) {
          console.log("[cancelWorkflow] No active workflow execution");
          return false;
        }
        
        try {
          const response = await fetch(`/api/executions/${currentWorkflowExecutionId}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              triggerRunId: currentTriggerRunId,
              type: "workflow" 
            }),
          });
          
          if (!response.ok) {
            const error = await response.json();
            console.error("[cancelWorkflow] Failed:", error);
            return false;
          }
          
          // Update all running nodes to cancelled
          set((prev) => ({
            isWorkflowRunning: false,
            currentWorkflowExecutionId: null,
            currentTriggerRunId: null,
            nodes: prev.nodes.map((n) => {
              const nodeData = n.data as Record<string, unknown>;
              if (nodeData.status === "running" || nodeData.status === "queued") {
                return { ...n, data: { ...nodeData, status: "cancelled" } };
              }
              return n;
            }),
          }));
          
          console.log("[cancelWorkflow] Workflow cancelled successfully");
          return true;
        } catch (error) {
          console.error("[cancelWorkflow] Error:", error);
          return false;
        }
      },
      
      cancelNode: async (nodeId) => {
        const state = get();
        
        // First, try to abort via AbortController (for in-progress fetch requests)
        const abortController = state.nodeAbortControllers.get(nodeId);
        if (abortController) {
          console.log("[cancelNode] Aborting fetch requests for node", nodeId);
          abortController.abort();
          
          // Remove from abort controllers map
          const newAbortMap = new Map(state.nodeAbortControllers);
          newAbortMap.delete(nodeId);
          set({ nodeAbortControllers: newAbortMap });
        }
        
        // Also try to cancel via API if we have execution info
        const runInfo = state.runningNodeIds.get(nodeId);
        if (runInfo) {
          try {
            const response = await fetch(`/api/executions/${runInfo.executionId}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                triggerRunId: runInfo.triggerRunId,
                type: "quick"
              }),
            });

            if (!response.ok) {
              console.warn("[cancelNode] API cancel failed, but local abort succeeded");
            }
          } catch (error) {
            console.warn("[cancelNode] API cancel error:", error);
          }
          
          // Remove from running nodes map
          const newRunMap = new Map(state.runningNodeIds);
          newRunMap.delete(nodeId);
          set({ runningNodeIds: newRunMap });
        }

        // Update node status to cancelled
        set((prev) => ({
          nodes: prev.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...(n.data as Record<string, unknown>), status: "cancelled", error: undefined } }
              : n
          ),
        }));

        console.log("[cancelNode] Node cancelled successfully");
        return true;
      },

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

        // AUTO-PROPAGATE if source has result
        const sourceNode = get().nodes.find(n => n.id === connection.source);
        if (sourceNode && sourceNode.data.result && typeof sourceNode.data.result === "string") {
           // Small delay to ensure edge is registered
           setTimeout(() => {
             get().propagateOutput(sourceNode.id, sourceNode.data.result as string);
           }, 10);
        }
      },

      addNode: (node) => {
        set({
          nodes: [...get().nodes, node],
        });
      },

      updateNode: (id, data) => {
        const state = get();
        const node = state.nodes.find((n) => n.id === id);
        if (!node) return;

        const oldData = node.data as Record<string, unknown>;
        let newData = { ...oldData, ...data };

        // Auto-clear result when input media changes
        const mediaInputFields = ["inputImage", "inputVideo", "inputAudio", "inputVideo1", "inputVideo2", "inputFrame", "referenceImages"];
        const mediaInputChanged = mediaInputFields.some(field => 
          data[field] !== undefined && data[field] !== oldData[field]
        );
        
        if (mediaInputChanged && oldData.result !== undefined) {
          // Clear the result when input media changes
          newData = { ...newData, result: undefined };
          console.log(`[updateNode] Cleared result for ${id} due to input media change`);
        }

        // Find all outgoing edges from this node for real-time propagation
        const outgoingEdges = state.edges.filter(e => e.source === id);
        
        // Build list of target nodes that need updates
        const targetUpdates: Map<string, Record<string, unknown>> = new Map();
        
        // Mapping from output handle names to actual data field names
        // This handles cases where the handle name differs from the stored data field
        const handleToDataField: Record<string, string> = {
          "response": "result",      // OpenRouter's "response" output is stored in data.result
          "audio": "result",         // ElevenLabs audio output
          "video": "result",         // Seedance video output  
          "image": "result",         // Seedream image output
          "upscaled": "result",      // SeedVR upscaled output
          "synced": "result",        // Lipsync synced output
          "merged": "result",        // Merge videos output
          "combined": "result",      // Merge audio-video output
          "extracted": "result",     // Extract audio output
          "cropped": "result",       // Crop image output
        };
        
        // Check each changed field and propagate to connected nodes
        const changedKeys = Object.keys(data).filter(key => data[key as keyof typeof data] !== oldData[key]);
        
        // Output handles - these should ONLY propagate the "result" field, NOT input fields
        const outputHandles = ["merged", "combined", "extracted", "cropped", "video", "image", "audio", "upscaled", "synced", "response"];
        // Settings that should be shared in real-time (NOT media inputs)
        // Including boolean settings like promptEnhancer, replaceAudio, truncatePrompt, syncMode
        const realtimeSettings = [
          "prompt", "negativePrompt", "aspectRatio", "seed", "model", "temperature",
          "systemPrompt", "maxTokens", "duration", "text", "transition", "transitionDuration",
          // Boolean settings
          "promptEnhancer", "truncatePrompt", "syncMode", "replaceAudio",
          "numInferenceSteps", "guidanceScale",
          // OpenRouter LLM settings
          "topP", "topK", "frequencyPenalty", "presencePenalty",
          // Crop/video settings
          "xPosition", "yPosition", "width", "height", "format", "bitrate",
          // Crop-image percentage settings
          "xPercent", "yPercent", "widthPercent", "heightPercent",
        ];
        
        for (const edge of outgoingEdges) {
          const sourceHandle = edge.sourceHandle;
          const targetHandle = edge.targetHandle;
          const targetNodeId = edge.target;
          
          if (!targetHandle) continue;
          
          // Check if this is an OUTPUT connection (media output -> media input)
          const isOutputConnection = outputHandles.includes(sourceHandle || "");
          
          // Get the actual data field for this source handle
          const dataField = handleToDataField[sourceHandle || ""] || sourceHandle;
          
          // Determine what value to pass based on connection type
          let valueToPass: unknown;
          
          if (isOutputConnection) {
            // For OUTPUT connections, ONLY pass the "result" field (the actual output)
            // Do NOT pass fields that happen to match the target handle name
            if (changedKeys.includes("result") && newData.result !== undefined) {
              valueToPass = newData.result;
            }
          } else if (sourceHandle === "out") {
            // For "out" bundle (settings sharing), propagate settings
            if (changedKeys.some(k => [...realtimeSettings, "result", "out"].includes(k))) {
              // Try to get value from the "out" bundle if it exists
              if (typeof newData.out === "object" && newData.out !== null) {
                const bundleValue = (newData.out as Record<string, unknown>)[targetHandle];
                if (bundleValue !== undefined) {
                  valueToPass = bundleValue;
                }
              }
              // If no bundle, check if target handle is a setting we should share
              if (valueToPass === undefined && realtimeSettings.includes(targetHandle) && newData[targetHandle] !== undefined) {
                valueToPass = newData[targetHandle];
              }
            }
          } else {
            // For other connections (settings connections from radial handles)
            // Handle the -setting suffix from radial handles (e.g., "prompt-setting" -> "prompt")
            const actualSourceHandle = (sourceHandle || "").replace("-setting", "");
            
            if (realtimeSettings.includes(actualSourceHandle) && changedKeys.includes(actualSourceHandle)) {
              valueToPass = newData[actualSourceHandle];
            }
          }
          
          if (valueToPass !== undefined) {
            const existingUpdates = targetUpdates.get(targetNodeId) || {};
            // Clamp the value to its max if this setting has a defined max
            existingUpdates[targetHandle] = clampSettingValue(targetHandle, valueToPass);

            // Also update the _inheritedFrom metadata for this setting
            const targetNode = state.nodes.find(n => n.id === targetNodeId);
            const actualSourceHandle = (sourceHandle || "").replace("-setting", "");
            if (targetNode) {
              const existingInherited = (targetNode.data as Record<string, unknown>)?._inheritedFrom as Record<string, unknown> | undefined;
              const existingSettings = (existingInherited?.settings as Record<string, unknown>) || {};
              existingUpdates._inheritedFrom = {
                ...existingInherited,
                sourceNodeId: id,
                sourceNodeType: state.nodes.find(n => n.id === id)?.type,
                settings: {
                  ...existingSettings,
                  [targetHandle]: valueToPass,
                },
                sourceSettingKey: actualSourceHandle,
                fullInheritance: false,
              };
            }
            
            targetUpdates.set(targetNodeId, existingUpdates);
          }
        }
        
        // Apply all updates in a single set call
        const updatedNodes = state.nodes.map((n) => {
          if (n.id === id) {
            return { ...n, data: newData };
          }
          
          const updates = targetUpdates.get(n.id);
          if (updates && Object.keys(updates).length > 0) {
            return {
              ...n,
              data: {
                ...(n.data as Record<string, unknown>),
                ...updates,
              },
            };
          }
          
          return n;
        });
        
        set({ nodes: updatedNodes });

        // Also handle result propagation for completed outputs (for backwards compatibility)
        const resultChanged = data.result !== undefined && data.result !== oldData.result;
        if (resultChanged && data.result) {
          setTimeout(() => {
            get().propagateOutput(id, data.result as string);
          }, 50);
        }
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

      highlightPipeline: (nodeIds) => {
        const state = get();
        
        // Find all matching nodes
        const matchingNodes = state.nodes.filter(n => 
          nodeIds.some(id => n.id === id || n.id.includes(id) || id.includes(n.id))
        );
        
        if (matchingNodes.length === 0) {
          console.warn(`[highlightPipeline] No nodes found matching: ${nodeIds.join(", ")}`);
          return;
        }
        
        const matchedIds = matchingNodes.map(n => n.id);
        console.log(`[highlightPipeline] Highlighting ${matchedIds.length} nodes`);
        
        // Set the first node as focus (for centering the view)
        set({ 
          highlightedNodeIds: matchedIds,
          focusNodeId: matchedIds[0],
          selectedNode: matchingNodes[0],
        });
      },

      clearHighlight: () => {
        set({ highlightedNodeIds: [] });
      },

      clearFlow: () => set({ nodes: [], edges: [], selectedNode: null, highlightedNodeIds: [] }),

      loadFlow: (nodes, edges) => set({ nodes, edges, selectedNode: null }),

      propagateOutput: (sourceNodeId, output) => {
        const state = get();
        
        console.log(`[propagateOutput] Called with sourceNodeId=${sourceNodeId}, output="${output?.slice?.(0, 50) || output}..."`);

        // Find the source node to get its data
        const sourceNode = state.nodes.find((n) => n.id === sourceNodeId);
        if (!sourceNode) {
          console.log(`[propagateOutput] Source node not found`);
          return;
        }

        const sourceData = sourceNode.data as Record<string, unknown>;
        const sourceNodeType = sourceNode.type;
        const sourcePrompt = sourceData.prompt as string | undefined;

        // Find all edges that start from this source node
        const outgoingEdges = state.edges.filter((e) => e.source === sourceNodeId);
        
        console.log(`[propagateOutput] Found ${outgoingEdges.length} outgoing edges from ${sourceNode.type}`);

        if (outgoingEdges.length === 0) return;

        // Build context that includes both the prompt and response
        const contextWithHistory = sourcePrompt
          ? `[Previous prompt: "${sourcePrompt?.slice(0, 50)}..."]\n\n[Response: "${output?.slice(0, 100)}..."]`
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
          
          console.log(`[propagateOutput] Processing edge to ${node.id} (${node.type}): sourceHandle=${sourceHandle}, targetHandle=${targetHandle}, isSettings=${isSettingsConnection}, isFull=${isFullInheritance}`);
          
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
            if (targetHandle === "referenceImages") {
              // Seedream referenceImages - add to array (supports up to 14)
              const existing = (nodeData.referenceImages as string[]) || [];
              if (existing.length < 14) {
                nodeData.referenceImages = [...existing, output];
              }
            } else if (targetHandle === "image" || targetHandle === "inputImage") {
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
          
          // Handle specific settings connections: source setting -> target setting
          // settingId is the SOURCE setting (e.g., "prompt"), targetHandle is the TARGET field (e.g., "negativePrompt")
          const sourceSettingId = edgeData?.settingId as string | undefined;
          const actualSourceHandle = sourceHandle?.replace("-setting", "") ?? "";
          const settingSource = sourceSettingId || actualSourceHandle;
          
          if (isSettingsConnection && settingSource) {
            const sourceValue = sourceBundle[settingSource];
            const targetField = targetHandle ?? settingSource;
            
            console.log(`[propagateOutput] Settings connection: ${settingSource} -> ${targetField}, value="${String(sourceValue).slice(0, 50)}..."`);

            if (sourceValue !== undefined) {
              // Pass the SOURCE setting value to the TARGET field (clamped to valid range)
              nodeData[targetField] = clampSettingValue(targetField, sourceValue);
              
              // Update inheritance metadata for this specific setting
              const existingInherited = nodeData._inheritedFrom as Record<string, unknown> | undefined;
              const existingSettings = (existingInherited?.settings as Record<string, unknown>) || {};
              nodeData._inheritedFrom = {
                sourceNodeId,
                sourceNodeType,
                settings: {
                  ...existingSettings,
                  [targetField]: sourceValue,
                },
                fullInheritance: false,
              };
              
              return { ...node, data: nodeData };
            }
          }
          
          // Determine the type of output based on source handle
          const isImageOutput = sourceHandle === "image" || sourceHandle === "upscaled" || sourceHandle === "cropped";
          const isVideoOutput = sourceHandle === "video" || sourceHandle === "synced" || sourceHandle === "combined" || sourceHandle === "merged";
          const isAudioOutput = sourceHandle === "audio";
          const isTextResponse = sourceHandle === "response"; // LLM text response
          
          // Map to appropriate field based on target handle and output type
          if (targetHandle === "referenceImages") {
            // Seedream referenceImages - add to array (supports up to 14)
            const existing = (nodeData.referenceImages as string[]) || [];
            if (existing.length < 14) {
              nodeData.referenceImages = [...existing, output];
            }
          } else if (targetHandle === "image" || targetHandle === "inputImage" || targetHandle === "frame" || targetHandle === "inputFrame") {
            nodeData.inputImage = output;
          } else if (targetHandle === "inputVideo1") {
            // Specifically for merge-videos Video 1 input
            nodeData.inputVideo1 = output;
          } else if (targetHandle === "inputVideo2") {
            // Specifically for merge-videos Video 2 input
            nodeData.inputVideo2 = output;
          } else if (targetHandle === "video" || targetHandle === "inputVideo") {
            nodeData.inputVideo = output;
          } else if (targetHandle === "audio" || targetHandle === "inputAudio") {
            nodeData.inputAudio = output;
          } else if (targetHandle === "prompt") {
            // response → prompt: use ONLY the LLM response as the new prompt
            console.log(`[propagateOutput] Setting prompt on ${node.id} to: "${output?.slice?.(0, 100) || output}..."`);
            nodeData.prompt = output;
          } else if (targetHandle === "context") {
            // response → context: include BOTH prompt and response (conversation history)
            nodeData.context = contextWithHistory;
          } else if (!targetHandle) {
            // Default: use context with history
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
        
        console.log(`[propagateOutput] Setting ${updatedNodes.length} updated nodes`);
        set({ nodes: updatedNodes });
      },

      isHandleConnected: (nodeId, handleId) => {
        const edges = get().edges;
        return edges.some((e) => e.target === nodeId && e.targetHandle === handleId);
      },

      getHandleSource: (nodeId, handleId) => {
        const edges = get().edges;
        const edge = edges.find((e) => e.target === nodeId && e.targetHandle === handleId);
        if (!edge) return null;
        return { sourceNodeId: edge.source, sourceHandle: edge.sourceHandle || "out" };
      },

      runNode: async (nodeId) => {
        const state = get();
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Create an AbortController for this node
        const abortController = new AbortController();
        const newAbortMap = new Map(state.nodeAbortControllers);
        newAbortMap.set(nodeId, abortController);

        // Async nodes that need polling (fal.ai based)
        const asyncNodeTypes = ["seedream", "seedvr", "seedance", "elevenlabs", "lipsync"];
        const isAsyncNode = asyncNodeTypes.includes(node.type ?? "");

        // Reset status for this node only (dependencies will be marked as queued by the runner)
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
          nodeAbortControllers: newAbortMap,
          // Enable polling for async nodes
          isWorkflowRunning: isAsyncNode ? true : state.isWorkflowRunning,
        });

        // Check if cancelled
        const isCancelled = () => abortController.signal.aborted;

        const applyStatus = (id: string, status: string, patch?: Record<string, unknown>) => {
          // Don't update if cancelled
          if (isCancelled()) return;
          set((prev) => ({
            nodes: prev.nodes.map((n) =>
              n.id === id ? { ...n, data: { ...(n.data as any), status, ...(patch ?? {}) } } : n
            ),
          }));
        };

        const applyResult = (id: string, resultText: string) => {
          // Don't update if cancelled
          if (isCancelled()) return;
          set((prev) => ({
            nodes: prev.nodes.map((n) =>
              n.id === id ? { ...n, data: { ...(n.data as any), result: resultText } } : n
            ),
          }));
        };

        // Update node data helper - used to propagate outputs through the workflow
        const updateNodeData = (id: string, data: Record<string, unknown>) => {
          // Don't update if cancelled
          if (isCancelled()) return;
          set((prev) => ({
            nodes: prev.nodes.map((n) =>
              n.id === id ? { ...n, data: { ...(n.data as any), ...data } } : n
            ),
          }));
          
          // If this node completed with a result, propagate to downstream nodes
          if (data.result && typeof data.result === "string") {
            setTimeout(() => {
              get().propagateOutput(id, data.result as string);
            }, 50);
          }
        };

        try {
          // Use runNodeWithDependencies to automatically run parent nodes first
          await runNodeWithDependencies(
            nodeId, 
            get().nodes, 
            get().edges, 
            {
              onNodeStatus: (id, status, patch) => {
                if (isCancelled()) return;
                applyStatus(id, status, patch);
                // If async node finished (completed/failed), stop polling
                if (id === nodeId && isAsyncNode && (status === "completed" || status === "failed")) {
                  set({ isWorkflowRunning: false });
                }
              },
              onNodeResult: (id, resultText) => {
                if (isCancelled()) return;
                applyResult(id, resultText);
              },
            }, 
            get().workflowId || undefined,
            updateNodeData
          );
        } finally {
          // Clean up the AbortController
          const currentAbortMap = get().nodeAbortControllers;
          const cleanedMap = new Map(currentAbortMap);
          cleanedMap.delete(nodeId);
          set({ nodeAbortControllers: cleanedMap });
        }
      },
      }),
      {
        name: "flowsmith-flow",
        storage: createJSONStorage(() => localStorage),
        // Only persist serializable, essential data - not transient state or large media
        partialize: (state) => {
          // Fields to exclude from node data (large media content)
          const mediaFields = [
            "result", "inputVideo", "inputVideo1", "inputVideo2", 
            "inputAudio", "inputImage", "referenceImages", "frame", "video", "audio", "image",
            "outputVideo", "outputAudio", "outputImage"
          ];
          
          // Clean nodes - remove large media data but keep structure and settings
          const cleanNodes = state.nodes.map(node => ({
            ...node,
            data: Object.fromEntries(
              Object.entries(node.data as Record<string, unknown>).filter(([key, value]) => {
                // Exclude media fields
                if (mediaFields.includes(key)) return false;
                // Exclude base64 data (starts with "data:")
                if (typeof value === "string" && value.startsWith("data:")) return false;
                // Exclude very long strings (likely URLs to large media)
                if (typeof value === "string" && value.length > 500) return false;
                return true;
              })
            ),
          }));
          
          return {
            nodes: cleanNodes,
            edges: state.edges,
            viewport: state.viewport,
            workflowId: state.workflowId,
            // Don't persist: selectedNode, isWorkflowRunning, runningNodeIds, media data, etc.
          };
        },
      }
    ),
    { name: "flow-store" }
  )
);

