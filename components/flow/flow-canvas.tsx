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
  ConnectionLineComponentProps,
  getStraightPath,
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

// Data type colors for edges - organized by category
// MEDIA TYPES: Bold colors for main data flowing between nodes
// SETTINGS TYPES: Distinct colors for parameters shared across nodes
const edgeColors: Record<string, { stroke: string; glow: string; dash: string }> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA TYPES - Primary data flow
  // ═══════════════════════════════════════════════════════════════════════════
  text: { stroke: "#3b82f6", glow: "#3b82f6", dash: "#60a5fa" },           // Blue
  image: { stroke: "#10b981", glow: "#10b981", dash: "#34d399" },          // Emerald
  video: { stroke: "#8b5cf6", glow: "#8b5cf6", dash: "#a78bfa" },          // Violet
  audio: { stroke: "#f59e0b", glow: "#f59e0b", dash: "#fbbf24" },          // Amber
  any: { stroke: "#a1a1aa", glow: "#a1a1aa", dash: "#d4d4d8" },            // Zinc
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS TYPES - Parameters & configuration
  // ═══════════════════════════════════════════════════════════════════════════
  prompt: { stroke: "#0ea5e9", glow: "#0ea5e9", dash: "#38bdf8" },         // Sky - instruction text
  negative: { stroke: "#ef4444", glow: "#ef4444", dash: "#f87171" },       // Red - exclusion
  seed: { stroke: "#84cc16", glow: "#84cc16", dash: "#a3e635" },           // Lime - reproducibility
  aspectRatio: { stroke: "#6366f1", glow: "#6366f1", dash: "#818cf8" },    // Indigo - dimensions
  duration: { stroke: "#14b8a6", glow: "#14b8a6", dash: "#2dd4bf" },       // Teal - time
  model: { stroke: "#f43f5e", glow: "#f43f5e", dash: "#fb7185" },          // Rose - AI model
  temperature: { stroke: "#f97316", glow: "#f97316", dash: "#fb923c" },    // Orange - randomness
  number: { stroke: "#ec4899", glow: "#ec4899", dash: "#f472b6" },         // Pink - generic number
  boolean: { stroke: "#06b6d4", glow: "#06b6d4", dash: "#22d3ee" },        // Cyan - on/off
};

// Custom edge component that changes color based on connection type with delete button
// Features: Type-based coloring, flowing dots animation when running, "break" style delete button
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
  const isSettingsConnection = data?.isSettingsConnection === true || data?.fromSettingsPopover === true;
  const [isHovered, setIsHovered] = useState(false);
  const isWorkflowRunning = useFlowStore((s) => s.isWorkflowRunning);
  const [animationPhase, setAnimationPhase] = useState(0);
  
  // Get colors based on data type - uses the unified color palette
  // Settings connections use a special violet/purple color scheme
  const typeColors = isSettingsConnection 
    ? { stroke: "#a855f7", glow: "rgba(168, 85, 247, 0.5)" } // violet for settings
    : edgeColors[dataType] || edgeColors.any;
  
  // Animate phase for flowing dots when workflow is running
  useEffect(() => {
    if (!isWorkflowRunning) {
      setAnimationPhase(0);
      return;
    }
    
    const interval = setInterval(() => {
      setAnimationPhase((prev) => (prev + 2) % 100);
    }, 30); // Smooth animation
    
    return () => clearInterval(interval);
  }, [isWorkflowRunning]);
  
  // Use bezier path for smooth flowing curves (matching connection line style)
  const [edgePath, labelX, labelY] = getBezierPath({
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

  // Early return AFTER all hooks
  if (shouldHideAdvanced) return null;

  // Unique IDs for this edge's mask
  const maskId = `edge-mask-${id}`;
  const breakRadius = 14; // Size of the "break" in the line

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ overflow: "visible" }}
    >
      {/* Definitions for masks */}
      <defs>
        {/* Mask to create a "break" in the edge when hovered */}
        <mask id={maskId}>
          <rect x="-10000" y="-10000" width="20000" height="20000" fill="white" />
          {isHovered && !isWorkflowRunning && (
            <circle cx={labelX} cy={labelY} r={breakRadius} fill="black" />
          )}
        </mask>
      </defs>

      {/* Invisible wider path for easier hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        style={{ cursor: "pointer" }}
      />
      
      {/* Edge with break effect - all layers use the mask when hovered */}
      <g mask={isHovered && !isWorkflowRunning ? `url(#${maskId})` : undefined}>
        {/* Outer soft glow */}
        <path
          d={edgePath}
          fill="none"
          stroke={typeColors.stroke}
          strokeWidth={isWorkflowRunning ? 20 : 16}
          strokeLinecap="round"
          opacity={isWorkflowRunning ? 0.15 : 0.08}
          style={{ filter: "blur(8px)" }}
        />
        
        {/* Middle glow layer */}
        <path
          d={edgePath}
          fill="none"
          stroke={typeColors.stroke}
          strokeWidth={isWorkflowRunning ? 10 : 8}
          strokeLinecap="round"
          opacity={isWorkflowRunning ? 0.25 : 0.15}
          style={{ filter: "blur(4px)" }}
        />
        
        {/* Main colored line */}
        <path
          id={id}
          d={edgePath}
          fill="none"
          stroke={typeColors.stroke}
          strokeWidth={isSettingsConnection ? 2 : 3}
          strokeLinecap="round"
          strokeDasharray={isSettingsConnection ? "6 4" : undefined}
          markerEnd={markerEnd}
          style={{
            filter: `drop-shadow(0 0 4px ${typeColors.stroke})`,
          }}
        />
        
        {/* Settings connection indicator - small dots along the path */}
        {isSettingsConnection && !isWorkflowRunning && (
          <path
            d={edgePath}
            fill="none"
            stroke="white"
            strokeWidth={1}
            strokeLinecap="round"
            strokeDasharray="2 10"
            opacity={0.4}
          />
        )}
      </g>
      
      {/* Animated flowing dash when running */}
      {isWorkflowRunning && (
        <path
          d={edgePath}
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="8 16"
          opacity={0.6}
          style={{
            animation: "connectionFlow 0.8s linear infinite",
          }}
        />
      )}
      
      {/* Delete button in the "break" - styled like a cut wire */}
      {isHovered && !isWorkflowRunning && (
        <g>
          {/* Outer ring - shows the break boundary */}
          <circle
            cx={labelX}
            cy={labelY}
            r={breakRadius}
            fill="#1a1a1a"
            stroke={typeColors.stroke}
            strokeWidth={2}
            strokeDasharray="4 3"
            style={{ cursor: "pointer" }}
          />
          
          {/* Inner delete button */}
          <foreignObject
            x={labelX - 12}
            y={labelY - 12}
            width={24}
            height={24}
            style={{ overflow: "visible" }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  useFlowStore.getState().onEdgesChange([{ type: "remove", id }]);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "transform 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
                title="Delete connection"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M3 3L11 11M11 3L3 11"
                    stroke={typeColors.stroke}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  );
}

const edgeTypes = {
  custom: CustomEdge,
};

// Custom connection line with smooth flowing curve
function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  connectionLineStyle,
}: ConnectionLineComponentProps) {
  // Get the connecting handle type from the store
  const connectingFrom = useFlowStore((s) => s.connectingFrom);
  const handleType = connectingFrom?.handleType || "any";
  const typeColors = edgeColors[handleType] || edgeColors.any;
  
  // Create a smooth bezier curve path
  const dx = toX - fromX;
  const dy = toY - fromY;
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 150);
  
  // Bezier control points for a smooth S-curve
  const path = `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;

  return (
    <g className="react-flow__connection">
      {/* Outer soft glow */}
      <path
        d={path}
        fill="none"
        stroke={typeColors.stroke}
        strokeWidth={20}
        strokeLinecap="round"
        opacity={0.1}
        style={{ filter: "blur(8px)" }}
      />
      
      {/* Middle glow layer */}
      <path
        d={path}
        fill="none"
        stroke={typeColors.stroke}
        strokeWidth={10}
        strokeLinecap="round"
        opacity={0.2}
        style={{ filter: "blur(4px)" }}
      />
      
      {/* Main colored line */}
      <path
        d={path}
        fill="none"
        stroke={typeColors.stroke}
        strokeWidth={3}
        strokeLinecap="round"
        style={{
          filter: `drop-shadow(0 0 4px ${typeColors.stroke})`,
        }}
      />
      
      {/* Animated flowing dash on top */}
      <path
        d={path}
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="8 16"
        opacity={0.6}
        style={{
          animation: "connectionFlow 0.8s linear infinite",
        }}
      />
    </g>
  );
}

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

// Handle type definitions - using specific setting types for consistent colors
const HANDLE_TYPES: Record<AINodeType, { inputs: Record<string, DataType>; outputs: Record<string, DataType> }> = {
  seedream: {
    inputs: {
      prompt: "prompt",
      numInferenceSteps: "number",
      seed: "seed",
      aspectRatio: "aspectRatio",
      negativePrompt: "negative",
      guidanceScale: "number",
      truncatePrompt: "boolean",
      promptEnhancer: "boolean",
      syncMode: "boolean",
      image: "image",
    },
    outputs: {
      image: "image",
    },
  },
  seedvr: { 
    inputs: { inputImage: "image", scale: "number", enhanceFaces: "boolean" }, 
    outputs: { upscaled: "image" } 
  },
  seedance: {
    inputs: { prompt: "prompt", inputFrame: "image", duration: "duration", aspectRatio: "aspectRatio", seed: "seed" },
    outputs: { video: "video" },
  },
  elevenlabs: { 
    inputs: { text: "prompt", voiceId: "model", stability: "number", clarity: "number" }, 
    outputs: { audio: "audio" } 
  },
  openrouter: {
    inputs: {
      prompt: "prompt",
      context: "text",
      inputImage: "image",
      systemPrompt: "prompt",
      model: "model",
      temperature: "temperature",
      maxTokens: "number",
      negativePrompt: "negative",
    },
    outputs: { response: "text", out: "any" },
  },
  lipsync: { 
    inputs: { inputVideo: "video", inputAudio: "audio", model: "model" }, 
    outputs: { synced: "video" } 
  },
  "crop-image": { 
    inputs: { inputImage: "image", xPercent: "number", yPercent: "number", widthPercent: "number", heightPercent: "number" }, 
    outputs: { cropped: "image" } 
  },
  "merge-audio-video": { 
    inputs: { inputVideo: "video", inputAudio: "audio", replaceAudio: "boolean" }, 
    outputs: { combined: "video" } 
  },
  "merge-videos": { 
    inputs: { inputVideo1: "video", inputVideo2: "video", transition: "text", transitionDuration: "duration" }, 
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

// Type compatibility matrix for settings connections
// Groups of types that can connect to each other
const TYPE_COMPATIBILITY_GROUPS: Record<string, string[]> = {
  // Number types can connect to each other (including temperature)
  number: ["number", "seed", "duration", "temperature"],
  seed: ["number", "seed", "duration", "temperature"],
  duration: ["number", "seed", "duration", "temperature"],

  // Text types can connect to each other
  text: ["text", "prompt", "negative"],
  prompt: ["text", "prompt", "negative"],
  negative: ["text", "prompt", "negative"],

  // Boolean types
  boolean: ["boolean"],

  // Aspect ratio is specific
  aspectRatio: ["aspectRatio"],
  
  // Media types
  image: ["image"],
  video: ["video"],
  audio: ["audio"],
  
  // Model types
  model: ["model"],
  
  // Temperature - compatible with all number types
  temperature: ["temperature", "number", "seed", "duration"],
};

function isTypeCompatible(from: DataType | undefined, to: DataType | undefined): boolean {
  if (!from || !to) return false;
  if (from === to) return true;
  if (to === "any") return true;
  if (from === "any") return true;
  
  // Check compatibility groups
  const compatibleTypes = TYPE_COMPATIBILITY_GROUPS[from];
  if (compatibleTypes && compatibleTypes.includes(to)) {
    return true;
  }
  
  return false;
}

// =============================================================================
// PIPELINE HIGHLIGHT OVERLAY
// =============================================================================
// Renders a dotted container around highlighted pipeline nodes
// Uses a custom node-like approach that moves with the canvas

interface PipelineHighlightOverlayProps {
  nodes: Node[];
  highlightedNodeIds: string[];
}

function PipelineHighlightOverlay({ nodes, highlightedNodeIds }: PipelineHighlightOverlayProps) {
  const { getViewport } = useReactFlow();
  const [viewport, setViewport] = useState(getViewport());
  const animationRef = useRef<number | null>(null);
  
  // Calculate bounds from highlighted nodes
  const bounds = useMemo(() => {
    if (highlightedNodeIds.length < 1) return null;
    
    const highlightedNodes = nodes.filter((n) => highlightedNodeIds.includes(n.id));
    if (highlightedNodes.length === 0) return null;
    
    // Node dimensions - use larger values to ensure full coverage
    // Nodes can be quite tall when expanded with all settings visible
    const nodeWidth = 320;   // Nodes are ~280-300px wide + some margin
    const nodeHeight = 750;  // Nodes can be very tall when expanded
    const padding = 80;      // Extra padding around the container
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const node of highlightedNodes) {
      // Node position is at center-top (nodeOrigin: [0.5, 0])
      // So we need to offset by half the width to get left edge
      const nodeLeft = node.position.x - nodeWidth / 2;
      const nodeRight = node.position.x + nodeWidth / 2;
      const nodeTop = node.position.y;
      const nodeBottom = node.position.y + nodeHeight;
      
      minX = Math.min(minX, nodeLeft);
      maxX = Math.max(maxX, nodeRight);
      minY = Math.min(minY, nodeTop);
      maxY = Math.max(maxY, nodeBottom);
    }
    
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, [highlightedNodeIds, nodes]);
  
  // Update viewport on animation frame for smooth tracking during pan/zoom
  useEffect(() => {
    if (!bounds) return;
    
    const updateViewport = () => {
      setViewport(getViewport());
      animationRef.current = requestAnimationFrame(updateViewport);
    };
    
    animationRef.current = requestAnimationFrame(updateViewport);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [bounds, getViewport]);
  
  if (!bounds || highlightedNodeIds.length < 1) return null;
  
  // Transform bounds to screen coordinates
  const screenX = bounds.x * viewport.zoom + viewport.x;
  const screenY = bounds.y * viewport.zoom + viewport.y;
  const screenWidth = bounds.width * viewport.zoom;
  const screenHeight = bounds.height * viewport.zoom;
  
  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="pipelineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Dotted border container */}
        <rect
          x={screenX}
          y={screenY}
          width={screenWidth}
          height={screenHeight}
          fill="rgba(59, 130, 246, 0.02)"
          stroke="url(#pipelineGradient)"
          strokeWidth="2"
          strokeDasharray="10 6"
          rx="16"
          ry="16"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.4))',
          }}
        />
        {/* Label */}
        <g transform={`translate(${screenX + 12}, ${screenY - 8})`}>
          <rect
            x="0"
            y="-14"
            width="110"
            height="22"
            rx="6"
            fill="rgba(0, 0, 0, 0.9)"
            stroke="rgba(139, 92, 246, 0.6)"
            strokeWidth="1"
          />
          <text
            x="10"
            y="1"
            fill="#60a5fa"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
          >
            PIPELINE
          </text>
          <text
            x="75"
            y="1"
            fill="#71717a"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
          >
            · {highlightedNodeIds.length}
          </text>
        </g>
      </svg>
    </div>
  );
}

function FlowCanvasInner({ className, storageKey }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getViewport, setViewport, setCenter, fitBounds } = useReactFlow();
  
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
    setConnectingFrom,
    highlightedNodeIds,
    clearHighlight,
  } = useFlowStore();

  // Focus on node when focusNodeId changes - pan so the NODE is at screen center
  // This is used for single node focus (clicking on a node in Activity panel)
  useEffect(() => {
    // Skip if we have multiple highlighted nodes - let the fitBounds effect handle it
    if (!focusNodeId || highlightedNodeIds.length > 1) return;
    
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
  }, [focusNodeId, nodes, setCenter, focusNode, highlightedNodeIds.length]);

  // Fit view to all highlighted nodes when highlighting a pipeline
  // This provides a better overview of the entire pipeline
  useEffect(() => {
    if (highlightedNodeIds.length < 2) return;

    // Find all highlighted nodes
    const highlightedNodes = nodes.filter((n) => highlightedNodeIds.includes(n.id));
    if (highlightedNodes.length === 0) return;

    // Calculate bounds of all highlighted nodes
    // Use same dimensions as PipelineHighlightOverlay for consistency
    const nodeWidth = 320;   // Nodes are ~280-300px wide + some margin
    const nodeHeight = 750;  // Nodes can be very tall when expanded
    const padding = 120;     // Padding around the bounds

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const node of highlightedNodes) {
      // Node position is at center-top (nodeOrigin: [0.5, 0])
      const nodeLeft = node.position.x - nodeWidth / 2;
      const nodeRight = node.position.x + nodeWidth / 2;
      const nodeTop = node.position.y;
      const nodeBottom = node.position.y + nodeHeight;
      
      minX = Math.min(minX, nodeLeft);
      maxX = Math.max(maxX, nodeRight);
      minY = Math.min(minY, nodeTop);
      maxY = Math.max(maxY, nodeBottom);
    }
    
    // Fit the view to show all highlighted nodes
    fitBounds(
      {
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
      },
      { duration: 600, padding: 0.1 }
    );
    
    // Clear the focusNodeId but keep highlighting
    setTimeout(() => focusNode(null), 650);
  }, [highlightedNodeIds, nodes, fitBounds, focusNode]);

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

  // Keyboard shortcuts: Delete/Backspace to delete, Ctrl/Cmd+D to duplicate, Escape to cancel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable === true;

      // Escape key: cancel connections and close modals
      if (e.key === "Escape") {
        e.preventDefault();
        // Clear connecting state
        connectingFromRef.current = null;
        setConnectingFrom(null);
        // Close modal if open
        if (isModalOpen) {
          setIsModalOpen(false);
          setPendingConnection(null);
        }
        // Deselect node
        selectNode(null);
        return;
      }

      if (isTyping) return;
      if (!selectedNode) return;

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
  }, [deleteNode, duplicateNode, selectNode, selectedNode, setConnectingFrom, isModalOpen]);

  const isValidConnection = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return false;

      const sourceNode = nodes.find((n) => n.id === conn.source);
      const targetNode = nodes.find((n) => n.id === conn.target);
      const sourceNodeType = sourceNode?.type as AINodeType | undefined;
      const targetNodeType = targetNode?.type as AINodeType | undefined;

      // Check if source handle is a radial settings handle (ends with -setting)
      const sourceHandle = conn.sourceHandle ?? "";
      const isFromRadialSettings = sourceHandle.endsWith("-setting");
      const actualSourceHandle = isFromRadialSettings 
        ? sourceHandle.replace("-setting", "") 
        : sourceHandle;
      
      const targetHandle = conn.targetHandle ?? "";
      
      // Check if target is a settings input
      const isTargetSettings = targetNodeType ? isSettingsHandle(targetNodeType, targetHandle) : false;
      
      // If dragging FROM a radial settings handle
      if (isFromRadialSettings && sourceNodeType) {
        const sourceContract = NODE_CONTRACTS[sourceNodeType];
        const sourceSetting = sourceContract?.settings.find((s: { id: string; type: string }) => s.id === actualSourceHandle);
        
        if (sourceSetting) {
          const sourceSettingType = sourceSetting.type as DataType;
          const toType = getHandleDataType(targetNode, "inputs", targetHandle);
          
          // Check type compatibility between source setting and target input
          if (!isTypeCompatible(sourceSettingType, toType)) return false;
          if (wouldCreateCycle(edges, conn.source, conn.target)) return false;
          return true;
        }
        return false;
      }
      
      // If connecting to a settings input from a regular output or another setting
      if (isTargetSettings && targetNodeType) {
        const targetContract = NODE_CONTRACTS[targetNodeType];
        const targetSetting = targetContract?.settings.find((s: { id: string; type: string }) => s.id === targetHandle);
        
        if (targetSetting) {
          const targetSettingType = targetSetting.type as DataType;
          
          // Check if source has a compatible setting to connect from
          if (sourceNodeType) {
            const sourceContract = NODE_CONTRACTS[sourceNodeType];
            // Look for ANY setting from source that has a compatible type
            const compatibleSourceSetting = sourceContract?.settings.find((s: { id: string; type: string }) => 
              isTypeCompatible(s.type as DataType, targetSettingType)
            );
            
            // Also check if the source output type is compatible
            const sourceOutputType = getHandleDataType(sourceNode, "outputs", actualSourceHandle);
            const isOutputCompatible = isTypeCompatible(sourceOutputType, targetSettingType);
            
            if (compatibleSourceSetting || isOutputCompatible) {
              if (wouldCreateCycle(edges, conn.source, conn.target)) return false;
              return true;
            }
          }
        }
      }

      // For non-settings connections, check type compatibility
      const fromType = getHandleDataType(sourceNode, "outputs", actualSourceHandle);
      const toType = getHandleDataType(targetNode, "inputs", targetHandle);
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
      
      // Check if connection is from settings popover or settings bundle handle
      let actualSourceHandle = params.sourceHandle ?? "";
      let isFromSettingsPopover = false;
      let isFromOutputPopover = false;
      let settingId: string | null = null;
      
      if (actualSourceHandle.endsWith("-setting")) {
        // Connection from individual setting in popover
        actualSourceHandle = actualSourceHandle.replace("-setting", "");
        settingId = actualSourceHandle;
        isFromSettingsPopover = true;
      } else if (actualSourceHandle.endsWith("-output")) {
        // Connection from output popover (media output) - legacy
        actualSourceHandle = actualSourceHandle.replace("-output", "");
        isFromOutputPopover = true;
      } else if (actualSourceHandle.endsWith("-settings-bundle")) {
        // Connection from the settings bundle handle itself - don't allow direct connections
        // This handle is just for triggering the popover, not for direct connections
        console.log("Settings bundle handle - use popover to select a specific setting");
        return;
      }
      
      // For settings connections, keep the original handle ID so React Flow connects from the radial handle
      // For other connections, use the cleaned handle ID
      const edgeSourceHandle = isFromSettingsPopover ? params.sourceHandle : actualSourceHandle;
      const cleanedParams = {
        ...params,
        sourceHandle: edgeSourceHandle,
      };
      
      const edgeDataType = getHandleDataType(sourceNode, "outputs", actualSourceHandle) ?? "any";
      const targetHandleType = getHandleDataType(targetNode, "inputs", params.targetHandle);

      // Check if connecting to a negative prompt handle
      const isNegative = targetHandleType === "negative" || params.targetHandle === "negativePrompt" || params.targetHandle === "negative";
      
      // Use NODE_CONTRACTS to determine if target is a settings input or media input
      const targetHandle = params.targetHandle ?? "";
      const isTargetSettingsInput = targetNodeType ? isSettingsHandle(targetNodeType, targetHandle) : false;
      const isTargetMediaInput = targetNodeType ? isMediaHandle(targetNodeType, targetHandle) : false;
      
      // Settings connection: when connecting FROM a settings handle OR TO a settings input
      // This should copy the setting value AND lock it on the target node
      const isSettingsConnection = isFromSettingsPopover || isTargetSettingsInput;
      
      // Determine the edge data type for settings connections
      let finalEdgeDataType = edgeDataType;
      if (isFromSettingsPopover && sourceNodeType) {
        // Get the setting type from NODE_CONTRACTS
        const contract = NODE_CONTRACTS[sourceNodeType];
        const setting = contract?.settings.find(s => s.id === actualSourceHandle);
        if (setting) {
          finalEdgeDataType = setting.type as DataType;
        }
      }

      const nextEdges = addEdge(
        {
          ...cleanedParams,
          type: "custom",
          animated: false,
          data: {
            dataType: finalEdgeDataType,
            isNegative,
            targetHandle: params.targetHandle ?? null,
            targetNodeId: params.target ?? null,
            sourceNodeType,
            sourceHandle: actualSourceHandle,
            isSettingsConnection,
            isMediaConnection: isTargetMediaInput && !isFromSettingsPopover,
            // Track if this was from the popover
            fromSettingsPopover: isFromSettingsPopover,
            fromOutputPopover: isFromOutputPopover,
            // Store the setting ID for settings connections
            settingId: settingId || (isFromSettingsPopover ? actualSourceHandle : undefined),
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
          const targetSettingKey = params.targetHandle; // The setting on the target node
          const sourceSettingKey = actualSourceHandle; // The setting from the source node
          
          // Get the value from the SOURCE handle (not target handle name in source data)
          const sourceValue = sourceSettingKey && sourceData[sourceSettingKey] !== undefined 
            ? sourceData[sourceSettingKey] 
            : derivedValue; // Fall back to derived value
          
          if (targetSettingKey && sourceValue !== undefined) {
            // Get existing inherited settings or create new
            const existingInherited = (targetNode?.data as Record<string, unknown>)?._inheritedFrom as Record<string, unknown> | undefined;
            const existingSettings = (existingInherited?.settings as Record<string, unknown>) || {};
            
            // Add this setting to the inherited settings
            const newInheritedSettings = {
              ...existingSettings,
              [targetSettingKey]: sourceValue,
            };
            
            settingsInheritanceUpdate = {
              // Copy the setting value to the target's setting key
              [targetSettingKey]: sourceValue,
              // Update inheritance metadata
              _inheritedFrom: {
                sourceNodeId: sourceNode.id,
                sourceNodeType,
                sourceSettingKey, // Track which setting it came from
                settings: newInheritedSettings,
                fullInheritance: false,
              },
            };
            
            console.log(`[Settings Connection] ${sourceNodeType}.${sourceSettingKey} → ${targetNodeType}.${targetSettingKey} = ${sourceValue}`);
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
    // Clear any lingering connection state
    connectingFromRef.current = null;
    setConnectingFrom(null);
  }, [selectNode, setConnectingFrom]);

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
        connectionLineComponent={CustomConnectionLine}
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
      
      {/* Pipeline Highlight Overlay - Dotted container around highlighted nodes */}
      {/* Rendered outside ReactFlow to avoid blocking canvas interactions */}
      <PipelineHighlightOverlay nodes={nodes} highlightedNodeIds={highlightedNodeIds} />

      {/* Node Type Selection Modal - appears when dragging to empty space */}
      <NodeTypeModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSelect={handleNodeTypeSelect}
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
