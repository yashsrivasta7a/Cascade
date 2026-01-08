"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Image,
  Film,
  Volume2,
  Brain,
  Wrench,
  Coins,
  X,
  Sparkles,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NODE_DEFINITIONS,
  CATEGORY_META,
  type NodeCategory,
  type AINodeType,
} from "@/types/nodes";

// =============================================================================
// CONFIG
// =============================================================================

const categoryIcons: Record<NodeCategory, React.ReactNode> = {
  image: <Image className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  audio: <Volume2 className="w-4 h-4" />,
  llm: <Brain className="w-4 h-4" />,
  utility: <Wrench className="w-4 h-4" />,
};

const categoryColors: Record<NodeCategory, { bg: string; border: string; text: string; accent: string }> = {
  llm: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", accent: "from-violet-500/20" },
  image: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", accent: "from-emerald-500/20" },
  video: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", accent: "from-rose-500/20" },
  audio: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", accent: "from-amber-500/20" },
  utility: { bg: "bg-sky-500/10", border: "border-sky-500/20", text: "text-sky-400", accent: "from-sky-500/20" },
};

const categoryOrder: NodeCategory[] = ["llm", "image", "video", "audio", "utility"];

// =============================================================================
// COMPONENT
// =============================================================================

interface NodePaletteProps {
  onDragStart?: (event: React.DragEvent, nodeType: string) => void;
  onClose?: () => void;
}

export function NodePalette({ onDragStart, onClose }: NodePaletteProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<NodeCategory | null>(null);

  const filteredNodes = Object.values(NODE_DEFINITIONS).filter((node) => {
    const matchesSearch = !search || 
      node.label.toLowerCase().includes(search.toLowerCase()) ||
      node.provider.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || node.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Group nodes by category for display
  const groupedNodes = categoryOrder.reduce((acc, category) => {
    const nodes = filteredNodes.filter(n => n.category === category);
    if (nodes.length > 0) {
      acc[category] = nodes;
    }
    return acc;
  }, {} as Record<NodeCategory, typeof filteredNodes>);

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
    onDragStart?.(event, nodeType);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-72 h-full bg-zinc-950 rounded-2xl border border-zinc-800/60 flex flex-col overflow-hidden shadow-2xl shadow-black/40"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <span className="text-sm font-semibold text-zinc-200">Nodes</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-10 pr-3 rounded-xl bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:bg-zinc-900 transition-all"
          />
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              !activeCategory
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            )}
          >
            All
          </button>
          {categoryOrder.map((cat) => {
            const colors = categoryColors[cat];
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  isActive
                    ? `${colors.bg} ${colors.border} ${colors.text}`
                    : "bg-zinc-900/50 border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
                )}
              >
                {categoryIcons[cat]}
                <span className="hidden sm:inline">{CATEGORY_META[cat].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
              <Search className="w-5 h-5 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-500 text-center">No nodes found</p>
            <p className="text-xs text-zinc-600 text-center mt-1">Try a different search term</p>
          </div>
        ) : activeCategory ? (
          // Single category view
          <div className="p-2">
            <AnimatePresence mode="popLayout">
              {filteredNodes.map((node, idx) => (
                <NodeCard
                  key={node.type}
                  node={node}
                  index={idx}
                  onDragStart={handleDragStart}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          // Grouped by category view
          <div className="py-2">
            {Object.entries(groupedNodes).map(([category, nodes]) => {
              const cat = category as NodeCategory;
              const colors = categoryColors[cat];
              
              return (
                <div key={category} className="mb-3">
                  {/* Category Header */}
                  <div className="px-4 py-2 flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-md", colors.bg, colors.text)}>
                      {categoryIcons[cat]}
                    </div>
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", colors.text)}>
                      {CATEGORY_META[cat].label}
                    </span>
                    <span className="text-[10px] text-zinc-600 ml-auto">{nodes.length}</span>
                  </div>
                  
                  {/* Nodes */}
                  <div className="px-2 space-y-1">
                    {nodes.map((node, idx) => (
                      <NodeCard
                        key={node.type}
                        node={node}
                        index={idx}
                        onDragStart={handleDragStart}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-zinc-800/50 bg-zinc-900/30">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-zinc-600 flex items-center gap-1.5">
            <GripVertical className="w-3 h-3" />
            Drag to canvas
          </p>
          <span className="text-[10px] text-zinc-600">{filteredNodes.length} nodes</span>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// NODE CARD COMPONENT
// =============================================================================

interface NodeCardProps {
  node: typeof NODE_DEFINITIONS[AINodeType];
  index: number;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

function NodeCard({ node, index, onDragStart }: NodeCardProps) {
  const colors = categoryColors[node.category];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      draggable
      onDragStart={(e) => onDragStart(e, node.type)}
      className={cn(
        "group relative flex items-center gap-3 p-3 rounded-xl cursor-grab active:cursor-grabbing transition-all",
        "bg-zinc-900/40 hover:bg-zinc-800/60",
        "border border-transparent hover:border-zinc-700/50",
        "hover:shadow-lg hover:shadow-black/20"
      )}
    >
      {/* Accent gradient on hover */}
      <div className={cn(
        "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
        "bg-gradient-to-r to-transparent",
        colors.accent
      )} />

      {/* Icon */}
      <div className={cn(
        "relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
        "border transition-all",
        colors.bg, colors.border, colors.text,
        "group-hover:scale-105"
      )}>
        {categoryIcons[node.category]}
      </div>

      {/* Info */}
      <div className="relative flex-1 min-w-0">
        <p className="text-[13px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
          {node.label}
        </p>
        <p className="text-[11px] text-zinc-500 truncate">
          {node.provider}
        </p>
      </div>

      {/* Cost Badge */}
      <div className={cn(
        "relative flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium",
        "bg-zinc-800/50 text-zinc-500",
        "opacity-0 group-hover:opacity-100 transition-opacity"
      )}>
        <Coins className="w-3 h-3" />
        <span>{node.estimatedCost || 0}</span>
      </div>
    </motion.div>
  );
}
