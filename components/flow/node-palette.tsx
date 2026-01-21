"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
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
  HelpCircle,
  Palette,
  ArrowRightLeft,
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
import { formatCredits, creditsToDollars } from "@/lib/credits";

// =============================================================================
// PRICING INFO - Human-readable pricing details for each node
// =============================================================================

const nodePricingInfo: Record<AINodeType, { priceLabel: string; priceNote: string }> = {
  seedream: {
    priceLabel: "$0.04/image",
    priceNote: "Fixed price per image generation",
  },
  seedvr: {
    priceLabel: "$0.001/megapixel",
    priceNote: "Cost scales with output resolution",
  },
  seedance: {
    priceLabel: "$0.26/5s 720p",
    priceNote: "With audio • Cost scales with resolution & duration",
  },
  elevenlabs: {
    priceLabel: "$0.1/1K chars",
    priceNote: "Cost scales with text length",
  },
  openrouter: {
    priceLabel: "~$0.05 avg",
    priceNote: "Varies by model (GPT-4, Claude, etc.)",
  },
  lipsync: {
    priceLabel: "$0.70/minute",
    priceNote: "Cost scales with video duration",
  },
  "crop-image": {
    priceLabel: "$0.001",
    priceNote: "Basic image processing",
  },
  "merge-videos": {
    priceLabel: "$0.005",
    priceNote: "FFmpeg video processing",
  },
  "merge-audio-video": {
    priceLabel: "$0.003",
    priceNote: "FFmpeg audio/video merge",
  },
  "extract-audio": {
    priceLabel: "$0.002",
    priceNote: "FFmpeg audio extraction",
  },
  comment: {
    priceLabel: "Free",
    priceNote: "Annotation only, no processing",
  },
  "input": {
    priceLabel: "Free",
    priceNote: "Workflow input node (text, image, video, or audio)",
  },
  "output": {
    priceLabel: "Free",
    priceNote: "Workflow output node",
  },
  "image-input": {
    priceLabel: "Free",
    priceNote: "Image input node",
  },
  "video-input": {
    priceLabel: "Free",
    priceNote: "Video input node",
  },
  "audio-input": {
    priceLabel: "Free",
    priceNote: "Audio input node",
  },
};

// =============================================================================
// CONFIG
// =============================================================================

const categoryIcons: Record<NodeCategory, React.ReactNode> = {
  image: <Image className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  audio: <Volume2 className="w-4 h-4" />,
  llm: <Brain className="w-4 h-4" />,
  utility: <Wrench className="w-4 h-4" />,
  io: <ArrowRightLeft className="w-4 h-4" />,
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
    gradient: "from-emerald-500 to-green-500",
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
    bg: "bg-teal-500/15", 
    border: "border-teal-500/30", 
    text: "text-teal-400", 
    accent: "from-teal-500/20",
    solid: "#14b8a6",
    gradient: "from-teal-500 to-cyan-500",
  },
  llm: { 
    bg: "bg-blue-500/15", 
    border: "border-blue-500/30", 
    text: "text-blue-400", 
    accent: "from-blue-500/20",
    solid: "#3b82f6",
    gradient: "from-blue-500 to-sky-500",
  },
  utility: { 
    bg: "bg-amber-500/15", 
    border: "border-amber-500/30", 
    text: "text-amber-400", 
    accent: "from-amber-500/20",
    solid: "#f59e0b",
    gradient: "from-amber-500 to-yellow-500",
  },
  io: { 
    bg: "bg-zinc-500/15", 
    border: "border-zinc-500/30", 
    text: "text-zinc-400", 
    accent: "from-zinc-500/20",
    solid: "#71717a",
    gradient: "from-zinc-500 to-gray-500",
  },
};

const categoryOrder: NodeCategory[] = ["io", "llm", "image", "video", "audio", "utility"];

// Output type badge colors - includes all data types (media + settings)
const outputTypeBadge: Record<DataType, { bg: string; text: string }> = {
  // Media types
  text: { bg: "bg-blue-500/20", text: "text-blue-400" },
  image: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  video: { bg: "bg-violet-500/20", text: "text-violet-400" },
  audio: { bg: "bg-teal-500/20", text: "text-teal-400" },
  any: { bg: "bg-zinc-500/20", text: "text-zinc-400" },
  // Settings types
  prompt: { bg: "bg-sky-500/20", text: "text-sky-400" },
  negative: { bg: "bg-red-500/20", text: "text-red-400" },
  seed: { bg: "bg-lime-500/20", text: "text-lime-400" },
  aspectRatio: { bg: "bg-indigo-500/20", text: "text-indigo-400" },
  duration: { bg: "bg-amber-500/20", text: "text-amber-400" },
  model: { bg: "bg-rose-500/20", text: "text-rose-400" },
  temperature: { bg: "bg-orange-500/20", text: "text-orange-400" },
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
  const [showColorHelp, setShowColorHelp] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  
  // Calculate popup position when shown
  useEffect(() => {
    if (showColorHelp && helpButtonRef.current) {
      const rect = helpButtonRef.current.getBoundingClientRect();
      // Position popup below the button, aligned to left edge of button
      // but ensure it doesn't go off the right side of the screen
      const popupWidth = 288; // w-72 = 18rem = 288px
      let left = rect.left;
      
      // If popup would overflow right side, align to right edge of button instead
      if (left + popupWidth > window.innerWidth - 16) {
        left = rect.right - popupWidth;
      }
      
      // Ensure it doesn't go off the left side either
      if (left < 16) {
        left = 16;
      }
      
      setPopupPosition({
        top: rect.bottom + 8,
        left,
      });
    }
  }, [showColorHelp]);

  // Hide old separate input nodes and comment node from palette
  const hiddenNodeTypes = ["image-input", "video-input", "audio-input", "comment"];
  
  const filteredNodes = Object.values(NODE_DEFINITIONS).filter((node) => {
    // Hide old separate input nodes
    if (hiddenNodeTypes.includes(node.type)) return false;
    
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
        className="w-72 h-full bg-white dark:bg-black/60 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl border border-gray-200 dark:border-white/[0.08] flex flex-col overflow-hidden shadow-xl shadow-gray-200/80 dark:shadow-2xl dark:shadow-black/40 relative"
      >
        {/* Dot Pattern */}
        {/* Dots removed - now only on ReactFlow background */}

        {/* Header - Glass highlight */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500 dark:bg-blue-500/20 border border-blue-600 dark:border-blue-500/30 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white dark:text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Nodes</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Color Help Button */}
              <button
                ref={helpButtonRef}
                onClick={() => setShowColorHelp(!showColorHelp)}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  showColorHelp 
                    ? "text-gray-900 dark:text-white bg-gray-200 dark:bg-white/10" 
                    : "text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5"
                )}
                title="Color scheme guide"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-600" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-10 pr-3 rounded-xl bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-sm text-gray-700 dark:text-zinc-300 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-gray-300 dark:focus:border-white/20 focus:bg-white dark:focus:bg-white/[0.05] transition-all"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                !activeCategory
                  ? "bg-gray-900 dark:bg-white text-white dark:text-black"
                  : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/10"
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
                      : "bg-gray-100 dark:bg-white/[0.02] border-transparent text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/[0.05]"
                  )}
                >
                  {categoryIcons[cat]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Node List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
          {filteredNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center mb-3">
                <Search className="w-5 h-5 text-gray-400 dark:text-zinc-700" />
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-500 text-center">No nodes found</p>
              <p className="text-xs text-gray-400 dark:text-zinc-600 text-center mt-1">Try a different search term</p>
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
                      <span className="text-[10px] text-gray-400 dark:text-zinc-600 ml-auto">{nodes.length}</span>
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

        {/* Footer - Glass highlight */}
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500 dark:text-zinc-600 flex items-center gap-1.5">
              <GripVertical className="w-3 h-3" />
              Drag to canvas
            </p>
            <span className="text-[10px] text-gray-500 dark:text-zinc-600">{filteredNodes.length} nodes</span>
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
            className="absolute left-[calc(100%+8px)] top-4 w-80 max-h-[calc(100vh-160px)] bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-white/[0.1] rounded-2xl shadow-xl shadow-gray-300/50 dark:shadow-2xl dark:shadow-black/50 overflow-y-auto z-50 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10 scrollbar-track-transparent"
          >
            <NodeInfoCard node={hoveredNodeData} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color Help Popup - Rendered via Portal to escape overflow:hidden */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {showColorHelp && (
            <>
              {/* Backdrop to close popup when clicking outside */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9998]"
                onClick={() => setShowColorHelp(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  top: popupPosition.top,
                  left: popupPosition.left,
                }}
                className="w-64 bg-[#161616] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/60 z-[9999] overflow-hidden backdrop-blur-xl"
              >
                {/* Header */}
                <div className="px-3 py-2.5 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                    <Palette className="w-3.5 h-3.5 text-white/70" />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-white/90">Color Guide</h4>
                    <p className="text-[10px] text-white/40">Understanding node connections</p>
                  </div>
                </div>

                {/* Node Categories */}
                <div className="p-3 border-b border-white/[0.06]">
                  <p className="text-[10px] text-white/40 mb-2.5">Node Categories</p>
                  <div className="space-y-1.5">
                    {[
                      { icon: Brain, label: "LLM / Vision", desc: "AI text & vision", color: "#3b82f6" },
                      { icon: Image, label: "Image", desc: "Generate images", color: "#10b981" },
                      { icon: Film, label: "Video", desc: "Generate videos", color: "#8b5cf6" },
                      { icon: Volume2, label: "Audio", desc: "Text to speech", color: "#14b8a6" },
                      { icon: Wrench, label: "Utility", desc: "Process media", color: "#f59e0b" },
                    ].map((item) => (
                      <div 
                        key={item.label}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-[#0f0f0f] hover:bg-white/[0.04] transition-colors cursor-default border border-white/[0.04]"
                      >
                        <div 
                          className="w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: `${item.color}15` }}
                        >
                          <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-medium text-white/80">{item.label}</p>
                          <p className="text-[9px] text-white/30">{item.desc}</p>
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Types - What connections carry */}
                <div className="p-3 border-b border-white/[0.06]">
                  <p className="text-[10px] text-white/40 mb-2.5">Connection Types</p>
                  <p className="text-[9px] text-white/30 mb-2">Colors show what data flows between nodes</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "Text", desc: "Prompts, responses", color: "#3b82f6" },
                      { label: "Image", desc: "Image files", color: "#10b981" },
                      { label: "Video", desc: "Video files", color: "#8b5cf6" },
                      { label: "Audio", desc: "Audio files", color: "#14b8a6" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 px-2 py-1 rounded bg-[#0f0f0f]">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[10px] text-white/60 flex-1">{item.label}</span>
                        <span className="text-[9px] text-white/30">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tip */}
                <div className="p-3 bg-white/[0.02]">
                  <p className="text-[9px] text-white/40 leading-relaxed">
                    <span className="text-white/50">Tip:</span> Connect matching colors for compatible data types. 
                    The colored dots on inputs show what type of data they accept.
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
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
          ? `bg-gray-100 dark:bg-white/[0.06] ${colors.border}` 
          : "bg-gray-50 dark:bg-white/[0.02] border-transparent hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:border-gray-200 dark:hover:border-white/[0.06]"
      )}
    >
      {/* Icon */}
      <div 
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
          "border transition-all",
          isHovered ? `${colors.bg} ${colors.border}` : "bg-gray-100 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.06]"
        )}
        style={{ color: isHovered ? colors.solid : undefined }}
      >
        {categoryIcons[node.category]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[13px] font-medium truncate transition-colors",
          isHovered ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-zinc-300"
        )}>
          {node.label}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-zinc-500 truncate">
          {node.action}
        </p>
      </div>

      {/* Cost Badge */}
      {node.estimatedCost > 0 && (
        <div 
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
            isHovered ? colors.bg : "bg-gray-100 dark:bg-white/[0.04]",
          )}
          style={{ color: isHovered ? colors.solid : "#71717a" }}
          title={nodePricingInfo[node.type]?.priceLabel}
        >
          <Zap className="w-3 h-3" />
          <span>{formatCredits(node.estimatedCost)}</span>
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
        className="p-4 border-b border-gray-100 dark:border-white/[0.04]"
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
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{node.label}</h3>
              <p className="text-[11px] text-gray-500 dark:text-zinc-500">{node.provider}</p>
            </div>
          </div>
          <div className={cn("px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1", outputBadge.bg, outputBadge.text)}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dataTypeColors[outputType]?.solid }} />
            {outputType}
          </div>
        </div>
        <p className="text-[12px] text-gray-600 dark:text-zinc-400 mt-3 leading-relaxed">
          {node.description}
        </p>
      </div>

      {/* Pricing Section */}
      <div className="p-4 border-b border-gray-100 dark:border-white/[0.04]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-gradient-to-br dark:from-amber-500/20 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {nodePricingInfo[node.type]?.priceLabel || "Free"}
              </span>
              {node.estimatedCost > 0 && (
                <span className="text-xs text-gray-500 dark:text-zinc-500">
                  ≈ {formatCredits(node.estimatedCost)} credits
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-500 leading-relaxed">
              {nodePricingInfo[node.type]?.priceNote || "No cost for this operation"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Time */}
        {node.estimatedTime && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-zinc-500">Time</p>
              <p className="text-xs font-medium text-gray-900 dark:text-white">{node.estimatedTime}</p>
            </div>
          </div>
        )}

        {/* Aspect Ratios */}
        {node.aspectRatios && node.aspectRatios.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center">
              <Monitor className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-zinc-500">Aspect</p>
              <p className="text-xs font-medium text-gray-900 dark:text-white">{node.aspectRatios.slice(0, 3).join(", ")}</p>
            </div>
          </div>
        )}

        {/* Resolutions */}
        {node.resolutions && node.resolutions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-zinc-500">Resolution</p>
              <p className="text-xs font-medium text-gray-900 dark:text-white">{node.resolutions.join(", ")}</p>
            </div>
          </div>
        )}

        {/* Models */}
        {node.models && node.models.length > 0 && (
          <div className="flex items-center gap-2 col-span-2">
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-zinc-500">Models</p>
              <p className="text-xs font-medium text-gray-900 dark:text-white">{node.models.join(", ")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      {node.features && node.features.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2">Features</p>
          <div className="flex flex-wrap gap-1.5">
            {node.features.map((feature) => (
              <span 
                key={feature}
                className="px-2 py-1 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-white/[0.04]"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Inputs/Outputs */}
      <div className="px-4 pb-3 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] text-gray-500 dark:text-zinc-500 mb-1">Inputs</p>
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
          <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.06]" />
          <div>
            <p className="text-[10px] text-gray-500 dark:text-zinc-500 mb-1">Output</p>
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

      {/* Estimation Note */}
      {node.estimatedCost > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[10px] text-gray-400 dark:text-zinc-600 leading-relaxed italic">
            * Costs are estimates and may vary based on input parameters. 
            Actual credits will be deducted after execution.
          </p>
        </div>
      )}
    </div>
  );
}
