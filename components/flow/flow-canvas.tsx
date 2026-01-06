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
import { NODE_DEFINITIONS, type AINodeType, type DataType } from "@/types/nodes";
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

// Custom edge component that changes color based on connection type
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
  const isNegative = data?.isNegative === true;
  
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <g>
      {/* Glow effect */}
      <path
        id={`${id}-glow`}
        d={edgePath}
        fill="none"
        stroke={isNegative ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)"}
        strokeWidth={8}
        filter="blur(4px)"
      />
      {/* Main edge */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={isNegative ? "#ef4444" : "#3b82f6"}
        strokeWidth={2}
        markerEnd={markerEnd}
        className="transition-all duration-200"
      />
      {/* Animated dash for active connections */}
      <path
        d={edgePath}
        fill="none"
        stroke={isNegative ? "#fca5a5" : "#93c5fd"}
        strokeWidth={2}
        strokeDasharray="5 5"
        className="animate-dash"
        style={{
          animation: "dash 1s linear infinite",
        }}
      />
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
  "text-input": { inputs: {}, outputs: { text: "text" } },
  "image-input": { inputs: {}, outputs: { image: "image" } },
  seedream: { inputs: { prompt: "text", image: "image" }, outputs: { image: "image" } },
  seedvr: { inputs: { image: "image" }, outputs: { upscaled: "image" } },
  seedance: { inputs: { prompt: "text", frame: "image" }, outputs: { video: "video" } },
  elevenlabs: { inputs: { text: "text" }, outputs: { audio: "audio" } },
  openrouter: { inputs: { context: "text" }, outputs: { response: "text" } },
  lipsync: { inputs: { video: "video", audio: "audio" }, outputs: { synced: "video" } },
  "crop-image": { inputs: { image: "image" }, outputs: { cropped: "image" } },
  "merge-audio-video": { inputs: { video: "video", audio: "audio" }, outputs: { combined: "video" } },
  "merge-videos": { inputs: { video1: "video", video2: "video" }, outputs: { merged: "video" } },
  "extract-audio": { inputs: { video: "video" }, outputs: { audio: "audio" } },
};

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
  if (from === "any" || to === "any") return true;
  // "negative" handles can accept "text" connections
  if (to === "negative" && from === "text") return true;
  return from === to;
}

function FlowCanvasInner({ className, storageKey }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow();
  
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
  } = useFlowStore();

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

      const fromType = getHandleDataType(sourceNode, "outputs", conn.sourceHandle);
      const toType = getHandleDataType(targetNode, "inputs", conn.targetHandle);

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
      const edgeDataType = getHandleDataType(sourceNode, "outputs", params.sourceHandle) ?? "any";
      const targetHandleType = getHandleDataType(targetNode, "inputs", params.targetHandle);
      
      // Check if connecting to a negative prompt handle
      const isNegative = targetHandleType === "negative" || params.targetHandle === "negativePrompt" || params.targetHandle === "negative";

      const nextEdges = addEdge(
        {
          ...params,
          type: "custom",
          animated: false,
          data: { dataType: edgeDataType, isNegative },
        },
        edges
      );
      setEdges(nextEdges);
      // Mark as successful connect so onConnectEnd doesn't open the modal.
      connectionCompletedRef.current = true;

      // When users connect nodes, treat it like "pass output -> input" by copying a preview into target context.
      if (params.source && params.target) {
        const sourceNode = nodes.find((n) => n.id === params.source);
        const preview = sourceNode ? getNodeOutputPreview(sourceNode) : undefined;

        if (preview) {
          setNodes(
            nodes.map((n) =>
              n.id === params.target
                ? {
                    ...n,
                    data: {
                      ...(n.data as any),
                      context: preview,
                      incomingFrom: { nodeId: params.source, handleId: params.sourceHandle ?? null },
                    },
                  }
                : n
            )
          );
        }
      }
    },
    [edges, isValidConnection, nodes, setEdges, setNodes]
  );

  // Track the source node/handle reliably (React Flow's onConnectEnd state can be inconsistent).
  const onConnectStart: OnConnectStart = useCallback((_event, params) => {
    connectingFromRef.current = {
      nodeId: params.nodeId,
      handleId: params.handleId ?? null,
    };
  }, []);

  // Handle when a connection is dropped on empty canvas - opens modal to add new node
  const onConnectEnd: OnConnectEnd = useCallback(
    (event, _connectionState) => {
      // If a valid connection just happened, never open the modal.
      if (connectionCompletedRef.current) {
        connectionCompletedRef.current = false;
        connectingFromRef.current = null;
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
    },
    [screenToFlowPosition]
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
          data: { dataType: edgeDataType, isNegative },
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

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node as Parameters<typeof selectNode>[0]);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

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
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
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
        className="bg-zinc-950"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#3f3f46"
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
    case "text-input":
      return {
        ...baseData,
        text: "",
      };
    case "image-input":
      return {
        ...baseData,
        image: "",
      };
    case "seedream":
      return {
        ...baseData,
        prompt: "",
        negativePrompt: "",
        aspectRatio: "1:1",
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
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
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
