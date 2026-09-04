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
import { PageBackground, DotPattern, Logo } from "@/components/ui";
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

 {/* Hero Header */}
 <div className="relative z-10 shrink-0 px-8 py-5 flex items-center justify-between border-b border-blue-100 dark:border-zinc-800/60 bg-white dark:bg-[#09090b]/80 ">
 <div className="flex items-center gap-3">
 <h1 className="text-[20px] font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Workflows</h1>
 <span className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-400 border border-blue-100 dark:border-zinc-700/50">
 {workflows.length}
 </span>
 </div>

 {/* Primary Actions */}
 <div className="flex items-center gap-3">
 <button
 onClick={handleImport}
 disabled={isImporting}
 className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-blue-100 dark:border-zinc-800 hover:bg-white/60 dark:hover:bg-zinc-800/80 rounded-md shadow-sm transition-all disabled:opacity-50"
 >
 {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 opacity-70" />}
 Import
 </button>

 {/* User Menu with Theme Toggle */}
 <div className="pl-3 border-l border-blue-100 dark:border-zinc-800 ml-1">
 <UserMenu />
 </div>
 </div>
 </div>

 {/* Filter Bar */}
 <div className="relative z-10 shrink-0 px-8 py-3 flex items-center justify-between border-b border-blue-100 dark:border-white/5 bg-white dark:bg-black/10 ">
 <div className="relative">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-800 dark:text-zinc-500" />
 <input
 type="text"
 placeholder="Search workflows..."
 value={filter}
 onChange={(e) => setFilter(e.target.value)}
 className="w-64 bg-white dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-xl pl-10 pr-4 py-1.5 text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-sm"
 />
 </div>

 <div className="relative">
 <button
 onClick={() => setShowSortDropdown(!showSortDropdown)}
 className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-transparent border border-transparent hover:bg-white/60 dark:hover:bg-white/5 rounded-xl transition-all"
 >
 <span className="text-slate-700 dark:text-zinc-500">Sort by:</span>
 {sortOptions.find((o) => o.id === sortBy)?.label}
 <ChevronDown className="w-4 h-4 text-slate-800" />
 </button>
 <AnimatePresence>
 {showSortDropdown && (
 <motion.div
 initial={{ opacity: 0, y: 10, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 10, scale: 0.95 }}
 transition={{ duration: 0.15 }}
 className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900/95 border border-blue-100 dark:border-white/10 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden z-50 "
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
 ? "bg-white dark:bg-blue-600/20 text-slate-900 dark:text-blue-400"
 : "text-slate-800 dark:text-zinc-400 hover:bg-white/60 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-zinc-200"
 )}
 >
 {option.label}
 </button>
 ))}
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>

 <div className="flex-1 overflow-auto p-8 relative z-0">
 {isLoading && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
 {/* Skeleton Workflow Cards */}
 {[...Array(8)].map((_, i) => (
 <div
 key={i}
 className="relative bg-white dark:bg-zinc-900/40 border border-blue-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm "
 style={{ animationDelay: `${i * 50}ms` }}
 >
 {/* Thumbnail skeleton */}
 <div className="aspect-video bg-gray-50/50 dark:bg-black/20 relative overflow-hidden">
 {/* Fake nodes */}
 <div className="absolute inset-4 flex flex-col justify-center gap-2">
 <div className="flex justify-center gap-8">
 <div className="w-8 h-5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
 </div>
 <div className="flex justify-between px-4">
 <div className="w-8 h-5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" style={{ animationDelay: '100ms' }} />
 <div className="w-8 h-5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" style={{ animationDelay: '200ms' }} />
 </div>
 </div>
 {/* Shimmer overlay */}
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-pulse" />
 </div>
 {/* Info skeleton */}
 <div className="p-5 flex flex-col justify-between h-20">
 <div className="h-4 w-3/4 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
 <div className="h-3 w-32 bg-white dark:bg-zinc-800/50 rounded animate-pulse" />
 </div>
 </div>
 ))}
 </div>
 )}

 {!isLoading && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

 {/* Workflow Cards - Dashboard style */}
 {sortedWorkflows.map((workflow, idx) => (
 <motion.div
 key={workflow.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: idx * 0.03, type: "spring", stiffness: 300, damping: 25 }}
 onContextMenu={(e) => handleContextMenu(e, workflow.id, workflow.name)}
 className="relative h-full"
 >
 <Link href={`/workflows/${workflow.id}`} className="block h-full">
 <motion.div
 whileHover={{ y: -4, scale: 1.01 }}
 className={cn(
 "group h-full flex flex-col relative bg-white dark:bg-zinc-900/40 border border-blue-100 dark:border-white/5 rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-black/50 hover:border-gray-300 dark:hover:border-white/10"
 )}
 >
 {/* Thumbnail Area */}
 <div className="relative aspect-video bg-gray-50/50 dark:bg-[#0a0a0b] border-b border-gray-100 dark:border-white/5 overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 dark:to-white/[0.02] pointer-events-none z-10" />
 
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
 className="absolute top-3 right-3 p-2 rounded-xl bg-white dark:bg-black/60 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-zinc-800 transition-all opacity-0 group-hover:opacity-100 shadow-md border border-blue-100 dark:border-white/10 z-20"
 >
 <MoreVertical className="w-4 h-4" />
 </button>
 </div>

 {/* Workflow Info */}
 <div className="relative flex-1 p-5 flex flex-col justify-between">
 <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors pr-6">
 {workflow.name || "Untitled"}
 </h3>
 <p className="text-[12px] font-medium text-slate-700 dark:text-zinc-500 mt-2 flex items-center gap-1.5">
 Edited {formatRelativeTime(workflow.updatedAt)}
 </p>
 </div>
 </motion.div>
 </Link>
 </motion.div>
 ))}
 </div>
 )}

 {/* Empty State - Professional Minimalist */}
 {!isLoading && workflows.length === 0 && (
 <div className="max-w-md mx-auto mt-24 flex flex-col items-center text-center">
 <div className="w-16 h-16 rounded-full bg-white dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800/80 flex items-center justify-center mb-6 shadow-sm">
 <Workflow className="w-7 h-7 text-slate-800 dark:text-zinc-500" />
 </div>
 
 <h3 className="text-[17px] font-semibold text-slate-900 dark:text-zinc-100 mb-2">
 No workflows yet
 </h3>
 
 <p className="text-[14px] text-slate-700 dark:text-zinc-400 mb-8 max-w-[280px] leading-relaxed">
 Create your first workflow to start automating your tasks and sequences.
 </p>
 
 <Link href="/workflows/new">
 <motion.button 
 whileHover={{ opacity: 0.9 }} 
 whileTap={{ scale: 0.98 }} 
 className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-zinc-900 text-[14px] font-medium rounded-md shadow-sm transition-all"
 >
 <Plus className="w-4 h-4 opacity-80" />
 Create Workflow
 </motion.button>
 </Link>
 </div>
 )}

 {/* No Results */}
 {!isLoading &&
 workflows.length > 0 &&
 filteredWorkflows.length === 0 && (
 <div className="flex flex-col items-center justify-center py-16">
 <Search className="w-10 h-10 text-slate-600 dark:text-zinc-700 mb-4" />
 <p className="text-sm text-slate-700 dark:text-zinc-500">
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
 className="fixed z-[100] w-48 bg-white dark:bg-zinc-900/95 border border-blue-100 dark:border-white/10 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden "
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
 className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-zinc-300 hover:bg-white/70 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-3 transition-colors"
 >
 <Pencil className="w-4 h-4 text-slate-700 dark:text-zinc-400" />
 Rename
 </button>

 {/* Export */}
 <button
 onClick={() => handleExport(contextMenu.workflowId)}
 disabled={exportingId === contextMenu.workflowId}
 className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-zinc-300 hover:bg-white/70 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50"
 >
 {exportingId === contextMenu.workflowId ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Download className="w-4 h-4 text-slate-700 dark:text-zinc-400" />
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
 className="bg-white dark:bg-zinc-900/95 border border-blue-100 dark:border-white/10 rounded-2xl shadow-2xl p-6 w-[400px] "
 onClick={(e) => e.stopPropagation()}
 >
 <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Rename Workflow</h3>
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
 className="w-full bg-white dark:bg-zinc-800 border border-blue-100 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-zinc-200 placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
 />
 <div className="flex justify-end gap-3 mt-4">
 <button
 onClick={() => setRenameModal(null)}
 className="px-4 py-2 text-sm text-slate-800 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors"
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
