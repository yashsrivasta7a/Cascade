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
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
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
          <div className="group relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5 flex flex-col md:flex-row h-[520px]">
            {/* Left Column: Context & Resources */}
            <div className="w-full md:w-[40%] bg-zinc-900/30 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col">
              <div className="p-6 h-full flex flex-col">
                <div className="flex items-center gap-2 text-zinc-400 mb-6">
                  <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner">
                    <Terminal className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-mono uppercase tracking-wider">System Check</span>
                </div>

                <div className="mb-6">
                  <h2 className="text-lg font-medium text-zinc-100 mb-1 tracking-tight">
                    Execute Pipeline
                  </h2>
                  <p className="text-sm text-zinc-500 font-normal line-clamp-2">
                    {workflowName}
                  </p>
                </div>

                {/* Resource Card */}
                <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/80 p-4 mb-4 shadow-sm backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-4 text-zinc-400">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium uppercase tracking-wider">Allocation</span>
                  </div>

                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <span className="text-3xl font-bold text-zinc-100 tracking-tight block tabular-nums">
                        {stats.totalCost}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Credits Req.</span>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5 mb-0.5">
                        <span className={cn(
                          "text-sm font-mono block tabular-nums",
                          stats.hasEnoughCredits ? "text-zinc-300" : "text-red-400"
                        )}>
                          {creditBalance.toLocaleString()}
                        </span>
                        {stats.hasEnoughCredits && <ShieldCheck className="w-3 h-3 text-emerald-500/50" />}
                      </div>
                      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Available</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden mb-1">
                    <div 
                      className={cn(
                        "absolute inset-y-0 left-0 transition-all duration-500 rounded-full",
                        stats.hasEnoughCredits ? "bg-gradient-to-r from-zinc-200 to-zinc-400" : "bg-red-500"
                      )}
                      style={{ width: `${Math.min((stats.totalCost / (creditBalance || 1)) * 100, 100)}%` }}
                    />
                  </div>

                  {!stats.hasEnoughCredits && (
                    <div className="flex items-start gap-2 mt-3 text-xs text-red-400 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Insufficient credits to run pipeline.</span>
                    </div>
                  )}
                </div>

                {/* System Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/20 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-medium">Est. Time</span>
                    </div>
                    <span className="text-sm font-medium text-zinc-200 pl-5">~{formatDuration(stats.estimatedDuration)}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/20 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Server className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-medium">Providers</span>
                    </div>
                    <span className="text-sm font-medium text-zinc-200 pl-5">{stats.uniqueProviders} services</span>
                  </div>
                </div>

                {/* Environment Info */}
                <div className="mt-auto pt-4 border-t border-zinc-800/50">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                    <span className="flex items-center gap-1.5">
                      <GitBranch className="w-3 h-3" />
                      v1.0.2
                    </span>
                    <span>Production</span>
                  </div>
                </div>
              </div>

              {/* Bottom aligned cancel for mobile */}
              <div className="p-6 pt-0 md:hidden">
                <button
                   onClick={onClose}
                   className="w-full text-sm font-medium text-zinc-400 hover:text-zinc-200 py-3 border border-zinc-800 rounded-lg"
                 >
                   Cancel Operation
                 </button>
              </div>
            </div>

            {/* Right Column: Execution Plan */}
            <div className="w-full md:w-[60%] flex flex-col bg-zinc-950 relative">
              {/* Header - Fixed Height with padding for close button */}
              <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50 backdrop-blur-sm z-10 pr-12">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                    <span className="relative block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  </div>
                  <h3 className="text-xs font-medium text-zinc-300 uppercase tracking-widest">Execution Sequence</h3>
                </div>
                <div className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-500 font-mono flex items-center gap-1.5">
                  <Layers className="w-3 h-3" />
                  {stats.nodeCount} STEPS
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
                <div className="relative pl-2">
                  {/* Vertical Timeline Line */}
                  <div className="absolute left-[15px] top-2 bottom-4 w-px bg-gradient-to-b from-zinc-800 via-zinc-800 to-transparent" />

                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="space-y-6"
                  >
                    {nodes.map((node, i) => (
                      <motion.div 
                        key={node.id} 
                        variants={itemVariants}
                        className="relative flex items-start gap-4 group"
                      >
                        {/* Timeline Node */}
                        <div className={cn(
                          "relative z-10 w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 bg-zinc-950",
                          node.estimatedCost > 0 
                            ? "border-zinc-700 group-hover:border-zinc-500 shadow-sm" 
                            : "border-zinc-800 group-hover:border-zinc-700"
                        )}>
                          {node.estimatedCost > 0 ? (
                            <Zap className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                          )}
                        </div>
                        
                        {/* Node Content */}
                        <div className="flex-1 pt-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <h4 className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors truncate">
                              {node.label}
                            </h4>
                            
                            {/* Cost Badge */}
                            {node.estimatedCost > 0 && (
                              <div className="flex-shrink-0 flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 group-hover:border-zinc-700 group-hover:text-zinc-300 transition-colors">
                                <Coins className="w-3 h-3 text-zinc-600 group-hover:text-zinc-500" />
                                <span>{node.estimatedCost}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-900/50 text-zinc-500 font-medium uppercase text-[9px] tracking-wide border border-zinc-800/50">
                              {node.type.replace("-", " ")}
                            </span>
                            <span className="text-zinc-600 font-mono text-[10px] truncate max-w-[120px]">
                              {node.provider}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                  
                  {/* End Node */}
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 0.5 }} 
                    transition={{ delay: 0.5 }}
                    className="relative flex items-center gap-4 mt-8"
                  >
                    <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center border border-dashed border-zinc-800 bg-zinc-950/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                    </div>
                    <span className="text-xs text-zinc-600 font-mono uppercase tracking-wider">End of Pipeline</span>
                  </motion.div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-5 border-t border-zinc-800 bg-zinc-900/20 flex items-center justify-end gap-3 z-10">
                <button
                   onClick={onClose}
                   className="hidden md:block text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors px-4 py-2"
                 >
                   Cancel
                 </button>
                <button
                  onClick={handleExecute}
                  disabled={!stats.hasEnoughCredits || isExecuting}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    stats.hasEnoughCredits
                      ? "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  )}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Initializing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Execute Pipeline</span>
                    </>
                  )}
                </button>
              </div>

              {/* Close Button Absolute - Moved out of scroll area */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 text-zinc-500 hover:text-zinc-200 transition-colors z-20 p-1 rounded-md hover:bg-zinc-800/50"
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
  { id: "1", label: "Generate Script", type: "openrouter", estimatedCost: 2, provider: "OpenRouter" },
  { id: "2", label: "Create Thumbnail", type: "seedream", estimatedCost: 5, provider: "ByteDance", fallbackProviders: ["Replicate"] },
  { id: "3", label: "Voice Narration", type: "elevenlabs", estimatedCost: 8, provider: "ElevenLabs" },
  { id: "4", label: "Generate Video", type: "seedance", estimatedCost: 25, provider: "ByteDance" },
  { id: "5", label: "Merge Audio", type: "merge-audio-video", estimatedCost: 0, provider: "Internal" },
];
