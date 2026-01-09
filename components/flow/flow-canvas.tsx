"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  addEdge,
  Connection,
  Edge,
  Node,
  OnConnectEnd,
  OnConnectStart,
  EdgeProps,
  getBezierPath,
  getSmoothStepPath,
} from "reactflow";
import "reactflow/dist/style.css";
import { useFlowStore } from "@/store";
import { nodeTypes } from "@/components/flow";
import { NODE_DEFINITIONS, type AINodeType, type DataType, NODE_CONTRACTS, isSettingsHandle, isMediaHandle } from "@/types/nodes";
import { NodeTypeModal } from "./node-type-modal";

interface PendingConnection {
  sourceNodeId: string;
  sourceHandleId: string | null;
  position: { x: number; y: number };
}

interface FlowCanvasProps {
  className?: string;
  storageKey?: string;
}

let nodeIdCounter = 1;
const getNewNodeId = () => `node-${Date.now()}-${nodeIdCounter++}`;

// Data type colors for edges - bright neon colors
const edgeColors: Record<string, { stroke: string; glow: string; dash: string }> = {
  text: { stroke: "#3b82f6", glow: "#3b82f6", dash: "#60a5fa" },      // Bright Blue
  image: { stroke: "#10b981", glow: "#10b981", dash: "#34d399" },     // Bright Green
  video: { stroke: "#8b5cf6", glow: "#8b5cf6", dash: "#a78bfa" },     // Bright Purple
  audio: { stroke: "#f59e0b", glow: "#f59e0b", dash: "#fbbf24" },     // Bright Orange
  any: { stroke: "#6b7280", glow: "#6b7280", dash: "#9ca3af" },       // Gray
  negative: { stroke: "#ef4444", glow: "#ef4444", dash: "#f87171" },  // Bright Red
  number: { stroke: "#ec4899", glow: "#ec4899", dash: "#f472b6" },    // Bright Pink
  boolean: { stroke: "#06b6d4", glow: "#06b6d4", dash: "#22d3ee" },   // Bright Cyan
};

// Custom edge component that changes color based on connection type with delete button
function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const dataType = (data?.dataType as string) || "any";
  const isNegative = data?.isNegative === true || dataType === "negative";
  const [isHovered, setIsHovered] = useState(false);
  const isWorkflowRunning = useFlowStore((s) => s.isWorkflowRunning);
  const [colorPhase, setColorPhase] = useState(0);
  
  // Get colors based on data type
  const typeColors = edgeColors[dataType] || edgeColors.any;
  
  // Animate color phase when workflow is running
  useEffect(() => {
    if (!isWorkflowRunning) {
      setColorPhase(0);
      return;
    }
    
    const interval = setInterval(() => {
      setColorPhase((prev) => (prev + 1) % 360);
    }, 20); // Fast smooth animation
    
    return () => clearInterval(interval);
  }, [isWorkflowRunning]);
  
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Hide "advanced setting" edges when the target node's advanced panel is collapsed
  const targetHandle = (data as any)?.targetHandle as string | undefined;
  const targetNodeId = (data as any)?.targetNodeId as string | undefined;
  const shouldHideAdvanced = useFlowStore((s) => {
    if (!targetNodeId || !targetHandle) return false;
    const node = s.nodes.find((n) => n.id === targetNodeId);
    if (!node) return false;
    const open = Boolean((node.data as any)?.advancedOpen);
    if (open) return false;
    const nodeType = node.type as AINodeType | undefined;
    const advancedByType: Partial<Record<AINodeType, Set<string>>> = {
      seedream: new Set([
        "numInferenceSteps",
        "guidanceScale",
        "seed",
        "aspectRatio",
        "negativePrompt",
        "truncatePrompt",
        "promptEnhancer",
        "syncMode",
      ]),
      openrouter: new Set(["systemPrompt", "model", "temperature", "maxTokens", "negativePrompt"]),
      elevenlabs: new Set(["stability", "clarity", "voiceId"]),
      seedance: new Set(["duration", "aspectRatio", "seed"]),
      seedvr: new Set(["scale", "enhanceFaces"]),
      lipsync: new Set(["model"]),
      "crop-image": new Set(["xPercent", "yPercent", "widthPercent", "heightPercent"]),
      "merge-audio-video": new Set(["replaceAudio"]),
      "merge-videos": new Set(["transition"]),
      "extract-audio": new Set(["format", "bitrate", "sampleRate", "channels", "normalize"]),
    };
    const set = nodeType ? advancedByType[nodeType] : undefined;
    return Boolean(set?.has(targetHandle));
  });

  if (shouldHideAdvanced) return null;

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const edges = useFlowStore.getState().edges;
    useFlowStore.getState().setEdges(edges.filter((edge) => edge.id !== id));
  }, [id]);

  // Calculate colors - use data type color, animate when running
  const getEdgeColor = () => {
    if (isWorkflowRunning) {
      return `hsl(${colorPhase}, 80%, 55%)`;
    }
    return typeColors.stroke;
  };
  
  const getGlowColor = () => {
    if (isWorkflowRunning) {
      return `hsla(${colorPhase}, 80%, 55%, 0.4)`;
    }
    return typeColors.glow;
  };
  
  const getDashColor = () => {
    if (isWorkflowRunning) {
      return `hsl(${(colorPhase + 60) % 360}, 80%, 70%)`;
    }
    return typeColors.dash;
  };

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ overflow: "visible" }}
    >
      {/* Invisible wider path for easier interaction */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        style={{ cursor: "pointer" }}
      />
      {/* Glow layer 1 - outermost, most transparent */}
      <path
        d={edgePath}
        fill="none"
        stroke={getGlowColor()}
        strokeWidth={12}
        strokeLinecap="round"
        opacity={0.15}
      />
      {/* Glow layer 2 */}
      <path
        d={edgePath}
        fill="none"
        stroke={getGlowColor()}
        strokeWidth={8}
        strokeLinecap="round"
        opacity={0.25}
      />
      {/* Glow layer 3 - inner glow */}
      <path
        d={edgePath}
        fill="none"
        stroke={getGlowColor()}
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.4}
      />
      {/* Main edge - thick solid bright line */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={getEdgeColor()}
        strokeWidth={2.5}
        strokeLinecap="round"
        markerEnd={markerEnd}
      />
      {/* Animated dash overlay */}
      {isWorkflowRunning && (
        <path
          d={edgePath}
          fill="none"
          stroke={getDashColor()}
          strokeWidth={3}
          strokeDasharray="8 4"
          style={{
            animation: "dash 0.3s linear infinite",
          }}
        />
      )}
      {/* Edge Handle / Delete Button */}
      {isHovered && !isWorkflowRunning && (
        <g
          transform={`translate(${labelX}, ${labelY})`}
          style={{ cursor: "pointer", overflow: "visible" }}
        >
          {/* Invisible larger hit area for easier clicking */}
          <circle
            cx={0}
            cy={0}
            r={20}
            fill="transparent"
            onClick={handleDelete}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ cursor: "pointer" }}
          />
          {/* Outer glow ring */}
          <circle
            cx={0}
            cy={0}
            r={14}
            fill={typeColors.stroke}
            fillOpacity={0.2}
            onClick={handleDelete}
            style={{ pointerEvents: "none" }}
          />
          {/* Inner solid circle */}
          <circle
            cx={0}
            cy={0}
            r={8}
            fill={typeColors.stroke}
            onClick={handleDelete}
            style={{ pointerEvents: "none" }}
          />
          {/* X Icon */}
          <path
            d="M-2.5 -2.5 L2.5 2.5 M2.5 -2.5 L-2.5 2.5"
            stroke="white"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
}

const edgeTypes = {
  custom: CustomEdge,
};

function getNodeOutputPreview(node: Node): string | undefined {
  const d = (node.data ?? {}) as any;
  const candidates = [
    d.result,
    d.response,
    d.output,
    d.prompt,
    d.systemPrompt,
    d.text,
  ];

  for (const v of candidates) {
    if (typeof v === "string" && v.trim().length > 0) {
      return v.trim().slice(0, 500);
    }
  }

  return undefined;
}

const HANDLE_TYPES: Record<AINodeType, { inputs: Record<string, DataType>; outputs: Record<string, DataType> }> = {
  seedream: {
    inputs: {
      prompt: "text",
      numInferenceSteps: "number",
      seed: "number",
      aspectRatio: "text",
      negativePrompt: "negative",
      guidanceScale: "number",
      truncatePrompt: "boolean",
      promptEnhancer: "boolean",
      syncMode: "boolean",
      image: "image",
    },
    outputs: {
      out: "any",
    },
  },
  seedvr: { inputs: { inputImage: "image", scale: "text", enhanceFaces: "boolean" }, outputs: { upscaled: "image" } },
  seedance: {
    inputs: { prompt: "text", inputFrame: "image", duration: "text", aspectRatio: "text", seed: "number" },
    outputs: { video: "video" },
  },
  elevenlabs: { inputs: { text: "text", voiceId: "text", stability: "number", clarity: "number" }, outputs: { audio: "audio" } },
  openrouter: {
    inputs: {
      prompt: "text",
      context: "text",
      inputImage: "image",
      systemPrompt: "text",
      model: "text",
      temperature: "number",
      maxTokens: "number",
      negativePrompt: "negative",
    },
    outputs: { response: "text", out: "any" },
  },
  lipsync: { inputs: { inputVideo: "video", inputAudio: "audio", model: "text" }, outputs: { synced: "video" } },
  "crop-image": { 
    inputs: { inputImage: "image", xPercent: "number", yPercent: "number", widthPercent: "number", heightPercent: "number" }, 
    outputs: { cropped: "image" } 
  },
  "merge-audio-video": { 
    inputs: { inputVideo: "video", inputAudio: "audio", replaceAudio: "boolean" }, 
    outputs: { combined: "video" } 
  },
  "merge-videos": { 
    inputs: { inputVideo1: "video", inputVideo2: "video", transition: "text" }, 
    outputs: { merged: "video" } 
  },
  "extract-audio": { 
    inputs: { inputVideo: "video", format: "text", bitrate: "text", sampleRate: "text", channels: "text", normalize: "boolean" }, 
    outputs: { audio: "audio" } 
  },
};

function getNodeSettingKeys(node: Node | undefined): string[] {
  if (!node?.type) return [];
  const nodeType = node.type as AINodeType;
  
  // Use NODE_CONTRACTS for accurate settings mapping
  const contract = NODE_CONTRACTS[nodeType];
  if (contract) {
    // Return all setting keys
    return contract.settings.map((s: { id: string }) => s.id);
  }
  
  // Fallback to HANDLE_TYPES
  const def = HANDLE_TYPES[nodeType];
  if (!def) return [];
  return Object.keys(def.inputs ?? {});
}

function getHandleDataType(
  node: Node | undefined,
  direction: "inputs" | "outputs",
  handleId: string | null | undefined
): DataType | undefined {
  if (!node?.type) return undefined;
  const def = HANDLE_TYPES[node.type as AINodeType];
  if (!def) return undefined;

  const map = def[direction];
  if (!handleId) {
    const first = Object.keys(map)[0];
    return first ? map[first] : undefined;
  }
  return map[handleId];
}

function wouldCreateCycle(edges: Edge[], source: string, target: string): boolean {
  if (source === target) return true;

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  // Check if there's already a path target -> source
  const stack = [target];
  const visited = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const next = adj.get(cur);
    if (next) stack.push(...next);
  }
  return false;
}

function isTypeCompatible(from: DataType | undefined, to: DataType | undefined): boolean {
  if (!from || !to) return false;
  if (from === to) return true;
  if (to === "any") return true;
  if (from === "any") return true;
  // Text can connect to negative prompt
  if (from === "text" && to === "negative") return true;
  return false;
}

function FlowCanvasInner({ className, storageKey }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getViewport, setViewport, setCenter } = useReactFlow();
  
  // Modal state for adding nodes
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const connectingFromRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const connectionCompletedRef = useRef(false);

  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    setNodes,
    setEdges,
    selectNode,
    selectedNode,
    deleteNode,
    duplicateNode,
    viewport,
    setViewport: setViewportState,
    focusNodeId,
    focusNode,
  } = useFlowStore();

  // Focus on node when focusNodeId changes - pan so the NODE is at screen center
  useEffect(() => {
    if (!focusNodeId) return;
    
    const node = nodes.find((n) => n.id === focusNodeId);
    if (node) {
      // node.position is top-left corner of the node
      // Nodes are approximately 280px wide and 300-400px tall (with all fields)
      // Center point should be middle of the node
      const nodeHalfWidth = 140;  // ~280/2
      const nodeHalfHeight = 180; // ~360/2 for expanded nodes
      
      const nodeCenterX = node.position.x + nodeHalfWidth;
      const nodeCenterY = node.position.y + nodeHalfHeight;
      
      // setCenter puts these coordinates at the CENTER of the viewport
      setCenter(nodeCenterX, nodeCenterY, { 
        zoom: 1, 
        duration: 500 
      });
      
      // Clear focus after animation
      setTimeout(() => focusNode(null), 550);
    }
  }, [focusNodeId, nodes, setCenter, focusNode]);

  // Save/restore viewport (per workflow)
  useEffect(() => {
    if (!storageKey) return;

    try {
      const raw = localStorage.getItem(`flowsmith:viewport:${storageKey}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { x: number; y: number; zoom: number };
        setViewport(parsed, { duration: 0 });
        setViewportState(parsed);
        return;
      }
    } catch {
      // ignore
    }

    if (viewport) {
      setViewport(viewport, { duration: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const handleMoveEnd = useCallback(() => {
    const vp = getViewport();
    setViewportState(vp);
    if (storageKey) {
      try {
        localStorage.setItem(`flowsmith:viewport:${storageKey}`, JSON.stringify(vp));
      } catch {
        // ignore
      }
    }
  }, [getViewport, setViewportState, storageKey]);

  // Keyboard shortcuts: Delete/Backspace to delete, Ctrl/Cmd+D to duplicate
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selectedNode) return;

      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable === true;
      if (isTyping) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteNode(selectedNode.id);
        selectNode(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateNode(selectedNode.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteNode, duplicateNode, selectNode, selectedNode]);

  const isValidConnection = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return false;

      const sourceNode = nodes.find((n) => n.id === conn.source);
      const targetNode = nodes.find((n) => n.id === conn.target);
      const sourceNodeType = sourceNode?.type as AINodeType | undefined;
      const targetNodeType = targetNode?.type as AINodeType | undefined;

      const fromType = getHandleDataType(sourceNode, "outputs", conn.sourceHandle);
      const toType = getHandleDataType(targetNode, "inputs", conn.targetHandle);
      const targetHandle = conn.targetHandle ?? "";

      // Check if target is a settings input - settings can receive from any output
      const isTargetSettings = targetNodeType ? isSettingsHandle(targetNodeType, targetHandle) : false;
      
      // If connecting to a settings input, allow if source node has that setting
      if (isTargetSettings && sourceNodeType) {
        // Check if source node has this setting
        const sourceContract = NODE_CONTRACTS[sourceNodeType];
        const hasSourceSetting = sourceContract?.settings.some((s: { id: string }) => s.id === targetHandle);
        if (hasSourceSetting) {
          // Settings connection is valid if source has the setting
          if (wouldCreateCycle(edges, conn.source, conn.target)) return false;
          return true;
        }
      }

      // For non-settings connections, check type compatibility
      if (!isTypeCompatible(fromType, toType)) return false;
      if (wouldCreateCycle(edges, conn.source, conn.target)) return false;

      return true;
    },
    [edges, nodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getNewNodeId(),
        type,
        position,
        data: getDefaultNodeData(type),
      };

      setNodes([...nodes, newNode]);
    },
    [screenToFlowPosition, nodes, setNodes]
  );

  // Handle regular connections between existing nodes
  const onConnect = useCallback(
    (params: Connection) => {
      if (!isValidConnection(params)) return;

      const sourceNode = params.source ? nodes.find((n) => n.id === params.source) : undefined;
      const targetNode = params.target ? nodes.find((n) => n.id === params.target) : undefined;
      const sourceNodeType = sourceNode?.type as AINodeType | undefined;
      const targetNodeType = targetNode?.type as AINodeType | undefined;
      const edgeDataType = getHandleDataType(sourceNode, "outputs", params.sourceHandle) ?? "any";
      const targetHandleType = getHandleDataType(targetNode, "inputs", params.targetHandle);

      // Check if connecting to a negative prompt handle
      const isNegative = targetHandleType === "negative" || params.targetHandle === "negativePrompt" || params.targetHandle === "negative";
      
      // Use NODE_CONTRACTS to determine if target is a settings input or media input
      const targetHandle = params.targetHandle ?? "";
      const isTargetSettingsInput = targetNodeType ? isSettingsHandle(targetNodeType, targetHandle) : false;
      const isTargetMediaInput = targetNodeType ? isMediaHandle(targetNodeType, targetHandle) : false;
      
      // Settings connection: when connecting to a SETTINGS input
      // This should copy the setting value AND lock it on the target node
      const isSettingsConnection = isTargetSettingsInput;

      const nextEdges = addEdge(
        {
          ...params,
          type: "custom",
          animated: false,
          data: {
            dataType: edgeDataType,
            isNegative,
            targetHandle: params.targetHandle ?? null,
            targetNodeId: params.target ?? null,
            sourceNodeType,
            sourceHandle: params.sourceHandle,
            isSettingsConnection,
            isMediaConnection: isTargetMediaInput,
          },
        },
        edges
      );
      setEdges(nextEdges);
      
      // Mark as successful connect so onConnectEnd doesn't open the modal.
      connectionCompletedRef.current = true;

      // When users connect nodes, treat it like "pass output -> input" by copying a value into the target handle.
      if (params.source && params.target) {
        const src = nodes.find((n) => n.id === params.source);
        const targetHandle = params.targetHandle ?? "context";
        const sourceHandle = params.sourceHandle ?? null;

        // IMPORTANT: When connecting "response" to "prompt", we should NOT copy any preview value.
        // The prompt should only be populated when the LLM actually generates a response.
        // This prevents the source's prompt from being copied to the target's prompt.
        const isResponseToPrompt = sourceHandle === "response" && targetHandle === "prompt";
        
        if (isResponseToPrompt) {
          // Don't copy anything yet - wait for actual LLM response
          // Just set up the connection metadata
          setNodes(
            nodes.map((n) =>
              n.id === params.target
                ? {
                    ...n,
                    data: {
                      ...(n.data as any),
                      incomingFrom: {
                        ...(n.data as any)?.incomingFrom,
                        [targetHandle]: { nodeId: params.source, handleId: sourceHandle },
                      },
                    },
                  }
                : n
            )
          );
          return;
        }

        const preview = src ? getNodeOutputPreview(src) : undefined;
        const srcData = (src?.data ?? {}) as any;
        const valueFromSourceHandle =
          sourceHandle && sourceHandle in srcData ? srcData[sourceHandle] : undefined;

        // Prefer same-named field value, otherwise use preview string
        const nextValue = valueFromSourceHandle !== undefined ? valueFromSourceHandle : preview;

        // If we got a bundle object (e.g., Seedream `out`) and the targetHandle is a specific setting,
        // pull the matching value out of the bundle.
        const derivedValue =
          nextValue &&
          typeof nextValue === "object" &&
          !Array.isArray(nextValue) &&
          targetHandle in (nextValue as any)
            ? (nextValue as any)[targetHandle]
            : nextValue;

        // Build settings inheritance data if connecting to a settings input
        let settingsInheritanceUpdate: Record<string, unknown> = {};
        if (isSettingsConnection && sourceNode && sourceNodeType) {
          const sourceData = sourceNode.data as Record<string, unknown>;
          const settingKey = params.targetHandle;
          
          if (settingKey && sourceData[settingKey] !== undefined) {
            // Get existing inherited settings or create new
            const existingInherited = (targetNode?.data as Record<string, unknown>)?._inheritedFrom as Record<string, unknown> | undefined;
            const existingSettings = (existingInherited?.settings as Record<string, unknown>) || {};
            
            // Add this setting to the inherited settings
            const newInheritedSettings = {
              ...existingSettings,
              [settingKey]: sourceData[settingKey],
            };
            
            settingsInheritanceUpdate = {
              // Copy the setting value
              [settingKey]: sourceData[settingKey],
              // Update inheritance metadata
              _inheritedFrom: {
                sourceNodeId: sourceNode.id,
                sourceNodeType,
                settings: newInheritedSettings,
                fullInheritance: false,
              },
            };
          }
        }

        // Combine all updates into one setNodes call
        setNodes(
          nodes.map((n) =>
            n.id === params.target
              ? {
                  ...n,
                  data: {
                    ...(n.data as any),
                    // Apply derived value if available (for media inputs)
                    ...(derivedValue !== undefined && !isSettingsConnection ? { [targetHandle]: derivedValue } : {}),
                    // Apply settings inheritance if connecting to a settings input
                    ...settingsInheritanceUpdate,
                    incomingFrom: {
                      ...(n.data as any)?.incomingFrom,
                      [targetHandle]: { nodeId: params.source, handleId: sourceHandle },
                    },
                  },
                }
              : n
          )
        );
      }
    },
    [edges, isValidConnection, nodes, setEdges, setNodes]
  );

  // Track the source node/handle reliably (React Flow's onConnectEnd state can be inconsistent).
  const setConnectingFrom = useFlowStore((s) => s.setConnectingFrom);
  
  const onConnectStart: OnConnectStart = useCallback((event, params) => {
    const nodeId = params.nodeId ?? "";
    const handleId = params.handleId ?? null;
    
    connectingFromRef.current = { nodeId, handleId };
    
    // Get the handle type from the data-handletype attribute on the handle wrapper or parent
    const target = event.target as HTMLElement | null;
    // Look for data-handletype on the handle itself, its wrapper, or any parent
    let handleType: string | null = null;
    let el: HTMLElement | null = target;
    while (el && !handleType) {
      handleType = el.getAttribute("data-handletype");
      el = el.parentElement;
    }
    
    // Set store state for node highlighting
    setConnectingFrom({ nodeId, handleId, handleType });
  }, [setConnectingFrom]);

  // Handle when a connection is dropped on empty canvas - opens modal to add new node
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event) => {
      // If a valid connection just happened, never open the modal.
      if (connectionCompletedRef.current) {
        connectionCompletedRef.current = false;
        connectingFromRef.current = null;
        setConnectingFrom(null);
        return;
      }

      // React Flow versions differ in what they provide in connectionState.
      // The most reliable signal for "dropped on empty canvas" is whether the pointer-up happened on the pane.
      const target = event.target as HTMLElement | null;
      const droppedOnPane = Boolean(target?.closest?.(".react-flow__pane"));
      const droppedOnHandle = Boolean(target?.closest?.(".react-flow__handle"));
      const droppedOnNode = Boolean(target?.closest?.(".react-flow__node"));

      if (droppedOnPane && !droppedOnHandle && !droppedOnNode && connectingFromRef.current) {
        const eventTarget = event as MouseEvent | TouchEvent;
        const point =
          "changedTouches" in eventTarget
            ? (eventTarget as TouchEvent).changedTouches[0]
            : (eventTarget as MouseEvent);

        const position = screenToFlowPosition({
          x: point.clientX,
          y: point.clientY,
        });

        setPendingConnection({
          sourceNodeId: connectingFromRef.current.nodeId,
          sourceHandleId: connectingFromRef.current.handleId,
          position,
        });
        setIsModalOpen(true);
      }

      // Always clear at end of gesture
      connectingFromRef.current = null;
      setConnectingFrom(null);
    },
    [screenToFlowPosition, setConnectingFrom]
  );

  // Handle node type selection from modal - creates node and edge
  const handleNodeTypeSelect = useCallback(
    (nodeType: AINodeType) => {
      if (!pendingConnection) return;

      const newNodeId = getNewNodeId();
      const baseData = getDefaultNodeData(nodeType) as any;

      // If created via a connection, pass output preview forward as context.
      const sourceNode = pendingConnection.sourceNodeId
        ? nodes.find((n) => n.id === pendingConnection.sourceNodeId)
        : undefined;
      const preview = sourceNode ? getNodeOutputPreview(sourceNode) : undefined;

      // Create the new node at the drop position
      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        position: pendingConnection.position,
        data: {
          ...baseData,
          ...(preview
            ? {
                context: preview,
                incomingFrom: {
                  nodeId: pendingConnection.sourceNodeId,
                  handleId: pendingConnection.sourceHandleId,
                },
              }
            : {}),
        },
      };

      // Add the new node
      setNodes([...nodes, newNode]);

      // Create edge connecting source node to new node (if dragged from a node)
      if (pendingConnection.sourceNodeId) {
        const sourceNode = nodes.find((n) => n.id === pendingConnection.sourceNodeId);
        const edgeDataType =
          getHandleDataType(sourceNode, "outputs", pendingConnection.sourceHandleId) ?? "any";
        
        // Determine target handle based on node type (default to context for text)
        const targetNodeDef = HANDLE_TYPES[nodeType];
        const targetHandle = targetNodeDef?.inputs ? Object.keys(targetNodeDef.inputs)[0] : undefined;
        const isNegative = targetHandle === "negativePrompt" || targetHandle === "negative";
        
        const newEdge: Edge = {
          id: `e-${pendingConnection.sourceNodeId}-${newNodeId}`,
          source: pendingConnection.sourceNodeId,
          sourceHandle: pendingConnection.sourceHandleId,
          target: newNodeId,
          targetHandle,
          type: "custom",
          animated: false,
          data: {
            dataType: edgeDataType,
            isNegative,
            targetHandle: targetHandle ?? null,
            targetNodeId: newNodeId,
          },
        };
        setEdges([...edges, newEdge]);
      }

      // Cleanup
      setIsModalOpen(false);
      setPendingConnection(null);
    },
    [pendingConnection, nodes, edges, setNodes, setEdges]
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setPendingConnection(null);
  }, []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      selectNode(node as Parameters<typeof selectNode>[0]);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);

  // Double-click on canvas to add a standalone node
  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setPendingConnection({
        sourceNodeId: "", // Empty = standalone node (no connection)
        sourceHandleId: null,
        position,
      });
      setIsModalOpen(true);
    },
    [screenToFlowPosition]
  );

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);

  return (
    <div ref={reactFlowWrapper} className={className} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onDoubleClick={onDoubleClick}
        onMoveEnd={handleMoveEnd}
        nodeTypes={memoizedNodeTypes}
        edgeTypes={memoizedEdgeTypes}
        fitView
        fitViewOptions={{ padding: 0.5 }}
        snapToGrid
        snapGrid={[20, 20]}
        nodeOrigin={[0.5, 0]}
        defaultEdgeOptions={{
          type: "custom",
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        className="bg-[#101010]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={32}
          size={2}
          color="rgba(0, 0, 255, 0.1)"
        />
        <Controls
          showInteractive={false}
          className="!bg-zinc-900/80 !backdrop-blur-md !border-white/5 !rounded-xl !shadow-2xl !p-1"
        />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-zinc-900/80 !backdrop-blur-md !border-white/5 !rounded-xl !shadow-2xl"
          maskColor="rgba(0, 212, 255, 0.05)"
          nodeColor="#27272a"
        />
      </ReactFlow>

      {/* Node Type Selection Modal - appears when dragging to empty space */}
      <NodeTypeModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSelect={handleNodeTypeSelect}
        intent={pendingConnection?.sourceNodeId ? "connect" : "add"}
      />
    </div>
  );
}

function getDefaultNodeData(type: string): Record<string, unknown> {
  const nodeDef = NODE_DEFINITIONS[type as AINodeType];
  
  if (!nodeDef) {
    return { label: "Unknown Node" };
  }

  const baseData = {
    label: nodeDef.label,
    description: nodeDef.description,
    provider: nodeDef.provider,
    estimatedCost: nodeDef.estimatedCost,
  };

  // Node-specific defaults
  switch (type) {
    case "seedream":
      return {
        ...baseData,
        prompt: "",
        negativePrompt: "",
        aspectRatio: "1:1",
        numInferenceSteps: 30,
        guidanceScale: 5,
        truncatePrompt: false,
        promptEnhancer: false,
        syncMode: false,
        result: "",
      };
    case "seedvr":
      return {
        ...baseData,
        scale: "2x",
        enhanceFaces: false,
      };
    case "seedance":
      return {
        ...baseData,
        prompt: "",
        duration: "4s",
        aspectRatio: "16:9",
        result: "",
      };
    case "elevenlabs":
      return {
        ...baseData,
        voiceId: "",
        voiceName: "",
        stability: 0.5,
        clarity: 0.75,
      };
    case "openrouter":
      return {
        ...baseData,
        prompt: "",
        context: "",
        model: "openai/gpt-4o-mini",
        systemPrompt: "",
        temperature: 0.7,
        maxTokens: 4096,
        result: "",
      };
    case "lipsync":
      return {
        ...baseData,
        model: "sync-1.5",
      };
    case "crop-image":
      return {
        ...baseData,
        xPercent: 0,
        yPercent: 0,
        widthPercent: 100,
        heightPercent: 100,
      };
    case "merge-audio-video":
      return {
        ...baseData,
        replaceAudio: true,
      };
    case "merge-videos":
      return {
        ...baseData,
        transition: "none",
        transitionDuration: 0.5,
      };
    case "extract-audio":
      return {
        ...baseData,
        format: "mp3",
        bitrate: "192k",
        sampleRate: "44100",
        channels: "2",
        normalize: false,
      };
    default:
      return baseData;
  }
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
