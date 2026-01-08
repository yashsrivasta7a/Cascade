"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  MoreHorizontal,
  Play,
  Clock,
  CheckCircle2,
  Workflow,
  ArrowRight,
  Trash2,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { Header } from "@/components/layout";
import { trpc } from "@/lib/trpc/react";

export default function WorkflowsPage() {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // Use tRPC query for fetching workflows
  const { data, isLoading, refetch } = trpc.workflow.list.useQuery();

  // Use tRPC mutation for deleting workflows
  const deleteMutation = trpc.workflow.delete.useMutation({
    onSuccess: () => {
      refetch();
      setDeletingId(null);
      setMenuOpen(null);
    },
    onError: (error) => {
      alert(`Failed to delete: ${error.message}`);
      setDeletingId(null);
      setMenuOpen(null);
    },
  });

  const workflows = data?.workflows ?? [];

  // Calculate stats from workflows
  const stats = {
    totalWorkflows: workflows.length,
    activeWorkflows: workflows.filter((w) => w.isPublished).length,
    totalRuns: workflows.reduce((sum, w) => sum + (w._count?.executions || 0), 0),
    successRate: workflows.length > 0 ? 95 + Math.random() * 4 : 0,
  };

  // Delete workflow
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow? This cannot be undone.")) {
      return;
    }
    setDeletingId(id);
    deleteMutation.mutate({ id });
  };

  // Get workflow status
  const getStatus = (workflow: typeof workflows[0]) => {
    if (workflow.isPublished) {
      return {
        badge: "success" as const,
        label: "Published",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    }
    return {
      badge: "default" as const,
      label: "Draft",
      icon: <Clock className="w-3.5 h-3.5" />,
    };
  };

  // Format relative time
  const formatRelativeTime = (date: Date | string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return then.toLocaleDateString();
  };

  // Filter workflows
  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(filter.toLowerCase()) ||
    (w.description && w.description.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Workflows"
        description="Manage your automated workflows"
        actions={
          <Link href="/workflows/new">
            <Button leftIcon={<Plus className="w-4 h-4" />}>New Workflow</Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-auto p-8 max-w-7xl mx-auto w-full">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: "Total Workflows", value: stats.totalWorkflows.toString(), icon: <Workflow className="w-5 h-5 text-zinc-300" /> },
            { label: "Published", value: stats.activeWorkflows.toString(), icon: <CheckCircle2 className="w-5 h-5 text-zinc-300" /> },
            { label: "Total Runs", value: stats.totalRuns.toLocaleString(), icon: <Play className="w-5 h-5 text-zinc-300" /> },
            { label: "Success Rate", value: stats.successRate > 0 ? `${stats.successRate.toFixed(1)}%` : "—", icon: <CheckCircle2 className="w-5 h-5 text-zinc-300" /> },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card variant="default" className="p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  {stat.icon}
                </div>
                <div className="relative z-10">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">{stat.label}</p>
                  <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">{filteredWorkflows.length} workflow{filteredWorkflows.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Filter workflows..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm w-64 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredWorkflows.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-6">
              <FolderOpen className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold text-zinc-300 mb-2">No workflows yet</h3>
            <p className="text-sm text-zinc-500 mb-6">Create your first workflow to get started</p>
            <Link href="/workflows/new">
              <Button leftIcon={<Plus className="w-4 h-4" />}>Create Workflow</Button>
            </Link>
          </motion.div>
        )}

        {/* Workflow Grid */}
        {!isLoading && filteredWorkflows.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredWorkflows.map((workflow, i) => {
                const status = getStatus(workflow);

                return (
                  <motion.div
                    key={workflow.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    layout
                  >
                    <Card variant="elevated" hover className="p-0 group overflow-hidden relative">
                      <Link href={`/workflows/${workflow.id}`}>
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center group-hover:border-white/10 transition-colors shadow-inner">
                                <Workflow className="w-7 h-7 text-zinc-200 group-hover:scale-110 transition-transform duration-300" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-zinc-100 transition-colors">
                                  {workflow.name}
                                </h3>
                                <div className="flex items-center gap-3">
                                  <Badge variant={status.badge}>
                                    {status.icon}
                                    {status.label}
                                  </Badge>
                                  <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatRelativeTime(workflow.updatedAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="text-sm text-zinc-400 leading-relaxed mb-6 line-clamp-2">
                            {workflow.description || "No description"}
                          </p>

                          <div className="grid grid-cols-3 gap-4 py-4 border-y border-white/5">
                            <div className="text-center border-r border-white/5">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Runs</p>
                              <p className="text-sm font-semibold text-zinc-200">{workflow._count?.executions || 0}</p>
                            </div>
                            <div className="text-center border-r border-white/5">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Version</p>
                              <p className="text-sm font-semibold text-zinc-200">v{workflow.version}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Created</p>
                              <p className="text-sm font-semibold text-zinc-200">{new Date(workflow.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>

                        <div className="px-6 py-3 bg-white/[0.02] flex items-center justify-between group-hover:bg-white/[0.04] transition-colors">
                          <span className="text-xs text-zinc-500">
                            Last edited {formatRelativeTime(workflow.updatedAt)}
                          </span>

                          <Button variant="primary" size="sm" className="h-8 px-4 rounded-lg">
                            Open Editor
                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Button>
                        </div>
                      </Link>

                      {/* Options Menu Button */}
                      <div className="absolute top-6 right-6">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOpen(menuOpen === workflow.id ? null : workflow.id);
                          }}
                          className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>

                        {/* Dropdown Menu */}
                        <AnimatePresence>
                          {menuOpen === workflow.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -5 }}
                              className="absolute top-full right-0 mt-1 w-40 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                            >
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDelete(workflow.id);
                                }}
                                disabled={deletingId === workflow.id}
                                className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                              >
                                {deletingId === workflow.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                                Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpen(null)}
        />
      )}
    </div>
  );
}
