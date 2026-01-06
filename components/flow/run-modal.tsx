"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Coins,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronRight,
  Settings,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

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
  onRun: () => void;
  workflowName: string;
  nodes: NodeEstimate[];
  creditBalance: number;
}

export function RunModal({
  isOpen,
  onClose,
  onRun,
  workflowName,
  nodes,
  creditBalance,
}: RunModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const totalCost = nodes.reduce((sum, node) => sum + node.estimatedCost, 0);
  const hasEnoughCredits = creditBalance >= totalCost;
  const estimatedDuration = nodes.length * 15; // rough estimate

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `~${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `~${mins}m ${secs}s`;
  };

  const handleRun = () => {
    setIsRunning(true);
    // Simulate a brief delay before triggering the actual run
    setTimeout(() => {
      onRun();
      onClose();
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg mx-4"
        >
          <Card variant="elevated" className="overflow-hidden border border-white/10">
            {/* Header */}
            <div className="p-5 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center border border-white/10">
                    <Play className="w-5 h-5 text-zinc-200" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-100">Run Workflow</h2>
                    <p className="text-xs text-zinc-500">{workflowName}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
              {/* Cost Estimate */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-300">Estimated Cost</span>
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-zinc-300" />
                    <span className="text-xl font-bold text-zinc-100">{totalCost}</span>
                    <span className="text-xs text-zinc-500">credits</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">
                    Your balance: {creditBalance.toLocaleString()} credits
                  </span>
                  {hasEnoughCredits ? (
                    <span className="text-zinc-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Sufficient
                    </span>
                  ) : (
                    <span className="text-zinc-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Insufficient
                    </span>
                  )}
                </div>
              </div>

              {/* Execution Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 text-center">
                  <Zap className="w-4 h-4 text-zinc-300 mx-auto mb-1" />
                  <p className="text-lg font-bold text-zinc-100">{nodes.length}</p>
                  <p className="text-[10px] text-zinc-500">Nodes</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 text-center">
                  <Clock className="w-4 h-4 text-zinc-300 mx-auto mb-1" />
                  <p className="text-lg font-bold text-zinc-100">{formatDuration(estimatedDuration)}</p>
                  <p className="text-[10px] text-zinc-500">Est. Time</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 text-center">
                  <Settings className="w-4 h-4 text-zinc-300 mx-auto mb-1" />
                  <p className="text-lg font-bold text-zinc-100">{new Set(nodes.map(n => n.provider)).size}</p>
                  <p className="text-[10px] text-zinc-500">Providers</p>
                </div>
              </div>

              {/* Node Breakdown */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-900/30 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <span className="text-sm font-medium text-zinc-300">Cost Breakdown</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-zinc-500 transition-transform",
                      showAdvanced && "rotate-180"
                    )}
                  />
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 space-y-2">
                        {nodes.map((node) => (
                          <div
                            key={node.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/30 border border-white/5"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                                <Zap className="w-4 h-4 text-zinc-400" />
                              </div>
                              <div>
                                <p className="text-sm text-zinc-100">{node.label}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-zinc-500">{node.provider}</span>
                                  {node.fallbackProviders && node.fallbackProviders.length > 0 && (
                                    <span className="text-[10px] text-zinc-400">
                                      +{node.fallbackProviders.length} fallback
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-zinc-200">
                              {node.estimatedCost > 0 ? node.estimatedCost : "Free"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Info Note */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/10">
                <Info className="w-4 h-4 text-zinc-300 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300">
                  <p className="font-medium mb-1">Execution will pause when waiting for providers</p>
                  <p className="text-zinc-500">
                    You won't be charged during webhook wait times. Actual cost may vary based on input sizes.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-white/5 bg-zinc-900/30 flex items-center justify-between">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleRun}
                disabled={!hasEnoughCredits}
                isLoading={isRunning}
                leftIcon={<Play className="w-4 h-4" />}
                className={cn(!hasEnoughCredits && "opacity-50 cursor-not-allowed")}
              >
                {isRunning ? "Starting..." : "Run Workflow"}
              </Button>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Demo usage export for testing
export const demoNodes: NodeEstimate[] = [
  { id: "1", label: "Generate Script", type: "openrouter", estimatedCost: 2, provider: "OpenRouter" },
  { id: "2", label: "Create Thumbnail", type: "seedream", estimatedCost: 5, provider: "ByteDance", fallbackProviders: ["Replicate"] },
  { id: "3", label: "Voice Narration", type: "elevenlabs", estimatedCost: 8, provider: "ElevenLabs" },
  { id: "4", label: "Generate Video", type: "seedance", estimatedCost: 25, provider: "ByteDance" },
  { id: "5", label: "Merge Audio", type: "merge-audio-video", estimatedCost: 0, provider: "Internal" },
];

