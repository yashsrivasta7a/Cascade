"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
 X,
 Play,
 Clock,
 Loader2,
 AlertCircle,
 CreditCard,
 Layers,
 Cpu,
 Coins,
 Server,
 ShieldCheck,
 GitBranch,
 Terminal,
 Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { formatCredits } from "@/lib/credits";

// =============================================================================
// HELPERS
// =============================================================================

function getNodeColors(type: string): { bg: string; border: string; text: string; glow: string } {
 switch (type) {
 case "openrouter":
 return { bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400", glow: "shadow-blue-500/20" };
 case "seedream":
 return { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400", glow: "shadow-emerald-500/20" };
 case "seedance":
 case "seedvr":
 return { bg: "bg-violet-500/15", border: "border-violet-500/30", text: "text-violet-400", glow: "shadow-violet-500/20" };
 case "elevenlabs":
 case "lipsync":
 return { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400", glow: "shadow-amber-500/20" };
 case "crop-image":
 return { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400", glow: "shadow-emerald-500/20" };
 case "merge-videos":
 case "merge-audio-video":
 return { bg: "bg-violet-500/15", border: "border-violet-500/30", text: "text-violet-400", glow: "shadow-violet-500/20" };
 case "extract-audio":
 return { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400", glow: "shadow-amber-500/20" };
 default:
 return { bg: "bg-zinc-500/15", border: "border-zinc-500/30", text: "text-slate-600", glow: "shadow-zinc-500/20" };
 }
}

// =============================================================================
// TYPES
// =============================================================================

interface NodeEstimate {
 id: string;
 label: string;
 type: string;
 estimatedCost: number;
 provider: string;
 fallbackProviders?: string[];
}

interface RunModalProps {
 isOpen: boolean;
 onClose: () => void;
 onRun: () => void | Promise<void>;
 workflowName: string;
 nodes: NodeEstimate[];
 creditBalance: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RunModal({
 isOpen,
 onClose,
 onRun,
 workflowName,
 nodes,
 creditBalance,
}: RunModalProps) {
 const [isExecuting, setIsExecuting] = useState(false);

 useEffect(() => {
 if (isOpen) {
 setIsExecuting(false);
 }
 }, [isOpen]);

 const stats = useMemo(() => {
 const totalCost = nodes.reduce((sum, node) => sum + node.estimatedCost, 0);
 const hasEnoughCredits = creditBalance >= totalCost;
 const estimatedDuration = nodes.length * 15;
 const aiNodes = nodes.filter(n => n.estimatedCost > 0).length;
 const uniqueProviders = [...new Set(nodes.map(n => n.provider))].length;
 
 return {
 totalCost,
 hasEnoughCredits,
 estimatedDuration,
 aiNodes,
 uniqueProviders,
 nodeCount: nodes.length,
 };
 }, [nodes, creditBalance]);

 const handleExecute = async () => {
 setIsExecuting(true);
 onClose();
 try {
 await onRun();
 } catch (error) {
 console.error("Workflow execution error:", error);
 }
 };

 const containerVariants = {
 hidden: { opacity: 0 },
 show: {
 opacity: 1,
 transition: {
 staggerChildren: 0.05,
 delayChildren: 0.1
 }
 }
 };

 const itemVariants = {
 hidden: { opacity: 0, x: -10 },
 show: { opacity: 1, x: 0 }
 };

 if (!isOpen) return null;

 return (
 <AnimatePresence>
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-50 flex items-center justify-center p-4"
 >
 {/* Backdrop */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="absolute inset-0 bg-black/80 backdrop-blur-sm"
 onClick={onClose}
 />

 {/* Modal Window */}
 <motion.div
 initial={{ opacity: 0, scale: 0.98, y: 8 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.98, y: 8 }}
 transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
 className="relative w-full max-w-3xl"
 >
 <div className="group relative bg-[#0a0a0a] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col md:flex-row h-[520px]">
 {/* Left Column: Context & Resources */}
 <div className="w-full md:w-[40%] bg-[#0d0d0d] border-b md:border-b-0 md:border-r border-white/[0.06] flex flex-col relative overflow-hidden">
 {/* Gradient overlay */}
 <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] via-transparent to-violet-500/[0.02] pointer-events-none" />
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
 
 <div className="p-6 h-full flex flex-col relative z-10">
 <div className="flex items-center gap-2 text-slate-700 mb-8">
 <div className="w-6 h-6 rounded bg-white border border-white/10 flex items-center justify-center">
 <Terminal className="w-3.5 h-3.5" />
 </div>
 <span className="text-[10px] font-mono uppercase tracking-widest text-slate-700">System Check</span>
 </div>

 <div className="mb-8">
 <h2 className="text-xl font-semibold text-zinc-100 mb-1.5 tracking-tight">
 Execute Workflow
 </h2>
 <p className="text-sm text-slate-700 font-normal line-clamp-2 leading-relaxed">
 {workflowName}
 </p>
 </div>

 {/* Resource Card */}
 <div className="rounded-xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] p-5 mb-4 relative overflow-hidden">
 {/* Subtle glow */}
 <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
 
 <div className="flex items-center gap-2 mb-5 text-slate-600 relative">
 <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
 <CreditCard className="w-3 h-3 text-amber-400" />
 </div>
 <span className="text-[10px] font-medium uppercase tracking-widest text-amber-400/70">Allocation</span>
 </div>

 <div className="flex items-end justify-between mb-4 relative">
 <div>
 <span className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent tracking-tight block tabular-nums">
 {formatCredits(stats.totalCost)}
 </span>
 <span className="text-[10px] text-slate-700 font-medium uppercase tracking-wide mt-1 block">Credits Req.</span>
 </div>
 <div className="text-right">
 <div className="flex items-center justify-end gap-1.5 mb-0.5">
 <span className={cn(
 "text-lg font-mono block tabular-nums font-bold",
 stats.hasEnoughCredits ? "text-emerald-400" : "text-red-400"
 )}>
 {formatCredits(creditBalance)}
 </span>
 {stats.hasEnoughCredits && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
 </div>
 <span className="text-[10px] text-slate-700 font-medium uppercase tracking-wide">Available</span>
 </div>
 </div>

 {/* Progress Bar */}
 <div className="relative h-1.5 w-full bg-white rounded-full overflow-hidden mb-1">
 <div 
 className={cn(
 "absolute inset-y-0 left-0 transition-all duration-500 rounded-full",
 stats.hasEnoughCredits 
 ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-lg shadow-emerald-500/30" 
 : "bg-gradient-to-r from-red-500 to-red-400 shadow-lg shadow-red-500/30"
 )}
 style={{ width: `${Math.min((stats.totalCost / (creditBalance || 1)) * 100, 100)}%` }}
 />
 </div>

 {!stats.hasEnoughCredits && (
 <div className="flex items-start gap-2 mt-4 text-[11px] text-red-300 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 leading-snug backdrop-blur-sm">
 <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
 <span>Insufficient credits to run pipeline. Please top up your balance.</span>
 </div>
 )}
 </div>

 {/* System Stats Grid */}
 <div className="grid grid-cols-2 gap-3 mb-4">
 <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white /[0.03] backdrop-blur-sm flex flex-col gap-1.5 hover:bg-white/60/[0.05] transition-colors">
 <div className="flex items-center gap-1.5">
 <div className="w-5 h-5 rounded-md bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
 <Clock className="w-2.5 h-2.5 text-blue-400" />
 </div>
 <span className="text-[9px] uppercase font-medium tracking-wider text-blue-400/70">Est. Time</span>
 </div>
 <span className="text-base font-semibold text-zinc-200 pl-6">~{formatDuration(stats.estimatedDuration)}</span>
 </div>
 <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white /[0.03] backdrop-blur-sm flex flex-col gap-1.5 hover:bg-white/60/[0.05] transition-colors">
 <div className="flex items-center gap-1.5">
 <div className="w-5 h-5 rounded-md bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
 <Server className="w-2.5 h-2.5 text-violet-400" />
 </div>
 <span className="text-[9px] uppercase font-medium tracking-wider text-violet-400/70">Providers</span>
 </div>
 <span className="text-base font-semibold text-zinc-200 pl-6">{stats.uniqueProviders} services</span>
 </div>
 </div>

 {/* Environment Info */}
 <div className="mt-auto pt-6 border-t border-white/5">
 <div className="flex items-center justify-between text-[10px] text-slate-700 uppercase tracking-widest font-mono">
 <span className="flex items-center gap-1.5">
 <GitBranch className="w-3 h-3" />
 v1.0.2
 </span>
 <span className="flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
 Production
 </span>
 </div>
 </div>
 </div>

 {/* Bottom aligned cancel for mobile */}
 <div className="p-6 pt-0 md:hidden relative z-10">
 <button
 onClick={onClose}
 className="w-full text-sm font-medium text-slate-600 hover:text-zinc-200 py-3 border border-white/10 rounded-xl bg-white "
 >
 Cancel Operation
 </button>
 </div>
 </div>

 {/* Right Column: Execution Plan */}
 <div className="w-full md:w-[60%] flex flex-col bg-[#0a0a0a] relative">
 {/* Header */}
 <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between bg-white /[0.02] z-20 pr-12">
 <div className="flex items-center gap-3">
 <div className="relative flex items-center justify-center w-3 h-3">
 <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
 <span className="relative block w-2 h-2 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/50" />
 </div>
 <h3 className="text-xs font-medium text-slate-600 uppercase tracking-widest">Execution Sequence</h3>
 </div>
 <div className="px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 text-[10px] text-cyan-400 font-mono flex items-center gap-1.5">
 <Layers className="w-3 h-3" />
 {stats.nodeCount} STEPS
 </div>
 </div>

 {/* Scrollable Content */}
 <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800 relative">
 <div className="relative pl-3">
 {/* Vertical Timeline Line */}
 <div className="absolute left-[17px] top-4 bottom-6 w-px bg-gradient-to-b from-violet-500/30 via-blue-500/20 to-transparent" />

 <motion.div 
 variants={containerVariants}
 initial="hidden"
 animate="show"
 className="space-y-5"
 >
 {nodes.map((node, i) => {
 const colors = getNodeColors(node.type);
 return (
 <motion.div 
 key={node.id} 
 variants={itemVariants}
 className="relative flex items-start gap-4 group"
 >
 {/* Timeline Node */}
 <div className={cn(
 "relative z-10 w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-300 backdrop-blur-sm",
 node.estimatedCost > 0 
 ? cn(colors.bg, colors.border, "shadow-lg", colors.glow, "group-hover:scale-105")
 : "bg-white /[0.03] border-white/10 group-hover:border-white/20"
 )}>
 {node.estimatedCost > 0 ? (
 <Zap className={cn("w-4 h-4 transition-colors", colors.text)} />
 ) : (
 <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-zinc-400 transition-colors" />
 )}
 </div>
 
 {/* Node Content */}
 <div className="flex-1 pt-1.5 min-w-0">
 <div className="flex items-center justify-between mb-2 gap-2">
 <h4 className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
 {node.label}
 </h4>
 
 {/* Cost Badge */}
 {node.estimatedCost > 0 && (
 <div className={cn(
 "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all backdrop-blur-sm",
 colors.bg, colors.border, colors.text
 )}>
 <Coins className="w-3 h-3" />
 <span className="font-semibold">{formatCredits(node.estimatedCost)}</span>
 </div>
 )}
 </div>
 
 <div className="flex items-center gap-2">
 <span className={cn(
 "px-2 py-0.5 rounded-md font-medium uppercase text-[8px] tracking-wide border",
 colors.bg, colors.border, colors.text
 )}>
 {node.type.replace("-", " ")}
 </span>
 <span className="text-slate-700 text-[10px] truncate max-w-[120px] flex items-center gap-1.5">
 <span className="w-0.5 h-2 bg-zinc-700 rounded-full" />
 {node.provider}
 </span>
 </div>
 </div>
 </motion.div>
 );
 })}
 </motion.div>
 
 {/* End Node */}
 <motion.div 
 initial={{ opacity: 0 }} 
 animate={{ opacity: 0.6 }} 
 transition={{ delay: 0.5 }}
 className="relative flex items-center gap-4 mt-6"
 >
 <div className="relative z-10 w-9 h-9 rounded-xl flex items-center justify-center border border-dashed border-zinc-700 bg-white /[0.02] backdrop-blur-sm">
 <div className="w-2 h-2 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700" />
 </div>
 <span className="text-[10px] text-slate-700 font-mono uppercase tracking-widest">End of Pipeline</span>
 </motion.div>
 </div>
 </div>

 {/* Footer Actions */}
 <div className="p-5 border-t border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent flex items-center justify-end gap-3 z-10 ">
 <button
 onClick={onClose}
 className="hidden md:block text-xs font-medium text-slate-700 hover:text-zinc-200 transition-colors px-4 py-2.5 rounded-lg hover:bg-white/60/[0.05]"
 >
 Cancel
 </button>
 <button
 onClick={handleExecute}
 disabled={!stats.hasEnoughCredits || isExecuting}
 className={cn(
 "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300",
 stats.hasEnoughCredits
 ? "bg-gradient-to-r from-white to-zinc-100 text-black hover:from-zinc-100 hover:to-white shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] transform hover:-translate-y-0.5 hover:scale-[1.02]"
 : "bg-zinc-800/50 text-slate-700 cursor-not-allowed backdrop-blur-sm"
 )}
 >
 {isExecuting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 <span>Initializing...</span>
 </>
 ) : (
 <>
 <Play className="w-4 h-4 fill-current" />
 <span>Execute Workflow</span>
 </>
 )}
 </button>
 </div>

 {/* Close Button Absolute - Moved out of scroll area */}
 <button
 onClick={onClose}
 className="absolute top-5 right-5 text-slate-700 hover:text-zinc-200 transition-colors z-20 p-2 rounded-lg hover:bg-white/60"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>
 </motion.div>
 </motion.div>
 </AnimatePresence>
 );
}

function formatDuration(seconds: number): string {
 if (seconds < 60) return `${seconds}s`;
 const mins = Math.floor(seconds / 60);
 return `${mins}m ${seconds % 60}s`;
}

// Demo usage export for testing
export const demoNodes: NodeEstimate[] = [
 { id: "1", label: "Generate Script", type: "openrouter", estimatedCost: 50000, provider: "OpenRouter" },
 { id: "2", label: "Create Thumbnail", type: "seedream", estimatedCost: 40000, provider: "ByteDance", fallbackProviders: ["Replicate"] },
 { id: "3", label: "Voice Narration", type: "elevenlabs", estimatedCost: 50000, provider: "ElevenLabs" },
 { id: "4", label: "Generate Video", type: "seedance", estimatedCost: 260000, provider: "ByteDance" },
 { id: "5", label: "Merge Audio", type: "merge-audio-video", estimatedCost: 3000, provider: "Internal" },
];
