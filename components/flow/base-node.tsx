"use client";

import { memo, ReactNode, type CSSProperties } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Coins,
  ExternalLink,
  Copy,
  Trash2,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useFlowStore } from "@/store";
import { type DataType, dataTypeColors, type NodeStatus } from "@/types/nodes";

export interface BaseNodeData {
  label: string;
  description?: string;
  icon?: ReactNode;
  status?: NodeStatus;
  provider?: string;
  estimatedCost?: number;
  actualCost?: number;
  progress?: number;
  [key: string]: unknown;
}

interface HandleConfig {
  id: string;
  type: DataType;
  label: string;
  position?: "top" | "center" | "bottom";
}

interface BaseNodeProps extends NodeProps<BaseNodeData> {
  color: "cyan" | "violet" | "emerald" | "amber" | "rose" | "blue" | "zinc";
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode; // backward-compat: treated as left content
  inputs?: HandleConfig[];
  outputs?: HandleConfig[];
  isUtility?: boolean;
  layout?: "horizontal" | "vertical"; // horizontal = side-by-side, vertical = stacked
}

const colorMap = {
  cyan: {
    accent: "bg-white/20",
    icon: "bg-white/[0.04] text-zinc-100 border-white/10",
    softRing: "ring-white/10",
    selectedBorder: "border-white/20",
  },
  violet: {
    accent: "bg-white/20",
    icon: "bg-white/[0.04] text-zinc-100 border-white/10",
    softRing: "ring-white/10",
    selectedBorder: "border-white/20",
  },
  emerald: {
    accent: "bg-white/20",
    icon: "bg-white/[0.04] text-zinc-100 border-white/10",
    softRing: "ring-white/10",
    selectedBorder: "border-white/20",
  },
  amber: {
    accent: "bg-white/20",
    icon: "bg-white/[0.04] text-zinc-100 border-white/10",
    softRing: "ring-white/10",
    selectedBorder: "border-white/20",
  },
  rose: {
    accent: "bg-white/25",
    icon: "bg-white/[0.04] text-zinc-100 border-white/10",
    softRing: "ring-white/10",
    selectedBorder: "border-white/20",
  },
  blue: {
    accent: "bg-white/20",
    icon: "bg-white/[0.04] text-zinc-100 border-white/10",
    softRing: "ring-white/10",
    selectedBorder: "border-white/20",
  },
  zinc: {
    accent: "bg-white/15",
    icon: "bg-white/[0.03] text-zinc-200 border-white/10",
    softRing: "ring-white/10",
    selectedBorder: "border-white/15",
  },
};

function StatusPill({ status }: { status: NodeStatus }) {
  const cfg: Record<
    NodeStatus,
    { label: string; icon: ReactNode; className: string }
  > = {
    idle: {
      label: "Idle",
      icon: <Clock className="w-3.5 h-3.5" />,
      className: "text-zinc-300 bg-white/[0.03] border-white/10",
    },
    queued: {
      label: "Queued",
      icon: <Clock className="w-3.5 h-3.5" />,
      className: "text-zinc-200 bg-white/[0.04] border-white/10",
    },
    running: {
      label: "Running",
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      className: "text-zinc-100 bg-white/[0.06] border-white/15",
    },
    completed: {
      label: "Done",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      className: "text-zinc-100 bg-white/[0.06] border-white/15",
    },
    failed: {
      label: "Failed",
      icon: <XCircle className="w-3.5 h-3.5" />,
      className: "text-zinc-100 bg-white/[0.06] border-white/15",
    },
  };

  const c = cfg[status];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-[10px] font-semibold border backdrop-blur-md",
        c.className
      )}
    >
      {c.icon}
      <span>{c.label}</span>
    </div>
  );
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
  const colors = colorMap[color];
  const status = data.status || "idle";
  const selectedNodeId = useFlowStore((s) => s.selectedNode?.id ?? null);
  const isSelected = Boolean(selected || (selectedNodeId && selectedNodeId === id));
  const deleteNode = useFlowStore((s) => s.deleteNode);
  const duplicateNode = useFlowStore((s) => s.duplicateNode);

  // Calculate handle positions
  const getHandleStyle = (index: number, total: number): CSSProperties => {
    if (total === 1) return { top: "50%" };
    const spacing = 100 / (total + 1);
    return { top: `${spacing * (index + 1)}%` };
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group/node relative min-w-[360px] max-w-[480px]",
        "node-card",
        "border border-white/10",
        "will-change-transform",
        isSelected && "selected border-gradient",
        isSelected && cn("ring-1", colors.softRing),
        "hover:translate-y-[-1px]",
        "overflow-visible"
      )}
    >
      {/* Noise + highlight */}
      <div className="absolute inset-0 rounded-[20px] bg-noise pointer-events-none" />
      <div className="absolute inset-0 rounded-[20px] pointer-events-none bg-gradient-to-b from-white/[0.06] via-transparent to-transparent opacity-60" />

      {/* Status Indicators */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <StatusPill status={status} />

        <div
          className={cn(
            "flex items-center gap-1 opacity-0 pointer-events-none transition-opacity",
            (isSelected || status !== "idle") && "opacity-100 pointer-events-auto",
            "group-hover/node:opacity-100 group-hover/node:pointer-events-auto"
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              duplicateNode(id);
            }}
            className="nodrag nowheel h-7 w-7 rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors inline-flex items-center justify-center"
            title="Duplicate"
            aria-label="Duplicate node"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteNode(id);
            }}
            className="nodrag nowheel h-7 w-7 rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors inline-flex items-center justify-center"
            title="Delete"
            aria-label="Delete node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar (during execution) */}
      {status === "running" && data.progress !== undefined && (
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[20px] overflow-hidden bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${data.progress}%` }}
            className={cn("h-full", colors.accent)}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-start gap-3 pr-24">
            {data.icon && (
              <div
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center border backdrop-blur-sm shrink-0",
                  colors.icon
                )}
              >
                {data.icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-semibold text-white truncate text-[13px] tracking-tight">
                  {data.label}
                </h3>
                {isUtility && (
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-zinc-400 bg-white/[0.03] border border-white/10 px-2 py-0.5 rounded-xl">
                    Utility
                  </span>
                )}
              </div>
              {data.description && (
                <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                  {data.description}
                </p>
              )}

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {data.provider && (
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-300 bg-white/[0.03] border border-white/10 rounded-xl px-2 py-1">
                    <ExternalLink className="w-3 h-3" />
                    <span>{data.provider}</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-300 bg-white/[0.03] border border-white/10 rounded-xl px-2 py-1">
                  <Coins className="w-3 h-3" />
                  <span>
                    {data.estimatedCost !== undefined && data.estimatedCost > 0
                      ? data.actualCost !== undefined
                        ? `${data.actualCost} / ${data.estimatedCost}`
                        : data.estimatedCost
                      : "Free"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {right ? (
            layout === "vertical" ? (
              /* Vertical layout: input on top, result below */
              <div className="space-y-3">
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      Input
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/20 border border-white/5 p-2.5 min-w-0">
                    {left ?? children ?? (
                      <div className="text-[11px] text-zinc-500">Configure in inspector</div>
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      Result
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/20 border border-white/5 p-2.5 min-w-0">
                    {right}
                  </div>
                </div>
              </div>
            ) : (
              /* Horizontal layout: side-by-side */
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      Input
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/20 border border-white/5 p-2.5 min-w-0">
                    {left ?? children ?? (
                      <div className="text-[11px] text-zinc-500">Configure in inspector</div>
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      Result
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/20 border border-white/5 p-2.5 min-w-0">
                    {right}
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Single-column layout for input-only nodes */
            <div className="rounded-xl bg-black/20 border border-white/5 p-2.5 min-w-0">
              {left ?? children ?? (
                <div className="text-[11px] text-zinc-500">Configure in inspector</div>
              )}
            </div>
          )}
        </div>

        {/* Footer - error / hint */}
        <div className="px-4 py-2 border-t border-white/5 bg-black/20 rounded-b-[20px]">
          {typeof (data as any).error === "string" && (data as any).error?.trim()?.length ? (
            <div className="text-[10px] text-zinc-200">
              <span className="text-zinc-500">Error:</span>{" "}
              <span className="text-zinc-200">{(data as any).error}</span>
            </div>
          ) : (
            <div className="text-[10px] text-zinc-500">
              Tip: double-click canvas to add a node. Drag from a port to create a connection.
            </div>
          )}
        </div>
      </div>

      {/* Input Handles */}
      {inputs.map((input, index) => {
        const handleColor = dataTypeColors[input.type];
        const showLabel = inputs.length > 1 || isSelected;
        return (
          <Handle
            key={`input-${input.id}`}
            id={input.id}
            type="target"
            position={Position.Left}
            style={getHandleStyle(index, inputs.length)}
            className={cn(
              "!w-3 !h-3 !-left-1.5 !border-2 transition-all duration-200",
              "hover:scale-110",
              `!${handleColor.bg}`,
              `!${handleColor.border}`
            )}
          >
            <span
              className={cn(
                // Labels should live OUTSIDE the node, not inside it.
                "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full -ml-3 text-[9px] font-semibold whitespace-nowrap pointer-events-none",
                "px-2 py-1 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md",
                "transition-opacity",
                handleColor.text,
                showLabel ? "opacity-95" : "opacity-0 group-hover/node:opacity-95"
              )}
            >
              {input.label}
            </span>
          </Handle>
        );
      })}

      {/* Output Handles */}
      {outputs.map((output, index) => {
        const handleColor = dataTypeColors[output.type];
        const showLabel = outputs.length > 1 || isSelected;
        return (
          <Handle
            key={`output-${output.id}`}
            id={output.id}
            type="source"
            position={Position.Right}
            style={getHandleStyle(index, outputs.length)}
            className={cn(
              "!w-3 !h-3 !-right-1.5 !border-2 transition-all duration-200",
              "hover:scale-110",
              `!${handleColor.bg}`,
              `!${handleColor.border}`
            )}
          >
            <span
              className={cn(
                // Labels should live OUTSIDE the node, not inside it.
                "absolute right-0 top-1/2 -translate-y-1/2 translate-x-full ml-3 text-[9px] font-semibold whitespace-nowrap pointer-events-none",
                "px-2 py-1 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md",
                "transition-opacity",
                handleColor.text,
                showLabel ? "opacity-95" : "opacity-0 group-hover/node:opacity-95"
              )}
            >
              {output.label}
            </span>
          </Handle>
        );
      })}
    </motion.div>
  );
}

export const BaseNode = memo(BaseNodeComponent);
