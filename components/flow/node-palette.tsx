"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  GripVertical,
  Image,
  Film,
  Volume2,
  Brain,
  Wrench,
  Upload,
  ChevronDown,
  Sparkles,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui";
import {
  NODE_DEFINITIONS,
  CATEGORY_META,
  type NodeCategory,
  type AINodeType,
} from "@/types/nodes";

const categoryIcons: Record<NodeCategory, React.ReactNode> = {
  input: <Upload className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  audio: <Volume2 className="w-4 h-4" />,
  llm: <Brain className="w-4 h-4" />,
  utility: <Wrench className="w-4 h-4" />,
};

const colorStyles: Record<string, string> = {
  emerald: "bg-white/[0.03] text-zinc-200 border-white/10 hover:border-white/20",
  violet: "bg-white/[0.03] text-zinc-200 border-white/10 hover:border-white/20",
  amber: "bg-white/[0.03] text-zinc-200 border-white/10 hover:border-white/20",
  blue: "bg-white/[0.03] text-zinc-200 border-white/10 hover:border-white/20",
  zinc: "bg-white/[0.03] text-zinc-200 border-white/10 hover:border-white/20",
};

const categoryOrder: NodeCategory[] = ["input", "image", "video", "audio", "llm", "utility"];

interface NodePaletteProps {
  onDragStart?: (event: React.DragEvent, nodeType: string) => void;
}

export function NodePalette({ onDragStart }: NodePaletteProps) {
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<NodeCategory>>(
    new Set(categoryOrder)
  );

  const toggleCategory = (category: NodeCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const nodesByCategory = categoryOrder.reduce((acc, category) => {
    acc[category] = Object.values(NODE_DEFINITIONS).filter(
      (node) => node.category === category
    );
    return acc;
  }, {} as Record<NodeCategory, typeof NODE_DEFINITIONS[AINodeType][]>);

  const filteredNodesByCategory = categoryOrder.reduce((acc, category) => {
    acc[category] = nodesByCategory[category].filter(
      (node) =>
        node.label.toLowerCase().includes(search.toLowerCase()) ||
        node.description.toLowerCase().includes(search.toLowerCase()) ||
        node.provider.toLowerCase().includes(search.toLowerCase())
    );
    return acc;
  }, {} as Record<NodeCategory, typeof NODE_DEFINITIONS[AINodeType][]>);

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
    onDragStart?.(event, nodeType);
  };

  const hasResults = Object.values(filteredNodesByCategory).some(
    (nodes) => nodes.length > 0
  );

  return (
    <div className="w-72 h-full bg-zinc-950/80 backdrop-blur-xl border-r border-white/5 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center border border-white/10">
            <Sparkles className="w-4 h-4 text-zinc-200" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">AI Nodes</h2>
            <p className="text-[10px] text-zinc-500">12 pipeline operations</p>
          </div>
        </div>
        <Input
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="h-9 bg-zinc-900/50 border-white/5"
        />
      </div>

      {/* Node List by Category */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!hasResults && search && (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-500">No nodes match "{search}"</p>
          </div>
        )}

        {categoryOrder.map((category) => {
          const nodes = filteredNodesByCategory[category];
          if (nodes.length === 0) return null;

          const meta = CATEGORY_META[category];
          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="border-b border-white/5 last:border-0">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">
                    {categoryIcons[category]}
                  </span>
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                    {nodes.length}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-zinc-500 transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              {/* Category Nodes */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-1.5">
                      {nodes.map((node) => (
                        <motion.div
                          key={node.type}
                          draggable
                          onDragStart={(e) => handleDragStart(e, node.type)}
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            "group relative flex items-center gap-3 p-3 rounded-xl border cursor-grab active:cursor-grabbing",
                            "transition-all duration-200",
                            colorStyles[node.color]
                          )}
                        >
                          {/* Node Icon */}
                          <div className="flex-shrink-0 relative">
                            {categoryIcons[node.category]}
                          </div>

                          {/* Node Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white truncate">
                                {node.label}
                              </p>
                            </div>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {node.description}
                            </p>
                          </div>

                          {/* Cost Badge */}
                          <div className="flex flex-col items-end gap-1">
                            {node.estimatedCost > 0 ? (
                              <div className="flex items-center gap-1 text-[10px] text-zinc-300 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                                <Coins className="w-2.5 h-2.5" />
                                {node.estimatedCost}
                              </div>
                            ) : (
                              <div className="text-[10px] text-zinc-300 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                                Free
                              </div>
                            )}
                            <GripVertical className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 bg-zinc-900/30">
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>Drag to canvas</span>
          <div className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-zinc-300" />
            <span>= credits per run</span>
          </div>
        </div>
      </div>
    </div>
  );
}
