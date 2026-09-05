"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
 Play,
 Pause,
 Square,
 RotateCcw,
 Clock,
 CheckCircle2,
 XCircle,
 AlertCircle,
 Loader2,
 Coins,
 Timer,
 ChevronDown,
 ChevronUp,
 Download,
 ExternalLink,
 Maximize2,
 X,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { type NodeStatus } from "@/types/nodes";

interface ExecutingNode {
 id: string;
 label: string;
 type: string;
 status: NodeStatus;
 progress?: number;
 startedAt?: Date;
 duration?: number;
 provider?: string;
 providerAttempt?: number;
 totalProviders?: number;
 cost?: number;
 output?: {
 type: "image" | "video" | "audio" | "text";
 url?: string;
 thumbnail?: string;
 };
 error?: string;
}

interface ExecutionState {
 status: "idle" | "running" | "paused" | "completed" | "failed";
 startedAt?: Date;
 currentNodeIndex: number;
 nodes: ExecutingNode[];
 totalCost: number;
 estimatedCost: number;
}

const statusConfig: Record<NodeStatus, { icon: React.ReactNode; color: string; pulse?: boolean }> = {
 idle: {
 icon: <Clock className="w-3.5 h-3.5" />,
 color: "text-slate-700",
 },
 queued: {
 icon: <Clock className="w-3.5 h-3.5" />,
 color: "text-slate-600",
 },
 running: {
 icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
 color: "text-zinc-200",
 pulse: true,
 },
 completed: {
 icon: <CheckCircle2 className="w-3.5 h-3.5" />,
 color: "text-zinc-200",
 },
 failed: {
 icon: <XCircle className="w-3.5 h-3.5" />,
 color: "text-zinc-200",
 },
 cancelled: {
 icon: <XCircle className="w-3.5 h-3.5" />,
 color: "text-slate-600",
 },
};

// Demo execution data
const demoExecution: ExecutionState = {
 status: "running",
 startedAt: new Date(),
 currentNodeIndex: 2,
 estimatedCost: 48,
 totalCost: 15,
 nodes: [
 {
 id: "1",
 label: "Generate Script",
 type: "openrouter",
 status: "completed",
 startedAt: new Date(Date.now() - 25000),
 duration: 12,
 provider: "OpenRouter",
 cost: 2,
 output: { type: "text" },
 },
 {
 id: "2",
 label: "Create Thumbnail",
 type: "seedream",
 status: "completed",
 startedAt: new Date(Date.now() - 13000),
 duration: 8,
 provider: "ByteDance",
 cost: 5,
 output: { type: "image", thumbnail: "/demo/thumb.jpg" },
 },
 {
 id: "3",
 label: "Voice Narration",
 type: "elevenlabs",
 status: "running",
 progress: 65,
 startedAt: new Date(Date.now() - 5000),
 provider: "ElevenLabs",
 providerAttempt: 1,
 totalProviders: 2,
 cost: 8,
 },
 {
 id: "4",
 label: "Generate Video",
 type: "seedance",
 status: "queued",
 provider: "ByteDance",
 cost: 25,
 },
 {
 id: "5",
 label: "Merge Audio",
 type: "merge-audio-video",
 status: "idle",
 provider: "Internal",
 cost: 0,
 },
 ],
};

interface ExecutionPanelProps {
 className?: string;
 onClose?: () => void;
 isMinimized?: boolean;
 onToggleMinimize?: () => void;
}

export function ExecutionPanel({
 className,
 onClose,
 isMinimized = false,
 onToggleMinimize,
}: ExecutionPanelProps) {
 const [execution, setExecution] = useState<ExecutionState>(demoExecution);
 const [elapsedTime, setElapsedTime] = useState(0);
 const [expandedNode, setExpandedNode] = useState<string | null>(null);

 // Simulated timer
 useEffect(() => {
 if (execution.status === "running") {
 const interval = setInterval(() => {
 setElapsedTime((prev) => prev + 1);
 }, 1000);
 return () => clearInterval(interval);
 }
 }, [execution.status]);

 const formatTime = (seconds: number): string => {
 const mins = Math.floor(seconds / 60);
 const secs = seconds % 60;
 return `${mins}:${secs.toString().padStart(2, "0")}`;
 };

 const completedNodes = execution.nodes.filter((n) => n.status === "completed").length;
 const progress = (completedNodes / execution.nodes.length) * 100;

 if (isMinimized) {
 return (
 <motion.div
 initial={{ y: 100, opacity: 0 }}
 animate={{ y: 0, opacity: 1 }}
 className={cn(
 "fixed bottom-4 right-4 z-50",
 "bg-zinc-950/90 border border-white/10 rounded-2xl",
 "shadow-2xl shadow-black/50",
 className
 )}
 >
 <button
 onClick={onToggleMinimize}
 className="flex items-center gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors rounded-2xl"
 >
 <div className="relative">
 <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/[0.03] flex items-center justify-center border border-white/10">
 <Loader2 className="w-5 h-5 text-zinc-200 animate-spin" />
 </div>
 <span className="text-[10px] absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white font-bold text-white flex items-center justify-center border border-white/10">
 {completedNodes}
 </span>
 </div>
 <div className="text-left">
 <p className="text-sm font-medium text-zinc-100">Running workflow...</p>
 <p className="text-xs text-slate-700">
 {completedNodes}/{execution.nodes.length} nodes • {formatTime(elapsedTime)}
 </p>
 </div>
 <Maximize2 className="w-4 h-4 text-slate-700 ml-2" />
 </button>
 </motion.div>
 );
 }

 return (
 <motion.div
 initial={{ x: 400, opacity: 0 }}
 animate={{ x: 0, opacity: 1 }}
 exit={{ x: 400, opacity: 0 }}
 className={cn(
 "w-96 h-full bg-zinc-950/95 border-white/5",
 "flex flex-col shadow-2xl",
 className
 )}
 >
 {/* Header */}
 <div className="p-4 border-white/5">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
 <h2 className="text-sm font-bold text-zinc-100">Execution</h2>
 </div>
 <div className="flex items-center gap-1">
 <Button
 variant="ghost"
 size="icon"
 className="w-7 h-7"
 onClick={onToggleMinimize}
 >
 <ChevronDown className="w-4 h-4" />
 </Button>
 <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
 <X className="w-4 h-4" />
 </Button>
 </div>
 </div>

 {/* Progress Bar */}
 <div className="relative h-2 rounded-full bg-zinc-800 overflow-hidden mb-3">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${progress}%` }}
 className="absolute inset-y-0 left-0 bg-white rounded-full"
 />
 {execution.status === "running" && (
 <motion.div
 animate={{ x: ["0%", "100%"] }}
 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
 className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/20 to-transparent"
 />
 )}
 </div>

 {/* Stats Row */}
 <div className="flex items-center justify-between text-xs">
 <div className="flex items-center gap-4">
 <span className="flex items-center gap-1 text-slate-600">
 <Timer className="w-3 h-3" />
 {formatTime(elapsedTime)}
 </span>
 <span className="flex items-center gap-1 text-slate-600">
 <CheckCircle2 className="w-3 h-3 text-slate-600" />
 {completedNodes}/{execution.nodes.length}
 </span>
 </div>
 <div className="flex items-center gap-1 text-slate-600 bg-white px-2 py-1 rounded border border-white/10">
 <Coins className="w-3 h-3" />
 <span>{execution.totalCost}/{execution.estimatedCost}</span>
 </div>
 </div>
 </div>

 {/* Controls */}
 <div className="p-4 border-white/5 flex items-center gap-2">
 {execution.status === "running" ? (
 <Button variant="outline" size="sm" className="flex-1">
 <Pause className="w-4 h-4" />
 Pause
 </Button>
 ) : (
 <Button variant="primary" size="sm" className="flex-1">
 <Play className="w-4 h-4" />
 Resume
 </Button>
 )}
 <Button variant="outline" size="sm" className="flex-1">
 <Square className="w-4 h-4" />
 Stop
 </Button>
 </div>

 {/* Nodes List */}
 <div className="flex-1 overflow-y-auto custom-scrollbar">
 <div className="p-4 space-y-2">
 {execution.nodes.map((node, index) => {
 const config = statusConfig[node.status];
 const isExpanded = expandedNode === node.id;
 const isActive = node.status === "running";

 return (
 <motion.div
 key={node.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.05 }}
 className={cn(
 "rounded-xl border transition-all",
 isActive
 ? "bg-gray-50 dark:bg-white/[0.03] border-white/15"
 : "bg-zinc-900/50 border-white/5 hover:border-white/10"
 )}
 >
 <button
 onClick={() => setExpandedNode(isExpanded ? null : node.id)}
 className="w-full p-3 flex items-center gap-3"
 >
 {/* Status Indicator */}
 <div className="relative">
 <div
 className={cn(
 "w-8 h-8 rounded-lg flex items-center justify-center",
 node.status === "completed" && "bg-gray-50 dark:bg-white/[0.03] border border-white/10",
 node.status === "running" && "bg-gray-50 dark:bg-white/[0.03] border border-white/10",
 node.status === "failed" && "bg-gray-50 dark:bg-white/[0.03] border border-white/10",
 (node.status === "idle" || node.status === "queued") &&
 "bg-zinc-800"
 )}
 >
 <span className={config.color}>{config.icon}</span>
 </div>
 {config.pulse && (
 <span className="absolute inset-0 rounded-lg bg-white animate-ping" />
 )}
 </div>

 {/* Node Info */}
 <div className="flex-1 text-left min-w-0">
 <p className="text-sm font-medium text-zinc-100 truncate">
 {node.label}
 </p>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-[10px] text-slate-700">{node.type}</span>
 {node.provider && (
 <>
 <span className="text-slate-800">•</span>
 <span className="text-[10px] text-slate-700">{node.provider}</span>
 </>
 )}
 {node.providerAttempt && node.totalProviders && node.totalProviders > 1 && (
 <span className="text-[10px] text-slate-600 bg-white px-1 rounded border border-white/10">
 {node.providerAttempt}/{node.totalProviders}
 </span>
 )}
 </div>
 </div>

 {/* Cost & Duration */}
 <div className="flex flex-col items-end gap-1">
 {node.cost !== undefined && node.cost > 0 && (
 <span className="text-[10px] text-slate-600">
 {node.cost} cr
 </span>
 )}
 {node.duration !== undefined && (
 <span className="text-[10px] text-slate-700">
 {node.duration}s
 </span>
 )}
 </div>
 </button>

 {/* Progress bar for running nodes */}
 {node.status === "running" && node.progress !== undefined && (
 <div className="px-3 pb-3">
 <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${node.progress}%` }}
 className="h-full bg-white"
 />
 </div>
 <p className="text-[10px] mt-1 text-center">
 {node.progress}% complete
 </p>
 </div>
 )}

 {/* Expanded Details */}
 <AnimatePresence>
 {isExpanded && node.status === "completed" && node.output && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: "auto", opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 className="px-3 pb-3 overflow-hidden"
 >
 <div className="p-2 rounded-lg bg-zinc-800/50 border border-white/5">
 <div className="flex items-center justify-between">
 <span className="text-[10px] text-slate-700">
 Output: {node.output.type}
 </span>
 <div className="flex items-center gap-1">
 {node.output.url && (
 <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
 <Download className="w-3 h-3" />
 </Button>
 )}
 <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
 <ExternalLink className="w-3 h-3" />
 </Button>
 </div>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Error Message */}
 {node.status === "failed" && node.error && (
 <div className="px-3 pb-3">
 <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
 <p className="text-[10px] text-red-400">{node.error}</p>
 </div>
 </div>
 )}
 </motion.div>
 );
 })}
 </div>
 </div>

 {/* Footer */}
 <div className="p-4 border-white/5 bg-zinc-900/30">
 <Button variant="outline" className="w-full" size="sm">
 <ExternalLink className="w-4 h-4" />
 View Full Details
 </Button>
 </div>
 </motion.div>
 );
}

