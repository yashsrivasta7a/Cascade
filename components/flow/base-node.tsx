"use client";

import { memo, ReactNode, type CSSProperties, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { useFlowStore } from "@/store";
import { type DataType, dataTypeColors, type NodeStatus, type InheritedSettings } from "@/types/nodes";

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
}: BaseNodeProps) {
  const status = data.status || "idle";
  const selectedNodeId = useFlowStore((s) => s.selectedNode?.id ?? null);
  const isSelected = Boolean(selected || (selectedNodeId && selectedNodeId === id));
  const deleteNode = useFlowStore((s) => s.deleteNode);
  const duplicateNode = useFlowStore((s) => s.duplicateNode);
  const runNode = useFlowStore((s) => s.runNode);
  const canRun = status !== "running";
  
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

          {/* Run Button - Always Visible */}
          <button
            type="button"
            disabled={!canRun}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void runNode(id);
            }}
            className={cn(
              "nodrag nowheel h-8 w-8 rounded-lg flex items-center justify-center transition-all",
              status === "running"
                ? "bg-white text-black"
                : canRun
                ? "bg-white/10 text-white hover:bg-white hover:text-black"
                : "bg-white/5 text-zinc-600 cursor-not-allowed"
            )}
            title={status === "running" ? "Running..." : "Run Node"}
          >
            {status === "running" ? (
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
        
        const mediaTypes = ["image", "video", "audio"];
        const isMediaInput = mediaTypes.includes(input.type);
        const isDraggedMedia = draggedType && mediaTypes.includes(draggedType);
        const isCompatible = isDragging && !isHidden && draggedType && (
          (isMediaInput && isDraggedMedia && input.type === draggedType)
        );
        
        return (
          <div
            key={`input-${input.id}`}
            className={cn(
              "absolute left-0 z-30",
              isHidden && "opacity-0 pointer-events-none"
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
                  borderColor: handleColor.solid,
                  boxShadow: isCompatible ? `0 0 12px ${handleColor.solid}, 0 0 24px ${handleColor.solid}` : undefined,
                  backgroundColor: isCompatible ? handleColor.solid : undefined,
                }}
                className={cn(
                  "!relative !left-0 !top-0 !transform-none",
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

      {/* Output Handles */}
      {outputs.map((output, index) => {
        const isHidden = Boolean(output.hidden);
        const handleColor = dataTypeColors[output.type];
        const percent = getHandlePercent(index, outputs.length);
        
        return (
          <div
            key={`output-${output.id}`}
            className={cn(
              "absolute right-0 z-30",
              isHidden && "opacity-0 pointer-events-none"
            )}
            style={{ top: `${percent}%`, transform: "translate(50%, -50%)" }}
            data-handletype={output.type}
          >
            <div className="handle-wrapper" data-handletype={output.type}>
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
