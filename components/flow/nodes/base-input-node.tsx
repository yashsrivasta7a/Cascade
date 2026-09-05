"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
 Upload,
 X,
 Loader2,
 Image as ImageIcon,
 Film,
 Volume2,
 Play,
 Pause,
} from "lucide-react";
import { useFlowStore } from "@/store";
import { dataTypeColors, type DataType } from "@/types/nodes";
import { showError, showWarning } from "@/lib/toast";
import { formatTime } from "@/lib/format";
import { useDarkMode } from "@/hooks/use-dark-mode";

// =============================================================================
// TYPES
// =============================================================================

export interface BaseInputNodeData {
 label: string;
 value?: string | null;
 [key: string]: unknown;
}

export interface BaseInputNodeProps extends NodeProps<BaseInputNodeData> {
 mediaType: "image" | "video" | "audio";
 accept: string;
 color: "emerald" | "violet" | "teal";
}

// =============================================================================
// COMPONENT
// =============================================================================

function BaseInputNodeComponent({
 data,
 selected,
 id,
 mediaType,
 accept,
 color,
}: BaseInputNodeProps) {
 const updateNode = useFlowStore((s) => s.updateNode);
 const propagateOutput = useFlowStore((s) => s.propagateOutput);
 const setNodeUploading = useFlowStore((s) => s.setNodeUploading);

 const [isDragOver, setIsDragOver] = useState(false);
 const [isUploading, setIsUploading] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Audio playback state
 const audioRef = useRef<HTMLAudioElement>(null);
 const [audioPlaying, setAudioPlaying] = useState(false);
 const [audioCurrentTime, setAudioCurrentTime] = useState(0);
 const [audioDuration, setAudioDuration] = useState(0);
 const [audioLoaded, setAudioLoaded] = useState(false);

 // Check dark mode
 const isDarkMode = useDarkMode();

 const value = data.value;
 const handleColor = dataTypeColors[mediaType as DataType];

 const FileIcon =
 mediaType === "image" ? ImageIcon : mediaType === "video" ? Film : Volume2;

 // Accent colors
 const accentColors: Record<string, string> = {
 emerald: "#10b981",
 violet: "#8b5cf6",
 teal: "#14b8a6",
 };
 const accentColor = accentColors[color];

 // Toggle audio playback
 const toggleAudioPlayback = useCallback((e: React.MouseEvent) => {
 e.stopPropagation();
 const audio = audioRef.current;
 if (!audio) return;

 if (audioPlaying) {
 audio.pause();
 } else {
 audio.play().catch((err) => {
 console.warn("[BaseInputNode] Audio play failed:", err);
 });
 }
 }, [audioPlaying]);

 // Handle audio seek
 const handleAudioSeek = useCallback(
 (e: React.MouseEvent<HTMLDivElement>) => {
 e.stopPropagation();
 const audio = audioRef.current;
 if (!audio || !audioDuration) return;

 const rect = e.currentTarget.getBoundingClientRect();
 const clickX = e.clientX - rect.left;
 const percentage = clickX / rect.width;
 audio.currentTime = Math.max(
 0,
 Math.min(percentage * audioDuration, audioDuration)
 );
 },
 [audioDuration]
 );

 // Reset audio state when value changes
 useEffect(() => {
 setAudioPlaying(false);
 setAudioCurrentTime(0);
 setAudioDuration(0);
 setAudioLoaded(false);
 }, [value]);

 // Handle file selection
 const handleFileSelect = useCallback(
 async (file: File) => {
 if (!file) return;

 // Check file type
 if (accept && !file.type.match(accept.replace("/*", "/.*"))) {
 showWarning(`Invalid file type`, {
 description: `Please select a ${mediaType} file. Got: ${file.type || "unknown"}`,
 });
 return;
 }

 // Check file size - 50MB for video/audio, 15MB for images
 const maxSize = mediaType === "image" ? 15 * 1024 * 1024 : 50 * 1024 * 1024;
 if (file.size > maxSize) {
 const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
 const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
 showError(`File too large (${sizeMB}MB)`, {
 description: `Maximum file size is ${maxMB}MB.`,
 });
 return;
 }

 setIsUploading(true);
 setNodeUploading(id, true);

 try {
 // For files > 3MB, use direct upload to Transloadit
 if (file.size > 3 * 1024 * 1024) {
 const signResponse = await fetch("/api/media/upload-direct", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ type: mediaType }),
 });

 if (!signResponse.ok) {
 showError("Upload failed", {
 description: "Could not initialize upload. Please try again.",
 });
 setIsUploading(false);
 setNodeUploading(id, false);
 return;
 }

 const { params, signature } = await signResponse.json();

 const formData = new FormData();
 formData.append("params", params);
 formData.append("signature", signature);
 formData.append("file", file);

 const uploadResponse = await fetch(
 "https://api2.transloadit.com/assemblies",
 { method: "POST", body: formData }
 );

 const result = await uploadResponse.json();

 if (result.error || uploadResponse.status >= 400) {
 showError("Upload failed", {
 description: result.message || result.error || "Unknown error",
 });
 setIsUploading(false);
 setNodeUploading(id, false);
 return;
 }

 // Poll for completion
 const assemblyUrl = result.assembly_ssl_url || result.assembly_url;
 let attempts = 0;
 const maxAttempts = 60;

 while (attempts < maxAttempts) {
 const statusResponse = await fetch(assemblyUrl);
 const status = await statusResponse.json();

 if (status.ok === "ASSEMBLY_COMPLETED") {
 const uploadedFile =
 status.results?.passthrough?.[0] ||
 status.uploads?.[0] ||
 status.results?.[":original"]?.[0];
 const fileUrl = uploadedFile?.ssl_url || uploadedFile?.url;
 if (fileUrl) {
 updateNode(id, { value: fileUrl, result: fileUrl });
 propagateOutput(id, fileUrl);
 setIsUploading(false);
 setNodeUploading(id, false);
 return;
 }
 } else if (status.ok === "ASSEMBLY_CANCELED" || status.error) {
 showError("Upload failed", {
 description: status.message || status.error || "Processing failed",
 });
 setIsUploading(false);
 setNodeUploading(id, false);
 return;
 }

 await new Promise((resolve) => setTimeout(resolve, 1000));
 attempts++;
 }

 showError("Upload timed out", {
 description: "Please try again with a smaller file.",
 });
 setIsUploading(false);
 setNodeUploading(id, false);
 return;
 }

 // For smaller files, use base64 upload
 const reader = new FileReader();
 reader.onload = async (e) => {
 const base64 = e.target?.result as string;

 try {
 const response = await fetch("/api/media/upload", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 dataUrl: base64,
 type: mediaType,
 filename: file.name,
 }),
 });

 if (response.ok) {
 const { url } = await response.json();
 updateNode(id, { value: url, result: url });
 propagateOutput(id, url);
 } else {
 // Fallback to base64
 updateNode(id, { value: base64, result: base64 });
 propagateOutput(id, base64);
 }
 } catch {
 // Fallback to base64
 updateNode(id, { value: base64, result: base64 });
 propagateOutput(id, base64);
 }

 setIsUploading(false);
 setNodeUploading(id, false);
 };
 reader.readAsDataURL(file);
 } catch (err) {
 console.error("[BaseInputNode] Error uploading file:", err);
 setIsUploading(false);
 setNodeUploading(id, false);
 }
 },
 [accept, mediaType, id, updateNode, propagateOutput, setNodeUploading]
 );

 const handleDrop = useCallback(
 (e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setIsDragOver(false);
 const file = e.dataTransfer.files[0];
 if (file) handleFileSelect(file);
 },
 [handleFileSelect]
 );

 const handleClear = useCallback(
 (e: React.MouseEvent) => {
 e.stopPropagation();
 updateNode(id, { value: null, result: null });
 },
 [id, updateNode]
 );

 const nodeBgColor = isDarkMode ? "#161616" : "#ffffff";
 const borderColor = selected ? accentColor : isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.1)";

 return (
 <motion.div
 initial={{ scale: 0.95, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ type: "spring", stiffness: 500, damping: 35 }}
 className={cn(
 "relative w-[200px] rounded-xl overflow-visible",
 "shadow-lg"
 )}
 style={{
 backgroundColor: nodeBgColor,
 border: `${selected ? 2 : 1}px solid ${borderColor}`,
 }}
 >
 {/* Accent bar */}
 <div
 className="h-1 w-full rounded-t-xl"
 style={{ backgroundColor: accentColor }}
 />

 {/* Header */}
 <div className="px-3 py-2 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <FileIcon className="w-4 h-4" style={{ color: accentColor }} />
 <span
 className="text-xs font-medium text-slate-800 dark:text-white/80"
 style={{ fontFamily: "Inter, system-ui, sans-serif" }}
 >
 {data.label || `${mediaType.toUpperCase()} INPUT`}
 </span>
 </div>
 </div>

 {/* Content */}
 <div className="px-3 pb-3">
 <input
 ref={fileInputRef}
 type="file"
 accept={accept}
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) handleFileSelect(file);
 }}
 className="hidden"
 />

 <div
 onDrop={handleDrop}
 onDragOver={(e) => {
 e.preventDefault();
 setIsDragOver(true);
 }}
 onDragLeave={() => setIsDragOver(false)}
 onClick={() => !value && !isUploading && fileInputRef.current?.click()}
 className={cn(
 "border-2 nodrag nowheel relative rounded-lg border-dashed transition-all",
 isDragOver
 ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
 : value
 ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5"
 : "border-gray-500 dark:border-white/20 bg-white dark:bg-white/[0.02] hover:border-gray-600 dark:hover:border-white/30 cursor-pointer"
 )}
 >
 {isUploading ? (
 <div className="flex flex-col items-center justify-center py-6 text-blue-500 dark:text-blue-400">
 <Loader2 className="w-6 h-6 mb-2 animate-spin" />
 <span className="text-[10px]">Uploading...</span>
 </div>
 ) : value ? (
 <div className="relative p-1">
 {/* Image preview */}
 {mediaType === "image" && (
 <img
 src={value}
 alt="Preview"
 className="w-full h-20 object-cover rounded"
 />
 )}

 {/* Video preview */}
 {mediaType === "video" && (
 <video
 src={value}
 className="w-full h-20 object-cover rounded"
 muted
 />
 )}

 {/* Audio player */}
 {mediaType === "audio" && (
 <div className="flex items-center gap-2 p-2">
 <button
 onClick={toggleAudioPlayback}
 disabled={!audioLoaded}
 className={cn(
 "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
 "bg-teal-500 text-white hover:bg-teal-600 transition-colors",
 "disabled:opacity-50 disabled:cursor-not-allowed"
 )}
 >
 {!audioLoaded ? (
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 ) : audioPlaying ? (
 <Pause className="w-3.5 h-3.5" />
 ) : (
 <Play className="w-3.5 h-3.5 ml-0.5" />
 )}
 </button>

 <div className="flex-1 min-w-0">
 <div
 onClick={handleAudioSeek}
 className="h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden cursor-pointer"
 >
 <div
 className="h-full bg-teal-500 transition-all duration-100"
 style={{
 width: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%`,
 }}
 />
 </div>
 <div className="text-[8px] flex justify-between text-slate-700 dark:text-zinc-500 font-mono mt-0.5">
 <span>{formatTime(audioCurrentTime)}</span>
 <span>{formatTime(audioDuration)}</span>
 </div>
 </div>

 <audio
 ref={audioRef}
 src={value}
 preload="metadata"
 onPlay={() => setAudioPlaying(true)}
 onPause={() => setAudioPlaying(false)}
 onEnded={() => {
 setAudioPlaying(false);
 setAudioCurrentTime(0);
 }}
 onLoadedMetadata={(e) => {
 setAudioDuration(e.currentTarget.duration);
 setAudioLoaded(true);
 }}
 onTimeUpdate={(e) =>
 setAudioCurrentTime(e.currentTarget.currentTime)
 }
 className="hidden"
 />
 </div>
 )}

 {/* Clear button */}
 <button
 onClick={handleClear}
 className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
 >
 <X className="w-3 h-3 text-white" />
 </button>
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center py-6 text-slate-700 dark:text-zinc-500">
 <Upload className="w-6 h-6 mb-2" />
 <span className="text-[10px]">
 Drop {mediaType} or click
 </span>
 </div>
 )}
 </div>
 </div>

 {/* Output Handle - Right side */}
 <div
 className="absolute right-0 top-1/2 z-30"
 style={{ transform: "translate(50%, -50%)" }}
 >
 <Handle
 id="output"
 type="source"
 position={Position.Right}
 data-handletype={mediaType}
 style={{
 position: "relative",
 width: 12,
 height: 12,
 borderWidth: 0,
 backgroundColor: handleColor.solid,
 }}
 className="!relative !right-0 !top-0 !transform-none"
 />
 </div>
 </motion.div>
 );
}

export const BaseInputNode = memo(BaseInputNodeComponent);
