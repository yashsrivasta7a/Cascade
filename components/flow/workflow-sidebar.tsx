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
 LayoutGrid,
 Search,
 Command,
 ChevronRight,
 User,
 Settings,
 LogOut,
 ChevronUp,
 CreditCard,
 UserCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui";

interface WorkflowSidebarProps {
 isOpen: boolean;
 onClose: () => void;
 currentWorkflowId?: string;
}

export function WorkflowSidebar({ isOpen, onClose, currentWorkflowId }: WorkflowSidebarProps) {
 const router = useRouter();
 const { user } = useUser();
 const { signOut } = useClerk();
 const [menuOpen, setMenuOpen] = useState<string | null>(null);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editName, setEditName] = useState("");
 const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState("");
 const [userMenuOpen, setUserMenuOpen] = useState(false);
 const editInputRef = useRef<HTMLInputElement>(null);
 const userMenuRef = useRef<HTMLDivElement>(null);
 
 // Close user menu when clicking outside
 useEffect(() => {
 const handleClickOutside = (e: MouseEvent) => {
 if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
 setUserMenuOpen(false);
 }
 };
 
 if (userMenuOpen) {
 document.addEventListener("mousedown", handleClickOutside);
 }
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, [userMenuOpen]);
 
 // Close user menu when sidebar closes
 useEffect(() => {
 if (!isOpen) setUserMenuOpen(false);
 }, [isOpen]);

 const utils = trpc.useUtils();

 // Fetch workflows
 const { data: workflowsData, isLoading, error } = trpc.workflow.list.useQuery(undefined, {
 enabled: isOpen,
 retry: 1,
 });

 const workflows = workflowsData?.workflows ?? [];
 const filteredWorkflows = workflows.filter(w => 
 w.name.toLowerCase().includes(searchQuery.toLowerCase())
 );
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
 transition={{ duration: 0.2 }}
 onClick={onClose}
 className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
 />

 {/* Sidebar */}
 <motion.div
 initial={{ x: "-100%" }}
 animate={{ x: 0 }}
 exit={{ x: "-100%" }}
 transition={{ 
 type: "tween",
 duration: 0.25,
 ease: [0.32, 0.72, 0, 1]
 }}
 style={{ willChange: "transform" }}
 className="fixed left-0 top-0 bottom-0 w-[340px] z-50 flex flex-col"
 >
 {/* Glass container */}
 <div className="relative h-full flex flex-col bg-white dark:bg-white/[0.03] border-r border-blue-100 dark:border-white/[0.08] shadow-2xl shadow-gray-400/30 dark:shadow-black/50">
 {/* Glass inner highlight */}
 <div className="absolute inset-0 bg-gradient-to-b from-gray-100/30 dark:from-white/[0.03] to-transparent pointer-events-none" />
 
 {/* Header */}
 <div className="relative p-4 border-b border-blue-100 dark:border-white/[0.06]">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 {/* Logo */}
 <Logo className="w-10 h-10 text-slate-900 dark:text-white" />
 <div>
 <h2 className="font-display text-base text-slate-900 dark:text-white uppercase tracking-[0.14em]">Cascade</h2>
 <p className="text-[10px] text-slate-700 dark:text-zinc-500 font-medium">Studio</p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="p-2 rounded-xl text-slate-800 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.05] transition-all"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 {/* Navigation Links */}
 <div className="space-y-1">
 <Link
 href="/workflows"
 onClick={onClose}
 className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-800 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/[0.05] transition-all group"
 >
 <div className="p-1.5 rounded-lg bg-gray-100/80 dark:bg-white/[0.05] group-hover:bg-gray-200/80 dark:group-hover:bg-white/60/[0.08] transition-colors">
 <Home className="w-4 h-4 text-slate-700 dark:text-zinc-500 group-hover:text-slate-900 dark:group-hover:text-slate-700 transition-colors" />
 </div>
 <span className="text-sm font-medium">Workflows</span>
 </Link>
 
 <Link
 href="/workflows/new"
 onClick={onClose}
 className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-800 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/[0.05] transition-all group"
 >
 <div className="p-1.5 rounded-lg bg-blue-100/80 dark:bg-blue-500/10 group-hover:bg-blue-200/80 dark:group-hover:bg-blue-500/20 transition-colors">
 <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
 </div>
 <span className="text-sm font-medium">New Project</span>
 <div className="ml-auto">
 <div className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-100/80 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/20">
 NEW
 </div>
 </div>
 </Link>
 </div>
 </div>

 {/* Search */}
 <div className="relative px-4 py-3">
 <div className="relative group">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-800 dark:text-zinc-500 group-focus-within:text-slate-800 dark:group-focus-within:text-slate-600 transition-colors" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search projects..."
 className="w-full pl-9 pr-3 py-2.5 bg-gray-100/60 dark:bg-white/[0.03] border border-blue-100 dark:border-white/[0.06] rounded-xl text-sm text-slate-700 dark:text-zinc-200 placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:border-gray-300/80 dark:focus:border-white/[0.12] focus:bg-white/80 dark:focus:bg-white/[0.05] transition-all backdrop-blur-sm"
 />
 <div className="absolute right-3 top-1/2 -translate-y-1/2">
 <Command className="w-3 h-3 text-slate-600 dark:text-zinc-700" />
 </div>
 </div>
 </div>

 {/* Section Label */}
 <div className="relative px-4 pb-2 pt-2">
 <h3 className="text-[10px] font-semibold text-slate-700 dark:text-zinc-500 uppercase tracking-wider">Recent Projects</h3>
 </div>

 {/* Workflows List */}
 <div className="relative flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
 {isLoading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-5 h-5 text-slate-800 dark:text-zinc-600 animate-spin" />
 </div>
 ) : hasError ? (
 <div className="flex flex-col items-center justify-center py-12 text-center px-4">
 <div className="w-10 h-10 rounded-xl bg-red-100/80 dark:bg-red-500/10 border border-red-200/80 dark:border-red-500/20 flex items-center justify-center mb-3 backdrop-blur-sm">
 <X className="w-5 h-5 text-red-500 dark:text-red-400" />
 </div>
 <p className="text-sm text-red-600 dark:text-red-400">Failed to load projects</p>
 </div>
 ) : filteredWorkflows.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <div className="w-10 h-10 rounded-xl bg-gray-100/80 dark:bg-white/[0.03] border border-blue-100 dark:border-white/[0.06] flex items-center justify-center mb-3 backdrop-blur-sm">
 <FileText className="w-5 h-5 text-slate-800 dark:text-zinc-600" />
 </div>
 <p className="text-sm text-slate-700 dark:text-zinc-500">No projects found</p>
 </div>
 ) : (
 <div className="space-y-1">
 {filteredWorkflows.map((workflow) => {
 const isActive = workflow.id === currentWorkflowId;
 const isEditing = editingId === workflow.id;
 const isDeleting = deleteConfirm === workflow.id;

 return (
 <div
 key={workflow.id}
 className={cn(
 "group relative rounded-xl transition-all duration-150",
 isActive
 ? "bg-blue-50/80 dark:bg-blue-500/[0.08] border border-blue-200/80 dark:border-blue-500/30 backdrop-blur-sm"
 : "hover:bg-gray-100/60 dark:hover:bg-white/[0.04] border border-transparent hover:border-gray-200/60 dark:hover:border-white/[0.08]"
 )}
 >
 {isEditing ? (
 <div className="flex items-center gap-2 px-3 py-2">
 <input
 ref={editInputRef}
 type="text"
 value={editName}
 onChange={(e) => setEditName(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter") handleSaveRename();
 if (e.key === "Escape") setEditingId(null);
 }}
 className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-black/30 border border-blue-100 dark:border-white/[0.1] rounded-lg text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-blue-500/50 backdrop-blur-sm"
 />
 <button
 onClick={handleSaveRename}
 className="p-1.5 rounded-lg bg-blue-100/80 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200/80 dark:hover:bg-blue-500/30 transition-colors"
 >
 <Check className="w-3.5 h-3.5" />
 </button>
 </div>
 ) : isDeleting ? (
 <div className="px-3 py-3 bg-red-50/80 dark:bg-red-500/[0.05] rounded-xl border border-red-200/80 dark:border-red-500/10 backdrop-blur-sm">
 <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mb-2">Delete this project?</p>
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleDelete(workflow.id)}
 disabled={deleteMutation.isPending}
 className="flex-1 px-2 py-1.5 text-xs font-medium bg-red-100/80 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200/80 dark:hover:bg-red-500/20 transition-colors"
 >
 {deleteMutation.isPending ? "Deleting..." : "Confirm"}
 </button>
 <button
 onClick={() => setDeleteConfirm(null)}
 className="flex-1 px-2 py-1.5 text-xs font-medium bg-gray-100/80 dark:bg-zinc-800/80 text-slate-800 dark:text-zinc-400 rounded-lg hover:bg-gray-200/80 dark:hover:bg-zinc-700/80 transition-colors"
 >
 Cancel
 </button>
 </div>
 </div>
 ) : (
 <div className="flex items-center">
 {isActive && (
 <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-blue-500 rounded-r-full" />
 )}
 <button
 onClick={() => handleWorkflowClick(workflow.id)}
 className="flex-1 flex items-start gap-3 px-4 py-3 text-left"
 >
 <div className={cn(
 "mt-0.5 p-1.5 rounded-lg transition-colors",
 isActive ? "bg-blue-100/80 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-gray-100/80 dark:bg-white/[0.03] text-slate-700 dark:text-zinc-600 group-hover:text-slate-900 dark:group-hover:text-slate-700"
 )}>
 <LayoutGrid className="w-4 h-4" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between mb-0.5">
 <p className={cn(
 "text-sm font-medium truncate transition-colors",
 isActive ? "text-slate-900 dark:text-zinc-100" : "text-slate-800 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-zinc-200"
 )}>
 {workflow.name}
 </p>
 </div>
 <div className="flex items-center gap-2 text-[10px] text-slate-700 dark:text-zinc-500">
 <span>v{workflow.version}</span>
 <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-zinc-700" />
 <span>{new Date(workflow.updatedAt).toLocaleDateString()}</span>
 </div>
 </div>
 {isActive && (
 <ChevronRight className="w-4 h-4 text-slate-800 dark:text-zinc-600 self-center" />
 )}
 </button>

 {/* Actions Menu */}
 <div className="relative pr-2">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setMenuOpen(menuOpen === workflow.id ? null : workflow.id);
 }}
 className={cn(
 "p-1.5 rounded-lg transition-all",
 menuOpen === workflow.id
 ? "bg-gray-100/80 dark:bg-white/[0.08] text-slate-700 dark:text-zinc-300"
 : "text-slate-800 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-gray-100/80 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-slate-700"
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
 className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-white/[0.05] border border-blue-100 dark:border-white/[0.1] rounded-xl overflow-hidden z-20 shadow-xl shadow-gray-300/30 dark:shadow-black/40"
 >
 <button
 onClick={() => handleStartRename(workflow.id, workflow.name)}
 className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-gray-100/80 dark:hover:bg-white/[0.05] transition-colors"
 >
 <Pencil className="w-3.5 h-3.5" />
 Rename
 </button>
 <button
 onClick={() => {
 setDeleteConfirm(workflow.id);
 setMenuOpen(null);
 }}
 className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-500/10 transition-colors"
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

 {/* User Footer */}
 <div ref={userMenuRef} className="relative p-4 border-t border-blue-100 dark:border-white/[0.06]">
 {/* User Menu Dropdown */}
 <AnimatePresence>
 {userMenuOpen && (
 <motion.div
 initial={{ opacity: 0, y: 10, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 10, scale: 0.95 }}
 transition={{ duration: 0.15 }}
 className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-zinc-900/95 rounded-xl border border-blue-100 dark:border-white/[0.1] shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden"
 >
 <div className="p-1">
 <Link
 href="/settings/profile"
 onClick={() => { setUserMenuOpen(false); onClose(); }}
 className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 dark:text-zinc-300 hover:bg-white/70 dark:hover:bg-white/[0.06] transition-colors"
 >
 <UserCircle className="w-4 h-4 text-slate-700 dark:text-zinc-400" />
 <span className="text-sm font-medium">Profile</span>
 </Link>
 <Link
 href="/settings"
 onClick={() => { setUserMenuOpen(false); onClose(); }}
 className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 dark:text-zinc-300 hover:bg-white/70 dark:hover:bg-white/[0.06] transition-colors"
 >
 <Settings className="w-4 h-4 text-slate-700 dark:text-zinc-400" />
 <span className="text-sm font-medium">Settings</span>
 </Link>
 <Link
 href="/billing"
 onClick={() => { setUserMenuOpen(false); onClose(); }}
 className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 dark:text-zinc-300 hover:bg-white/70 dark:hover:bg-white/[0.06] transition-colors"
 >
 <CreditCard className="w-4 h-4 text-slate-700 dark:text-zinc-400" />
 <span className="text-sm font-medium">Billing</span>
 </Link>
 <div className="my-1 border-t border-blue-100 dark:border-white/[0.06]" />
 <button
 onClick={() => {
 setUserMenuOpen(false);
 signOut({ redirectUrl: "/" });
 }}
 className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
 >
 <LogOut className="w-4 h-4" />
 <span className="text-sm font-medium">Log out</span>
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 
 {/* Clickable User Card */}
 <button
 onClick={() => setUserMenuOpen(!userMenuOpen)}
 className="w-full flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-gray-100/80 dark:hover:bg-white/[0.04] transition-colors"
 >
 {user?.imageUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img 
 src={user.imageUrl} 
 alt={user.fullName || "User"} 
 className="w-9 h-9 rounded-xl object-cover border border-blue-100 dark:border-white/[0.1]"
 />
 ) : (
 <div className="w-9 h-9 rounded-xl bg-blue-100/80 dark:bg-blue-500/20 flex items-center justify-center border border-blue-200/80 dark:border-blue-500/30">
 <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
 </div>
 )}
 <div className="flex-1 min-w-0 text-left">
 <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
 {user?.fullName || user?.firstName || "User"}
 </p>
 <p className="text-[10px] text-slate-700 dark:text-zinc-500 truncate">
 {user?.primaryEmailAddress?.emailAddress || "Pro Plan"}
 </p>
 </div>
 <ChevronUp className={cn(
 "w-4 h-4 text-slate-800 dark:text-zinc-500 transition-transform",
 userMenuOpen ? "rotate-0" : "rotate-180"
 )} />
 </button>
 </div>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 );
}

export default WorkflowSidebar;
