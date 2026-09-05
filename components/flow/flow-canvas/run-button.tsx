"use client";

import { useEffect, useState } from "react";
import { Node, useReactFlow } from "reactflow";
import { Play, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface RunSelectedButtonProps {
  selectedNodes: Node[];
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>;
}

/**
 * Button that appears above selected nodes to run them together
 */
export function RunSelectedButton({ 
  selectedNodes, 
  isRunning, 
  onRun,
  onStop,
  reactFlowWrapper
}: RunSelectedButtonProps) {
  const { getViewport } = useReactFlow();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (selectedNodes.length < 2 || !reactFlowWrapper.current) {
      setPosition(null);
      return;
    }

    // Calculate bounding box of selected nodes
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity;
    
    for (const node of selectedNodes) {
      const nodeWidth = 280; // Approximate node width
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      minY = Math.min(minY, node.position.y);
    }

    // Convert flow coordinates to screen coordinates
    const vp = getViewport();
    const centerX = ((minX + maxX) / 2) * vp.zoom + vp.x;
    const topY = minY * vp.zoom + vp.y - 50; // 50px above the top-most node

    setPosition({ x: centerX, y: topY });
  }, [selectedNodes, getViewport, reactFlowWrapper]);

  if (!position || selectedNodes.length < 2) return null;

  return (
    <div 
      className="absolute z-20 pointer-events-auto"
      style={{
        left: position.x,
        top: Math.max(10, position.y), // Don't go above viewport
        transform: 'translateX(-50%)',
      }}
    >
      <button
        onClick={isRunning ? onStop : onRun}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-lg group/runbtn",
          isRunning
            ? "bg-zinc-800 hover:bg-red-600 border border-zinc-700 hover:border-red-500"
            : "border border-white/10 hover:brightness-110"
        )}
        style={!isRunning ? { backgroundColor: "#058b61" } : undefined}
        title={isRunning ? "Click to stop" : `Run ${selectedNodes.length} nodes`}
      >
        {isRunning ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin group-hover/runbtn:hidden" />
            <Square className="w-3.5 h-3.5 fill-current hidden group-hover/runbtn:block" />
            <span className="group-hover/runbtn:hidden">Running {selectedNodes.length}</span>
            <span className="hidden group-hover/runbtn:block">Stop</span>
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5" />
            <span>Run {selectedNodes.length}</span>
          </>
        )}
      </button>
    </div>
  );
}
