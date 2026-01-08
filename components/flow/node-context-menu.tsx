"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  Copy,
  Settings,
  Play,
  Unlink,
  Image,
  Film,
  Volume2,
  Brain,
  Wrench,
  Upload,
} from "lucide-react";
import { useFlowStore } from "@/store";
import { NODE_DEFINITIONS, type AINodeType, type NodeCategory } from "@/types/nodes";

const categoryIcons: Record<NodeCategory, React.ReactNode> = {
  input: <Upload className="w-3.5 h-3.5" />,
  image: <Image className="w-3.5 h-3.5" />,
  video: <Film className="w-3.5 h-3.5" />,
  audio: <Volume2 className="w-3.5 h-3.5" />,
  llm: <Brain className="w-3.5 h-3.5" />,
  utility: <Wrench className="w-3.5 h-3.5" />,
};

interface NodeContextMenuProps {
  onOpenSettings?: () => void;
}

export function NodeContextMenu({ onOpenSettings }: NodeContextMenuProps) {
  const { selectedNode, deleteNode, selectNode, duplicateNode, edges, setEdges } = useFlowStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!selectedNode) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Check if clicking on a node or the menu itself
        const target = e.target as HTMLElement;
        if (!target.closest(".react-flow__node") && !target.closest("[data-context-menu]")) {
          selectNode(null);
        }
      }
    };

    // Delay to prevent immediate close on selection
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedNode, selectNode]);

  // Disconnect all edges from this node
  const handleDisconnect = useCallback(() => {
    if (!selectedNode) return;
    const newEdges = edges.filter(
      (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
    );
    setEdges(newEdges);
  }, [selectedNode, edges, setEdges]);

  const handleDelete = useCallback(() => {
    if (!selectedNode) return;
    deleteNode(selectedNode.id);
    selectNode(null);
  }, [selectedNode, deleteNode, selectNode]);

  const handleDuplicate = useCallback(() => {
    if (!selectedNode) return;
    duplicateNode(selectedNode.id);
  }, [selectedNode, duplicateNode]);

  if (!selectedNode) return null;

  const nodeType = selectedNode.type as AINodeType;
  const nodeDef = NODE_DEFINITIONS[nodeType];
  if (!nodeDef) return null;

  // Get connected edges count
  const connectedEdgesCount = edges.filter(
    (edge) => edge.source === selectedNode.id || edge.target === selectedNode.id
  ).length;

  // Calculate position near the node
  const nodePosition = selectedNode.position;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        data-context-menu
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        transition={{ type: "spring", damping: 25, stiffness: 400 }}
        className="absolute z-50 pointer-events-auto"
        style={{
          left: nodePosition.x + 200,
          top: nodePosition.y - 20,
        }}
      >
        <div className="bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
            <span className="text-zinc-400">{categoryIcons[nodeDef.category]}</span>
            <span className="text-xs font-medium text-zinc-200 truncate flex-1">
              {nodeDef.label}
            </span>
            <button
              onClick={() => selectNode(null)}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Actions */}
          <div className="p-1">
            {onOpenSettings && (
              <button
                onClick={() => {
                  onOpenSettings();
                  selectNode(null);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-zinc-300 hover:bg-white/5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-zinc-500" />
                Configure
              </button>
            )}

            <button
              onClick={handleDuplicate}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-zinc-500" />
              Duplicate
            </button>

            {connectedEdgesCount > 0 && (
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-amber-300 hover:bg-amber-500/10 transition-colors"
              >
                <Unlink className="w-3.5 h-3.5 text-amber-500" />
                Disconnect All ({connectedEdgesCount})
              </button>
            )}

            <div className="my-1 h-px bg-white/5" />

            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Node
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default NodeContextMenu;



