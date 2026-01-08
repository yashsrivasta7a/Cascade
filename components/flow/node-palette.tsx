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
  X,
  Sparkles,
  GripVertical,
  Clock,
  Zap,
  Layers,
  Wand2,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NODE_DEFINITIONS,
  CATEGORY_META,
  type NodeCategory,
  type AINodeType,
  type DataType,
  dataTypeColors,
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

// Vibrant category colors matching main UI
const categoryColors: Record<NodeCategory, { 
  bg: string; 
  border: string; 
  text: string; 
  accent: string;
  solid: string;
  gradient: string;
}> = {
  image: { 
    bg: "bg-emerald-500/15", 
    border: "border-emerald-500/30", 
    text: "text-emerald-400", 
    accent: "from-emerald-500/20",
    solid: "#10b981",
    gradient: "from-emerald-500 to-teal-500",
  },
  video: { 
    bg: "bg-violet-500/15", 
    border: "border-violet-500/30", 
    text: "text-violet-400", 
    accent: "from-violet-500/20",
    solid: "#8b5cf6",
    gradient: "from-violet-500 to-purple-500",
  },
  audio: { 
    bg: "bg-amber-500/15", 
    border: "border-amber-500/30", 
    text: "text-amber-400", 
    accent: "from-amber-500/20",
    solid: "#f59e0b",
    gradient: "from-amber-500 to-orange-500",
  },
  llm: { 
    bg: "bg-blue-500/15", 
    border: "border-blue-500/30", 
    text: "text-blue-400", 
    accent: "from-blue-500/20",
    solid: "#3b82f6",
    gradient: "from-blue-500 to-cyan-500",
  },
  utility: { 
    bg: "bg-zinc-500/15", 
    border: "border-zinc-500/30", 
    text: "text-zinc-400", 
    accent: "from-zinc-500/20",
    solid: "#71717a",
    gradient: "from-zinc-500 to-slate-500",
  },
};

const categoryOrder: NodeCategory[] = ["llm", "image", "video", "audio", "utility"];

// Output type badge colors
const outputTypeBadge: Record<DataType, { bg: string; text: string }> = {
  text: { bg: "bg-blue-500/20", text: "text-blue-400" },
  image: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  video: { bg: "bg-violet-500/20", text: "text-violet-400" },
  audio: { bg: "bg-amber-500/20", text: "text-amber-400" },
  any: { bg: "bg-zinc-500/20", text: "text-zinc-400" },
  negative: { bg: "bg-red-500/20", text: "text-red-400" },
  number: { bg: "bg-pink-500/20", text: "text-pink-400" },
  boolean: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
};

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
  const [hoveredNode, setHoveredNode] = useState<AINodeType | null>(null);

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

  const hoveredNodeData = hoveredNode ? NODE_DEFINITIONS[hoveredNode] : null;

  return (
    <div className="relative flex h-full max-h-[calc(100vh-120px)]">
      {/* Main Palette */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-72 h-full bg-[#0a0a0a] rounded-2xl border border-white/[0.06] flex flex-col overflow-hidden shadow-2xl shadow-black/50"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">Nodes</span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-all"
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
              className="w-full h-9 pl-10 pr-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                !activeCategory
                  ? "bg-white text-black"
                  : "bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10"
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
                      : "bg-white/[0.02] border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]"
                  )}
                >
                  {categoryIcons[cat]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Node List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {filteredNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
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
                    onHover={setHoveredNode}
                    isHovered={hoveredNode === node.type}
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
                  <div key={category} className="mb-4">
                    {/* Category Header */}
                    <div className="px-4 py-2 flex items-center gap-2">
                      <div 
                        className={cn("p-1.5 rounded-lg", colors.bg)}
                        style={{ color: colors.solid }}
                      >
                        {categoryIcons[cat]}
                      </div>
                      <span 
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: colors.solid }}
                      >
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
                          onHover={setHoveredNode}
                          isHovered={hoveredNode === node.type}
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
        <div className="px-4 py-2.5 border-t border-white/[0.04] bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-600 flex items-center gap-1.5">
              <GripVertical className="w-3 h-3" />
              Drag to canvas
            </p>
            <span className="text-[10px] text-zinc-600">{filteredNodes.length} nodes</span>
          </div>
        </div>
      </motion.div>

      {/* Hover Info Card */}
      <AnimatePresence>
        {hoveredNodeData && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="absolute left-[calc(100%+8px)] top-4 w-80 max-h-[calc(100vh-160px)] bg-[#0d0d0d] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-y-auto z-50 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          >
            <NodeInfoCard node={hoveredNodeData} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// NODE CARD COMPONENT (in list)
// =============================================================================

interface NodeCardProps {
  node: typeof NODE_DEFINITIONS[AINodeType];
  index: number;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  onHover: (nodeType: AINodeType | null) => void;
  isHovered: boolean;
}

function NodeCard({ node, index, onDragStart, onHover, isHovered }: NodeCardProps) {
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
      onMouseEnter={() => onHover(node.type)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "group relative flex items-center gap-3 p-3 rounded-xl cursor-grab active:cursor-grabbing transition-all",
        "border",
        isHovered 
          ? `bg-white/[0.06] ${colors.border}` 
          : "bg-white/[0.02] border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]"
      )}
    >
      {/* Icon */}
      <div 
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
          "border transition-all",
          isHovered ? `${colors.bg} ${colors.border}` : "bg-white/[0.04] border-white/[0.06]"
        )}
        style={{ color: isHovered ? colors.solid : undefined }}
      >
        {categoryIcons[node.category]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[13px] font-medium truncate transition-colors",
          isHovered ? "text-white" : "text-zinc-300"
        )}>
          {node.label}
        </p>
        <p className="text-[11px] text-zinc-500 truncate">
          {node.provider}
        </p>
      </div>

      {/* Cost Badge */}
      {node.estimatedCost > 0 && (
        <div 
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
            isHovered ? colors.bg : "bg-white/[0.04]",
          )}
          style={{ color: isHovered ? colors.solid : "#71717a" }}
        >
          <Zap className="w-3 h-3" />
          <span>{node.estimatedCost}</span>
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// NODE INFO CARD (hover popup)
// =============================================================================

interface NodeInfoCardProps {
  node: typeof NODE_DEFINITIONS[AINodeType];
}

function NodeInfoCard({ node }: NodeInfoCardProps) {
  const colors = categoryColors[node.category];
  const outputType = node.outputs[0]?.type || "any";
  const outputBadge = outputTypeBadge[outputType];

  return (
    <div>
      {/* Header with gradient */}
      <div 
        className="p-4 border-b border-white/[0.04]"
        style={{ 
          background: `linear-gradient(135deg, ${colors.solid}15 0%, transparent 50%)` 
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div 
              className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors.bg, colors.border, "border")}
              style={{ color: colors.solid }}
            >
              {categoryIcons[node.category]}
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">{node.label}</h3>
              <p className="text-[11px] text-zinc-500">{node.provider}</p>
            </div>
          </div>
          <div className={cn("px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1", outputBadge.bg, outputBadge.text)}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dataTypeColors[outputType]?.solid }} />
            {outputType}
          </div>
        </div>
        <p className="text-[12px] text-zinc-400 mt-3 leading-relaxed">
          {node.description}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Time */}
        {node.estimatedTime && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Time</p>
              <p className="text-xs font-medium text-white">{node.estimatedTime}</p>
            </div>
          </div>
        )}

        {/* Cost */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Credits</p>
            <p className="text-xs font-medium text-white">{node.estimatedCost || "Free"}</p>
          </div>
        </div>

        {/* Aspect Ratios */}
        {node.aspectRatios && node.aspectRatios.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
              <Monitor className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Aspect</p>
              <p className="text-xs font-medium text-white">{node.aspectRatios.slice(0, 3).join(", ")}</p>
            </div>
          </div>
        )}

        {/* Resolutions */}
        {node.resolutions && node.resolutions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Resolution</p>
              <p className="text-xs font-medium text-white">{node.resolutions.join(", ")}</p>
            </div>
          </div>
        )}

        {/* Models */}
        {node.models && node.models.length > 0 && (
          <div className="flex items-center gap-2 col-span-2">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Models</p>
              <p className="text-xs font-medium text-white">{node.models.join(", ")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      {node.features && node.features.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Features</p>
          <div className="flex flex-wrap gap-1.5">
            {node.features.map((feature) => (
              <span 
                key={feature}
                className="px-2 py-1 rounded-md text-[10px] font-medium bg-white/[0.04] text-zinc-400 border border-white/[0.04]"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Inputs/Outputs */}
      <div className="px-4 pb-4 pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] text-zinc-500 mb-1">Inputs</p>
            <div className="flex gap-1">
              {node.inputs.map((input, i) => {
                const typeColor = dataTypeColors[input.type];
                return (
                  <div 
                    key={i}
                    className="w-4 h-4 rounded-full border-2"
                    style={{ 
                      borderColor: typeColor?.solid,
                      backgroundColor: `${typeColor?.solid}30`,
                    }}
                    title={input.label}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex-1 h-px bg-white/[0.06]" />
          <div>
            <p className="text-[10px] text-zinc-500 mb-1">Output</p>
            <div className="flex gap-1">
              {node.outputs.map((output, i) => {
                const typeColor = dataTypeColors[output.type];
                return (
                  <div 
                    key={i}
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: typeColor?.solid }}
                    title={output.label}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
