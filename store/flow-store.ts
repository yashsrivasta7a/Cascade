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
import { showCancelled, showNodeError, showError, showTimeoutError, showProviderError, showInsufficientCredits, showNetworkError, showLLMParseError } from "@/lib/toast";
import { parseLLMToFieldValue, canFieldAcceptLLMInput } from "@/lib/workflow/llm-type-parser";
import { type AINodeType } from "@/types/nodes";

// =============================================================================
// Setting Value Clamping - ensures values stay within valid ranges
// =============================================================================

// Define min/max values for settings that should be clamped
// These values MUST match the Zod schema constraints in lib/config/node-config.ts
const SETTING_RANGES: Record<string, { min: number; max: number }> = {
  // LLM settings (openrouter)
  "temperature": { min: 0, max: 2 },
  "maxTokens": { min: 1, max: 128000 },
  "topP": { min: 0, max: 1 },
  "topK": { min: 0, max: 100 },
  "frequencyPenalty": { min: -2, max: 2 },
  "presencePenalty": { min: -2, max: 2 },
  // Image generation settings (seedream) - from schema: z.number().min(0).max(30)
  "numInferenceSteps": { min: 1, max: 60 },
  "guidanceScale": { min: 0, max: 30 },
  // Seed - no max in schema, but cap to prevent overflow when passed to other settings
  "seed": { min: 0, max: 2147483647 },
  // Crop image settings (0-100 percentage)
  "xPercent": { min: 0, max: 100 },
  "yPercent": { min: 0, max: 100 },
  "widthPercent": { min: 1, max: 100 },
  "heightPercent": { min: 1, max: 100 },
  // Video settings (merge-videos) - from schema: z.number().min(0).max(2)
  "transitionDuration": { min: 0, max: 2 },
  // ElevenLabs voice settings
  "stability": { min: 0, max: 1 },
  "similarityBoost": { min: 0, max: 1 },
  "clarity": { min: 0, max: 1 },
};

// Helper to clamp a value to its range if defined
// Also sanitizes non-numeric values for numeric settings
function clampSettingValue(key: string, value: unknown): unknown {
  // Check if this is a numeric setting
  const numericSettings = new Set(Object.keys(SETTING_RANGES));
  
  if (numericSettings.has(key)) {
    // For numeric settings, MUST return a number
    if (typeof value === "number") {
      const range = SETTING_RANGES[key];
      if (range !== undefined) {
        return Math.min(Math.max(range.min, value), range.max);
      }
      return value;
    } else if (typeof value === "string" && !isNaN(Number(value))) {
      const numValue = Number(value);
      const range = SETTING_RANGES[key];
      if (range !== undefined) {
        return Math.min(Math.max(range.min, numValue), range.max);
      }
      return numValue;
    } else {
      // Non-numeric value for numeric setting - return undefined to skip
      console.warn(`[clampSettingValue] Non-numeric value for ${key}:`, typeof value, value);
      return undefined;
    }
  }
  
  // Non-numeric settings pass through as-is
  return value;
}

// History state for undo/redo
interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

// Clipboard state for copy/paste
interface ClipboardData {
  nodes: Node[];
  edges: Edge[];
}

// Maximum history entries to keep
const MAX_HISTORY_LENGTH = 50;

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  selectedNodeIds: string[]; // Support multi-selection
  contextMenuPosition: { x: number; y: number } | null; // Position for right-click menu
  viewport?: { x: number; y: number; zoom: number };
  isWorkflowRunning: boolean;
  focusNodeId: string | null;
  workflowId: string | null; // Current workflow ID for Activity tracking
  highlightedNodeIds: string[]; // IDs of nodes to highlight (for pipeline view)
  
  // Undo/Redo history
  history: HistoryEntry[];
  historyIndex: number;
  
  // Clipboard for copy/paste
  clipboard: ClipboardData | null;
  
  // Execution tracking for cancel functionality
  currentWorkflowExecutionId: string | null;
  currentTriggerRunId: string | null;
  runningNodeIds: Map<string, { executionId: string; triggerRunId?: string }>; // node ID -> execution info
  nodeAbortControllers: Map<string, AbortController>; // node ID -> AbortController for cancellation
  
  // Upload tracking - prevents running workflow while any node is uploading
  uploadingNodeIds: Set<string>;

  // Connection dragging state for highlighting compatible nodes
  connectingFrom: {
    nodeId: string;
    handleId: string | null;
    handleType: string | null; // data type: "text", "image", "video", etc.
  } | null;
  
  // Flag to trigger fitView from outside FlowCanvas
  pendingFitView: boolean;
  
  // Actions
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[]) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number } | undefined) => void;
  setWorkflowRunning: (running: boolean) => void;
  setWorkflowId: (workflowId: string | null) => void;
  setConnectingFrom: (info: FlowState["connectingFrom"]) => void;
  triggerFitView: () => void;
  clearFitView: () => void;
  
  // Execution tracking actions
  setWorkflowExecution: (executionId: string | null, triggerRunId?: string | null) => void;
  setNodeRunning: (nodeId: string, executionId: string, triggerRunId?: string) => void;
  clearNodeRunning: (nodeId: string) => void;
  cancelWorkflow: () => Promise<boolean>;
  cancelNode: (nodeId: string) => Promise<boolean>;
  
  // Upload tracking actions
  setNodeUploading: (nodeId: string, uploading: boolean) => void;
  isAnyNodeUploading: () => boolean;
  
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  
  addNode: (node: Node) => void;
  updateNode: (id: string, data: Partial<Node["data"]>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  
  selectNode: (node: Node | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setContextMenuPosition: (position: { x: number; y: number } | null) => void;
  focusNode: (nodeId: string | null) => void;
  
  // Pipeline highlighting (for Activity panel)
  highlightPipeline: (nodeIds: string[]) => void;
  clearHighlight: () => void;
  
  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  recordHistory: () => void;
  
  // Copy/Paste actions
  copySelectedNodes: () => void;
  pasteNodes: (position?: { x: number; y: number }) => void;
  
  // Selection actions
  selectAllNodes: () => void;
  deleteSelectedNodes: () => void;
  duplicateSelectedNodes: () => void;
  
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
        selectedNodeIds: [],
        contextMenuPosition: null,
        viewport: undefined,
        isWorkflowRunning: false,
        focusNodeId: null,
        workflowId: null,
        highlightedNodeIds: [],
        connectingFrom: null,
        pendingFitView: false,
        
        // Undo/Redo history
        history: [],
        historyIndex: -1,
        
        // Clipboard
        clipboard: null,
        
        // Execution tracking
        currentWorkflowExecutionId: null,
        currentTriggerRunId: null,
        runningNodeIds: new Map(),
        // AbortController map for cancelling running nodes
        nodeAbortControllers: new Map<string, AbortController>(),
        // Upload tracking - nodes currently uploading files
        uploadingNodeIds: new Set<string>(),

        setWorkflowRunning: (running) => set({ isWorkflowRunning: running }),
        setWorkflowId: (workflowId) => set({ workflowId }),
        setConnectingFrom: (info) => set({ connectingFrom: info }),
        triggerFitView: () => set({ pendingFitView: true }),
        clearFitView: () => set({ pendingFitView: false }),
        
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
        
        // Upload tracking - prevents running workflow while any node is uploading
        setNodeUploading: (nodeId, uploading) => {
          const state = get();
          const newSet = new Set(state.uploadingNodeIds);
          if (uploading) {
            newSet.add(nodeId);
          } else {
            newSet.delete(nodeId);
          }
          set({ uploadingNodeIds: newSet });
        },
        
        isAnyNodeUploading: () => {
          return get().uploadingNodeIds.size > 0;
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
            showError("Failed to cancel workflow");
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
          showCancelled("Workflow");
          return true;
        } catch (error) {
          console.error("[cancelWorkflow] Error:", error);
          showError("Failed to cancel workflow");
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
        const nodeToCancel = state.nodes.find((n) => n.id === nodeId);
        const nodeName = (nodeToCancel?.data as Record<string, unknown>)?.label as string || "Node";
        
        set((prev) => ({
          nodes: prev.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...(n.data as Record<string, unknown>), status: "cancelled", error: undefined } }
              : n
          ),
        }));

        console.log("[cancelNode] Node cancelled successfully");
        showCancelled(nodeName);
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
        
        // Check for removed edges
        const removedChanges = changes.filter((c) => c.type === "remove");
        if (removedChanges.length > 0) {
          // Record history before removing edges for undo support
          get().recordHistory();
          const removedEdgeIds = new Set(removedChanges.map((c) => c.id));
          const removedEdges = state.edges.filter((e) => removedEdgeIds.has(e.id));
          
          // Map of target handle to the input field it corresponds to
          const handleToInputField: Record<string, string[]> = {
            "video": ["inputVideo", "video"],
            "inputVideo": ["inputVideo", "video"],
            "video1": ["inputVideo1", "video1"],
            "inputVideo1": ["inputVideo1", "video1"],
            "video2": ["inputVideo2", "video2"],
            "inputVideo2": ["inputVideo2", "video2"],
            "audio": ["inputAudio", "audio"],
            "inputAudio": ["inputAudio", "audio"],
            "image": ["inputImage", "image"],
            "inputImage": ["inputImage", "image"],
            "frame": ["inputFrame", "frame"],
            "inputFrame": ["inputFrame", "frame"],
            "referenceImages": ["referenceImages"],
          };
          
          // Update nodes affected by removed edges
          const updatedNodes = state.nodes.map((n) => {
            const edgesForNode = removedEdges.filter((e) => e.target === n.id);
            if (edgesForNode.length === 0) return n;
            
            const nodeData = { ...(n.data as Record<string, unknown>) };
            let hasChanges = false;
            
            // Clear the input field and result for each removed edge
            for (const edge of edgesForNode) {
              const targetHandle = edge.targetHandle;
              if (targetHandle) {
                const fieldsToClean = handleToInputField[targetHandle] || [targetHandle];
                for (const field of fieldsToClean) {
                  if (nodeData[field] !== undefined) {
                    nodeData[field] = undefined;
                    hasChanges = true;
                    console.log(`[onEdgesChange] Cleared ${field} from ${n.id} due to edge removal`);
                  }
                }
              }
            }
            
            // If any media input was cleared, also clear the result
            if (hasChanges) {
              nodeData.result = undefined;
              nodeData.status = undefined;
              nodeData.error = undefined;
              console.log(`[onEdgesChange] Cleared result from ${n.id} due to edge removal`);
            }
            
            // Handle inheritance metadata cleanup
            const existingInherited = nodeData._inheritedFrom as Record<string, unknown> | undefined;
            const inheritanceEdges = edgesForNode.filter((e) => {
              const edgeData = e.data as Record<string, unknown> | undefined;
              return edgeData?.isFullInheritance === true || edgeData?.isSettingsConnection === true;
            });
            
            if (inheritanceEdges.length > 0) {
              const hasFullInheritance = inheritanceEdges.some((e) => {
                const edgeData = e.data as Record<string, unknown> | undefined;
                return edgeData?.isFullInheritance === true;
              });
              
              if (hasFullInheritance) {
                delete nodeData._inheritedFrom;
              } else if (existingInherited) {
                // For settings connections, remove only the specific settings
                const settingsToRemove = inheritanceEdges
                  .filter((e) => {
                    const edgeData = e.data as Record<string, unknown> | undefined;
                    return edgeData?.isSettingsConnection === true;
                  })
                  .map((e) => e.targetHandle)
                  .filter(Boolean) as string[];
                
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
            
            return hasChanges || inheritanceEdges.length > 0 ? { ...n, data: nodeData } : n;
          });
          
          set({ edges: newEdges, nodes: updatedNodes });
          return;
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
        // Record history before adding node for undo support
        get().recordHistory();
        set({
          nodes: [...get().nodes, node],
        });
      },

      updateNode: (id, data) => {
        const state = get();
        const node = state.nodes.find((n) => n.id === id);
        if (!node) {
          console.warn(`[updateNode] Node ${id} NOT FOUND in store!`);
          return;
        }
        
        // DEBUG: Log crop-related updates
        const cropFields = ["xPercent", "yPercent", "widthPercent", "heightPercent"];
        const hasCropUpdate = cropFields.some(f => f in data);
        if (hasCropUpdate) {
          console.log(`[updateNode:${id}] Crop update RECEIVED:`, {
            xPercent: (data as Record<string, unknown>).xPercent,
            yPercent: (data as Record<string, unknown>).yPercent,
            widthPercent: (data as Record<string, unknown>).widthPercent,
            heightPercent: (data as Record<string, unknown>).heightPercent,
          });
        }

        const oldData = node.data as Record<string, unknown>;
        let newData = { ...oldData, ...data };
        
        // DEBUG: Log merged data for crop fields
        if (hasCropUpdate) {
          console.log(`[updateNode:${id}] Crop MERGED data:`, {
            xPercent: newData.xPercent,
            yPercent: newData.yPercent,
            widthPercent: newData.widthPercent,
            heightPercent: newData.heightPercent,
          });
        }

        // Auto-clear result when input media changes OR is removed
        const mediaInputFields = ["inputImage", "inputVideo", "inputAudio", "inputVideo1", "inputVideo2", "inputFrame", "referenceImages", "video", "audio", "image", "video1", "video2"];
        const mediaInputChanged = mediaInputFields.some(field => {
          // Check if this field is being updated
          if (!(field in data)) return false;
          const newValue = data[field];
          const oldValue = oldData[field];
          // Changed if: value is different (including being cleared/removed)
          return newValue !== oldValue;
        });
        
        // Also check if any media input is being explicitly removed (set to null, undefined, or empty string)
        const mediaInputRemoved = mediaInputFields.some(field => {
          if (!(field in data)) return false;
          const newValue = data[field];
          // Considered "removed" if set to null, undefined, or empty string
          return newValue === null || newValue === undefined || newValue === "";
        });
        
        if ((mediaInputChanged || mediaInputRemoved) && oldData.result !== undefined) {
          // Clear the result when input media changes or is removed
          newData = { ...newData, result: undefined, status: undefined, error: undefined };
          console.log(`[updateNode] Cleared result for ${id} due to input media ${mediaInputRemoved ? "removal" : "change"}`);
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
        const changedKeys = Object.keys(data).filter(key => (data as Record<string, unknown>)[key] !== oldData[key]);
        
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
            // Clamp the value to its max if this setting has a defined max
            const clampedValue = clampSettingValue(targetHandle, valueToPass);
            
            // Skip if clampSettingValue returned undefined (invalid value type)
            if (clampedValue === undefined) {
              console.warn(`[updateNode] Skipping invalid value for ${targetHandle}`);
              continue;
            }
            
            const existingUpdates = targetUpdates.get(targetNodeId) || {};
            existingUpdates[targetHandle] = clampedValue;

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
        // Record history before deleting node for undo support
        get().recordHistory();
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

        // Record history before duplicating node for undo support
        get().recordHistory();

        const newId = `node-${Date.now()}-dup`;
        const originalData = original.data as Record<string, unknown>;
        const newNode: Node = {
          ...original,
          id: newId,
          position: {
            x: original.position.x + 40,
            y: original.position.y + 40,
          },
          selected: false,
          data: {
            ...originalData,
            // Don't copy skip flag - duplicated nodes should default to running normally
            skip: false,
          },
        };

        set({
          nodes: [...state.nodes, newNode],
          selectedNode: newNode,
        });
      },

      selectNode: (node) => set({ 
          selectedNode: node,
          selectedNodeIds: node ? [node.id] : [],
        }),
        
        setSelectedNodeIds: (ids) => {
          const state = get();
          const nodes = state.nodes.filter(n => ids.includes(n.id));
          set({ 
            selectedNodeIds: ids,
            selectedNode: nodes.length > 0 ? nodes[0] : null,
          });
        },

      setContextMenuPosition: (position) => set({ contextMenuPosition: position }),

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

      // =============================================================================
      // UNDO/REDO ACTIONS
      // =============================================================================
      
      recordHistory: () => {
        const state = get();
        const entry: HistoryEntry = {
          nodes: JSON.parse(JSON.stringify(state.nodes)),
          edges: JSON.parse(JSON.stringify(state.edges)),
        };
        
        // If we're not at the end of history, truncate forward history
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(entry);
        
        // Limit history length
        if (newHistory.length > MAX_HISTORY_LENGTH) {
          newHistory.shift();
        }
        
        set({
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },
      
      undo: () => {
        const state = get();
        if (state.historyIndex <= 0) return;
        
        const newIndex = state.historyIndex - 1;
        const entry = state.history[newIndex];
        
        if (entry) {
          set({
            nodes: JSON.parse(JSON.stringify(entry.nodes)),
            edges: JSON.parse(JSON.stringify(entry.edges)),
            historyIndex: newIndex,
            selectedNode: null,
            selectedNodeIds: [],
          });
        }
      },
      
      redo: () => {
        const state = get();
        if (state.historyIndex >= state.history.length - 1) return;
        
        const newIndex = state.historyIndex + 1;
        const entry = state.history[newIndex];
        
        if (entry) {
          set({
            nodes: JSON.parse(JSON.stringify(entry.nodes)),
            edges: JSON.parse(JSON.stringify(entry.edges)),
            historyIndex: newIndex,
            selectedNode: null,
            selectedNodeIds: [],
          });
        }
      },
      
      canUndo: () => {
        const state = get();
        return state.historyIndex > 0;
      },
      
      canRedo: () => {
        const state = get();
        return state.historyIndex < state.history.length - 1;
      },
      
      // =============================================================================
      // COPY/PASTE ACTIONS
      // =============================================================================
      
      copySelectedNodes: () => {
        const state = get();
        const selectedIds = state.selectedNodeIds.length > 0 
          ? state.selectedNodeIds 
          : state.selectedNode ? [state.selectedNode.id] : [];
        
        if (selectedIds.length === 0) return;
        
        // Get selected nodes
        const nodesToCopy = state.nodes.filter(n => selectedIds.includes(n.id));
        
        // Get edges that connect selected nodes to each other
        const edgesToCopy = state.edges.filter(
          e => selectedIds.includes(e.source) && selectedIds.includes(e.target)
        );
        
        set({
          clipboard: {
            nodes: JSON.parse(JSON.stringify(nodesToCopy)),
            edges: JSON.parse(JSON.stringify(edgesToCopy)),
          },
        });
        
        console.log(`[Copy] Copied ${nodesToCopy.length} nodes and ${edgesToCopy.length} edges`);
      },
      
      pasteNodes: (position) => {
        const state = get();
        if (!state.clipboard || state.clipboard.nodes.length === 0) return;
        
        // Record history before paste
        get().recordHistory();
        
        // Generate new IDs for pasted nodes
        const idMap = new Map<string, string>();
        const timestamp = Date.now();
        
        state.clipboard.nodes.forEach((node, index) => {
          const newId = `node-${timestamp}-${index}`;
          idMap.set(node.id, newId);
        });
        
        // Calculate offset for new nodes
        // If position is provided, center the pasted nodes there
        // Otherwise, offset from original position
        let offsetX = 40;
        let offsetY = 40;
        
        if (position && state.clipboard.nodes.length > 0) {
          // Find center of copied nodes
          const minX = Math.min(...state.clipboard.nodes.map(n => n.position.x));
          const maxX = Math.max(...state.clipboard.nodes.map(n => n.position.x));
          const minY = Math.min(...state.clipboard.nodes.map(n => n.position.y));
          const maxY = Math.max(...state.clipboard.nodes.map(n => n.position.y));
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          
          offsetX = position.x - centerX;
          offsetY = position.y - centerY;
        }
        
        // Create new nodes with new IDs and offset positions
        const newNodes: Node[] = state.clipboard.nodes.map(node => ({
          ...JSON.parse(JSON.stringify(node)),
          id: idMap.get(node.id)!,
          position: {
            x: node.position.x + offsetX,
            y: node.position.y + offsetY,
          },
          selected: true,
          data: {
            ...(node.data as Record<string, unknown>),
            // Clear execution state and skip flag
            status: undefined,
            error: undefined,
            result: undefined,
            skip: false, // Pasted nodes should default to running normally
          },
        }));
        
        // Create new edges with updated source/target IDs
        const newEdges: Edge[] = state.clipboard.edges.map((edge, index) => ({
          ...JSON.parse(JSON.stringify(edge)),
          id: `e-${timestamp}-${index}`,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
        }));
        
        // Update state
        set({
          nodes: [...state.nodes.map(n => ({ ...n, selected: false })), ...newNodes],
          edges: [...state.edges, ...newEdges],
          selectedNodeIds: newNodes.map(n => n.id),
          selectedNode: newNodes.length > 0 ? newNodes[0] : null,
        });
        
        console.log(`[Paste] Pasted ${newNodes.length} nodes and ${newEdges.length} edges`);
      },
      
      // =============================================================================
      // SELECTION ACTIONS
      // =============================================================================
      
      selectAllNodes: () => {
        const state = get();
        const allIds = state.nodes.map(n => n.id);
        set({
          selectedNodeIds: allIds,
          selectedNode: state.nodes.length > 0 ? state.nodes[0] : null,
          nodes: state.nodes.map(n => ({ ...n, selected: true })),
        });
      },
      
      deleteSelectedNodes: () => {
        const state = get();
        const selectedIds = state.selectedNodeIds.length > 0 
          ? state.selectedNodeIds 
          : state.selectedNode ? [state.selectedNode.id] : [];
        
        if (selectedIds.length === 0) return;
        
        // Record history before delete
        get().recordHistory();
        
        set({
          nodes: state.nodes.filter(n => !selectedIds.includes(n.id)),
          edges: state.edges.filter(e => !selectedIds.includes(e.source) && !selectedIds.includes(e.target)),
          selectedNode: null,
          selectedNodeIds: [],
        });
      },
      
      duplicateSelectedNodes: () => {
        const state = get();
        const selectedIds = state.selectedNodeIds.length > 0 
          ? state.selectedNodeIds 
          : state.selectedNode ? [state.selectedNode.id] : [];
        
        if (selectedIds.length === 0) return;
        
        // Record history before duplicate
        get().recordHistory();
        
        // Generate new IDs
        const idMap = new Map<string, string>();
        const timestamp = Date.now();
        
        selectedIds.forEach((id, index) => {
          idMap.set(id, `node-${timestamp}-dup-${index}`);
        });
        
        // Create duplicated nodes
        const nodesToDuplicate = state.nodes.filter(n => selectedIds.includes(n.id));
        const newNodes: Node[] = nodesToDuplicate.map(node => {
          const clonedNode = JSON.parse(JSON.stringify(node));
          return {
            ...clonedNode,
            id: idMap.get(node.id)!,
            position: {
              x: node.position.x + 40,
              y: node.position.y + 40,
            },
            selected: true,
            data: {
              ...clonedNode.data,
              // Don't copy skip flag - duplicated nodes should default to running normally
              skip: false,
            },
          };
        });
        
        // Duplicate edges between selected nodes
        const edgesToDuplicate = state.edges.filter(
          e => selectedIds.includes(e.source) && selectedIds.includes(e.target)
        );
        const newEdges: Edge[] = edgesToDuplicate.map((edge, index) => ({
          ...JSON.parse(JSON.stringify(edge)),
          id: `e-${timestamp}-dup-${index}`,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
        }));
        
        set({
          nodes: [...state.nodes.map(n => ({ ...n, selected: false })), ...newNodes],
          edges: [...state.edges, ...newEdges],
          selectedNodeIds: newNodes.map(n => n.id),
          selectedNode: newNodes.length > 0 ? newNodes[0] : null,
        });
      },

      clearFlow: () => set({ nodes: [], edges: [], selectedNode: null, selectedNodeIds: [], highlightedNodeIds: [] }),

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
        
        // Check if source is an LLM node - we'll need to parse outputs for settings handles
        const isLLMSource = sourceNodeType === "openrouter";

        // Find all edges that start from this source node
        const outgoingEdges = state.edges.filter((e) => e.source === sourceNodeId);
        
        console.log(`[propagateOutput] Found ${outgoingEdges.length} outgoing edges from ${sourceNode.type} (isLLM=${isLLMSource})`);
        console.log(`[propagateOutput] Edges:`, outgoingEdges.map(e => ({
          id: e.id,
          sourceHandle: e.sourceHandle,
          target: e.target,
          targetHandle: e.targetHandle,
        })));

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
        
        // Track nodes that failed LLM parsing
        const failedNodes: { nodeId: string; nodeName: string; handle: string; error: string }[] = [];
        
        // Update all target nodes based on edge configuration
        // NOTE: A target node may have MULTIPLE edges from the same source (e.g., output + settings)
        // We need to process ALL non-settings edges, not just the first one found
        const updatedNodes = state.nodes.map((node) => {
          // Find ALL edges to this target node
          const edgesToNode = outgoingEdges.filter((e) => e.target === node.id);
          if (edgesToNode.length === 0) return node;
          
          // Filter out settings connections - they are synced separately in updateNode
          const nonSettingsEdges = edgesToNode.filter((edge) => {
            const edgeData = edge.data as Record<string, unknown> | undefined;
            const sourceHandle = edge.sourceHandle;
            const isSettingsConnection = edgeData?.isSettingsConnection === true || 
                                         edgeData?.fromSettingsPopover === true ||
                                         (sourceHandle?.endsWith("-setting") ?? false);
            const isFullInheritance = edgeData?.isFullInheritance === true;
            
            // Keep full inheritance edges, skip individual settings edges
            if (isSettingsConnection && !isFullInheritance) {
              console.log(`[propagateOutput] Skipping settings edge ${sourceHandle} -> ${edge.targetHandle}`);
              return false;
            }
            return true;
          });
          
          if (nonSettingsEdges.length === 0) return node;
          
          // Process each non-settings edge
          let nodeData = { ...(node.data as Record<string, unknown>) };
          
          for (const edge of nonSettingsEdges) {
            const targetHandle = edge.targetHandle;
            const sourceHandle = edge.sourceHandle;
            const edgeData = edge.data as Record<string, unknown> | undefined;
            const isFullInheritance = edgeData?.isFullInheritance === true;
          
            console.log(`[propagateOutput] Processing edge to ${node.id} (${node.type}): sourceHandle=${sourceHandle}, targetHandle=${targetHandle}, isFull=${isFullInheritance}`);
          
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
            
            // Continue to next edge (full inheritance already handled media)
            continue;
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
            // Set the ACTUAL target handle field, not always inputImage
            // crop-image uses "image", seedvr uses "inputImage", seedance uses "frame"
            nodeData[targetHandle] = output;
            // Also set inputImage as fallback for compatibility
            if (targetHandle !== "inputImage") {
              nodeData.inputImage = output;
            }
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
            // For other handles, check if we need to parse LLM output
            const targetNodeType = node.type as AINodeType | undefined;
            
            // DEBUG: Log what we're checking
            console.log(`[propagateOutput] Checking handle ${targetHandle}:`, {
              isLLMSource,
              targetNodeType,
              sourceHandle,
              output: output?.slice?.(0, 50) || output,
            });
            
            // Check if this is an LLM source and the field can accept parsed input
            const shouldParseLLM = isLLMSource && targetNodeType && canFieldAcceptLLMInput(targetNodeType, targetHandle);
            console.log(`[propagateOutput] shouldParseLLM=${shouldParseLLM} (isLLMSource=${isLLMSource}, targetNodeType=${targetNodeType}, canAccept=${targetNodeType ? canFieldAcceptLLMInput(targetNodeType, targetHandle) : 'N/A'})`);
            
            if (shouldParseLLM && targetNodeType) {
              // Use universal parser that handles ALL field types (select, slider, number, toggle, text)
              console.log(`[propagateOutput] Parsing LLM output for ${node.id}.${targetHandle}`);
              const parseResult = parseLLMToFieldValue(output, targetNodeType, targetHandle);
              
              if (parseResult.success) {
                console.log(`[propagateOutput] Parse success: "${output?.slice(0, 30)}..." -> ${JSON.stringify(parseResult.value)}`);
                nodeData[targetHandle] = parseResult.value;
              } else {
                // Parsing failed - track for error reporting
                const errorMsg = parseResult.error;
                console.log(`[propagateOutput] Parse FAILED: ${errorMsg}`);
                const nodeName = (node.data as Record<string, unknown>)?.label as string || node.type || node.id;
                failedNodes.push({
                  nodeId: node.id,
                  nodeName,
                  handle: targetHandle,
                  error: errorMsg,
                });
                // Mark node as failed
                nodeData.status = "failed";
                nodeData.error = `LLM output invalid: ${errorMsg}`;
              }
            } else {
              // No parsing needed - use raw output
              nodeData[targetHandle] = output;
            }
          }
          } // End of for loop
          
          return { ...node, data: nodeData };
        });
        
        console.log(`[propagateOutput] Setting ${updatedNodes.length} updated nodes`);
        set({ nodes: updatedNodes });
        
        // Show toast notifications for any parsing failures
        for (const failure of failedNodes) {
          showLLMParseError(failure.nodeName, failure.handle, failure.error);
        }
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
                // Show appropriate error toast when a node fails
                if (status === "failed" && patch?.error) {
                  const failedNode = get().nodes.find((n) => n.id === id);
                  const nodeName = (failedNode?.data as Record<string, unknown>)?.label as string || "Node";
                  const errorMsg = String(patch.error).toLowerCase();
                  
                  // Detect specific error types and show appropriate toast
                  if (errorMsg.includes("timed out") || errorMsg.includes("timeout")) {
                    showTimeoutError(nodeName);
                  } else if (errorMsg.includes("insufficient credits") || errorMsg.includes("not enough credits")) {
                    // Extract credit amounts if available
                    showInsufficientCredits();
                  } else if (errorMsg.includes("network") || errorMsg.includes("econnrefused") || errorMsg.includes("fetch failed")) {
                    showNetworkError(String(patch.error));
                  } else if (errorMsg.includes("all providers failed") || patch.attemptedProviders) {
                    const providers = patch.attemptedProviders as string[] | undefined;
                    showProviderError(
                      providers?.join(", ") || "Provider",
                      String(patch.error)
                    );
                  } else {
                    showNodeError(nodeName, String(patch.error));
                  }
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

