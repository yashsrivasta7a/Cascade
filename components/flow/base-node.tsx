"use client";

import { memo, ReactNode, type CSSProperties, useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Play,
  Loader2,
  AlertCircle,
  Link2,
  CheckCircle2,
  Circle,
  Clock,
  Square,
  Info,
} from "lucide-react";
import { useFlowStore } from "@/store";
import { type DataType, dataTypeColors, type NodeStatus, type InheritedSettings, NODE_CONTRACTS, type AINodeType, isTypeCompatible } from "@/types/nodes";

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
  color: "cyan" | "violet" | "emerald" | "amber" | "rose" | "blue" | "zinc" | "teal";
  nodeType?: string; // Explicit node type for settings lookup
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
  teal: "#14b8a6", // For audio nodes
};

// Status configuration with icons and colors - minimal dark theme
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
    bgColor: "",
    label: "Ready" 
  },
  queued: { 
    icon: Clock, 
    color: "text-zinc-400", 
    bgColor: "",
    label: "Queued" 
  },
  running: { 
    icon: Loader2, 
    color: "text-blue-400", 
    bgColor: "",
    label: "Running",
    animate: true 
  },
  completed: { 
    icon: CheckCircle2, 
    color: "text-emerald-400", 
    bgColor: "",
    label: "Done" 
  },
  failed: { 
    icon: AlertCircle, 
    color: "text-red-400", 
    bgColor: "",
    label: "Failed" 
  },
  cancelled: {
    icon: Square,
    color: "text-amber-400",
    bgColor: "",
    label: "Cancelled"
  },
};

// ============================================================================
// Settings Handles Component - Always shows all settings handles
// ============================================================================
interface SettingsHandlesProps {
  nodeId: string;
  nodeSettings: Array<{ id: string; type: string; label: string }>;
}

function SettingsHandles({ nodeId, nodeSettings }: SettingsHandlesProps) {
  return (
    <>
      {/* Settings handles - always visible with 3% gap */}
      {nodeSettings.map((setting, settingIndex) => {
        const settingColor = dataTypeColors[setting.type as DataType] || dataTypeColors.any;
        const total = nodeSettings.length;
        const spacing = 3; // 3% gap between handles
        const startPercent = 80 - ((total - 1) * spacing) / 2;
        const handlePercent = startPercent + (settingIndex * spacing);
        
        return (
          <div
            key={`output-${setting.id}-setting`}
            className="absolute right-0 z-30 group/handle"
            style={{ top: `${handlePercent}%`, transform: "translate(50%, -50%)" }}
            data-handletype={setting.type}
          >
            <Handle
              id={`${setting.id}-setting`}
              type="source"
              position={Position.Right}
              data-handletype={setting.type}
              title={setting.label}
              style={{ 
                position: "relative",
                right: 0,
                top: 0,
                transform: "none",
                width: 10,
                height: 10,
                borderWidth: 0,
                backgroundColor: settingColor.solid,
              }}
              className="!relative !right-0 !top-0 !transform-none"
            />
            
            {/* Hover tooltip */}
            <div 
              data-settings-label="true"
              className={cn(
                "absolute left-full ml-3 top-1/2 -translate-y-1/2",
                "px-2 py-1 rounded-md",
                "text-[10px] whitespace-nowrap",
                "pointer-events-none",
                "shadow-lg shadow-black/30",
                "opacity-0 group-hover/handle:opacity-100",
                "transition-opacity duration-150"
              )}
              style={{ 
                fontFamily: 'Inter, system-ui, sans-serif',
                backgroundColor: settingColor.solid,
                color: '#000',
                fontWeight: 600,
              }}
            >
              {setting.label}
            </div>
          </div>
        );
      })}
    </>
  );
}

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
  nodeType: nodeTypeProp,
  left,
  right,
  children,
  inputs = [],
  outputs = [],
  isUtility = false,
  layout = "horizontal",
  id,
  type: reactFlowType,
}: BaseNodeProps) {
  // Use explicit nodeType prop if provided, otherwise fall back to React Flow type
  const nodeTypeFromProps = nodeTypeProp || reactFlowType;
  const status = data.status || "idle";
  const selectedNodeId = useFlowStore((s) => s.selectedNode?.id ?? null);
  const isSelected = Boolean(selected || (selectedNodeId && selectedNodeId === id));
  const highlightedNodeIds = useFlowStore((s) => s.highlightedNodeIds);
  const isHighlighted = highlightedNodeIds.includes(id);
  // Note: duplicate/delete functionality moved to context menu
  const runNode = useFlowStore((s) => s.runNode);
  const cancelNode = useFlowStore((s) => s.cancelNode);
  const isUploading = Boolean((data as any)._isUploading);
  const canRun = status !== "running" && status !== "queued" && !isUploading;
  const isRunningOrQueued = status === "running" || status === "queued";
  const isActuallyRunning = status === "running"; // Only show glow for actually running nodes
  
  const connectingFrom = useFlowStore((s) => s.connectingFrom);
  const draggedType = connectingFrom?.handleType;
  const isDragging = Boolean(connectingFrom && connectingFrom.nodeId !== id);
  
  const inheritedFrom = data._inheritedFrom;
  const inheritedSettingsKeys = inheritedFrom?.settings ? Object.keys(inheritedFrom.settings) : [];
  // Show indicator if ANY settings are inherited (not just full inheritance)
  const hasInheritedSettings = inheritedSettingsKeys.length > 0 || Boolean(inheritedFrom?.fullInheritance);

  const accentColor = accentColors[color] || accentColors.zinc;
  const statusCfg = statusConfig[status];
  const StatusIcon = statusCfg.icon;

  // Node dimensions for SVG border
  const nodeRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 320, height: 200 });
  
  
  // Editable node name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(data.label);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const updateNode = useFlowStore((s) => s.updateNode);
  
  // Node hover state for showing run button
  const [isNodeHovered, setIsNodeHovered] = useState(false);
  
  // Get node type from the props - nodeTypeFromProps is the React Flow node type
  // This is passed from the parent node component (e.g., SeedreamNode → BaseNode)
  const nodeType = nodeTypeFromProps || (data as any).nodeType || id?.split("-")[0] as AINodeType;
  const contract = nodeType ? NODE_CONTRACTS[nodeType as AINodeType] : undefined;
  
  // Get settings from contract - these are all non-media inputs that can be shared
  // Settings include: prompt, model, temperature, seed, aspectRatio, duration, format, etc.
  const nodeSettings = useMemo(() => {
    if (!contract?.settings) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[BaseNode] No settings found for node type: ${nodeType}`);
      }
      return [];
    }
    return contract.settings;
  }, [contract, nodeType]);
  

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

  
  // Focus input when editing name
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);
  
  // Handle name edit submission
  const handleNameSubmit = useCallback(() => {
    if (editedName.trim() && editedName !== data.label) {
      updateNode(id, { label: editedName.trim() });
    } else {
      setEditedName(data.label);
    }
    setIsEditingName(false);
  }, [editedName, data.label, updateNode, id]);
  
  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSubmit();
    } else if (e.key === "Escape") {
      setEditedName(data.label);
      setIsEditingName(false);
    }
  }, [handleNameSubmit, data.label]);

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
  
  // Right notches: just media outputs (settings handles are hidden)
  const hasSettings = nodeSettings.length > 0;
  
  const rightNotches = visibleOutputs.map((_, i) => getHandlePercent(i, visibleOutputs.length));

  const hasError = typeof (data as any).error === "string" && (data as any).error?.trim()?.length > 0;

  // Check if we're in dark mode by checking the document's class
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Border states: failed (red dashed), running (node theme), selected (category color), default (very subtle)
  const isFailed = status === "failed";
  const borderColor = isFailed
    ? "#ef4444" // Red for failed
    : isActuallyRunning
      ? accentColor // Node theme color when running
      : isHighlighted 
        ? accentColor // Node theme color for pipeline view
        : isSelected 
          ? accentColor // Category color when selected
          : isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.1)"; // Very subtle default
  
  const borderStyle = isFailed ? "dashed" : "solid";
  const borderWidth = isFailed || isSelected ? 2 : 1;
  
  // Node background - dark gray matching reference
  const nodeBgColor = isDarkMode ? "#161616" : "#ffffff";

  return (
    <motion.div
      ref={nodeRef}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className={cn(
        "group/node relative min-w-[300px] max-w-[380px]",
        "overflow-visible",
        "will-change-transform",
        "transition-all duration-200"
      )}
      style={{
        boxShadow: isActuallyRunning 
          ? `0 0 20px ${accentColor}40, 0 0 40px ${accentColor}20, 0 4px 12px rgba(0,0,0,0.4)`
          : "0 4px 12px rgba(0,0,0,0.4)",
      }}
      onMouseEnter={() => setIsNodeHovered(true)}
      onMouseLeave={() => setIsNodeHovered(false)}
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
          {/* Glow filter for running state - subtle effect */}
          {isActuallyRunning && (
            <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          )}
        </defs>
        {/* Background fill */}
        <path
          d={generateNodePath(dimensions.width, dimensions.height, 12, leftNotches, rightNotches, 13)}
          fill={nodeBgColor}
        />
        {/* Border stroke */}
        <path
          d={generateNodePath(dimensions.width, dimensions.height, 12, leftNotches, rightNotches, 13)}
          fill="none"
          stroke={borderColor}
          strokeWidth={borderWidth}
          strokeDasharray={borderStyle === "dashed" ? "8 4" : undefined}
          filter={isActuallyRunning ? `url(#glow-${id})` : undefined}
          className={isActuallyRunning ? "animate-pulse-glow" : ""}
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
          <div className="absolute top-1 left-0 right-0 h-0.5 bg-gray-200 dark:bg-white/5 mx-3 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.progress}%` }}
              className="h-full bg-blue-500 dark:bg-white"
              style={{ boxShadow: `0 0 8px ${accentColor}` }}
            />
          </div>
        )}

        {/* Header - Clean with run button on hover */}
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Editable Node Name */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleNameKeyDown}
                className="nodrag nowheel bg-transparent border-b border-zinc-600 text-white/90 text-[13px] tracking-wide focus:outline-none focus:border-zinc-400 w-full max-w-[200px]"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              />
            ) : (
              <h3 
                className="text-white/80 text-[13px] tracking-wide truncate cursor-text hover:text-white transition-colors"
                onClick={() => setIsEditingName(true)}
                title="Click to rename"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                {data.label}
              </h3>
            )}
            {hasInheritedSettings && (
              <div 
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/25"
                title={inheritedSettingsKeys.length > 0 
                  ? `Connected settings: ${inheritedSettingsKeys.join(", ")}` 
                  : "Settings inherited from another node"}
              >
                <Link2 className="w-2.5 h-2.5 text-violet-400" />
                {inheritedSettingsKeys.length > 0 && (
                  <span className="text-[9px] text-violet-400 font-medium">{inheritedSettingsKeys.length}</span>
                )}
              </div>
            )}
          </div>

          {/* Info icon with custom tooltip */}
          <div className="relative group/info">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-600 hover:text-zinc-400 cursor-default transition-colors">
              <Info className="w-3.5 h-3.5" />
            </div>
            {/* Custom tooltip - rectangle aligned to right */}
            <div className="absolute bottom-full right-0 mb-2 px-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-xs text-zinc-200 w-[280px] opacity-0 group-hover/info:opacity-100 pointer-events-none transition-opacity duration-150 shadow-xl shadow-black/50 z-50 leading-relaxed">
              {data.description || "Node information"}
            </div>
          </div>
        </div>

        {/* Content Area - Input fields first, Output at bottom */}
        <div className="px-4 pb-3 space-y-3">
          {/* Input Fields with darker background */}
          <div className={cn("rounded-lg p-3 space-y-2", isDarkMode ? "bg-[#0f0f0f]" : "bg-gray-100")}>
            {left ?? children ?? (
              <div className="text-[11px] text-zinc-600 italic" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                Configure node inputs
              </div>
            )}
          </div>
          
          {/* Output Section - label outside, content in box */}
          <div>
            <div className="text-[10px] text-zinc-500 mb-1.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Output
            </div>
            <div className={cn("rounded-lg p-3", isDarkMode ? "bg-[#0f0f0f] border border-zinc-800/30" : "bg-gray-100 border border-gray-200")}>
              {right || (
                <div className="text-[11px] text-zinc-600 text-center py-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Results will be shown here
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {hasError && (
          <div className="px-4 pb-3">
            <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-2.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="break-words leading-relaxed">{(data as any).error}</span>
            </div>
          </div>
        )}

        {/* Status Footer - minimal */}
        <div 
          className={cn(
            "px-4 py-2 flex items-center justify-between",
            "border-t border-zinc-800/30"
          )}
        >
          <div className="flex items-center gap-2">
            <StatusIcon 
              className={cn(
                "w-3 h-3",
                statusCfg.color,
                statusCfg.animate && "animate-spin"
              )} 
            />
            <span className={cn("text-[10px] font-medium", statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>

          {/* Credits display */}
          {data.estimatedCost !== undefined && data.estimatedCost > 0 && (
            <span className="text-[10px] text-zinc-500">
              {data.estimatedCost} credits
            </span>
          )}
        </div>
      </div>

      {/* Input Handles - Simple dot on edge */}
      {inputs.map((input, index) => {
        const isHidden = Boolean(input.hidden);
        const handleColor = dataTypeColors[input.type];
        const visibleIndex = inputs.slice(0, index).filter(i => !i.hidden).length;
        const visibleCount = inputs.filter(i => !i.hidden).length;
        const percent = isHidden 
          ? getHandlePercent(index, inputs.length) 
          : getHandlePercent(visibleIndex, visibleCount);

        const isCompatible = isDragging && !isHidden && draggedType && 
          isTypeCompatible(draggedType, input.type);
        const isIncompatible = isDragging && !isHidden && draggedType && !isCompatible;
        
        const tooltipText = input.label + (input.required ? " (required)" : "");
        
        return (
          <div
            key={`input-${input.id}`}
            className={cn(
              "absolute left-0 z-30 transition-all duration-200 group/handle",
              isHidden && "opacity-0 pointer-events-none",
              isIncompatible && "opacity-30"
            )}
            style={{ top: `${percent}%`, transform: "translate(-50%, -50%)" }}
            data-handletype={input.type}
          >
            {isCompatible && (
              <div 
                className="absolute rounded-full animate-ping"
                style={{ 
                  width: 12,
                  height: 12,
                  backgroundColor: handleColor.solid,
                  opacity: 0.4,
                  left: -1,
                  top: -1,
                }}
              />
            )}
            <Handle
              id={input.id}
              type="target"
              position={Position.Left}
              data-handletype={input.type}
              title={tooltipText}
              style={{ 
                position: "relative",
                left: 0,
                top: 0,
                transform: "none",
                width: 10,
                height: 10,
                borderWidth: 0,
                backgroundColor: handleColor.solid,
                boxShadow: isCompatible ? `0 0 8px ${handleColor.solid}` : undefined,
              }}
              className="!relative !left-0 !top-0 !transform-none transition-all duration-200"
            />
            
            {/* Hover tooltip - shows outside node (to the left) */}
            <div 
              className={cn(
                "absolute right-full mr-3 top-1/2 -translate-y-1/2",
                "px-3 py-1.5 rounded-lg",
                "bg-[#1a1a1a] border border-white/10",
                "text-[11px] text-white/90 whitespace-nowrap",
                "opacity-0 group-hover/handle:opacity-100 pointer-events-none",
                "transition-opacity duration-150",
                "shadow-xl shadow-black/50"
              )}
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              {tooltipText}
            </div>
          </div>
        );
      })}

      {/* Output Handles - Simple dot on edge */}
      {outputs.map((output, index) => {
        const isHidden = Boolean(output.hidden);
        const handleColor = dataTypeColors[output.type];
        const percent = getHandlePercent(index, outputs.length);
        
        const tooltipText = output.label;
        
        return (
          <div
            key={`output-${output.id}`}
            className={cn(
              "absolute right-0 z-30 group/handle",
              isHidden && "opacity-0 pointer-events-none"
            )}
            style={{ top: `${percent}%`, transform: "translate(50%, -50%)" }}
            data-handletype={output.type}
          >
            <Handle
              id={output.id}
              type="source"
              position={Position.Right}
              data-handletype={output.type}
              title={tooltipText}
              style={{ 
                position: "relative",
                right: 0,
                top: 0,
                transform: "none",
                width: 10,
                height: 10,
                borderWidth: 0,
                backgroundColor: handleColor.solid,
              }}
              className="!relative !right-0 !top-0 !transform-none"
            />
            
            {/* Hover tooltip - shows outside node (to the right) */}
            <div 
              className={cn(
                "absolute left-full ml-3 top-1/2 -translate-y-1/2",
                "px-3 py-1.5 rounded-lg",
                "bg-[#1a1a1a] border border-white/10",
                "text-[11px] text-white/90 whitespace-nowrap",
                "opacity-0 group-hover/handle:opacity-100 pointer-events-none",
                "transition-opacity duration-150",
                "shadow-xl shadow-black/50"
              )}
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              {tooltipText}
            </div>
          </div>
        );
      })}

      {/* Settings handles - always visible */}
      {hasSettings && (
        <SettingsHandles
          nodeId={id}
          nodeSettings={nodeSettings}
        />
      )}

      {/* Floating Run Button - outside node on right, appears on hover */}
      <AnimatePresence>
        {(isNodeHovered || isRunningOrQueued || isUploading) && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            type="button"
            disabled={isUploading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isUploading) return; // Don't run while uploading
              if (isRunningOrQueued) {
                void cancelNode(id);
              } else if (canRun) {
                void runNode(id);
              }
            }}
            className={cn(
              "nodrag nowheel absolute -right-14 top-4 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all shadow-lg group/runbtn",
              isUploading
                ? "bg-zinc-900 text-zinc-500 cursor-not-allowed border border-zinc-800"
                : status === "running"
                ? "bg-zinc-800 text-white hover:bg-red-600 border border-zinc-700 hover:border-red-500"
                : status === "queued"
                ? "bg-zinc-800 text-white hover:bg-red-600 border border-zinc-700 hover:border-red-500"
                : canRun
                ? "text-white hover:brightness-110 border border-white/10"
                : "bg-zinc-900 text-zinc-500 cursor-not-allowed border border-zinc-800"
            )}
            style={canRun && !isUploading && !isRunningOrQueued ? { backgroundColor: "#058b61" } : undefined}
            title={isUploading ? "Wait for upload to complete" : isRunningOrQueued ? "Click to stop" : "Run node"}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs font-medium">Uploading...</span>
              </>
            ) : status === "running" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin group-hover/runbtn:hidden" />
                <Square className="w-3.5 h-3.5 fill-current hidden group-hover/runbtn:block" />
                <span className="text-xs font-medium group-hover/runbtn:hidden">Running</span>
                <span className="text-xs font-medium hidden group-hover/runbtn:block">Stop</span>
              </>
            ) : status === "queued" ? (
              <>
                <Clock className="w-3.5 h-3.5 group-hover/runbtn:hidden" />
                <Square className="w-3.5 h-3.5 fill-current hidden group-hover/runbtn:block" />
                <span className="text-xs font-medium group-hover/runbtn:hidden">Queued</span>
                <span className="text-xs font-medium hidden group-hover/runbtn:block">Stop</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Run</span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

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
