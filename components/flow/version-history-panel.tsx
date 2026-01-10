"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  X,
  RotateCcw,
  Clock,
  Layers,
  Trash2,
  Loader2,
  History,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { format, formatDistanceToNow } from "date-fns";

interface VersionHistoryPanelProps {
  workflowId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (nodesJson: unknown[], edgesJson: unknown[], viewportJson?: unknown) => void;
}

export function VersionHistoryPanel({
  workflowId,
  isOpen,
  onClose,
  onRestore,
}: VersionHistoryPanelProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch versions with auto-refresh every 3 seconds when open
  const { data, isLoading, refetch } = trpc.version.list.useQuery(
    { workflowId },
    { 
      enabled: isOpen && workflowId !== "new",
      refetchInterval: isOpen ? 3000 : false, // Auto-refresh every 3s
    }
  );

  // Refetch when panel opens
  useEffect(() => {
    if (isOpen && workflowId !== "new") {
      refetch();
    }
  }, [isOpen, workflowId, refetch]);

  // Restore version mutation
  const restoreVersion = trpc.version.restore.useMutation({
    onSuccess: (data) => {
      if (data.workflow) {
        onRestore(
          data.workflow.nodesJson as unknown[],
          data.workflow.edgesJson as unknown[],
          data.workflow.viewportJson
        );
      }
      setIsRestoring(false);
      setSelectedVersion(null);
      refetch();
    },
    onError: () => {
      setIsRestoring(false);
    },
  });

  // Delete version mutation
  const deleteVersion = trpc.version.delete.useMutation({
    onSuccess: () => {
      refetch();
      setExpandedId(null);
    },
  });

  const handleRestore = (versionId: string) => {
    if (workflowId === "new") return;
    setIsRestoring(true);
    setSelectedVersion(versionId);
    restoreVersion.mutate({ workflowId, versionId });
  };

  const versions = data?.versions ?? [];

  // Format timestamp nicely
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    // Same day - show time
    if (date.toDateString() === now.toDateString()) {
      return format(date, "h:mm a");
    }
    
    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${format(date, "h:mm a")}`;
    }
    
    // This week - show day and time
    if (diffMs < 7 * 24 * 60 * 60 * 1000) {
      return format(date, "EEE h:mm a");
    }
    
    // Older - show date
    return format(date, "MMM d, h:mm a");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="fixed right-3 top-16 bottom-3 w-[340px] z-40"
        >
          <div className="h-full bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900 to-zinc-950">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
                    <History className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Versions</h3>
                    <p className="text-[10px] text-zinc-500">Auto-saved on every save</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Version Count */}
            {versions.length > 0 && (
              <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">
                    {versions.length} version{versions.length !== 1 ? "s" : ""} saved
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {isLoading ? "Syncing..." : "Live"}
                  </span>
                </div>
              </div>
            )}

            {/* Version List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading && versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-600 mb-3" />
                  <p className="text-xs text-zinc-500">Loading versions...</p>
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                    <GitBranch className="w-6 h-6 text-zinc-600" />
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">No versions yet</p>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Save your workflow to create the first version
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {versions.map((version, index) => {
                    const isExpanded = expandedId === version.id;
                    const isLatest = index === 0;
                    
                    return (
                      <motion.div
                        key={version.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={`rounded-xl border transition-all overflow-hidden ${
                          selectedVersion === version.id
                            ? "bg-blue-500/10 border-blue-500/30"
                            : isExpanded
                            ? "bg-zinc-900 border-zinc-700/80"
                            : "bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700/50"
                        }`}
                      >
                        {/* Main Row - Clickable */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : version.id)}
                          className="w-full text-left p-3 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {/* Version Badge */}
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isLatest 
                                ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30" 
                                : "bg-zinc-800/80 border border-zinc-700/50"
                            }`}>
                              <span className={`text-sm font-bold font-mono ${
                                isLatest ? "text-emerald-400" : "text-zinc-400"
                              }`}>
                                {version.version}
                              </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                {isLatest && (
                                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Current
                                  </span>
                                )}
                                <span className="text-xs text-zinc-300 truncate">
                                  {version.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatTime(version.createdAt)}</span>
                                </div>
                                <span className="text-zinc-700">•</span>
                                <div className="flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  <span>{version.nodeCount}</span>
                                </div>
                              </div>
                            </div>

                            {/* Chevron */}
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.15 }}
                              className="text-zinc-600"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </motion.div>
                          </div>
                        </button>

                        {/* Expanded Actions */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <div className="px-3 pb-3 pt-1 border-t border-zinc-800/50">
                                {/* Full Timestamp */}
                                <div className="flex items-center gap-2 text-[10px] text-zinc-600 mb-3 px-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{format(new Date(version.createdAt), "EEEE, MMMM d, yyyy 'at' h:mm:ss a")}</span>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestore(version.id);
                                    }}
                                    disabled={isRestoring || isLatest}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                      isLatest
                                        ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                                        : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30"
                                    }`}
                                  >
                                    {isRestoring && selectedVersion === version.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    )}
                                    {isLatest ? "Current Version" : "Restore"}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteVersion.mutate({ versionId: version.id });
                                    }}
                                    disabled={deleteVersion.isPending}
                                    className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-zinc-800/50 bg-zinc-900/30">
              <p className="text-[10px] text-zinc-600 text-center">
                Restore backs up current state automatically
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

