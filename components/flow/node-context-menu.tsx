"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
 X,
 Trash2,
 Copy,
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
 io: <Upload className="w-3.5 h-3.5" />,
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
 // Individually selected — see node-inspector.tsx for the same reasoning.
 const selectedNode = useFlowStore((s) => s.selectedNode);
 const contextMenuPosition = useFlowStore((s) => s.contextMenuPosition);
 const deleteNode = useFlowStore((s) => s.deleteNode);
 const selectNode = useFlowStore((s) => s.selectNode);
 const setContextMenuPosition = useFlowStore((s) => s.setContextMenuPosition);
 const duplicateNode = useFlowStore((s) => s.duplicateNode);
 const edges = useFlowStore((s) => s.edges);
 const setEdges = useFlowStore((s) => s.setEdges);
 const menuRef = useRef<HTMLDivElement>(null);

 // Close menu helper
 const closeMenu = useCallback(() => {
 selectNode(null);
 setContextMenuPosition(null);
 }, [selectNode, setContextMenuPosition]);

 // Close on click outside
 useEffect(() => {
 if (!selectedNode || !contextMenuPosition) return;

 const handleClickOutside = (e: MouseEvent) => {
 if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
 // Check if clicking on the menu itself
 const target = e.target as HTMLElement;
 if (!target.closest("[data-context-menu]")) {
 closeMenu();
 }
 }
 };

 // Close on Escape
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === "Escape") {
 closeMenu();
 }
 };

 // Delay to prevent immediate close on selection
 const timer = setTimeout(() => {
 document.addEventListener("mousedown", handleClickOutside);
 document.addEventListener("keydown", handleKeyDown);
 }, 100);

 return () => {
 clearTimeout(timer);
 document.removeEventListener("mousedown", handleClickOutside);
 document.removeEventListener("keydown", handleKeyDown);
 };
 }, [selectedNode, contextMenuPosition, closeMenu]);

 // Disconnect all edges from this node
 const handleDisconnect = useCallback(() => {
 if (!selectedNode) return;
 const newEdges = edges.filter(
 (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
 );
 setEdges(newEdges);
 closeMenu();
 }, [selectedNode, edges, setEdges, closeMenu]);

 const handleDelete = useCallback(() => {
 if (!selectedNode) return;
 deleteNode(selectedNode.id);
 closeMenu();
 }, [selectedNode, deleteNode, closeMenu]);

 const handleDuplicate = useCallback(() => {
 if (!selectedNode) return;
 duplicateNode(selectedNode.id);
 closeMenu();
 }, [selectedNode, duplicateNode, closeMenu]);

 // Don't render if no node selected or no position
 if (!selectedNode || !contextMenuPosition) return null;

 const nodeType = selectedNode.type as AINodeType;
 const nodeDef = NODE_DEFINITIONS[nodeType];
 if (!nodeDef) return null;

 // Get connected edges count
 const connectedEdgesCount = edges.filter(
 (edge) => edge.source === selectedNode.id || edge.target === selectedNode.id
 ).length;

 return (
 <AnimatePresence>
 <motion.div
 ref={menuRef}
 data-context-menu
 initial={{ opacity: 0, scale: 0.9 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.9 }}
 transition={{ type: "spring", damping: 25, stiffness: 400 }}
 className="fixed z-[100] pointer-events-auto"
 style={{
 left: contextMenuPosition.x,
 top: contextMenuPosition.y,
 }}
 >
 <div className="shadow-2xl bg-white dark:bg-[#1a1a1a] border border-blue-100 dark:border-white/10 rounded-xl overflow-hidden min-w-[180px] shadow-black/10 dark:shadow-black/50">
 {/* Header */}
 <div className="px-3 py-2 border-gray-100 dark:border-white/10 flex items-center gap-2 bg-white dark:bg-white/5">
 <span className="text-slate-700 dark:text-zinc-400">{categoryIcons[nodeDef.category]}</span>
 <span className="text-xs font-medium text-slate-900 dark:text-zinc-200 truncate flex-1">
 {nodeDef.label}
 </span>
 <button
 onClick={closeMenu}
 className="p-1 rounded text-slate-800 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
 >
 <X className="w-3 h-3" />
 </button>
 </div>

 {/* Actions */}
 <div className="p-1.5">
 <button
 onClick={handleDuplicate}
 className="text-xs w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
 >
 <Copy className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-500" />
 Duplicate
 </button>

 {connectedEdgesCount > 0 && (
 <button
 onClick={handleDisconnect}
 className="text-xs w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
 >
 <Unlink className="w-3.5 h-3.5 text-amber-500" />
 Disconnect All ({connectedEdgesCount})
 </button>
 )}

 <div className="my-1.5 h-px bg-white dark:bg-white/10" />

 <button
 onClick={handleDelete}
 className="text-xs w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
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



