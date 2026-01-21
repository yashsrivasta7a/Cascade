"use client";

import { useEffect, useState } from "react";
import { EdgeProps, getBezierPath } from "reactflow";
import { useFlowStore } from "@/store";
import { type AINodeType } from "@/types/nodes";

// =============================================================================
// EDGE COLORS
// =============================================================================

// Data type colors for edges - organized by category
export const edgeColors: Record<string, { stroke: string; glow: string; dash: string }> = {
  // MEDIA TYPES - Primary data flow
  text: { stroke: "#3b82f6", glow: "#3b82f6", dash: "#60a5fa" },           // Blue
  image: { stroke: "#10b981", glow: "#10b981", dash: "#34d399" },          // Emerald
  video: { stroke: "#8b5cf6", glow: "#8b5cf6", dash: "#a78bfa" },          // Violet
  audio: { stroke: "#f59e0b", glow: "#f59e0b", dash: "#fbbf24" },          // Amber
  any: { stroke: "#a1a1aa", glow: "#a1a1aa", dash: "#d4d4d8" },            // Zinc

  // SETTINGS TYPES - Parameters & configuration
  prompt: { stroke: "#0ea5e9", glow: "#0ea5e9", dash: "#38bdf8" },         // Sky
  negative: { stroke: "#ef4444", glow: "#ef4444", dash: "#f87171" },       // Red
  seed: { stroke: "#84cc16", glow: "#84cc16", dash: "#a3e635" },           // Lime
  aspectRatio: { stroke: "#6366f1", glow: "#6366f1", dash: "#818cf8" },    // Indigo
  duration: { stroke: "#14b8a6", glow: "#14b8a6", dash: "#2dd4bf" },       // Teal
  model: { stroke: "#f43f5e", glow: "#f43f5e", dash: "#fb7185" },          // Rose
  temperature: { stroke: "#f97316", glow: "#f97316", dash: "#fb923c" },    // Orange
  number: { stroke: "#ec4899", glow: "#ec4899", dash: "#f472b6" },         // Pink
  boolean: { stroke: "#06b6d4", glow: "#06b6d4", dash: "#22d3ee" },        // Cyan
};

// Advanced settings by node type (for visibility control)
const advancedByType: Partial<Record<AINodeType, Set<string>>> = {
  seedream: new Set([
    "numInferenceSteps", "guidanceScale", "seed", "aspectRatio",
    "negativePrompt", "truncatePrompt", "promptEnhancer", "syncMode",
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

// =============================================================================
// CUSTOM EDGE COMPONENT
// =============================================================================

/**
 * Custom edge with type-based coloring, animations, and delete button
 */
export function CustomEdge({
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
  const hasSettingInId = id.includes("-setting");
  const hasSettingId = Boolean(data?.settingId);
  const isSettingsConnection = data?.isSettingsConnection === true || 
                               data?.fromSettingsPopover === true ||
                               hasSettingId ||
                               hasSettingInId;
  const [isHovered, setIsHovered] = useState(false);
  const isWorkflowRunning = useFlowStore((s) => s.isWorkflowRunning);
  const [animationPhase, setAnimationPhase] = useState(0);

  const typeColors = edgeColors[dataType] || edgeColors.any;

  // Animate phase for flowing dots
  useEffect(() => {
    if (!isWorkflowRunning) {
      setAnimationPhase(0);
      return;
    }
    const interval = setInterval(() => {
      setAnimationPhase((prev) => (prev + 2) % 100);
    }, 30);
    return () => clearInterval(interval);
  }, [isWorkflowRunning]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  // Hide advanced setting edges when collapsed
  const targetHandle = (data as Record<string, unknown>)?.targetHandle as string | undefined;
  const targetNodeId = (data as Record<string, unknown>)?.targetNodeId as string | undefined;
  const shouldHideAdvanced = useFlowStore((s) => {
    if (isSettingsConnection) return false;
    if (!targetNodeId || !targetHandle) return false;
    const node = s.nodes.find((n) => n.id === targetNodeId);
    if (!node) return false;
    const open = Boolean((node.data as Record<string, unknown>)?.advancedOpen);
    if (open) return false;
    const nodeType = node.type as AINodeType | undefined;
    const set = nodeType ? advancedByType[nodeType] : undefined;
    return Boolean(set?.has(targetHandle));
  });

  if (shouldHideAdvanced) return null;

  const maskId = `edge-mask-${id}`;
  const breakRadius = 14;

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ overflow: "visible" }}
    >
      <defs>
        <mask id={maskId}>
          <rect x="-10000" y="-10000" width="20000" height="20000" fill="white" />
          {isHovered && !isWorkflowRunning && (
            <circle cx={labelX} cy={labelY} r={breakRadius} fill="black" />
          )}
        </mask>
      </defs>

      {/* Invisible wider path for hover detection */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={24} style={{ cursor: "pointer" }} />

      {/* Edge with break effect */}
      <g mask={isHovered && !isWorkflowRunning ? `url(#${maskId})` : undefined}>
        <path
          id={id}
          d={edgePath}
          fill="none"
          stroke={typeColors.stroke}
          strokeWidth={isSettingsConnection ? 2.5 : 3}
          strokeLinecap="round"
          strokeDasharray={isSettingsConnection ? "8 4" : undefined}
          markerEnd={markerEnd}
        />

        {/* Settings connection indicator */}
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
          style={{ animation: "connectionFlow 0.8s linear infinite" }}
        />
      )}

      {/* Delete button */}
      {isHovered && !isWorkflowRunning && (
        <g>
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

          <foreignObject x={labelX - 12} y={labelY - 12} width={24} height={24} style={{ overflow: "visible" }}>
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  useFlowStore.getState().onEdgesChange([{ type: "remove", id }]);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: 22, height: 22, borderRadius: "50%",
                  backgroundColor: "transparent", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "transform 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                title="Delete connection"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3L11 11M11 3L3 11" stroke={typeColors.stroke} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  );
}

export const edgeTypes = {
  custom: CustomEdge,
};
