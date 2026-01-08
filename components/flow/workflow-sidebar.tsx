"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Home,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileText,
  Loader2,
  Check,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";

interface WorkflowSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkflowId?: string;
}

export function WorkflowSidebar({ isOpen, onClose, currentWorkflowId }: WorkflowSidebarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Fetch workflows
  const { data: workflowsData, isLoading, error } = trpc.workflow.list.useQuery(undefined, {
    enabled: isOpen,
    retry: 1,
  });

  const workflows = workflowsData?.workflows ?? [];
  const hasError = !!error;

  // Mutations
  const renameMutation = trpc.workflow.update.useMutation({
    onSuccess: () => {
      utils.workflow.list.invalidate();
      setEditingId(null);
    },
  });

  const deleteMutation = trpc.workflow.delete.useMutation({
    onSuccess: (_, variables) => {
      utils.workflow.list.invalidate();
      setDeleteConfirm(null);
      // If we deleted the current workflow, go to workflows page
      if (variables.id === currentWorkflowId) {
        router.push("/workflows");
      }
    },
  });

  // Focus input when editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setMenuOpen(null);
  }, []);

  const handleSaveRename = useCallback(() => {
    if (!editingId || !editName.trim()) return;
    renameMutation.mutate({ id: editingId, name: editName.trim() });
  }, [editingId, editName, renameMutation]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate({ id });
  }, [deleteMutation]);

  const handleWorkflowClick = useCallback((id: string) => {
    onClose();
    router.push(`/workflows/${id}`);
  }, [onClose, router]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    if (menuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-zinc-950 border-r border-zinc-800 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-violet-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Workflows</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dashboard Link */}
            <div className="px-3 py-2 border-b border-zinc-800/50">
              <Link
                href="/dashboard"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="text-sm font-medium">Go to Dashboard</span>
              </Link>
            </div>

            {/* New Workflow Button */}
            <div className="px-3 py-2">
              <Link
                href="/workflows/new"
                onClick={onClose}
                className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">New Workflow</span>
              </Link>
            </div>

            {/* Workflows List */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                </div>
              ) : hasError ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                    <X className="w-5 h-5 text-red-400" />
                  </div>
                  <p className="text-sm text-red-400">Failed to load workflows</p>
                  <p className="text-xs text-zinc-600 mt-1">Please try again later</p>
                </div>
              ) : workflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-10 h-10 text-zinc-700 mb-3" />
                  <p className="text-sm text-zinc-500">No workflows yet</p>
                  <p className="text-xs text-zinc-600 mt-1">Create your first workflow</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {workflows.map((workflow) => {
                    const isActive = workflow.id === currentWorkflowId;
                    const isEditing = editingId === workflow.id;
                    const isDeleting = deleteConfirm === workflow.id;

                    return (
                      <div
                        key={workflow.id}
                        className={cn(
                          "group relative rounded-xl transition-all",
                          isActive
                            ? "bg-violet-500/10 border border-violet-500/30"
                            : "hover:bg-zinc-800/50 border border-transparent"
                        )}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveRename();
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="flex-1 px-2 py-1 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-violet-500"
                            />
                            <button
                              onClick={handleSaveRename}
                              disabled={renameMutation.isPending}
                              className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors"
                            >
                              {renameMutation.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-800 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : isDeleting ? (
                          <div className="px-3 py-2.5">
                            <p className="text-xs text-red-400 mb-2">Delete "{workflow.name}"?</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDelete(workflow.id)}
                                disabled={deleteMutation.isPending}
                                className="flex-1 px-2 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                                ) : (
                                  "Delete"
                                )}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 px-2 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <button
                              onClick={() => handleWorkflowClick(workflow.id)}
                              className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left"
                            >
                              <FileText className={cn(
                                "w-4 h-4 shrink-0",
                                isActive ? "text-violet-400" : "text-zinc-500"
                              )} />
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-sm font-medium truncate",
                                  isActive ? "text-violet-300" : "text-zinc-300"
                                )}>
                                  {workflow.name}
                                </p>
                                <p className="text-[10px] text-zinc-600 truncate">
                                  {new Date(workflow.updatedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </button>

                            {/* Actions Menu */}
                            <div className="relative pr-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpen(menuOpen === workflow.id ? null : workflow.id);
                                }}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  menuOpen === workflow.id
                                    ? "bg-zinc-800 text-zinc-300"
                                    : "text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-zinc-800 hover:text-zinc-300"
                                )}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {/* Dropdown Menu */}
                              <AnimatePresence>
                                {menuOpen === workflow.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1 w-36 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-10"
                                  >
                                    <button
                                      onClick={() => handleStartRename(workflow.id, workflow.name)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                      Rename
                                    </button>
                                    <button
                                      onClick={() => {
                                        setDeleteConfirm(workflow.id);
                                        setMenuOpen(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Delete
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-zinc-800 text-center">
              <p className="text-[10px] text-zinc-600">
                {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default WorkflowSidebar;
