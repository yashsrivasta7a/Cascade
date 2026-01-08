"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  MoreVertical,
  Play,
  Clock,
  CheckCircle2,
  Workflow,
  Trash2,
  Loader2,
  Search,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui";
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

  // Delete workflow
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) {
      return;
    }
    setDeletingId(id);
    deleteMutation.mutate({ id });
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Filter workflows
  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(filter.toLowerCase()) ||
    (w.description && w.description.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">Workflows</h1>
              <p className="text-sm text-zinc-500 mt-1">
                {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Link href="/workflows/new">
              <Button leftIcon={<Plus className="w-4 h-4" />}>
                New
              </Button>
            </Link>
          </div>

          {/* Search */}
          {workflows.length > 0 && (
            <div className="mt-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-colors"
              />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && workflows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center mb-5 shadow-lg">
              <Sparkles className="w-7 h-7 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-zinc-200 mb-1">No workflows yet</h3>
            <p className="text-sm text-zinc-500 mb-6">Create your first workflow to get started</p>
            <Link href="/workflows/new">
              <Button leftIcon={<Plus className="w-4 h-4" />}>
                Create Workflow
              </Button>
            </Link>
          </div>
        )}

        {/* No Results */}
        {!isLoading && workflows.length > 0 && filteredWorkflows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Search className="w-10 h-10 text-zinc-700 mb-4" />
            <p className="text-sm text-zinc-500">No workflows match "{filter}"</p>
          </div>
        )}

        {/* Workflow List */}
        {!isLoading && filteredWorkflows.length > 0 && (
          <div className="space-y-2">
            {filteredWorkflows.map((workflow) => {
              const isPublished = workflow.isPublished;

              return (
                <Link key={workflow.id} href={`/workflows/${workflow.id}`}>
                  <div className="group relative flex items-center gap-4 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 hover:bg-zinc-900/60 hover:border-zinc-700/50 transition-colors cursor-pointer">
                    {/* Icon */}
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center group-hover:border-zinc-600/50 transition-colors">
                      <Workflow className="w-5 h-5 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                          {workflow.name}
                        </h3>
                        {isPublished && (
                          <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Live
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-zinc-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(workflow.updatedAt)}
                        </span>
                        <span className="text-xs text-zinc-600 flex items-center gap-1">
                          <Play className="w-3 h-3" />
                          {workflow._count?.executions || 0} runs
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="shrink-0 w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />

                    {/* Menu Button */}
                    <div className="absolute right-12 top-1/2 -translate-y-1/2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpen(menuOpen === workflow.id ? null : workflow.id);
                        }}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {menuOpen === workflow.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDelete(workflow.id);
                            }}
                            disabled={deletingId === workflow.id}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                          >
                            {deletingId === workflow.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
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
