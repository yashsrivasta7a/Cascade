"use client";

import { memo, ReactNode, type CSSProperties, useRef, useEffect, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Copy,
  Trash2,
  Play,
  Loader2,
  AlertCircle,
  Link2,
  CheckCircle2,
  Circle,
  Clock,
  Square,
  Settings2,
  ChevronRight,
  Type,
  Hash,
  Palette,
  Thermometer,
  Bot,
  Zap,
  X,
} from "lucide-react";
import { useFlowStore } from "@/store";
import { type DataType, dataTypeColors, type NodeStatus, type InheritedSettings, NODE_CONTRACTS, type AINodeType } from "@/types/nodes";

// Icons for different setting types
const settingIcons: Record<string, typeof Type> = {
  prompt: Type,
  negative: X,
  aspectRatio: Palette,
  seed: Hash,
  number: Hash,
  duration: Clock,
  model: Bot,
  temperature: Thermometer,
  boolean: Zap,
  text: Type,
};

export interface BaseNodeData {
  label: string;
  description?: string;
  icon?: ReactNode;
  status?: NodeStatus;
  provider?: string;
  estimatedCost?: number;
  actualCost?: number;
  progress?: number;
  /** Settings inherited from another node */
  _inheritedFrom?: InheritedSettings;
  [key: string]: unknown;
}

interface HandleConfig {
  id: string;
  type: DataType;
  label: string;
  position?: "top" | "center" | "bottom";
  required?: boolean;
  hidden?: boolean;
}

interface BaseNodeProps extends NodeProps<BaseNodeData> {
  color: "cyan" | "violet" | "emerald" | "amber" | "rose" | "blue" | "zinc";
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  inputs?: HandleConfig[];
  outputs?: HandleConfig[];
  isUtility?: boolean;
  layout?: "horizontal" | "vertical";
}

// Color mapping for accent bars
const accentColors: Record<string, string> = {
  cyan: "#06b6d4",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  blue: "#3b82f6",
  zinc: "#71717a",
};

// Status configuration with icons and colors
const statusConfig: Record<NodeStatus, { 
  icon: typeof Circle; 
  color: string; 
  bgColor: string;
  label: string;
  animate?: boolean 
}> = {
  idle: { 
    icon: Circle, 
    color: "text-zinc-500", 
    bgColor: "bg-zinc-500/10",
    label: "Ready" 
  },
  queued: { 
    icon: Clock, 
    color: "text-zinc-400", 
    bgColor: "bg-zinc-400/10",
    label: "Queued" 
  },
  running: { 
    icon: Loader2, 
    color: "text-white", 
    bgColor: "bg-white/10",
    label: "Running",
    animate: true 
  },
  completed: { 
    icon: CheckCircle2, 
    color: "text-emerald-400", 
    bgColor: "bg-emerald-500/10",
    label: "Done" 
  },
  failed: { 
    icon: AlertCircle, 
    color: "text-red-400", 
    bgColor: "bg-red-500/10",
    label: "Failed" 
  },
  cancelled: {
    icon: Square,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    label: "Cancelled"
  },
};

// Generate SVG path for node shape with semicircular notches
function generateNodePath(
  width: number,
  height: number,
  radius: number,
  leftNotches: number[], // Y positions as percentages (0-100)
  rightNotches: number[], // Y positions as percentages (0-100)
  notchRadius: number = 10
): string {
  const r = radius;
  const nr = notchRadius;
  
  // Convert percentage positions to actual Y values
  const leftYs = leftNotches.map(p => (p / 100) * height).sort((a, b) => a - b);
  const rightYs = rightNotches.map(p => (p / 100) * height).sort((a, b) => a - b);
  
  let path = "";
  
  // Start at top-left corner (after radius)
  path += `M ${r} 0`;
  
  // Top edge
  path += ` L ${width - r} 0`;
  
  // Top-right corner
  path += ` Q ${width} 0 ${width} ${r}`;
  
  // Right edge with notches
  let lastY = r;
  for (const y of rightYs) {
    if (y - nr > lastY) {
      path += ` L ${width} ${y - nr}`;
    }
    // Semicircular notch (curves inward)
    path += ` A ${nr} ${nr} 0 0 0 ${width} ${y + nr}`;
    lastY = y + nr;
  }
  path += ` L ${width} ${height - r}`;
  
  // Bottom-right corner
  path += ` Q ${width} ${height} ${width - r} ${height}`;
  
  // Bottom edge
  path += ` L ${r} ${height}`;
  
  // Bottom-left corner
  path += ` Q 0 ${height} 0 ${height - r}`;
  
  // Left edge with notches (going up, so reverse order)
  lastY = height - r;
  const leftYsReversed = [...leftYs].reverse();
  for (const y of leftYsReversed) {
    if (y + nr < lastY) {
      path += ` L 0 ${y + nr}`;
    }
    // Semicircular notch (curves inward)
    path += ` A ${nr} ${nr} 0 0 0 0 ${y - nr}`;
    lastY = y - nr;
  }
  path += ` L 0 ${r}`;
  
  // Top-left corner
  path += ` Q 0 0 ${r} 0`;
  
  path += " Z";
  
  return path;
}

function BaseNodeComponent({
  data,
  selected,
  color,
  left,
  right,
  children,
  inputs = [],
  outputs = [],
  isUtility = false,
  layout = "horizontal",
  id,
  type: nodeTypeFromProps,
}: BaseNodeProps) {
  const status = data.status || "idle";
  const selectedNodeId = useFlowStore((s) => s.selectedNode?.id ?? null);
  const isSelected = Boolean(selected || (selectedNodeId && selectedNodeId === id));
  const deleteNode = useFlowStore((s) => s.deleteNode);
  const duplicateNode = useFlowStore((s) => s.duplicateNode);
  const runNode = useFlowStore((s) => s.runNode);
  const cancelNode = useFlowStore((s) => s.cancelNode);
  const canRun = status !== "running" && status !== "queued";
  const isRunning = status === "running" || status === "queued";
  
  const connectingFrom = useFlowStore((s) => s.connectingFrom);
  const draggedType = connectingFrom?.handleType;
  const isDragging = Boolean(connectingFrom && connectingFrom.nodeId !== id);
  
  const inheritedFrom = data._inheritedFrom;
  const hasInheritedSettings = Boolean(inheritedFrom?.fullInheritance);
  const inheritedSettingsKeys = inheritedFrom?.settings ? Object.keys(inheritedFrom.settings) : [];

  const accentColor = accentColors[color] || accentColors.zinc;
  const statusCfg = statusConfig[status];
  const StatusIcon = statusCfg.icon;

  // Node dimensions for SVG border
  const nodeRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 320, height: 200 });
  
  // Radial settings expansion state
  const [settingsExpanded, setSettingsExpanded] = useState<string | null>(null);
  const [hoveredSetting, setHoveredSetting] = useState<string | null>(null);
  const settingsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const setConnectingFrom = useFlowStore((s) => s.setConnectingFrom);
  
  // Get node type from the props - nodeTypeFromProps is the React Flow node type
  // This is passed from the parent node component (e.g., SeedreamNode → BaseNode)
  const nodeType = nodeTypeFromProps || (data as any).nodeType || id?.split("-")[0] as AINodeType;
  const contract = nodeType ? NODE_CONTRACTS[nodeType as AINodeType] : undefined;
  const nodeSettings = contract?.settings || [];
  
  // Calculate radial positions for settings handles
  // Spreads N items across a semi-circle arc with good spacing
  const getRadialPosition = useCallback((index: number, total: number, baseRadius: number = 80) => {
    if (total === 1) {
      return { x: baseRadius, y: 0 };
    }
    
    // Adjust radius based on number of items to prevent overlap
    // More items = larger radius
    const radius = baseRadius + Math.max(0, (total - 5) * 8);
    
    // Spread angle based on number of items
    // More items = wider spread (up to 140 degrees)
    const maxSpread = Math.min(Math.PI * 0.78, Math.PI / 3 + (total * 0.08)); // -70° to +70° max
    const startAngle = -maxSpread;
    const endAngle = maxSpread;
    const angleStep = (endAngle - startAngle) / (total - 1);
    const angle = startAngle + (index * angleStep);

    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  }, []);
  

  useEffect(() => {
    if (nodeRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      resizeObserver.observe(nodeRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);
  
  // Track if mouse is inside settings area (anchor + radial handles)
  const isMouseInSettingsRef = useRef(false);
  
  // Handle expanding settings on hover
  const handleSettingsHover = useCallback((outputId: string) => {
    // Only expand if there are settings to show
    if (nodeSettings.length === 0) return;
    
    isMouseInSettingsRef.current = true;
    
    // Clear any pending timeout
    if (settingsTimeoutRef.current) {
      clearTimeout(settingsTimeoutRef.current);
      settingsTimeoutRef.current = null;
    }
    
    // Expand immediately if already expanded for another output, otherwise short delay
    if (settingsExpanded) {
      setSettingsExpanded(outputId);
    } else {
      settingsTimeoutRef.current = setTimeout(() => {
        if (isMouseInSettingsRef.current) {
          setSettingsExpanded(outputId);
        }
      }, 150);
    }
  }, [nodeSettings.length, settingsExpanded]);
  
  // Toggle settings on click
  const handleSettingsClick = useCallback((outputId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (settingsTimeoutRef.current) {
      clearTimeout(settingsTimeoutRef.current);
      settingsTimeoutRef.current = null;
    }
    setSettingsExpanded(prev => prev === outputId ? null : outputId);
  }, []);
  
  const collapseSettings = useCallback(() => {
    // Only collapse if mouse is not in the area
    if (isMouseInSettingsRef.current) return;
    setSettingsExpanded(null);
    setHoveredSetting(null);
  }, []);
  
  const handleSettingsLeave = useCallback(() => {
    isMouseInSettingsRef.current = false;
    
    // Clear timeout if leaving before it fires
    if (settingsTimeoutRef.current) {
      clearTimeout(settingsTimeoutRef.current);
      settingsTimeoutRef.current = null;
    }
    // Longer delay for user-friendliness
    settingsTimeoutRef.current = setTimeout(() => {
      collapseSettings();
    }, 400);
  }, [collapseSettings]);
  
  // Keep expanded when hovering on radial handles
  const handleRadialHandleEnter = useCallback(() => {
    isMouseInSettingsRef.current = true;
    if (settingsTimeoutRef.current) {
      clearTimeout(settingsTimeoutRef.current);
      settingsTimeoutRef.current = null;
    }
  }, []);
  
  // Handle starting a connection from a setting
  const handleSettingDragStart = useCallback((settingId: string, settingType: DataType) => {
    isMouseInSettingsRef.current = true; // Keep expanded while dragging
    setConnectingFrom({
      nodeId: id,
      handleId: settingId,
      handleType: settingType,
    });
  }, [id, setConnectingFrom]);

  // Calculate handle positions as percentages
  const getHandlePercent = (index: number, total: number): number => {
    if (total === 1) return 50;
    const padding = 20;
    const span = 100 - (padding * 2);
    const spacing = span / (total - 1);
    return padding + spacing * index;
  };

  // Get visible handles only
  const visibleInputs = inputs.filter(i => !i.hidden);
  const visibleOutputs = outputs.filter(o => !o.hidden);

  const leftNotches = visibleInputs.map((_, i) => getHandlePercent(i, visibleInputs.length));
  const rightNotches = visibleOutputs.map((_, i) => getHandlePercent(i, visibleOutputs.length));

  const hasError = typeof (data as any).error === "string" && (data as any).error?.trim()?.length > 0;

  const borderColor = isSelected ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)";

  return (
    <motion.div
      ref={nodeRef}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className={cn(
        "group/node relative min-w-[300px] max-w-[380px]",
        "overflow-visible",
        "shadow-2xl shadow-black/50",
        "will-change-transform",
        "transition-all duration-200"
      )}
    >
      {/* SVG Border with notches */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: "visible" }}
      >
        <defs>
          <clipPath id={`node-clip-${id}`}>
            <path d={generateNodePath(dimensions.width, dimensions.height, 12, leftNotches, rightNotches, 13)} />
          </clipPath>
        </defs>
        {/* Background fill */}
        <path
          d={generateNodePath(dimensions.width, dimensions.height, 12, leftNotches, rightNotches, 13)}
          fill="#0d0d0d"
        />
        {/* Border stroke */}
        <path
          d={generateNodePath(dimensions.width, dimensions.height, 12, leftNotches, rightNotches, 13)}
          fill="none"
          stroke={borderColor}
          strokeWidth={1.5}
        />
        {/* Accent bar at top */}
        <rect
          x={0}
          y={0}
          width={dimensions.width}
          height={4}
          rx={12}
          ry={12}
          fill={accentColor}
          clipPath={`url(#node-clip-${id})`}
        />
      </svg>

      {/* Content Container */}
      <div className="relative z-10">
        {/* Progress Overlay (when running) */}
        {status === "running" && data.progress !== undefined && (
          <div className="absolute top-1 left-0 right-0 h-0.5 bg-white/5 mx-3 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.progress}%` }}
              className="h-full bg-white"
              style={{ boxShadow: `0 0 8px ${accentColor}` }}
            />
          </div>
        )}

        {/* Header */}
        <div className="px-4 py-3 pt-5 flex items-center gap-3">
          {/* Icon Container */}
          {data.icon && (
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ 
                backgroundColor: `${accentColor}15`,
                border: `1px solid ${accentColor}30`,
              }}
            >
              <div style={{ color: accentColor }}>
                {data.icon}
              </div>
            </div>
          )}

          {/* Title & Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm truncate">
                {data.label}
              </h3>
              {hasInheritedSettings && (
                <div 
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/25"
                  title={`Settings inherited (${inheritedSettingsKeys.length})`}
                >
                  <Link2 className="w-2.5 h-2.5 text-violet-400" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {data.provider && (
                <span className="text-[10px] text-zinc-500">{data.provider}</span>
              )}
              {data.provider && data.estimatedCost !== undefined && data.estimatedCost > 0 && (
                <span className="text-zinc-700">•</span>
              )}
              {data.estimatedCost !== undefined && data.estimatedCost > 0 && (
                <span className="text-[10px] text-zinc-500">{data.estimatedCost} credits</span>
              )}
            </div>
          </div>

          {/* Run/Stop Button - Always Visible */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isRunning) {
                void cancelNode(id);
              } else {
                void runNode(id);
              }
            }}
            className={cn(
              "nodrag nowheel h-8 w-8 rounded-lg flex items-center justify-center transition-all",
              isRunning
                ? "bg-red-500/80 text-white hover:bg-red-500"
                : canRun
                ? "bg-white/10 text-white hover:bg-white hover:text-black"
                : "bg-white/5 text-zinc-600 cursor-not-allowed"
            )}
            title={isRunning ? "Stop" : "Run Node"}
          >
            {status === "running" ? (
              <Square className="w-4 h-4 fill-white" />
            ) : status === "queued" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="px-4 pb-3">
          {right ? (
            layout === "vertical" ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  {left ?? children ?? (
                    <div className="text-[11px] text-zinc-600 italic">No input configured</div>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute -top-1.5 left-3 px-1.5 bg-[#0d0d0d] text-[9px] text-zinc-500 uppercase tracking-wider">
                    Output
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] pt-4">
                    {right}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  {left ?? children ?? (
                    <div className="text-[11px] text-zinc-600 italic">No input</div>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute -top-1.5 left-3 px-1.5 bg-[#0d0d0d] text-[9px] text-zinc-500 uppercase tracking-wider">
                    Output
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] pt-4">
                    {right}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              {left ?? children ?? (
                <div className="text-[11px] text-zinc-600 italic">Configure node settings</div>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {hasError && (
          <div className="px-4 pb-3">
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="break-words leading-relaxed">{(data as any).error}</span>
            </div>
          </div>
        )}

        {/* Status Footer */}
        <div 
          className={cn(
            "px-4 py-2 flex items-center justify-between",
            "border-t border-white/[0.04]",
            statusCfg.bgColor
          )}
        >
          <div className="flex items-center gap-2">
            <StatusIcon 
              className={cn(
                "w-3.5 h-3.5",
                statusCfg.color,
                statusCfg.animate && "animate-spin"
              )} 
            />
            <span className={cn("text-[11px] font-medium", statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>

          {/* Secondary Actions */}
          <div
            className={cn(
              "flex items-center gap-1 transition-opacity duration-150",
              isSelected ? "opacity-100" : "opacity-0 group-hover/node:opacity-100"
            )}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                duplicateNode(id);
              }}
              className="nodrag nowheel h-6 w-6 rounded-md bg-white/[0.04] text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors inline-flex items-center justify-center"
              title="Duplicate"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteNode(id);
              }}
              className="nodrag nowheel h-6 w-6 rounded-md bg-white/[0.04] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors inline-flex items-center justify-center"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Input Handles */}
      {inputs.map((input, index) => {
        const isHidden = Boolean(input.hidden);
        const handleColor = dataTypeColors[input.type];
        const percent = getHandlePercent(index, inputs.length);

        // Type compatibility groups (matching flow-canvas.tsx)
        const TYPE_COMPAT: Record<string, string[]> = {
          number: ["number", "seed", "duration"],
          seed: ["number", "seed", "duration"],
          duration: ["number", "seed", "duration"],
          text: ["text", "prompt", "negative"],
          prompt: ["text", "prompt", "negative"],
          negative: ["text", "prompt", "negative"],
          boolean: ["boolean"],
          aspectRatio: ["aspectRatio"],
          image: ["image"],
          video: ["video"],
          audio: ["audio"],
          model: ["model"],
          temperature: ["temperature", "number"],
        };

        // Check if types are compatible
        const checkTypeCompat = (from: string, to: string) => {
          if (from === to) return true;
          if (from === "any" || to === "any") return true;
          const compatTypes = TYPE_COMPAT[from];
          return compatTypes ? compatTypes.includes(to) : false;
        };

        // Compatible if types match using compatibility groups
        const isCompatible = isDragging && !isHidden && draggedType && 
          checkTypeCompat(draggedType, input.type);
        
        // Dim incompatible handles when dragging
        const isIncompatible = isDragging && !isHidden && draggedType && !isCompatible;
        
        return (
          <div
            key={`input-${input.id}`}
            className={cn(
              "absolute left-0 z-30 transition-opacity duration-200",
              isHidden && "opacity-0 pointer-events-none",
              isIncompatible && "opacity-30"
            )}
            style={{ top: `${percent}%`, transform: "translate(-50%, -50%)" }}
            data-handletype={input.type}
          >
            <div 
              className="handle-wrapper relative" 
              data-handletype={input.type}
            >
              {isCompatible && (
                <div 
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ 
                    backgroundColor: handleColor.solid,
                    opacity: 0.4,
                    transform: "scale(2)",
                  }}
                />
              )}
              <Handle
                id={input.id}
                type="target"
                position={Position.Left}
                data-handletype={input.type}
                style={{ 
                  position: "relative",
                  left: 0,
                  top: 0,
                  transform: "none",
                  borderColor: isIncompatible ? "#555" : handleColor.solid,
                  boxShadow: isCompatible ? `0 0 12px ${handleColor.solid}, 0 0 24px ${handleColor.solid}` : undefined,
                  backgroundColor: isCompatible ? handleColor.solid : isIncompatible ? "#333" : undefined,
                }}
                className={cn(
                  "!relative !left-0 !top-0 !transform-none transition-all duration-200",
                  isCompatible && "!scale-125"
                )}
              />
            </div>
            
            <span
              className={cn(
                "absolute right-full mr-2 top-1/2 -translate-y-1/2",
                "text-[10px] font-medium whitespace-nowrap",
                "px-2 py-1 rounded-md",
                "bg-[#0d0d0d] border border-white/10",
                "transition-all duration-200",
                handleColor.text,
                isCompatible && "border-current"
              )}
              style={isCompatible ? { 
                boxShadow: `0 0 8px ${handleColor.solid}`,
                borderColor: handleColor.solid,
              } : undefined}
            >
              {input.label}
              {input.required && <span className="text-red-400 ml-0.5">*</span>}
            </span>
          </div>
        );
      })}

      {/* Output Handles - Two separate handles stacked vertically: Media Output + Settings */}
      {outputs.map((output, index) => {
        const isHidden = Boolean(output.hidden);
        const handleColor = dataTypeColors[output.type];
        const hasSettings = nodeSettings.length > 0;
        const isSettingsExpanded = settingsExpanded === output.id;
        
        // Calculate positions - if we have settings, we need 2 handles
        // Media output at 40%, Settings at 60% (or just media at 50% if no settings)
        const mediaPercent = hasSettings ? 35 : getHandlePercent(index, outputs.length);
        const settingsPercent = 65;
        
        return (
          <div key={`output-${output.id}`}>
            {/* 1. MEDIA OUTPUT HANDLE - for sharing actual output */}
            <div
              className={cn(
                "absolute right-0 z-30",
                isHidden && "opacity-0 pointer-events-none"
              )}
              style={{ top: `${mediaPercent}%`, transform: "translate(50%, -50%)" }}
            >
              <div 
                className="handle-wrapper relative group" 
                data-handletype={output.type}
              >
                <Handle
                  id={output.id}
                  type="source"
                  position={Position.Right}
                  data-handletype={output.type}
                  style={{ 
                    position: "relative",
                    right: 0,
                    top: 0,
                    transform: "none",
                    borderColor: handleColor.solid,
                  }}
                  className="!relative !right-0 !top-0 !transform-none"
                />
              </div>
              
              {/* Media output label */}
              <span
                className={cn(
                  "absolute left-full ml-2 top-1/2 -translate-y-1/2",
                  "text-[10px] font-medium whitespace-nowrap",
                  "px-2 py-1 rounded-md",
                  "bg-[#0d0d0d] border border-white/10",
                  handleColor.text
                )}
              >
                {output.label}
              </span>
            </div>
            
            {/* 2. SETTINGS ANCHOR HANDLE - hover/click to expand radial settings */}
            {hasSettings && (
              <div
                className="absolute right-0 z-40"
                style={{ top: `${settingsPercent}%`, transform: "translate(50%, -50%)" }}
                onMouseEnter={() => handleSettingsHover(output.id)}
                onMouseLeave={handleSettingsLeave}
                onClick={(e) => handleSettingsClick(output.id, e)}
              >
                <div 
                  className={cn(
                    "relative p-2 -m-2 rounded-lg cursor-pointer",
                    "hover:bg-violet-500/10 transition-colors",
                    isSettingsExpanded && "bg-violet-500/20"
                  )}
                >
                  {/* Anchor handle (square) */}
                  <div
                    className={cn(
                      "w-3 h-3 rounded-sm border-2 transition-all duration-150",
                      "border-violet-500 bg-[#1a1a2e]",
                      "hover:scale-125 hover:bg-violet-500/50",
                      isSettingsExpanded && "scale-110 bg-violet-500"
                    )}
                  />
                </div>
                
                {/* Settings label - hidden when expanded */}
                <AnimatePresence>
                  {!isSettingsExpanded && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        "absolute left-full ml-2 top-1/2 -translate-y-1/2",
                        "text-[10px] font-medium whitespace-nowrap",
                        "px-2 py-1 rounded-md flex items-center gap-1",
                        "bg-violet-500/10 border border-violet-500/30",
                        "text-violet-400 cursor-pointer"
                      )}
                    >
                      <Settings2 className="w-2.5 h-2.5" />
                      Settings
                    </motion.span>
                  )}
                </AnimatePresence>
                
                {/* Radial Settings Handles - ALWAYS RENDERED for React Flow, but visually hidden */}
                <div 
                  className={cn(
                    "absolute left-0 top-0",
                    isSettingsExpanded ? "pointer-events-auto" : "pointer-events-none"
                  )}
                  onMouseEnter={handleRadialHandleEnter}
                  onMouseLeave={handleSettingsLeave}
                >
                  {nodeSettings.map((setting, settingIndex) => {
                    const pos = getRadialPosition(settingIndex, nodeSettings.length, 85);
                    const Icon = settingIcons[setting.type] || Hash;
                    const color = dataTypeColors[setting.type as DataType] || dataTypeColors.text;
                    const isHovered = hoveredSetting === setting.id;
                    
                    // Calculate bezier curve control points
                    return (
                      <div
                        key={setting.id}
                        className="absolute"
                        style={{ 
                          left: isSettingsExpanded ? pos.x : 0, 
                          top: isSettingsExpanded ? pos.y : 0,
                          opacity: isSettingsExpanded ? 1 : 0,
                          transform: `translate(-50%, -50%) scale(${isSettingsExpanded ? 1 : 0})`,
                          transition: `all 0.2s ease-out ${settingIndex * 0.03}s`,
                        }}
                        onMouseEnter={() => setHoveredSetting(setting.id)}
                        onMouseLeave={() => setHoveredSetting(null)}
                      >
                        {/* Setting Handle - ALWAYS RENDERED */}
                        <div className="relative">
                          {/* Glow ring on hover */}
                          {isHovered && (
                            <div 
                              className="absolute inset-0 rounded-full animate-pulse"
                              style={{
                                backgroundColor: color.solid,
                                opacity: 0.3,
                                transform: "scale(2)",
                              }}
                            />
                          )}
                          <Handle
                            id={`${setting.id}-setting`}
                            type="source"
                            position={Position.Right}
                            data-handletype={setting.type}
                            style={{ 
                              position: "relative",
                              right: 0,
                              top: 0,
                              transform: "none",
                              borderColor: color.solid,
                              backgroundColor: isHovered ? color.solid : `${color.solid}40`,
                              width: "12px",
                              height: "12px",
                              boxShadow: isHovered ? `0 0 8px ${color.solid}` : "none",
                            }}
                            className={cn(
                              "!relative !right-0 !top-0 !transform-none !rounded-full !border-2",
                              "transition-all duration-150 cursor-grab",
                              isHovered && "!scale-110"
                            )}
                            onMouseDown={() => handleSettingDragStart(setting.id, setting.type as DataType)}
                          />
                          
                          {/* Curved bezier line from handle to anchor */}
                          {isSettingsExpanded && (
                            <svg
                              className="absolute"
                              style={{
                                left: 5,
                                top: 5,
                                width: 1,
                                height: 1,
                                overflow: "visible",
                                pointerEvents: "stroke",
                              }}
                              onMouseEnter={handleRadialHandleEnter}
                              onMouseLeave={handleSettingsLeave}
                            >
                              {/* Glow effect */}
                              <path
                                d={`M 0,0 Q ${-pos.x * 0.2},0 ${-pos.x * 0.5},${-pos.y * 0.5} T ${-pos.x},${-pos.y}`}
                                fill="none"
                                stroke={color.solid}
                                strokeWidth="6"
                                strokeOpacity="0.1"
                                strokeLinecap="round"
                              />
                              {/* Main curve */}
                              <path
                                d={`M 0,0 Q ${-pos.x * 0.2},0 ${-pos.x * 0.5},${-pos.y * 0.5} T ${-pos.x},${-pos.y}`}
                                fill="none"
                                stroke={color.solid}
                                strokeWidth="2"
                                strokeOpacity={isHovered ? "0.8" : "0.4"}
                                strokeLinecap="round"
                                className="transition-all duration-150"
                              />
                              {/* Invisible wider stroke for easier hover */}
                              <path
                                d={`M 0,0 Q ${-pos.x * 0.2},0 ${-pos.x * 0.5},${-pos.y * 0.5} T ${-pos.x},${-pos.y}`}
                                fill="none"
                                stroke="transparent"
                                strokeWidth="12"
                                style={{ cursor: "pointer" }}
                              />
                            </svg>
                          )}
                          
                          {/* Label - always visible when expanded */}
                          {isSettingsExpanded && (
                            <div
                              className={cn(
                                "absolute left-full ml-3 top-1/2 -translate-y-1/2",
                                "text-[9px] font-medium whitespace-nowrap",
                                "px-2 py-1 rounded-md",
                                "bg-zinc-900/95 backdrop-blur-sm border z-50",
                                "flex items-center gap-1.5",
                                "shadow-xl transition-all duration-150",
                                isHovered && "scale-105"
                              )}
                              style={{
                                borderColor: isHovered ? color.solid : `${color.solid}40`,
                                color: color.solid,
                                boxShadow: isHovered ? `0 0 12px ${color.solid}30` : undefined,
                              }}
                            >
                              <Icon className="w-3 h-3" />
                              {setting.label}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
      
    </motion.div>
  );
}

export const BaseNode = memo(BaseNodeComponent);

/**
 * Helper to check if a setting is inherited from another node.
 */
export function isSettingInherited(
  data: BaseNodeData,
  settingKey: string
): boolean {
  const inherited = data._inheritedFrom;
  if (!inherited) return false;
  return settingKey in (inherited.settings || {});
}

/**
 * Get the inherited value for a setting if it exists.
 */
export function getInheritedValue<T>(
  data: BaseNodeData,
  settingKey: string
): T | undefined {
  const inherited = data._inheritedFrom;
  if (!inherited) return undefined;
  return inherited.settings?.[settingKey] as T | undefined;
}
