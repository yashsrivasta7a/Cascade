"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { NodeProps } from "reactflow";
import { createPortal } from "react-dom";
import { useFlowStore } from "@/store";
import { cn } from "@/lib/utils";
import { Palette } from "lucide-react";

// Available color themes for comments - with hex values for swatches
const COMMENT_COLORS = [
  { name: "Zinc", bg: "from-zinc-500/10 to-zinc-600/5", border: "border-zinc-500/20", glow: "shadow-zinc-500/10", hex: "#71717a" },
  { name: "Blue", bg: "from-blue-500/10 to-blue-600/5", border: "border-blue-500/20", glow: "shadow-blue-500/10", hex: "#3b82f6" },
  { name: "Purple", bg: "from-purple-500/10 to-purple-600/5", border: "border-purple-500/20", glow: "shadow-purple-500/10", hex: "#a855f7" },
  { name: "Pink", bg: "from-pink-500/10 to-pink-600/5", border: "border-pink-500/20", glow: "shadow-pink-500/10", hex: "#ec4899" },
  { name: "Rose", bg: "from-rose-500/10 to-rose-600/5", border: "border-rose-500/20", glow: "shadow-rose-500/10", hex: "#f43f5e" },
  { name: "Orange", bg: "from-orange-500/10 to-orange-600/5", border: "border-orange-500/20", glow: "shadow-orange-500/10", hex: "#f97316" },
  { name: "Amber", bg: "from-amber-500/10 to-amber-600/5", border: "border-amber-500/20", glow: "shadow-amber-500/10", hex: "#f59e0b" },
  { name: "Yellow", bg: "from-yellow-500/10 to-yellow-600/5", border: "border-yellow-500/20", glow: "shadow-yellow-500/10", hex: "#eab308" },
  { name: "Lime", bg: "from-lime-500/10 to-lime-600/5", border: "border-lime-500/20", glow: "shadow-lime-500/10", hex: "#84cc16" },
  { name: "Green", bg: "from-green-500/10 to-green-600/5", border: "border-green-500/20", glow: "shadow-green-500/10", hex: "#22c55e" },
  { name: "Emerald", bg: "from-emerald-500/10 to-emerald-600/5", border: "border-emerald-500/20", glow: "shadow-emerald-500/10", hex: "#10b981" },
  { name: "Teal", bg: "from-teal-500/10 to-teal-600/5", border: "border-teal-500/20", glow: "shadow-teal-500/10", hex: "#14b8a6" },
  { name: "Cyan", bg: "from-cyan-500/10 to-cyan-600/5", border: "border-cyan-500/20", glow: "shadow-cyan-500/10", hex: "#06b6d4" },
  { name: "Sky", bg: "from-sky-500/10 to-sky-600/5", border: "border-sky-500/20", glow: "shadow-sky-500/10", hex: "#0ea5e9" },
  { name: "Indigo", bg: "from-indigo-500/10 to-indigo-600/5", border: "border-indigo-500/20", glow: "shadow-indigo-500/10", hex: "#6366f1" },
  { name: "Violet", bg: "from-violet-500/10 to-violet-600/5", border: "border-violet-500/20", glow: "shadow-violet-500/10", hex: "#8b5cf6" },
];

export function getRandomColorIndex(): number {
  return Math.floor(Math.random() * COMMENT_COLORS.length);
}

export interface CommentNodeData {
  label: string;
  text?: string;
  colorIndex?: number;
}

function CommentNodeComponent(props: NodeProps<CommentNodeData>) {
  const { data, id, selected } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const [isEditing, setIsEditing] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const colorIndex = data.colorIndex ?? 0;
  const colorTheme = COMMENT_COLORS[colorIndex] ?? COMMENT_COLORS[0];

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNode(id, { text: e.target.value });
    },
    [id, updateNode]
  );

  // Single click to edit
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
    }
  }, [isEditing]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX + 8, y: e.clientY - 20 });
    setShowColorMenu(true);
  }, []);

  const handleColorChange = useCallback((newColorIndex: number) => {
    updateNode(id, { colorIndex: newColorIndex });
    setShowColorMenu(false);
  }, [id, updateNode]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Close color menu when clicking anywhere
  useEffect(() => {
    if (!showColorMenu) return;
    
    const handleClick = () => {
      setShowColorMenu(false);
    };
    
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClick);
      document.addEventListener("contextmenu", handleClick);
    }, 0);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("contextmenu", handleClick);
    };
  }, [showColorMenu]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsEditing(false);
        setShowColorMenu(false);
        textareaRef.current?.blur();
      }
      e.stopPropagation();
    },
    []
  );

  return (
    <>
      <div
        className={cn(
          "group relative rounded-xl transition-all duration-300",
          "bg-gradient-to-br backdrop-blur-xl backdrop-saturate-150",
          colorTheme.bg,
          "border",
          colorTheme.border,
          "shadow-lg",
          colorTheme.glow,
          selected && "ring-1 ring-white/20",
          "w-[200px] h-[100px]"
        )}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        <div className="p-3 h-full relative">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={data.text ?? ""}
              onChange={handleTextChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Add a note..."
              className={cn(
                "w-full h-full resize-none bg-transparent",
                "text-xs text-zinc-200 placeholder-zinc-500",
                "focus:outline-none",
                "nodrag nowheel"
              )}
            />
          ) : (
            <div
              className={cn(
                "w-full h-full text-xs cursor-text whitespace-pre-wrap overflow-hidden",
                data.text ? "text-zinc-200" : "text-zinc-500 italic"
              )}
            >
              {data.text || "Click to add note..."}
            </div>
          )}
        </div>

        {!isEditing && (
          <div className="absolute bottom-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] text-zinc-600">Right-click for colors</span>
          </div>
        )}
      </div>

      {/* Color picker menu - themed to match app */}
      {showColorMenu && typeof document !== "undefined" && createPortal(
        <div
          className="fixed z-[9999] overflow-hidden rounded-2xl"
          style={{
            left: menuPosition.x,
            top: menuPosition.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glass background */}
          <div className="relative bg-black/70 backdrop-blur-2xl backdrop-saturate-150 border border-white/[0.08] shadow-2xl shadow-black/50 rounded-2xl p-4">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent rounded-2xl pointer-events-none" />
            
            {/* Header */}
            <div className="relative flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
                <Palette className="w-3 h-3 text-zinc-400" />
              </div>
              <span className="text-xs font-medium text-zinc-300">Note Color</span>
            </div>
            
            {/* Color grid */}
            <div className="relative grid grid-cols-4 gap-2">
              {COMMENT_COLORS.map((color, index) => (
                <button
                  key={color.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleColorChange(index);
                  }}
                  className={cn(
                    "w-8 h-8 rounded-xl transition-all duration-200",
                    "hover:scale-110 hover:shadow-lg",
                    "border border-white/10",
                    index === colorIndex && "ring-2 ring-white/60 ring-offset-2 ring-offset-black/50 scale-110"
                  )}
                  style={{
                    backgroundColor: color.hex,
                  }}
                  title={color.name}
                />
              ))}
            </div>

            {/* Current color indicator */}
            <div className="relative mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">Selected</span>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-md border border-white/20"
                  style={{ backgroundColor: colorTheme.hex }}
                />
                <span className="text-[10px] text-zinc-400">{colorTheme.name}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export const CommentNode = memo(CommentNodeComponent);
export { COMMENT_COLORS };
