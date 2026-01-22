"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  MoreVertical,
  Clock,
  Trash2,
  Loader2,
  Search,
  ChevronDown,
  Workflow,
  Download,
  Upload,
  Pencil,
} from "lucide-react";
import { PageBackground, DotPattern } from "@/components/ui";
import { UserMenu } from "@/components/layout";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Sort options
const sortOptions = [
  { id: "last-viewed", label: "Last viewed" },
  { id: "last-modified", label: "Last modified" },
  { id: "name-asc", label: "Name (A-Z)" },
  { id: "name-desc", label: "Name (Z-A)" },
];

interface ContextMenuState {
  workflowId: string;
  workflowName: string;
  x: number;
  y: number;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState("last-viewed");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [renameModal, setRenameModal] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = trpc.workflow.list.useQuery();

  const deleteMutation = trpc.workflow.delete.useMutation({
    onSuccess: () => {
      refetch();
      setDeletingId(null);
      setContextMenu(null);
      toast.success("Workflow deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
      setDeletingId(null);
      setContextMenu(null);
    },
  });

  const updateMutation = trpc.workflow.update.useMutation({
    onSuccess: () => {
      refetch();
      setRenameModal(null);
      setNewName("");
      toast.success("Workflow renamed");
    },
    onError: (error) => {
      toast.error(`Failed to rename: ${error.message}`);
    },
  });

  const createMutation = trpc.workflow.create.useMutation({
    onSuccess: (data) => {
      refetch();
      setIsImporting(false);
      toast.success("Workflow imported successfully");
      router.push(`/workflows/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to import: ${error.message}`);
      setIsImporting(false);
    },
  });

  const workflows = data?.workflows ?? [];

  // Close context menu on click outside or escape
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setRenameModal(null);
      }
    };

    if (contextMenu || renameModal) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu, renameModal]);

  const handleContextMenu = (e: React.MouseEvent, workflowId: string, workflowName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      workflowId,
      workflowName,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) {
      return;
    }
    setDeletingId(id);
    deleteMutation.mutate({ id });
  };

  const handleRename = (id: string, currentName: string) => {
    setNewName(currentName);
    setRenameModal({ id, name: currentName });
    setContextMenu(null);
  };

  const submitRename = () => {
    if (!renameModal || !newName.trim()) return;
    updateMutation.mutate({ id: renameModal.id, name: newName.trim() });
  };

  const handleExport = async (workflowId: string) => {
    setExportingId(workflowId);
    setContextMenu(null);
    
    try {
      // Find the workflow in the list to get name
      const workflow = workflows.find(w => w.id === workflowId);
      if (!workflow) {
        toast.error("Workflow not found");
        return;
      }

      // Fetch full workflow data
      const response = await fetch(`/api/workflows/${workflowId}`);
      if (!response.ok) throw new Error("Failed to fetch workflow");
      
      const data = await response.json();
      const fullWorkflow = data.workflow;
      
      // Create export object
      const exportData = {
        name: fullWorkflow.name,
        description: fullWorkflow.description || "",
        nodesJson: fullWorkflow.nodesJson || [],
        edgesJson: fullWorkflow.edgesJson || [],
        viewportJson: fullWorkflow.viewportJson || { x: 0, y: 0, zoom: 1 },
        exportedAt: new Date().toISOString(),
        version: "1.0",
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${workflow.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_workflow.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Workflow exported");
    } catch (error) {
      toast.error("Failed to export workflow");
      console.error(error);
    } finally {
      setExportingId(null);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Validate required fields
      if (!importData.name || !Array.isArray(importData.nodesJson) || !Array.isArray(importData.edgesJson)) {
        throw new Error("Invalid workflow file format");
      }

      // Create new workflow from imported data
      createMutation.mutate({
        name: `${importData.name} (Imported)`,
        description: importData.description || "",
        nodesJson: importData.nodesJson,
        edgesJson: importData.edgesJson,
        viewportJson: importData.viewportJson || { x: 0, y: 0, zoom: 1 },
      });
    } catch (error) {
      toast.error("Failed to import: Invalid file format");
      setIsImporting(false);
      console.error(error);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatRelativeTime = (date: Date | string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filteredWorkflows = workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(filter.toLowerCase()) ||
      (w.description &&
        w.description.toLowerCase().includes(filter.toLowerCase()))
  );

  // Sort workflows
  const sortedWorkflows = [...filteredWorkflows].sort((a, b) => {
    switch (sortBy) {
      case "last-modified":
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      default:
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }
  });

  return (
    <PageBackground>
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b border-[#6b6b6b] dark:border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-200 dark:bg-zinc-800/50 flex items-center justify-center">
            <Workflow className="w-4 h-4 text-blue-600 dark:text-zinc-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Workflows</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-500">
              {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Right side: Import, Search, Sort, User */}
        <div className="flex items-center gap-3">
          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 bg-gray-100 dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Import
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-56 bg-gray-100 dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-gray-300 dark:focus:border-zinc-700 focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-700 transition-colors"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 bg-gray-100 dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800 rounded-lg transition-colors"
            >
              {sortOptions.find((o) => o.id === sortBy)?.label}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <AnimatePresence>
              {showSortDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-zinc-900 border border-[#6b6b6b] dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50"
                >
                  {sortOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortBy(option.id);
                        setShowSortDropdown(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm transition-colors",
                        sortBy === option.id
                          ? "bg-gray-100 dark:bg-blue-600/20 text-gray-900 dark:text-blue-400"
                          : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-zinc-200"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Menu with Theme Toggle */}
          <UserMenu />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* Skeleton for New Workflow Card */}
            <div className="relative bg-[#f8f9fb] dark:bg-zinc-900/50 border border-gray-300 dark:border-zinc-800/60 border-dashed rounded-xl overflow-hidden shadow-md">
              <div className="aspect-[4/3] flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 animate-pulse" />
                <div className="h-4 w-24 bg-gray-100 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
            {/* Skeleton Workflow Cards */}
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="relative bg-[#f8f9fb] dark:bg-zinc-900/50 border border-gray-300 dark:border-zinc-800/60 rounded-xl overflow-hidden shadow-md"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Thumbnail skeleton */}
                <div className="aspect-[4/3] bg-gray-50 dark:bg-zinc-800/50 relative overflow-hidden">
                  {/* Fake nodes */}
                  <div className="absolute inset-4 flex flex-col justify-center gap-2">
                    <div className="flex justify-center gap-8">
                      <div className="w-8 h-5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
                    </div>
                    <div className="flex justify-between px-4">
                      <div className="w-8 h-5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" style={{ animationDelay: '100ms' }} />
                      <div className="w-8 h-5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" style={{ animationDelay: '200ms' }} />
                    </div>
                    <div className="flex justify-center gap-8">
                      <div className="w-8 h-5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                  {/* Shimmer overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-pulse" />
                </div>
                {/* Info skeleton */}
                <div className="p-3 border-t border-gray-200 dark:border-zinc-800/60 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-gray-100 dark:bg-zinc-800/50 animate-pulse" />
                    <div className="h-3 w-20 bg-gray-100 dark:bg-zinc-800/50 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* New Workflow Card - Dashboard style */}
            <Link href="/workflows/new">
              <motion.div
                whileTap={{ scale: 0.98 }}
                className="group relative bg-[#f8f9fb] dark:bg-zinc-900/50 border-2 border-blue-300 dark:border-zinc-800/60 border-dashed rounded-xl overflow-hidden transition-all shadow-md hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500/20"
              >
                <DotPattern className="text-blue-500/5 group-hover:text-blue-500/10 transition-colors" />
                <div className="relative aspect-[4/3] flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-200 dark:bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-300 dark:group-hover:bg-blue-500/20 transition-colors">
                    <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-bold text-blue-600 dark:text-zinc-400 group-hover:text-blue-700 dark:group-hover:text-zinc-300">
                    New Workflow
                  </span>
                </div>
              </motion.div>
            </Link>

            {/* Workflow Cards - Dashboard style */}
            {sortedWorkflows.map((workflow, idx) => (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onContextMenu={(e) => handleContextMenu(e, workflow.id, workflow.name)}
                className="relative"
              >
                <Link href={`/workflows/${workflow.id}`}>
                  <div
                    className={cn(
                      "group relative bg-[#f8f9fb] dark:bg-zinc-900/50 border border-gray-300 dark:border-zinc-800/60 rounded-xl overflow-hidden transition-all shadow-md hover:shadow-lg hover:border-violet-400 dark:hover:border-violet-500/20"
                    )}
                  >
                    <DotPattern className="text-violet-500/5 group-hover:text-violet-500/10 transition-colors" />

                    {/* Thumbnail Area */}
                    <div className="relative aspect-[4/3]">
                      <WorkflowMinimap
                        nodes={workflow.thumbnailNodes}
                        edges={workflow.thumbnailEdges}
                        workflowId={workflow.id}
                      />

                      {/* Three-dot menu button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setContextMenu({
                            workflowId: workflow.id,
                            workflowName: workflow.name,
                            x: rect.right - 160,
                            y: rect.bottom + 8,
                          });
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-gray-200/50 dark:border-zinc-700/50"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Workflow Info */}
                    <div className="relative p-3 border-t border-gray-200 dark:border-zinc-800/60">
                      <h3 className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors pr-6">
                        {workflow.name || "Untitled"}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Edited {formatRelativeTime(workflow.updatedAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State - Dashboard style */}
        {!isLoading && workflows.length === 0 && (
          <div className="relative bg-[#f8f9fb] dark:bg-zinc-900/50 border border-gray-300 dark:border-zinc-800/60 rounded-xl overflow-hidden shadow-md">
            <DotPattern className="text-blue-500/5 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
            <div className="relative flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-xl bg-blue-200 dark:bg-violet-500/10 flex items-center justify-center mb-5">
                <Workflow className="w-7 h-7 text-blue-600 dark:text-violet-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-zinc-200 mb-1">
                No workflows yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-6">
                Create your first workflow or import one
              </p>
              <div className="flex items-center gap-3">
                <Link href="/workflows/new">
                  <button className="px-4 py-2.5 bg-blue-100 hover:bg-blue-200 border-2 border-blue-400 hover:border-blue-500 dark:bg-white/10 dark:hover:bg-white/15 dark:border-0 text-blue-600 dark:text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Workflow
                  </button>
                </Link>
                <button
                  onClick={handleImport}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Import
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No Results */}
        {!isLoading &&
          workflows.length > 0 &&
          filteredWorkflows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <Search className="w-10 h-10 text-gray-300 dark:text-zinc-700 mb-4" />
              <p className="text-sm text-gray-500 dark:text-zinc-500">
                No workflows match "{filter}"
              </p>
            </div>
          )}
      </div>

      {/* Click outside handlers */}
      {showSortDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSortDropdown(false)}
        />
      )}

      {/* Right-Click Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[100] w-40 bg-white dark:bg-zinc-900 border border-[#6b6b6b] dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
            style={{
              left: Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 176 : contextMenu.x),
              top: Math.min(contextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 160 : contextMenu.y),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-1">
              {/* Rename */}
              <button
                onClick={() => handleRename(contextMenu.workflowId, contextMenu.workflowName)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-3 transition-colors"
              >
                <Pencil className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                Rename
              </button>

              {/* Export */}
              <button
                onClick={() => handleExport(contextMenu.workflowId)}
                disabled={exportingId === contextMenu.workflowId}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                {exportingId === contextMenu.workflowId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                )}
                Export
              </button>

              {/* Divider */}
              <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />

              {/* Delete */}
              <button
                onClick={() => handleDelete(contextMenu.workflowId)}
                disabled={deletingId === contextMenu.workflowId}
                className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                {deletingId === contextMenu.workflowId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {renameModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setRenameModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-[#6b6b6b] dark:border-zinc-800 rounded-xl shadow-2xl p-6 w-96"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rename Workflow</h3>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename();
                  if (e.key === "Escape") setRenameModal(null);
                }}
                placeholder="Workflow name"
                autoFocus
                className="w-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setRenameModal(null)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRename}
                  disabled={!newName.trim() || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Rename
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageBackground>
  );
}

// Minimap-style workflow preview - renders nodes exactly like ReactFlow MiniMap
function WorkflowMinimap({
  nodes,
  edges,
  workflowId,
}: {
  nodes: Array<{ id: string; position: { x: number; y: number }; width?: number; height?: number }>;
  edges: Array<{ id: string; source: string; target: string }>;
  workflowId: string;
}) {
  const { bounds, scaledNodes } = useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return { bounds: null, scaledNodes: [] };
    }

    // Filter out nodes with invalid positions to prevent crashes
    const validNodes = nodes.filter((node) => 
      node.position && typeof node.position.x === "number" && typeof node.position.y === "number"
    );
    
    if (validNodes.length === 0) {
      return { bounds: null, scaledNodes: [] };
    }

    // Default node dimensions
    const defaultW = 280;
    const defaultH = 180;

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    validNodes.forEach((node) => {
      const w = node.width || defaultW;
      const h = node.height || defaultH;
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + w);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + h);
    });

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    // Scale to fit with padding
    const padding = 12;
    const availableW = 100 - padding * 2;
    const availableH = 100 - padding * 2;
    const scale = Math.min(availableW / width, availableH / height) * 0.9;

    // Center offset
    const scaledW = width * scale;
    const scaledH = height * scale;
    const offsetX = (100 - scaledW) / 2;
    const offsetY = (100 - scaledH) / 2;

    const scaledNodes = validNodes.map((node) => ({
      id: node.id,
      x: offsetX + (node.position.x - minX) * scale,
      y: offsetY + (node.position.y - minY) * scale,
      w: (node.width || defaultW) * scale,
      h: (node.height || defaultH) * scale,
    }));

    return {
      bounds: { minX, maxX, minY, maxY, width, height, scale, offsetX, offsetY },
      scaledNodes,
    };
  }, [nodes]);

  // Empty state
  if (!bounds || scaledNodes.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-10 h-14 bg-gray-200 dark:bg-zinc-700/50 rounded" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <svg
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Mask for viewport effect like minimap */}
        <defs>
          <mask id={`minimap-mask-${workflowId}`}>
            <rect width="100" height="100" fill="white" />
          </mask>
        </defs>

        {/* Background with slight blue tint like minimap */}
        <rect
          width="100"
          height="100"
          fill="rgba(59, 130, 246, 0.03)"
          mask={`url(#minimap-mask-${workflowId})`}
        />

        {/* Draw nodes as rectangles - matching minimap gray color */}
        {scaledNodes.map((node) => (
          <rect
            key={node.id}
            x={node.x}
            y={node.y}
            width={node.w}
            height={node.h}
            rx={1}
            ry={1}
            fill="#6b7280"
            opacity={0.8}
          />
        ))}
      </svg>
    </div>
  );
}
