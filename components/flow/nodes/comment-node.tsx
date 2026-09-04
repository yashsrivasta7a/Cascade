"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { NodeProps } from "reactflow";
import { createPortal } from "react-dom";
import { useFlowStore } from "@/store";
import { cn } from "@/lib/utils";
import { MessageSquare, Trash2, Check } from "lucide-react";

// Available color themes for comments - with hex values for swatches
const COMMENT_COLORS = [
 { name: "Slate", bg: "bg-slate-900/80", border: "border-slate-700/50", accent: "bg-slate-500", text: "text-slate-200", muted: "text-slate-600", hex: "#64748b" },
 { name: "Blue", bg: "bg-blue-950/80", border: "border-blue-700/50", accent: "bg-blue-500", text: "text-blue-100", muted: "text-blue-300", hex: "#3b82f6" },
 { name: "Purple", bg: "bg-purple-950/80", border: "border-purple-700/50", accent: "bg-purple-500", text: "text-purple-100", muted: "text-purple-300", hex: "#a855f7" },
 { name: "Pink", bg: "bg-pink-950/80", border: "border-pink-700/50", accent: "bg-pink-500", text: "text-pink-100", muted: "text-pink-300", hex: "#ec4899" },
 { name: "Rose", bg: "bg-rose-950/80", border: "border-rose-700/50", accent: "bg-rose-500", text: "text-rose-100", muted: "text-rose-300", hex: "#f43f5e" },
 { name: "Orange", bg: "bg-orange-950/80", border: "border-orange-700/50", accent: "bg-orange-500", text: "text-orange-100", muted: "text-orange-300", hex: "#f97316" },
 { name: "Amber", bg: "bg-amber-950/80", border: "border-amber-700/50", accent: "bg-amber-500", text: "text-amber-100", muted: "text-amber-300", hex: "#f59e0b" },
 { name: "Yellow", bg: "bg-yellow-950/80", border: "border-yellow-700/50", accent: "bg-yellow-500", text: "text-yellow-100", muted: "text-yellow-300", hex: "#eab308" },
 { name: "Lime", bg: "bg-lime-950/80", border: "border-lime-700/50", accent: "bg-lime-500", text: "text-lime-100", muted: "text-lime-300", hex: "#84cc16" },
 { name: "Green", bg: "bg-green-950/80", border: "border-green-700/50", accent: "bg-green-500", text: "text-green-100", muted: "text-green-300", hex: "#22c55e" },
 { name: "Emerald", bg: "bg-emerald-950/80", border: "border-emerald-700/50", accent: "bg-emerald-500", text: "text-emerald-100", muted: "text-emerald-300", hex: "#10b981" },
 { name: "Teal", bg: "bg-teal-950/80", border: "border-teal-700/50", accent: "bg-teal-500", text: "text-teal-100", muted: "text-teal-300", hex: "#14b8a6" },
 { name: "Cyan", bg: "bg-cyan-950/80", border: "border-cyan-700/50", accent: "bg-cyan-500", text: "text-cyan-100", muted: "text-cyan-300", hex: "#06b6d4" },
 { name: "Sky", bg: "bg-sky-950/80", border: "border-sky-700/50", accent: "bg-sky-500", text: "text-sky-100", muted: "text-sky-300", hex: "#0ea5e9" },
 { name: "Indigo", bg: "bg-indigo-950/80", border: "border-indigo-700/50", accent: "bg-indigo-500", text: "text-indigo-100", muted: "text-indigo-300", hex: "#6366f1" },
 { name: "Violet", bg: "bg-violet-950/80", border: "border-violet-700/50", accent: "bg-violet-500", text: "text-violet-100", muted: "text-violet-300", hex: "#8b5cf6" },
];

export function getRandomColorIndex(): number {
 return Math.floor(Math.random() * COMMENT_COLORS.length);
}

export interface CommentNodeData {
 label: string;
 text?: string;
 title?: string;
 colorIndex?: number;
}

function CommentNodeComponent(props: NodeProps<CommentNodeData>) {
 const { data, id, selected } = props;
 const updateNode = useFlowStore((s) => s.updateNode);
 const deleteNode = useFlowStore((s) => s.deleteNode);
 const [isEditing, setIsEditing] = useState(false);
 const [isEditingTitle, setIsEditingTitle] = useState(false);
 const [isHovered, setIsHovered] = useState(false);
 const [showColorPicker, setShowColorPicker] = useState(false);
 const textareaRef = useRef<HTMLTextAreaElement>(null);
 const titleInputRef = useRef<HTMLInputElement>(null);
 const colorPickerRef = useRef<HTMLDivElement>(null);
 const dropdownRef = useRef<HTMLDivElement>(null);

 const colorIndex = data.colorIndex ?? 0;
 const colorTheme = COMMENT_COLORS[colorIndex] ?? COMMENT_COLORS[0];

 const handleTextChange = useCallback(
 (e: React.ChangeEvent<HTMLTextAreaElement>) => {
 updateNode(id, { text: e.target.value });
 },
 [id, updateNode]
 );

 const handleTitleChange = useCallback(
 (e: React.ChangeEvent<HTMLInputElement>) => {
 updateNode(id, { title: e.target.value });
 },
 [id, updateNode]
 );

 // Double click to edit for better UX
 const handleDoubleClick = useCallback((e: React.MouseEvent) => {
 e.stopPropagation();
 setIsEditing(true);
 }, []);

 const handleTitleDoubleClick = useCallback((e: React.MouseEvent) => {
 e.stopPropagation();
 setIsEditingTitle(true);
 }, []);

 const handleBlur = useCallback(() => {
 setIsEditing(false);
 }, []);

 const handleTitleBlur = useCallback(() => {
 setIsEditingTitle(false);
 }, []);

 const handleColorChange = useCallback((newColorIndex: number) => {
 updateNode(id, { colorIndex: newColorIndex });
 setShowColorPicker(false);
 }, [id, updateNode]);

 const handleDelete = useCallback(() => {
 deleteNode(id);
 }, [id, deleteNode]);

 const toggleColorPicker = useCallback((e: React.MouseEvent) => {
 e.stopPropagation();
 e.preventDefault();
 setShowColorPicker(prev => !prev);
 }, []);

 // Focus textarea when entering edit mode
 useEffect(() => {
 if (isEditing && textareaRef.current) {
 textareaRef.current.focus();
 const len = textareaRef.current.value.length;
 textareaRef.current.setSelectionRange(len, len);
 }
 }, [isEditing]);

 // Focus title input when entering edit mode
 useEffect(() => {
 if (isEditingTitle && titleInputRef.current) {
 titleInputRef.current.focus();
 titleInputRef.current.select();
 }
 }, [isEditingTitle]);

 // Close color picker when clicking outside (check both button and dropdown)
 useEffect(() => {
 if (!showColorPicker) return;
 
 const handleClickOutside = (e: MouseEvent) => {
 const target = e.target as Node;
 const isInsideButton = colorPickerRef.current?.contains(target);
 const isInsideDropdown = dropdownRef.current?.contains(target);
 
 if (!isInsideButton && !isInsideDropdown) {
 setShowColorPicker(false);
 }
 };
 
 // Use a small delay to avoid immediate close
 const timer = setTimeout(() => {
 document.addEventListener("mousedown", handleClickOutside);
 }, 10);
 
 return () => {
 clearTimeout(timer);
 document.removeEventListener("mousedown", handleClickOutside);
 };
 }, [showColorPicker]);

 // Handle keyboard shortcuts
 const handleKeyDown = useCallback(
 (e: React.KeyboardEvent) => {
 if (e.key === "Escape") {
 setIsEditing(false);
 setIsEditingTitle(false);
 setShowColorPicker(false);
 textareaRef.current?.blur();
 titleInputRef.current?.blur();
 }
 e.stopPropagation();
 },
 []
 );

 return (
 <div
 className={cn(
 "group relative w-[220px] min-h-[120px] transition-all duration-200 ease-out",
 "rounded-2xl overflow-hidden",
 colorTheme.bg,
 "border",
 colorTheme.border,
 " ",
 "shadow-xl shadow-black/20",
 selected && "ring-2 ring-white/30 ring-offset-2 ring-offset-transparent",
 isHovered && !selected && "shadow-2xl shadow-black/30 scale-[1.02]"
 )}
 onMouseEnter={() => setIsHovered(true)}
 onMouseLeave={() => setIsHovered(false)}
 onDoubleClick={handleDoubleClick}
 >
 {/* Decorative accent bar at top */}
 <div className={cn("h-1 w-full", colorTheme.accent)} />

 {/* Header with icon and editable title */}
 <div className="px-3 pt-2.5 pb-1 flex items-center gap-2">
 <div className={cn(
 "w-5 h-5 rounded-md flex items-center justify-center shrink-0",
 colorTheme.accent,
 "bg-opacity-20"
 )}>
 <MessageSquare className={cn("w-3 h-3", colorTheme.text)} strokeWidth={2.5} />
 </div>
 {isEditingTitle ? (
 <input
 ref={titleInputRef}
 type="text"
 value={data.title ?? ""}
 onChange={handleTitleChange}
 onBlur={handleTitleBlur}
 onKeyDown={handleKeyDown}
 placeholder="Note"
 className={cn(
 "flex-1 min-w-0 bg-transparent",
 "text-[10px] font-semibold uppercase tracking-wider",
 colorTheme.text,
 "placeholder:opacity-50",
 "focus:outline-none",
 "nodrag"
 )}
 autoFocus
 />
 ) : (
 <span 
 className={cn(
 "text-[10px] font-semibold uppercase tracking-wider cursor-text truncate",
 data.title ? colorTheme.text : colorTheme.muted
 )}
 onDoubleClick={handleTitleDoubleClick}
 title="Double-click to edit title"
 >
 {data.title || "Note"}
 </span>
 )}
 </div>

 {/* Content area */}
 <div className="px-3 pb-3 pt-1">
 {isEditing ? (
 <textarea
 ref={textareaRef}
 value={data.text ?? ""}
 onChange={handleTextChange}
 onBlur={handleBlur}
 onKeyDown={handleKeyDown}
 placeholder="Write something..."
 className={cn(
 "w-full min-h-[60px] resize-none bg-transparent",
 "text-[13px] leading-relaxed",
 colorTheme.text,
 "placeholder:opacity-50",
 "focus:outline-none",
 "nodrag nowheel"
 )}
 autoFocus
 />
 ) : (
 <div
 className={cn(
 "min-h-[60px] text-[13px] leading-relaxed cursor-text",
 "whitespace-pre-wrap break-words",
 data.text ? colorTheme.text : cn(colorTheme.muted, "opacity-60 italic")
 )}
 >
 {data.text || "Double-click to add a note..."}
 </div>
 )}
 </div>

 {/* Floating toolbar - appears on hover */}
 <div className={cn(
 "absolute top-2 right-2 flex items-center gap-1",
 "transition-all duration-200",
 (isHovered || showColorPicker) ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
 )}>
 {/* Color picker button */}
 <div className="relative" ref={colorPickerRef}>
 <button
 onClick={toggleColorPicker}
 className={cn(
 "w-6 h-6 rounded-lg flex items-center justify-center",
 "bg-black/30 hover:bg-black/50 backdrop-blur-sm",
 "border border-white/10 hover:border-white/20",
 "transition-all duration-150",
 "nodrag"
 )}
 title="Change color"
 >
 <div 
 className="w-3 h-3 rounded-full ring-1 ring-white/30"
 style={{ backgroundColor: colorTheme.hex }}
 />
 </button>

 {/* Inline color picker dropdown */}
 {showColorPicker && typeof document !== "undefined" && createPortal(
 <div
 ref={dropdownRef}
 className="fixed z-[9999]"
 style={{
 left: colorPickerRef.current?.getBoundingClientRect().left ?? 0,
 top: (colorPickerRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
 }}
 onClick={(e) => e.stopPropagation()}
 onMouseDown={(e) => e.stopPropagation()}
 >
 <div className={cn(
 "bg-zinc-900/95 ",
 "border border-white/10 rounded-xl",
 "shadow-2xl shadow-black/50",
 "p-2 w-[200px]",
 "animate-in fade-in-0 zoom-in-95 duration-150"
 )}>
 <div className="grid grid-cols-4 gap-1.5">
 {COMMENT_COLORS.map((color, index) => (
 <button
 key={color.name}
 onClick={(e) => {
 e.stopPropagation();
 e.preventDefault();
 handleColorChange(index);
 }}
 onMouseDown={(e) => e.stopPropagation()}
 className={cn(
 "w-10 h-10 rounded-lg transition-all duration-150",
 "hover:scale-110 hover:z-10",
 "flex items-center justify-center",
 "ring-1 ring-white/10",
 index === colorIndex && "ring-2 ring-white/60"
 )}
 style={{ backgroundColor: color.hex }}
 title={color.name}
 >
 {index === colorIndex && (
 <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
 )}
 </button>
 ))}
 </div>
 </div>
 </div>,
 document.body
 )}
 </div>

 {/* Delete button */}
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleDelete();
 }}
 className={cn(
 "w-6 h-6 rounded-lg flex items-center justify-center",
 "bg-black/30 hover:bg-red-500/80 backdrop-blur-sm",
 "border border-white/10 hover:border-red-400/50",
 "transition-all duration-150",
 "group/delete nodrag"
 )}
 title="Delete note"
 >
 <Trash2 className="w-3 h-3 text-slate-600 group-hover/delete:text-white transition-colors" />
 </button>
 </div>

 {/* Subtle corner decoration */}
 <div className={cn(
 "absolute bottom-0 right-0 w-8 h-8",
 "bg-gradient-to-tl from-white/5 to-transparent",
 "rounded-tl-2xl pointer-events-none"
 )} />
 </div>
 );
}

export const CommentNode = memo(CommentNodeComponent);
export { COMMENT_COLORS };
