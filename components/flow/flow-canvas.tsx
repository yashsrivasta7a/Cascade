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
import { NODE_DEFINITIONS, type AINodeType, type DataType, NODE_CONTRACTS, isSettingsHandle, isMediaHandle, TYPE_COMPATIBILITY_GROUPS, isTypeCompatible as isTypeCompatibleFn, getHandleDataType as getHandleDataTypeFn } from "@/types/nodes";
import { NodeTypeModal } from "./node-type-modal";
import { NodeContextMenu } from "./node-context-menu";
import { showInvalidConnection, showCycleDetected, showLLMParseError } from "@/lib/toast";
import { parseLLMToFieldValue, canFieldAcceptLLMInput } from "@/lib/workflow/llm-type-parser";

interface PendingConnection {
  sourceNodeId: string;
  sourceHandleId: string | null;
  position: { x: number; y: number };
}

interface FlowCanvasProps {
  className?: string;
  storageKey?: string;
  placingComment?: boolean;
  onPlaceComment?: (position: { x: number; y: number }) => void;
  onCancelPlacement?: () => void;
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
  // Check if this is a settings connection - by flags, settingId presence, or edge ID pattern
  // Edge IDs for settings connections include "-setting" in the source handle part
  const hasSettingInId = id.includes("-setting");
  const hasSettingId = Boolean(data?.settingId);
  const isSettingsConnection = data?.isSettingsConnection === true || 
                               data?.fromSettingsPopover === true ||
                               hasSettingId ||
                               hasSettingInId;
  const [isHovered, setIsHovered] = useState(false);
  const isWorkflowRunning = useFlowStore((s) => s.isWorkflowRunning);
  const [animationPhase, setAnimationPhase] = useState(0);

  // Get colors based on data type - uses the unified color palette
  // Settings connections use the color of the actual data type being passed
  const typeColors = edgeColors[dataType] || edgeColors.any;

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

  // DEBUG: Log edge info
  useEffect(() => {
    if (isSettingsConnection) {
      console.log(`[CustomEdge ${id}] Settings edge rendered:`, {
        sourceX, sourceY, targetX, targetY,
        edgePath: edgePath?.substring(0, 100),
        isSettingsConnection,
        dataType,
      });
    }
  }, [id, sourceX, sourceY, targetX, targetY, edgePath, isSettingsConnection, dataType]);


  // Hide "advanced setting" edges when the target node's advanced panel is collapsed
  // EXCEPTION: Settings connections (from radial handles) should ALWAYS be visible
  const targetHandle = (data as any)?.targetHandle as string | undefined;
  const targetNodeId = (data as any)?.targetNodeId as string | undefined;
  const shouldHideAdvanced = useFlowStore((s) => {
    // Never hide settings connections - they should always be visible
    if (isSettingsConnection) return false;
    
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


        {/* Main colored line */}
        <path
          id={id}
          d={edgePath}
          fill="none"
          stroke={typeColors.stroke}
          strokeWidth={isSettingsConnection ? 2.5 : 3}
          strokeLinecap="round"
          strokeDasharray={isSettingsConnection ? "8 4" : undefined}
          markerEnd={markerEnd}
          style={{
            // Removed drop-shadow glow
          }}
        />

        {/* Settings connection indicator - subtle highlight along the path */}
        {isSettingsConnection && !isWorkflowRunning && (
          <path
            d={edgePath}
            fill="none"
            stroke="white"
            strokeWidth={1}
            strokeLinecap="round"
            strokeDasharray="3 8"
            opacity={0.3}
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


      {/* Main colored line */}
      <path
        d={path}
        fill="none"
        stroke={typeColors.stroke}
        strokeWidth={3}
        strokeLinecap="round"
        style={{
          // Removed drop-shadow glow
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

// Get the actual media output from a node (image/video/audio URL)
// Maps output handle names to data fields where the actual output is stored
function getNodeMediaOutput(node: Node, handleId: string | null): string | undefined {
  const d = (node.data ?? {}) as any;
  
  // Direct field match first
  if (handleId && d[handleId] && typeof d[handleId] === "string") {
    return d[handleId];
  }
  
  // Map handle names to common data field names
  const handleToFieldMap: Record<string, string[]> = {
    // Image outputs
    "image": ["result", "image", "outputImage"],
    "upscaled": ["result", "upscaled", "outputImage"],
    "cropped": ["result", "cropped", "outputImage"],
    // Video outputs
    "video": ["result", "video", "outputVideo"],
    "synced": ["result", "synced", "outputVideo"],
    "combined": ["result", "combined", "outputVideo"],
    "merged": ["result", "merged", "outputVideo"],
    // Audio outputs
    "audio": ["result", "audio", "outputAudio"],
    // Text outputs
    "response": ["response", "result", "output"],
    "out": ["result", "response", "output"],
  };
  
  const fieldsToCheck = handleId ? (handleToFieldMap[handleId] || [handleId, "result"]) : ["result"];
  
  for (const field of fieldsToCheck) {
    if (d[field] && typeof d[field] === "string" && d[field].trim().length > 0) {
      return d[field];
    }
  }
  
  return undefined;
}

// NOTE: HANDLE_TYPES has been removed - now using NODE_CONTRACTS from types/nodes.ts
// All handle type definitions are derived from the config-driven node configurations

function getNodeSettingKeys(node: Node | undefined): string[] {
  if (!node?.type) return [];
  const nodeType = node.type as AINodeType;

  // Use NODE_CONTRACTS for accurate settings mapping (config-driven)
  const contract = NODE_CONTRACTS[nodeType];
  if (contract) {
    return contract.settings.map((s: { id: string }) => s.id);
  }

  return [];
}

function getHandleDataType(
  node: Node | undefined,
  direction: "inputs" | "outputs",
  handleId: string | null | undefined
): DataType | undefined {
  if (!node?.type) return undefined;
  // Use the centralized config-driven function
  return getHandleDataTypeFn(node.type as AINodeType, direction, handleId);
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

// Type compatibility - use centralized function from types/nodes.ts
function isTypeCompatible(from: DataType | undefined, to: DataType | undefined): boolean {
  return isTypeCompatibleFn(from, to);
}

// Connection validation result with reason
type ConnectionValidationResult = 
  | { valid: true }
  | { valid: false; reason: "type_mismatch" | "cycle" | "invalid_handle" | "missing_source_target"; details?: string };

// Validate connection and return the reason if invalid
function validateConnection(
  conn: Connection,
  nodes: Node[],
  edges: Edge[]
): ConnectionValidationResult {
  if (!conn.source || !conn.target) {
    return { valid: false, reason: "missing_source_target" };
  }

  const sourceNode = nodes.find((n) => n.id === conn.source);
  const targetNode = nodes.find((n) => n.id === conn.target);
  const sourceNodeType = sourceNode?.type as AINodeType | undefined;
  const targetNodeType = targetNode?.type as AINodeType | undefined;

  const sourceHandle = conn.sourceHandle ?? "";
  const isFromRadialSettings = sourceHandle.endsWith("-setting");
  const actualSourceHandle = isFromRadialSettings
    ? sourceHandle.replace("-setting", "")
    : sourceHandle;

  const targetHandle = conn.targetHandle ?? "";
  const isTargetSettings = targetNodeType ? isSettingsHandle(targetNodeType, targetHandle) : false;

  // Check cycle first (applies to all connection types)
  if (wouldCreateCycle(edges, conn.source, conn.target)) {
    return { valid: false, reason: "cycle" };
  }

  // If dragging FROM a radial settings handle
  if (isFromRadialSettings && sourceNodeType) {
    const sourceContract = NODE_CONTRACTS[sourceNodeType];
    const sourceSetting = sourceContract?.settings.find((s: { id: string; type: string }) => s.id === actualSourceHandle);

    if (sourceSetting) {
      const sourceSettingType = sourceSetting.type as DataType;
      const toType = getHandleDataType(targetNode, "inputs", targetHandle);

      if (!isTypeCompatible(sourceSettingType, toType)) {
        return { 
          valid: false, 
          reason: "type_mismatch", 
          details: `${sourceSettingType} → ${toType || "unknown"}` 
        };
      }
      return { valid: true };
    }
    return { valid: false, reason: "invalid_handle" };
  }

  // If connecting to a settings input
  if (isTargetSettings && targetNodeType) {
    const targetContract = NODE_CONTRACTS[targetNodeType];
    const targetSetting = targetContract?.settings.find((s: { id: string; type: string }) => s.id === targetHandle);

    if (targetSetting) {
      const targetSettingType = targetSetting.type as DataType;

      if (sourceNodeType) {
        const sourceContract = NODE_CONTRACTS[sourceNodeType];
        const compatibleSourceSetting = sourceContract?.settings.find((s: { id: string; type: string }) =>
          isTypeCompatible(s.type as DataType, targetSettingType)
        );

        const sourceOutputType = getHandleDataType(sourceNode, "outputs", actualSourceHandle);
        const isOutputCompatible = isTypeCompatible(sourceOutputType, targetSettingType);

        if (compatibleSourceSetting || isOutputCompatible) {
          return { valid: true };
        }
        return { 
          valid: false, 
          reason: "type_mismatch",
          details: `No compatible output for ${targetSettingType}`
        };
      }
    }
  }

  // For non-settings connections
  const fromType = getHandleDataType(sourceNode, "outputs", actualSourceHandle);
  const toType = getHandleDataType(targetNode, "inputs", targetHandle);
  
  if (!isTypeCompatible(fromType, toType)) {
    return { 
      valid: false, 
      reason: "type_mismatch",
      details: `${fromType || "unknown"} → ${toType || "unknown"}`
    };
  }

  return { valid: true };
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

function FlowCanvasInner({ className, storageKey, placingComment = false, onPlaceComment, onCancelPlacement }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getViewport, setViewport, setCenter, fitBounds } = useReactFlow();

  // Theme detection for background dots
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  useEffect(() => {
    const checkTheme = () => {
      const isLight = document.documentElement.classList.contains('light');
      setIsDarkMode(!isLight);
    };
    
    checkTheme();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Modal state for adding nodes
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const connectingFromRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const connectionCompletedRef = useRef(false);

  // Comment placement ghost preview
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);

  // Track mouse position for ghost preview when placing comment
  useEffect(() => {
    if (!placingComment) {
      setGhostPosition(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (reactFlowWrapper.current) {
        const rect = reactFlowWrapper.current.getBoundingClientRect();
        setGhostPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [placingComment]);

  // Handle escape to cancel placement mode
  useEffect(() => {
    if (!placingComment) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancelPlacement?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [placingComment, onCancelPlacement]);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    setEdges,
    selectNode,
    selectedNode,
    setContextMenuPosition,
    deleteNode,
    duplicateNode,
    viewport,
    setViewport: setViewportState,
    focusNodeId,
    focusNode,
    setConnectingFrom,
    highlightedNodeIds,
    clearHighlight,
    recordHistory,
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

  // Record history when starting to drag nodes (captures pre-move state for undo)
  const onNodeDragStart = useCallback(() => {
    recordHistory();
  }, [recordHistory]);

  // Get additional actions from store for keyboard shortcuts
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    copySelectedNodes,
    pasteNodes,
    selectAllNodes,
    deleteSelectedNodes,
    duplicateSelectedNodes,
    selectedNodeIds,
  } = useFlowStore();

  // Keyboard shortcuts - comprehensive list
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || el?.isContentEditable === true;
      const isMod = e.ctrlKey || e.metaKey;

      // ═══════════════════════════════════════════════════════════════════════════
      // GLOBAL SHORTCUTS (work even when typing)
      // ═══════════════════════════════════════════════════════════════════════════

      // Escape: Cancel connections, close modals, deselect all
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
        // Deselect all nodes
        selectNode(null);
        clearHighlight();
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // SHORTCUTS BLOCKED WHEN TYPING
      // ═══════════════════════════════════════════════════════════════════════════
      if (isTyping) {
        // Allow Ctrl+Z/Y even in inputs for native undo
        if (isMod && (e.key === "z" || e.key === "y")) {
          // Let native input undo work
          return;
        }
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // UNDO/REDO (Ctrl/Cmd + Z, Ctrl/Cmd + Shift + Z, Ctrl/Cmd + Y)
      // ═══════════════════════════════════════════════════════════════════════════
      if (isMod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo
          if (canRedo()) {
            redo();
            console.log("[Keyboard] Redo");
          }
        } else {
          // Undo
          if (canUndo()) {
            undo();
            console.log("[Keyboard] Undo");
          }
        }
        return;
      }

      if (isMod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        if (canRedo()) {
          redo();
          console.log("[Keyboard] Redo (Ctrl+Y)");
        }
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // COPY/PASTE/DUPLICATE (Ctrl/Cmd + C, V, D)
      // ═══════════════════════════════════════════════════════════════════════════
      if (isMod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelectedNodes();
        console.log("[Keyboard] Copy selected nodes");
        return;
      }

      if (isMod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        // Paste at center of viewport
        const vp = getViewport();
        const wrapper = reactFlowWrapper.current;
        if (wrapper) {
          const rect = wrapper.getBoundingClientRect();
          const centerX = (rect.width / 2 - vp.x) / vp.zoom;
          const centerY = (rect.height / 2 - vp.y) / vp.zoom;
          pasteNodes({ x: centerX, y: centerY });
        } else {
          pasteNodes();
        }
        console.log("[Keyboard] Paste nodes");
        return;
      }

      if (isMod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selectedNode || selectedNodeIds.length > 0) {
          duplicateSelectedNodes();
          console.log("[Keyboard] Duplicate selected nodes");
        }
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // SELECT ALL (Ctrl/Cmd + A)
      // ═══════════════════════════════════════════════════════════════════════════
      if (isMod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAllNodes();
        console.log("[Keyboard] Select all nodes");
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // DELETE (Delete, Backspace)
      // ═══════════════════════════════════════════════════════════════════════════
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedNode || selectedNodeIds.length > 0) {
          recordHistory(); // Save state before delete
          deleteSelectedNodes();
          console.log("[Keyboard] Delete selected nodes");
        }
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // ZOOM (Ctrl/Cmd + Plus/Minus/0)
      // ═══════════════════════════════════════════════════════════════════════════
      if (isMod && (e.key === "=" || e.key === "+" || e.key === "NumpadAdd")) {
        e.preventDefault();
        const vp = getViewport();
        const newZoom = Math.min(vp.zoom * 1.2, 2);
        setViewport({ ...vp, zoom: newZoom }, { duration: 200 });
        console.log("[Keyboard] Zoom in:", newZoom);
        return;
      }

      if (isMod && (e.key === "-" || e.key === "NumpadSubtract")) {
        e.preventDefault();
        const vp = getViewport();
        const newZoom = Math.max(vp.zoom / 1.2, 0.1);
        setViewport({ ...vp, zoom: newZoom }, { duration: 200 });
        console.log("[Keyboard] Zoom out:", newZoom);
        return;
      }

      if (isMod && e.key === "0") {
        e.preventDefault();
        // Fit view to show all nodes
        const allNodes = nodes;
        if (allNodes.length > 0) {
          const padding = 100;
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          
          for (const node of allNodes) {
            const nodeWidth = 300;
            const nodeHeight = 400;
            minX = Math.min(minX, node.position.x);
            maxX = Math.max(maxX, node.position.x + nodeWidth);
            minY = Math.min(minY, node.position.y);
            maxY = Math.max(maxY, node.position.y + nodeHeight);
          }
          
          fitBounds(
            { x: minX - padding, y: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 },
            { duration: 300 }
          );
        }
        console.log("[Keyboard] Zoom to fit");
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // SAVE (Ctrl/Cmd + S) - Prevent browser save dialog
      // ═══════════════════════════════════════════════════════════════════════════
      if (isMod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        // The workflow auto-saves, but we can trigger a manual save notification
        console.log("[Keyboard] Manual save triggered (auto-save is active)");
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // EXPORT (Ctrl/Cmd + E)
      // ═══════════════════════════════════════════════════════════════════════════
      if (isMod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        // Export workflow as JSON
        const exportData = {
          nodes: nodes.map(n => ({
            ...n,
            data: {
              ...(n.data as Record<string, unknown>),
              // Clear execution-specific data
              status: undefined,
              error: undefined,
              result: undefined,
            },
          })),
          edges,
          exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `flowsmith-workflow-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log("[Keyboard] Exported workflow");
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    deleteNode, 
    duplicateNode, 
    selectNode, 
    selectedNode, 
    selectedNodeIds,
    setConnectingFrom, 
    isModalOpen,
    undo,
    redo,
    canUndo,
    canRedo,
    copySelectedNodes,
    pasteNodes,
    selectAllNodes,
    deleteSelectedNodes,
    duplicateSelectedNodes,
    recordHistory,
    nodes,
    edges,
    getViewport,
    setViewport,
    fitBounds,
    clearHighlight,
  ]);

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

      // Record history before adding node
      recordHistory();

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
    [screenToFlowPosition, nodes, setNodes, recordHistory]
  );

  // Handle regular connections between existing nodes
  const onConnect = useCallback(
    (params: Connection) => {
      // Validate connection and show toast if invalid
      const validation = validateConnection(params, nodes, edges);
      if (!validation.valid) {
        if (validation.reason === "cycle") {
          showCycleDetected();
        } else if (validation.reason === "type_mismatch") {
          showInvalidConnection(
            validation.details 
              ? `Incompatible types: ${validation.details}`
              : "Incompatible data types"
          );
        } else if (validation.reason === "invalid_handle") {
          showInvalidConnection("Invalid connection handle");
        }
        return;
      }

      // Record history before making connection
      recordHistory();

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

        const srcData = (src?.data ?? {}) as any;
        
        // Check if this is a media connection (image/video/audio)
        const mediaHandles = ["image", "inputImage", "referenceImages", "upscaled", "cropped", "video", "inputVideo", "synced", "combined", "merged", "audio", "inputAudio", "frame", "inputFrame"];
        const isMediaConnection = mediaHandles.includes(targetHandle) || mediaHandles.includes(sourceHandle ?? "");
        
        // For media connections, use the dedicated function that maps handles to data fields
        // For other connections, use the preview function
        // Type is flexible because LLM parsing can produce numbers, booleans, strings
        let derivedValue: unknown;
        
        if (isMediaConnection && src) {
          // Get the actual media output (handles mapping like "image" -> "result")
          derivedValue = getNodeMediaOutput(src, sourceHandle);
          console.log(`[onConnect] Media connection: ${sourceHandle} -> ${targetHandle}, value=${typeof derivedValue === 'string' ? derivedValue.slice(0, 100) : derivedValue}...`);
        } else {
          // For text/settings connections
          const isLLMSourceNode = sourceNodeType === "openrouter";
          
          // For LLM nodes, ONLY use the actual response (result or text), never fall back to prompt
          if (isLLMSourceNode) {
            // Only get the actual LLM output - the "text" output or "result"
            const llmOutput = srcData.result ?? srcData.text ?? srcData.response;
            if (typeof llmOutput === "string" && llmOutput.trim().length > 0) {
              derivedValue = llmOutput;
              console.log(`[onConnect] LLM output: "${(derivedValue as string).slice(0, 50)}..."`);
            } else {
              // No LLM response yet - don't propagate anything
              console.log(`[onConnect] LLM has no response yet, not propagating`);
              derivedValue = undefined;
            }
          } else {
            // For non-LLM nodes, use original logic
            const preview = src ? getNodeOutputPreview(src) : undefined;
            const valueFromSourceHandle =
              sourceHandle && sourceHandle in srcData ? srcData[sourceHandle] : undefined;
            const nextValue = valueFromSourceHandle !== undefined ? valueFromSourceHandle : preview;
            
            // If we got a bundle object (e.g., Seedream `out`) and the targetHandle is a specific setting,
            // pull the matching value out of the bundle.
            derivedValue =
              nextValue &&
                typeof nextValue === "object" &&
                !Array.isArray(nextValue) &&
                targetHandle in (nextValue as any)
                ? (nextValue as any)[targetHandle]
                : nextValue;
          }
        }

        // --- LLM OUTPUT PARSING ---
        // If the source is an LLM and target can accept parsed input, parse the text value
        const isLLMSource = sourceNodeType === "openrouter";
        if (isLLMSource && targetNodeType && derivedValue && typeof derivedValue === "string") {
          // Check if the target field can accept LLM input
          if (canFieldAcceptLLMInput(targetNodeType, targetHandle)) {
            console.log(`[onConnect] Parsing LLM output for ${targetNodeType}.${targetHandle}: "${derivedValue.slice(0, 50)}..."`);
            const parseResult = parseLLMToFieldValue(derivedValue, targetNodeType, targetHandle);
            
            if (parseResult.success) {
              console.log(`[onConnect] Parse SUCCESS: ${JSON.stringify(parseResult.value)}`);
              derivedValue = parseResult.value;
            } else {
              // Parsing failed - show error and mark connection as failed
              console.error(`[onConnect] Parse FAILED: ${parseResult.error}`);
              const nodeName = (targetNode?.data as Record<string, unknown>)?.label as string || targetNodeType || params.target || "Unknown Node";
              showLLMParseError(nodeName, targetHandle, parseResult.error);
              // Don't propagate the invalid value - leave derivedValue undefined
              derivedValue = undefined;
            }
          }
        }

        // Build settings inheritance data if connecting to a settings input
        let settingsInheritanceUpdate: Record<string, unknown> = {};
        if (isSettingsConnection && sourceNode && sourceNodeType) {
          const sourceData = sourceNode.data as Record<string, unknown>;
          const targetSettingKey = params.targetHandle; // The setting on the target node
          const sourceSettingKey = actualSourceHandle; // The setting from the source node

          // Get the value from the SOURCE handle (not target handle name in source data)
          let sourceValue = sourceSettingKey && sourceData[sourceSettingKey] !== undefined
            ? sourceData[sourceSettingKey]
            : derivedValue; // Fall back to derived value

          // CRITICAL: Ensure numeric settings are actually numbers, not objects
          const numericSettings = new Set([
            "xPercent", "yPercent", "widthPercent", "heightPercent",
            "temperature", "maxTokens", "seed", "numInferenceSteps", "guidanceScale",
            "stability", "clarity", "transitionDuration",
            "topP", "topK", "frequencyPenalty", "presencePenalty",
          ]);
          
          if (targetSettingKey && numericSettings.has(targetSettingKey)) {
            if (typeof sourceValue === "number") {
              // Value is already a number, good
            } else if (typeof sourceValue === "string" && !isNaN(Number(sourceValue))) {
              sourceValue = Number(sourceValue);
            } else if (typeof sourceValue === "object" && sourceValue !== null) {
              // Object value for numeric setting - try to extract a number or use default
              console.warn(`[onConnect] Numeric setting ${targetSettingKey} received object, using 0:`, sourceValue);
              sourceValue = 0;
            }
          }

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
    [edges, isValidConnection, nodes, setEdges, setNodes, recordHistory]
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

      // Record history before creating node
      recordHistory();

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

        // Determine target handle based on node type (config-driven via NODE_CONTRACTS)
        const contract = NODE_CONTRACTS[nodeType];
        const targetHandle = contract?.mediaInputs[0]?.id ?? contract?.settings[0]?.id;
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
    [pendingConnection, nodes, edges, setNodes, setEdges, recordHistory]
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setPendingConnection(null);
  }, []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      selectNode(node as Parameters<typeof selectNode>[0]);
      setContextMenuPosition({ x: event.clientX, y: event.clientY });
    },
    [selectNode, setContextMenuPosition]
  );

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    // If in comment placement mode, place the comment at click position
    if (placingComment && onPlaceComment) {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onPlaceComment(position);
      return;
    }
    
    selectNode(null);
    setContextMenuPosition(null);
    // Clear any lingering connection state
    connectingFromRef.current = null;
    setConnectingFrom(null);
  }, [selectNode, setContextMenuPosition, setConnectingFrom, placingComment, onPlaceComment, screenToFlowPosition]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);


  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);

  return (
    <div 
      ref={reactFlowWrapper} 
      className={className} 
      style={{ 
        width: '100%', 
        height: '100%',
        cursor: placingComment ? 'crosshair' : undefined,
      }}
    >
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
        onMoveEnd={handleMoveEnd}
        onNodeDragStart={onNodeDragStart}
        nodeTypes={memoizedNodeTypes}
        edgeTypes={memoizedEdgeTypes}
        fitView
        fitViewOptions={{ padding: 0.5 }}
        snapToGrid={true}
        snapGrid={[30, 30]}
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
        style={{ background: isDarkMode ? '#101010' : '#F3F4F6' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={30}
          size={2}
          color={isDarkMode ? "#3f3f46" : "#9ca3af"}
        />
        <Controls
          showInteractive={false}
          className="!bg-white dark:!bg-zinc-900/80 !backdrop-blur-none dark:!backdrop-blur-md !border-gray-200 dark:!border-white/5 !rounded-xl !shadow-md dark:!shadow-2xl !p-1"
        />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-white dark:!bg-zinc-900/80 !backdrop-blur-none dark:!backdrop-blur-md !border-gray-200 dark:!border-white/5 !rounded-xl !shadow-md dark:!shadow-2xl"
          maskColor="rgba(59, 130, 246, 0.1)"
          nodeColor="#9CA3AF"
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

      {/* Right-click Context Menu for nodes */}
      <NodeContextMenu />

      {/* Ghost preview when placing comment */}
      {placingComment && ghostPosition && (
        <div
          className="pointer-events-none absolute z-50"
          style={{
            left: ghostPosition.x - 100, // Center the 200px width ghost
            top: ghostPosition.y - 50, // Center the 100px height ghost
          }}
        >
          <div className="w-[200px] h-[100px] rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 backdrop-blur-sm border border-amber-500/30 border-dashed opacity-70 shadow-lg shadow-amber-500/10">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent" />
            <div className="p-3 text-xs text-amber-400/60 italic">Click to place note...</div>
          </div>
        </div>
      )}

      {/* Placement mode cursor indicator */}
      {placingComment && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-500/20 backdrop-blur-xl border border-amber-500/30 rounded-full text-amber-400 text-xs font-medium z-50 animate-pulse">
          Click anywhere to place comment • Press ESC to cancel
        </div>
      )}
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
