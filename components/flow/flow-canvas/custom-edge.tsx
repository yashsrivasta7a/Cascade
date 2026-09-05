"use client";

import { useEffect, useState } from "react";
import { EdgeProps, getBezierPath } from "reactflow";
import { useFlowStore } from "@/store";
import { type AINodeType } from "@/types/nodes";

// =============================================================================
// EDGE COLORS
// =============================================================================

/**
 * Edge colours.
 *
 * This was 14 fully-saturated hues — one per data type, each a Tailwind 500.
 * A graph with a dozen connections became a rainbow of wires, and because edges
 * cross the whole canvas they were the largest coloured surface in the product.
 * Worse, 14 categories is past the point where colour communicates: nobody
 * learns that pink means "number" and orange means "temperature".
 *
 * The system now distinguishes only what a user actually reasons about — the
 * four media kinds that flow between nodes — and renders everything else as
 * neutral wire. The four are desaturated to sit behind the node cards rather
 * than in front of them; edges are connective tissue, not content.
 */
const NEUTRAL = { stroke: "#6b6b73", glow: "#6b6b73", dash: "#8a8a92" };

export const edgeColors: Record<string, { stroke: string; glow: string; dash: string }> = {
  // Media types — the only distinctions worth encoding in colour.
  text: { stroke: "#8fa8c8", glow: "#8fa8c8", dash: "#a9bdd6" },
  image: { stroke: "#86b79c", glow: "#86b79c", dash: "#a3c9b4" },
  video: { stroke: "#a094c4", glow: "#a094c4", dash: "#b6acd3" },
  audio: { stroke: "#c9ac83", glow: "#c9ac83", dash: "#d7c1a0" },
  any: NEUTRAL,

  // Settings/parameter wires. Deliberately all one neutral: these are numerous,
  // short, and their meaning is already carried by the port they land on.
  prompt: NEUTRAL,
  negative: NEUTRAL,
  seed: NEUTRAL,
  aspectRatio: NEUTRAL,
  duration: NEUTRAL,
  model: NEUTRAL,
  temperature: NEUTRAL,
  number: NEUTRAL,
  boolean: NEUTRAL,
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
