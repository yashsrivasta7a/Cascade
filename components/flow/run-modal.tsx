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
  Server,
  ShieldCheck,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/credits";

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
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
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
          <div className="shadow-2xl group relative bg-white dark:bg-zinc-950 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden flex flex-col md:flex-row h-[min(520px,85vh)] md:h-[520px]">
            {/* Left Column: Context & Resources */}
            <div className="w-full md:w-[40%] bg-gray-50 dark:bg-zinc-900 md:border-r border-gray-200 dark:border-white/10 flex flex-col relative overflow-hidden">
              <div className="p-6 h-full flex flex-col relative z-10">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-1.5 tracking-tight">
                    Confirm Execution
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 font-normal line-clamp-2 leading-relaxed">
                    {workflowName || "Untitled Workflow"}
                  </p>
                </div>

                {/* Resource Card */}
                <div className="rounded-xl bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-white/10 p-5 mb-4 relative overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 mb-4 text-slate-600 dark:text-zinc-400 relative">
                    <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-zinc-300">Cost Estimate</span>
                  </div>

                  <div className="flex items-end justify-between mb-4 relative">
                    <div>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight block tabular-nums">
                        {formatCredits(stats.totalCost)}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium uppercase mt-1 block">Credits Required</span>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5 mb-0.5">
                        <span className={cn(
                          "text-lg block tabular-nums font-semibold",
                          stats.hasEnoughCredits ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        )}>
                          {formatCredits(creditBalance)}
                        </span>
                        {stats.hasEnoughCredits && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium uppercase">Available</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-1.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-1">
                    <div 
                      className={cn(
                        "absolute inset-y-0 left-0 transition-all duration-500 rounded-full",
                        stats.hasEnoughCredits 
                          ? "bg-emerald-500" 
                          : "bg-red-500"
                      )}
                      style={{ width: `${Math.min((stats.totalCost / (creditBalance || 1)) * 100, 100)}%` }}
                    />
                  </div>

                  {!stats.hasEnoughCredits && (
                    <div className="text-[11px] flex items-start gap-2 mt-4 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-2.5 rounded-md border border-red-100 dark:border-red-500/20 leading-snug">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Insufficient credits to run pipeline. Please top up your balance.</span>
                    </div>
                  )}
                </div>

                {/* System Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800/50 flex flex-col gap-1.5 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-gray-50 dark:bg-zinc-700 border border-gray-100 dark:border-zinc-600 flex items-center justify-center">
                        <Clock className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
                      </div>
                      <span className="text-[10px] font-medium text-slate-600 dark:text-zinc-400">Est. Time</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 pl-6">~{formatDuration(stats.estimatedDuration)}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800/50 flex flex-col gap-1.5 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-gray-50 dark:bg-zinc-700 border border-gray-100 dark:border-zinc-600 flex items-center justify-center">
                        <Server className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
                      </div>
                      <span className="text-[10px] font-medium text-slate-600 dark:text-zinc-400">Providers</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 pl-6">{stats.uniqueProviders} services</span>
                  </div>
                </div>

                {/* Environment Info */}
                <div className="mt-auto pt-4">
                  <div className="text-[10px] flex items-center justify-between text-slate-500 dark:text-zinc-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <GitBranch className="w-3 h-3" />
                      v1.0.2
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Production
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom aligned cancel for mobile */}
              <div className="p-6 pt-0 md:hidden relative z-10">
                <button
                  onClick={onClose}
                  className="text-sm w-full font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Right Column: Execution Plan */}
            <div className="w-full md:w-[60%] flex flex-col bg-white dark:bg-zinc-950 relative">
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-zinc-950 z-20 pr-12">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Execution Plan</h3>
                </div>
                <div className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                  {stats.nodeCount} Steps
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-800 relative">
                <div className="relative">
                  {/* Vertical Timeline Line */}
                  <div className="absolute left-4 top-4 bottom-6 w-px bg-gray-200 dark:bg-zinc-800" />

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
                        className="relative flex items-start gap-4"
                      >
                        {/* Timeline Node */}
                        <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-zinc-700 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                          {i + 1}
                        </div>
                        
                        {/* Node Content */}
                        <div className="flex-1 min-w-0 pt-1.5">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <h4 className="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate">
                              {node.label}
                            </h4>
                            
                            {/* Cost Badge */}
                            {node.estimatedCost > 0 && (
                              <div className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                                <span>{formatCredits(node.estimatedCost)} cr</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                              {node.type.replace("-", " ")}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-zinc-500 truncate flex items-center gap-1.5">
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
                    animate={{ opacity: 1 }} 
                    transition={{ delay: 0.5 }}
                    className="relative flex items-center gap-4 mt-6"
                  >
                    <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 dark:bg-zinc-900 border-2 border-dashed border-gray-200 dark:border-zinc-700" />
                    <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">End of Pipeline</span>
                  </motion.div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-950 flex items-center justify-end gap-3 z-10">
                <button
                  onClick={onClose}
                  className="text-sm hidden md:block font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecute}
                  disabled={!stats.hasEnoughCredits || isExecuting}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
                    stats.hasEnoughCredits
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                      : "bg-gray-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed"
                  )}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Starting...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Run Workflow</span>
                    </>
                  )}
                </button>
              </div>

              {/* Close Button Absolute */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors z-20 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
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
