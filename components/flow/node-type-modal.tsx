"use client";

import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Image,
  Film,
  Volume2,
  Brain,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NODE_DEFINITIONS,
  type NodeCategory,
  type AINodeType,
} from "@/types/nodes";
import { formatCredits } from "@/lib/credits";

interface NodeTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (nodeType: AINodeType) => void;
}

const categoryIcon: Record<NodeCategory, React.ReactNode> = {
  image: <Image className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  audio: <Volume2 className="w-4 h-4" />,
  llm: <Brain className="w-4 h-4" />,
  utility: <Wrench className="w-4 h-4" />,
};

const categoryColor: Record<NodeCategory, string> = {
  image: "text-emerald-400",
  video: "text-violet-400",
  audio: "text-amber-400",
  llm: "text-blue-400",
  utility: "text-zinc-400",
};

export function NodeTypeModal({
  isOpen,
  onClose,
  onSelect,
}: NodeTypeModalProps) {
  const [search, setSearch] = useState("");

  const allNodes = useMemo(() => Object.values(NODE_DEFINITIONS), []);

  const filteredNodes = useMemo(() => {
    if (!search) return allNodes;
    const q = search.toLowerCase();
    return allNodes.filter((node) =>
      node.label.toLowerCase().includes(q) ||
      node.action.toLowerCase().includes(q)
    );
  }, [search, allNodes]);

  const handleSelect = useCallback((nodeType: AINodeType) => {
    onSelect(nodeType);
    setSearch("");
  }, [onSelect]);

  const handleClose = useCallback(() => {
    onClose();
    setSearch("");
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
          className="relative w-full max-w-[380px] mx-4"
        >
          <div className="bg-[#09090b]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Add Node</span>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Search */}
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
                <input
                  type="text"
                  placeholder="Search nodes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full h-10 pl-10 pr-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 focus:bg-black/60 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Node List */}
            <div className="max-h-[400px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {filteredNodes.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <Search className="w-5 h-5 text-zinc-600" />
                  </div>
                  <p className="text-sm font-medium text-zinc-400">No nodes found</p>
                  <p className="text-xs text-zinc-600 mt-1">Try searching for something else</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredNodes.map((node) => (
                    <button
                      key={node.type}
                      onClick={() => handleSelect(node.type)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-xl",
                        "hover:bg-white/[0.04] transition-all text-left group border border-transparent hover:border-white/5"
                      )}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg",
                        "bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10",
                        "group-hover:border-white/20 group-hover:from-white/10 group-hover:to-white/5 transition-all",
                        categoryColor[node.category]
                      )}>
                        {categoryIcon[node.category]}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                            {node.label}
                          </span>
                          {node.estimatedCost > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono bg-white/[0.02] px-1.5 py-0.5 rounded border border-white/5">
                              <Zap className="w-2.5 h-2.5" />
                              {formatCredits(node.estimatedCost)}
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate group-hover:text-zinc-400 transition-colors">
                          {node.action}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-white/5 bg-white/[0.02] backdrop-blur-sm flex justify-between items-center">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">
                {filteredNodes.length} Available
              </span>
              <div className="flex gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                 <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                 <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
