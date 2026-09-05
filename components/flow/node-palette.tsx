"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
 Search,
 Image,
 Film,
 Volume2,
 MessageSquareText,
 Wrench,
 X,
 Plus,
 Clock,
 Zap,
 Layers,
 SlidersHorizontal,
 Monitor,
 HelpCircle,
 Palette,
 ArrowRightLeft,
 LayoutGrid,
 GripVertical,
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
 image: <Image className="w-4 h-4" strokeWidth={1.75} />,
 video: <Film className="w-4 h-4" strokeWidth={1.75} />,
 audio: <Volume2 className="w-4 h-4" strokeWidth={1.75} />,
 llm: <MessageSquareText className="w-4 h-4" strokeWidth={1.75} />,
 utility: <Wrench className="w-4 h-4" strokeWidth={1.75} />,
 io: <ArrowRightLeft className="w-4 h-4" strokeWidth={1.75} />,
};

/**
 * Palette category colours.
 *
 * Was saturated Tailwind 500s plus a two-stop gradient per category. Gradients
 * on categorical chips are decoration — they encode nothing a flat swatch does
 * not — and the saturation made the palette the loudest panel on screen.
 *
 * Now one muted hue per category, matched to the node accent and edge palettes
 * so a green chip in the palette and a green wire on the canvas mean the same
 * thing. `gradient` is kept in the shape (consumers still read it) but resolves
 * to a flat fill.
 */
const categoryColors: Record<NodeCategory, {
 bg: string;
 border: string;
 text: string;
 accent: string;
 solid: string;
 gradient: string;
}> = {
 image: {
 bg: "bg-[#86b79c]/12",
 border: "border-[#86b79c]/25",
 text: "text-[#86b79c]",
 accent: "from-[#86b79c]/15",
 solid: "#86b79c",
 gradient: "from-[#86b79c] to-[#86b79c]",
 },
 video: {
 bg: "bg-[#a094c4]/12",
 border: "border-[#a094c4]/25",
 text: "text-[#a094c4]",
 accent: "from-[#a094c4]/15",
 solid: "#a094c4",
 gradient: "from-[#a094c4] to-[#a094c4]",
 },
 audio: {
 bg: "bg-[#8cc4bd]/12",
 border: "border-[#8cc4bd]/25",
 text: "text-[#8cc4bd]",
 accent: "from-[#8cc4bd]/15",
 solid: "#8cc4bd",
 gradient: "from-[#8cc4bd] to-[#8cc4bd]",
 },
 llm: {
 bg: "bg-[#8fa8c8]/12",
 border: "border-[#8fa8c8]/25",
 text: "text-[#8fa8c8]",
 accent: "from-[#8fa8c8]/15",
 solid: "#8fa8c8",
 gradient: "from-[#8fa8c8] to-[#8fa8c8]",
 },
 utility: {
 bg: "bg-[#c9ac83]/12",
 border: "border-[#c9ac83]/25",
 text: "text-[#c9ac83]",
 accent: "from-[#c9ac83]/15",
 solid: "#c9ac83",
 gradient: "from-[#c9ac83] to-[#c9ac83]",
 },
 io: {
 bg: "bg-[#8a8a92]/12",
 border: "border-[#8a8a92]/25",
 text: "text-[#8a8a92]",
 accent: "from-[#8a8a92]/15",
 solid: "#8a8a92",
 gradient: "from-[#8a8a92] to-[#8a8a92]",
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
 any: { bg: "bg-zinc-500/20", text: "text-slate-600" },
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
  onNodeClick?: (nodeType: string) => void;
  onClose?: () => void;
}

export function NodePalette({ onDragStart, onNodeClick, onClose }: NodePaletteProps) {
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
 className="w-[min(18rem,calc(100vw-1.5rem))] h-full bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden shadow-gray-300/40 dark:shadow-black/50 relative"
 >
 {/* Dot Pattern */}
 {/* Dots removed - now only on ReactFlow background */}

 {/* Header - Glass highlight */}
 <div className="px-4 py-3 border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-zinc-800 dark:bg-white/10 border border-zinc-700 dark:border-white/20 flex items-center justify-center">
 <LayoutGrid className="w-3.5 h-3.5 text-white dark:text-white/80" strokeWidth={1.75} />
 </div>
 <span className="text-sm font-semibold text-slate-900 dark:text-white">Nodes</span>
 </div>
 <div className="flex items-center gap-1">
 {/* Color Help Button */}
 <button
 ref={helpButtonRef}
 onClick={() => setShowColorHelp(!showColorHelp)}
 className={cn(
 "p-1.5 rounded-lg transition-all",
 showColorHelp 
 ? "text-slate-900 dark:text-white bg-gray-200 dark:bg-white/10" 
 : "text-slate-800 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-slate-700 hover:bg-gray-100 dark:hover:bg-white/5"
 )}
 title="Color scheme guide"
 >
 <HelpCircle className="w-4 h-4" strokeWidth={1.75} />
 </button>
 
 {onClose && (
 <button
 onClick={onClose}
 className="p-1.5 rounded-lg text-slate-800 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-slate-700 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
 >
 <X className="w-4 h-4" strokeWidth={1.75} />
 </button>
 )}
 </div>
 </div>

 {/* Search */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-800 dark:text-zinc-600" strokeWidth={1.75} />
 <input
 type="text"
 placeholder="Search nodes..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full h-9 pl-10 pr-3 rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:border-gray-300 dark:focus:border-white/20 focus:bg-white dark:focus:bg-white/[0.05] transition-all"
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
 : "bg-white dark:bg-white/5 text-slate-700 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-slate-700 hover:bg-gray-200 dark:hover:bg-white/10"
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
 : "bg-white dark:bg-white/[0.02] border-transparent text-slate-700 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-slate-700 hover:bg-gray-200 dark:hover:bg-white/[0.05]"
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
 <div className="w-12 h-12 rounded-2xl bg-white dark:bg-white/5 border border-blue-100 dark:border-white/10 flex items-center justify-center mb-3">
 <Search className="w-5 h-5 text-slate-800 dark:text-zinc-700" strokeWidth={1.75} />
 </div>
 <p className="text-xs dark:text-zinc-500 text-center">No nodes found</p>
 <p className="dark:text-zinc-600 text-center mt-1">Try a different search term</p>
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
 onClick={onNodeClick ? () => onNodeClick(node.type) : undefined}
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
 <span className="text-[10px] text-slate-800 dark:text-zinc-600 ml-auto">{nodes.length}</span>
 </div>
 
 {/* Nodes */}
 <div className="px-2 space-y-1">
 {nodes.map((node, idx) => (
 <NodeCard
 key={node.type}
 node={node}
 index={idx}
 onDragStart={handleDragStart}
 onClick={onNodeClick ? () => onNodeClick(node.type) : undefined}
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
 <div className="px-4 py-2.5 border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03]">
 <div className="text-[10px] flex items-center justify-between">
 <p className="text-[10px] text-slate-700 dark:text-zinc-600 flex items-center gap-1.5">
 <GripVertical className="w-3.5 h-3.5" strokeWidth={1.75} />
 Drag to canvas
 </p>
 <span className="text-[10px] text-slate-700 dark:text-zinc-600">{filteredNodes.length} nodes</span>
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
 className="absolute left-[calc(100%+8px)] top-4 w-80 max-h-[calc(100vh-160px)] bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl shadow-gray-300/50 dark:shadow-black/50 overflow-y-auto z-50 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10 scrollbar-track-transparent"
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
 className="shadow-2xl w-64 bg-[#161616] border border-white/[0.08] rounded-xl shadow-black/60 z-[9999] overflow-hidden"
 >
 {/* Header */}
 <div className="px-3 py-2.5 border-white/[0.06] bg-gray-50 dark:bg-white/[0.03] flex items-center gap-2.5">
 <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
 <Palette className="w-3.5 h-3.5 text-white/70" strokeWidth={1.75} />
 </div>
 <div>
 <h4 className="text-xs font-medium text-white/90">Color Guide</h4>
 <p className="text-[10px] text-white/40">Understanding node connections</p>
 </div>
 </div>

 {/* Node Categories */}
 <div className="text-[10px] p-3 border-white/[0.06]">
 <p className="text-[10px] text-white/40 mb-2.5">Node Categories</p>
 <div className="space-y-1.5">
 {[
 { icon: MessageSquareText, label: "LLM / Vision", desc: "Text & vision models", color: "#3b82f6" },
 { icon: Image, label: "Image", desc: "Generate images", color: "#10b981" },
 { icon: Film, label: "Video", desc: "Generate videos", color: "#8b5cf6" },
 { icon: Volume2, label: "Audio", desc: "Audio processing", color: "#14b8a6" },
 { icon: Wrench, label: "Utility", desc: "Media utilities", color: "#f59e0b" },
 ].map((item) => (
 <div 
 key={item.label}
 className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-[#0f0f0f] hover:bg-gray-100 dark:hover:bg-white/[0.06]/[0.04] transition-colors cursor-default border border-white/[0.04]"
 >
 <div 
 className="w-6 h-6 rounded-md flex items-center justify-center"
 style={{ backgroundColor: `${item.color}15` }}
 >
 <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
 </div>
 <div className="text-[11px] flex-1">
 <p className="text-[11px] font-medium text-white/80">{item.label}</p>
 <p className="text-white/30">{item.desc}</p>
 </div>
 <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
 </div>
 ))}
 </div>
 </div>

 {/* Data Types - What connections carry */}
 <div className="text-[10px] p-3 border-white/[0.06]">
 <p className="text-[9px] text-white/40 mb-2.5">Connection Types</p>
 <p className="text-white/30 mb-2">Colors show what data flows between nodes</p>
 <div className="space-y-1.5">
 {[
 { label: "Text", desc: "Prompts, responses", color: "#3b82f6" },
 { label: "Image", desc: "Image files", color: "#10b981" },
 { label: "Video", desc: "Video files", color: "#8b5cf6" },
 { label: "Audio", desc: "Audio files", color: "#14b8a6" },
 ].map((item) => (
 <div key={item.label} className="flex items-center gap-2 px-2 py-1 rounded bg-[#0f0f0f]">
 <div className="text-[10px] w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
 <span className="text-[9px] text-white/60 flex-1">{item.label}</span>
 <span className="text-white/30">{item.desc}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Tip */}
 <div className="text-[9px] p-3 bg-gray-50 dark:bg-white/[0.03]">
 <p className="text-white/40 leading-relaxed">
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
  onClick?: () => void;
  onHover: (nodeType: AINodeType | null) => void;
  isHovered: boolean;
}

function NodeCard({ node, index, onDragStart, onClick, onHover, isHovered }: NodeCardProps) {
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
 onClick={onClick}
 onMouseEnter={() => onHover(node.type)}
 onMouseLeave={() => onHover(null)}
 className={cn(
 "group relative flex items-center gap-3 p-3 rounded-xl transition-all",
 onClick ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
 "border",
 isHovered 
 ? `bg-gray-50 dark:bg-white/[0.05] ${colors.border}` 
 : "bg-white dark:bg-white/[0.02] border-transparent hover:bg-gray-50 dark:hover:bg-white/[0.05] hover:border-gray-200 dark:hover:border-white/10"
 )}
 >
 {/* Icon */}
 <div 
 className={cn(
 "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
 "border transition-all",
 isHovered ? `${colors.bg} ${colors.border}` : "bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/10"
 )}
 style={{ color: isHovered ? colors.solid : undefined }}
 >
 {categoryIcons[node.category]}
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <p className={cn(
 "text-[13px] font-medium truncate transition-colors",
 isHovered ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-zinc-300"
 )}>
 {node.label}
 </p>
 <p className="text-[11px] text-slate-700 dark:text-zinc-500 truncate">
 {node.action}
 </p>
 </div>

 {/* Cost Badge */}
 {node.estimatedCost > 0 && (
 <div 
 className={cn(
 "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
 isHovered ? colors.bg : "bg-white dark:bg-white/[0.04]",
 )}
 style={{ color: isHovered ? colors.solid : "#71717a" }}
 title={nodePricingInfo[node.type]?.priceLabel}
 >
 <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
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
 className="p-4 border-gray-200 dark:border-white/10"
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
 <h3 className="font-semibold dark:text-white text-sm">{node.label}</h3>
 <p className="text-[11px] text-slate-700 dark:text-zinc-500">{node.provider}</p>
 </div>
 </div>
 <div className={cn("px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1", outputBadge.bg, outputBadge.text)}>
 <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dataTypeColors[outputType]?.solid }} />
 {outputType}
 </div>
 </div>
 <p className="text-[12px] text-slate-800 dark:text-zinc-400 mt-3 leading-relaxed">
 {node.description}
 </p>
 </div>

 {/* Pricing Section */}
 <div className="p-4 border-gray-200 dark:border-white/10">
 <div className="flex items-start gap-3">
 <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-gradient-to-br dark:from-amber-500/20 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center flex-shrink-0">
 <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-lg flex items-baseline gap-2 mb-0.5">
 <span className="font-bold text-slate-900 dark:text-white">
 {nodePricingInfo[node.type]?.priceLabel || "Free"}
 </span>
 {node.estimatedCost > 0 && (
 <span className="text-[11px] text-slate-700 dark:text-zinc-500">
 ≈ {formatCredits(node.estimatedCost)} credits
 </span>
 )}
 </div>
 <p className="text-[11px] text-slate-700 dark:text-zinc-500 leading-relaxed">
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
 <div className="w-7 h-7 rounded-lg bg-white dark:bg-white/[0.04] flex items-center justify-center">
 <Clock className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-500" strokeWidth={1.75} />
 </div>
 <div>
 <p className="text-[11px] text-slate-700 dark:text-zinc-500">Time</p>
 <p className="text-xs font-medium text-slate-900 dark:text-white">{node.estimatedTime}</p>
 </div>
 </div>
 )}

 {/* Aspect Ratios */}
 {node.aspectRatios && node.aspectRatios.length > 0 && (
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-white dark:bg-white/[0.04] flex items-center justify-center">
 <Monitor className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-500" strokeWidth={1.75} />
 </div>
 <div>
 <p className="text-xs text-slate-700 dark:text-zinc-500">Aspect</p>
 <p className="font-medium text-slate-900 dark:text-white">{node.aspectRatios.slice(0, 3).join(", ")}</p>
 </div>
 </div>
 )}

 {/* Resolutions */}
 {node.resolutions && node.resolutions.length > 0 && (
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-white dark:bg-white/[0.04] flex items-center justify-center">
 <Layers className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-500" strokeWidth={1.75} />
 </div>
 <div>
 <p className="text-xs text-slate-700 dark:text-zinc-500">Resolution</p>
 <p className="font-medium text-slate-900 dark:text-white">{node.resolutions.join(", ")}</p>
 </div>
 </div>
 )}

 {/* Models */}
 {node.models && node.models.length > 0 && (
 <div className="flex items-center gap-2 col-span-2">
 <div className="w-7 h-7 rounded-lg bg-white dark:bg-white/[0.04] flex items-center justify-center">
 <MessageSquareText className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-500" strokeWidth={1.75} />
 </div>
 <div>
 <p className="text-xs text-slate-700 dark:text-zinc-500">Models</p>
 <p className="font-medium text-slate-900 dark:text-white">{node.models.join(", ")}</p>
 </div>
 </div>
 )}
 </div>

 {/* Features */}
 {node.features && node.features.length > 0 && (
 <div className="text-[10px] px-4 pb-4">
 <p className="text-slate-700 dark:text-zinc-500 uppercase tracking-wider mb-2">Features</p>
 <div className="flex flex-wrap gap-1.5">
 {node.features.map((feature) => (
 <span 
 key={feature}
 className="px-2 py-1 rounded-md font-medium bg-white dark:bg-white/[0.04] text-slate-700 dark:text-zinc-400 border border-gray-200 dark:border-white/10"
 >
 {feature}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Inputs/Outputs */}
 <div className="px-4 pb-3 pt-2 border-gray-200 dark:border-white/10">
 <div className="flex items-center gap-4">
 <div>
 <p className="text-slate-700 dark:text-zinc-500 mb-1">Inputs</p>
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
 <p className="text-slate-700 dark:text-zinc-500 mb-1">Output</p>
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
 <div className="text-[10px] px-4 pb-4">
 <p className="text-slate-800 dark:text-zinc-600 leading-relaxed italic">
 * Costs are estimates and may vary based on input parameters. 
 Actual credits will be deducted after execution.
 </p>
 </div>
 )}
 </div>
 );
}
