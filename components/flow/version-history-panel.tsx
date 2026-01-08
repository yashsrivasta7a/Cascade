"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  X,
  RotateCcw,
  Clock,
  Layers,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  Save,
} from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { formatDistanceToNow } from "date-fns";

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
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const utils = trpc.useUtils();

  // Fetch versions
  const { data, isLoading, refetch } = trpc.version.list.useQuery(
    { workflowId },
    { enabled: isOpen && workflowId !== "new" }
  );

  // Create version mutation
  const createVersion = trpc.version.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowSaveInput(false);
      setSaveMessage("");
    },
  });

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
    },
  });

  const handleSaveVersion = () => {
    if (workflowId === "new") return;
    createVersion.mutate({
      workflowId,
      message: saveMessage || undefined,
    });
  };

  const handleRestore = (versionId: string) => {
    if (workflowId === "new") return;
    setIsRestoring(true);
    setSelectedVersion(versionId);
    restoreVersion.mutate({ workflowId, versionId });
  };

  const versions = data?.versions ?? [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed right-3 top-16 bottom-3 w-80 z-40"
        >
          <div className="h-full bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20">
                  <GitBranch className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm font-medium text-zinc-200">Version History</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Save New Version */}
            <div className="px-4 py-3 border-b border-zinc-800/50">
              {showSaveInput ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={saveMessage}
                    onChange={(e) => setSaveMessage(e.target.value)}
                    placeholder="Version note (optional)"
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveVersion();
                      if (e.key === "Escape") {
                        setShowSaveInput(false);
                        setSaveMessage("");
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveVersion}
                      disabled={createVersion.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {createVersion.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowSaveInput(false);
                        setSaveMessage("");
                      }}
                      className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  disabled={workflowId === "new"}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  Save Current Version
                </button>
              )}
            </div>

            {/* Version List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="p-3 rounded-full bg-zinc-800/50 mb-3">
                    <GitBranch className="w-6 h-6 text-zinc-500" />
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">No versions saved yet</p>
                  <p className="text-xs text-zinc-500">
                    Save versions to track your workflow changes
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {versions.map((version, index) => (
                    <motion.div
                      key={version.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`group p-3 rounded-xl border transition-all ${
                        selectedVersion === version.id
                          ? "bg-blue-500/10 border-blue-500/30"
                          : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-mono font-medium text-blue-400 bg-blue-500/20 rounded">
                            v{version.version}
                          </span>
                          {index === 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/20 rounded">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleRestore(version.id)}
                            disabled={isRestoring}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                            title="Restore this version"
                          >
                            {isRestoring && selectedVersion === version.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteVersion.mutate({ versionId: version.id })}
                            disabled={deleteVersion.isPending}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Delete version"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-zinc-300 truncate mb-2">
                        {version.name}
                      </p>

                      {version.message && (
                        <p className="text-xs text-zinc-500 mb-2 line-clamp-2">
                          {version.message}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <div className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>{version.nodeCount} nodes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatDistanceToNow(new Date(version.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Restore button for mobile / touch */}
                      <button
                        onClick={() => handleRestore(version.id)}
                        disabled={isRestoring}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-700/50 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg transition-colors disabled:opacity-50 md:hidden"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-zinc-800/50">
              <p className="text-[10px] text-zinc-500 text-center">
                Restoring a version auto-saves current state
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

