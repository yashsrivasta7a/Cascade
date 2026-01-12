"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Coins,
  TrendingDown,
  CreditCard,
  ArrowRight,
  History,
  Loader2,
  Zap,
  Image,
  Film,
  Volume2,
  Brain,
  Crop,
  Scissors,
  Mic,
  Wallet,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DotPattern } from "@/components/ui";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";

// =============================================================================
// HELPERS
// =============================================================================

function formatCredits(credits?: number): string {
  if (credits === undefined || credits === null) return "0";
  if (credits >= 1000000) return `${(credits / 1000000).toFixed(2)}M`;
  if (credits >= 1000) return `${(credits / 1000).toFixed(1)}K`;
  if (credits < 1) return credits.toFixed(2);
  return credits.toLocaleString();
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getNodeIcon(nodeType: string) {
  switch (nodeType) {
    case "openrouter": return <Brain className="w-3 h-3 text-blue-400" />;
    case "seedream": return <Image className="w-3 h-3 text-emerald-400" />;
    case "seedance": return <Film className="w-3 h-3 text-violet-400" />;
    case "seedvr": return <Film className="w-3 h-3 text-violet-400" />;
    case "lipsync": return <Mic className="w-3 h-3 text-amber-400" />;
    case "elevenlabs": return <Volume2 className="w-3 h-3 text-amber-400" />;
    case "crop-image": return <Crop className="w-3 h-3 text-emerald-400" />;
    case "merge-videos": return <Film className="w-3 h-3 text-violet-400" />;
    case "merge-audio-video": return <Film className="w-3 h-3 text-violet-400" />;
    case "extract-audio": return <Scissors className="w-3 h-3 text-amber-400" />;
    default: return <Zap className="w-3 h-3 text-zinc-400" />;
  }
}

function getNodeColor(nodeType: string): string {
  switch (nodeType) {
    case "openrouter": return "bg-blue-500/15";
    case "seedream": return "bg-emerald-500/15";
    case "seedance": return "bg-violet-500/15";
    case "seedvr": return "bg-violet-500/15";
    case "lipsync": return "bg-amber-500/15";
    case "elevenlabs": return "bg-amber-500/15";
    case "crop-image": return "bg-emerald-500/15";
    case "merge-videos": return "bg-violet-500/15";
    case "merge-audio-video": return "bg-violet-500/15";
    case "extract-audio": return "bg-amber-500/15";
    default: return "bg-zinc-500/15";
  }
}

// =============================================================================
// TYPES
// =============================================================================

interface CreditHistoryItem {
  id: string;
  nodeName: string;
  nodeType: string;
  cost: number;
  createdAt: string;
  executionType: "single" | "pipeline";
  workflowName?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface CreditsPanelProps {
  workflowId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CreditsPanel({ 
  workflowId,
  isOpen, 
  onClose,
}: CreditsPanelProps) {
  const [creditHistory, setCreditHistory] = useState<CreditHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);

  const { data: creditsData } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: isOpen,
  });

  const fetchHistory = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (workflowId && workflowId !== "new") {
        params.set("workflowId", workflowId);
      }
      
      const response = await fetch(`/api/trigger-runs?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        const history: CreditHistoryItem[] = [];
        let total = 0;
        
        (data.executions || []).forEach((exec: any) => {
          const isMulti = (exec.nodeExecutions || []).length > 1;
          
          (exec.nodeExecutions || []).forEach((node: any) => {
            const cost = node.actualCost || 0;
            if (cost > 0) {
              const nodeDef = NODE_DEFINITIONS[node.nodeType as AINodeType];
              history.push({
                id: node.id,
                nodeName: nodeDef?.label || node.nodeLabel || node.nodeType,
                nodeType: node.nodeType,
                cost,
                createdAt: node.completedAt || node.startedAt || exec.createdAt,
                executionType: isMulti ? "pipeline" : "single",
                workflowName: exec.workflowName,
              });
              total += cost;
            }
          });
        });
        
        history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setCreditHistory(history);
        setTotalSpent(total);
      }
    } catch (err) {
      console.error("Failed to fetch credit history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, workflowId]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  const balance = creditsData?.credits ?? 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{ right: "16px" }}
          className="fixed top-16 z-50 w-[340px] bg-black/60 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/40 flex flex-col max-h-[calc(100vh-120px)]"
        >
          {/* Dot Pattern */}
          <DotPattern className="text-white/[0.03] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />

          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">Credits</span>
                  <p className="text-[10px] text-zinc-500">Usage & History</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Balance Card */}
          <div className="p-3 border-b border-white/[0.04] shrink-0">
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl border border-emerald-500/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Balance</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">{formatCredits(balance)} <span className="text-sm font-normal text-emerald-400/60">credits</span></p>
                </div>
                <Link href="/billing">
                  <button className="h-8 px-3 text-[10px] font-medium text-white bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] hover:from-[#2a4a6f] hover:to-[#3a5a7f] rounded-lg flex items-center gap-1.5 transition-all shadow-lg shadow-[#0f1f33]/50">
                    <CreditCard className="w-3.5 h-3.5" />
                    Buy Credits
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Workflow Spending */}
          <div className="p-3 border-b border-white/[0.04] shrink-0">
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl border border-amber-500/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] text-amber-400/70 uppercase tracking-wider">
                  {workflowId && workflowId !== "new" ? "This Workflow" : "All Workflows"}
                </span>
              </div>
              <p className="text-xl font-bold text-amber-400">{formatCredits(totalSpent)} <span className="text-xs font-normal text-amber-400/60">credits</span></p>
              <p className="text-[9px] text-zinc-500 mt-1">{creditHistory.length} transactions</p>
            </div>
          </div>

          {/* History */}
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-white/10">
            <div className="flex items-center gap-2 px-1 mb-2">
              <History className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Recent Spending</span>
            </div>
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                <p className="text-xs text-zinc-500 mt-2">Loading...</p>
              </div>
            ) : creditHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-zinc-500">No spending history yet</p>
                <p className="text-[10px] text-zinc-600 mt-1">Run some nodes to see costs</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {creditHistory.slice(0, 20).map((item, idx) => (
                  <motion.div
                    key={`${item.id}-${idx}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0", getNodeColor(item.nodeType))}>
                        {getNodeIcon(item.nodeType)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-zinc-300 truncate">{item.nodeName}</span>
                          <span className={cn(
                            "text-[7px] px-1 py-0.5 rounded uppercase shrink-0",
                            item.executionType === "pipeline" 
                              ? "bg-blue-500/10 text-blue-400" 
                              : "bg-white/[0.04] text-zinc-500"
                          )}>
                            {item.executionType}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Calendar className="w-2.5 h-2.5 text-zinc-600" />
                          <p className="text-[8px] text-zinc-600">{formatTimeAgo(item.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-400 shrink-0">
                      -{formatCredits(item.cost)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-white/[0.06] bg-white/[0.02] shrink-0">
            <Link href="/billing">
              <div className="flex items-center justify-between p-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg border border-white/[0.04] transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] text-zinc-400">View Full Billing History</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
              </div>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
