"use client";

import { ConnectionLineComponentProps } from "reactflow";
import { useFlowStore } from "@/store";
import { edgeColors } from "./custom-edge";

/**
 * Custom connection line with smooth flowing curve animation
 */
export function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  // Get the connecting handle type from the store
  const connectingFrom = useFlowStore((s) => s.connectingFrom);
  const handleType = connectingFrom?.handleType || "any";
  const typeColors = edgeColors[handleType] || edgeColors.any;

  // Create a smooth bezier curve path
  const controlOffset = Math.min(Math.abs(toX - fromX) * 0.5, 150);

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
