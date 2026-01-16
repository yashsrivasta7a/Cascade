"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  MoreVertical,
  Clock,
  Trash2,
  Loader2,
  Search,
  ChevronDown,
  Workflow,
} from "lucide-react";
import { PageBackground, DotPattern } from "@/components/ui";
import { UserMenu } from "@/components/layout";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";

// Sort options
const sortOptions = [
  { id: "last-viewed", label: "Last viewed" },
  { id: "last-modified", label: "Last modified" },
  { id: "name-asc", label: "Name (A-Z)" },
  { id: "name-desc", label: "Name (Z-A)" },
];

export default function WorkflowsPage() {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState("last-viewed");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const { data, isLoading, refetch } = trpc.workflow.list.useQuery();

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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this workflow?")) {
      return;
    }
    setDeletingId(id);
    deleteMutation.mutate({ id });
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
      {/* Header */}
      <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b border-gray-200 dark:border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center">
            <Workflow className="w-4 h-4 text-gray-600 dark:text-zinc-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Workflows</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-500">
              {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Right side: Search, Sort, User */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-56 bg-zinc-900/50 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-colors"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 border border-zinc-800 rounded-lg transition-colors"
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
                  className="absolute right-0 top-full mt-2 w-36 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50"
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
                          ? "bg-blue-600/20 text-blue-400"
                          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
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
            <div className="relative bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800/60 border-dashed rounded-xl overflow-hidden">
              <div className="aspect-[4/3] flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 animate-pulse" />
                <div className="h-4 w-24 bg-gray-100 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
            {/* Skeleton Workflow Cards */}
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="relative bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800/60 rounded-xl overflow-hidden"
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
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative bg-zinc-900/50 border border-zinc-800/60 border-dashed rounded-xl overflow-hidden transition-colors hover:border-blue-500/20"
              >
                <DotPattern className="text-blue-500/5 group-hover:text-blue-500/10 transition-colors" />
                <div className="relative aspect-[4/3] flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <Plus className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-300">
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
              >
                <Link href={`/workflows/${workflow.id}`}>
                  <div
                    className={cn(
                      "group relative bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden transition-colors hover:border-violet-500/20"
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

                      {/* Hover Overlay with Menu */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOpen(
                              menuOpen === workflow.id ? null : workflow.id
                            );
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Context Menu */}
                        <AnimatePresence>
                          {menuOpen === workflow.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-2 top-10 w-32 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50"
                            >
                              <button
                                onClick={(e) => handleDelete(workflow.id, e)}
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
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Workflow Info */}
                    <div className="relative p-3 border-t border-zinc-800/60">
                      <h3 className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                        {workflow.name || "Untitled"}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
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
          <div className="relative bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
            <DotPattern className="text-violet-500/5 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
            <div className="relative flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-xl bg-violet-500/10 flex items-center justify-center mb-5">
                <Workflow className="w-7 h-7 text-violet-400" />
              </div>
              <h3 className="text-lg font-medium text-zinc-200 mb-1">
                No workflows yet
              </h3>
              <p className="text-sm text-zinc-500 mb-6">
                Create your first workflow to get started
              </p>
              <Link href="/workflows/new">
                <button className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-violet-500/25">
                  <Plus className="w-4 h-4" />
                  Create Workflow
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* No Results */}
        {!isLoading &&
          workflows.length > 0 &&
          filteredWorkflows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <Search className="w-10 h-10 text-zinc-700 mb-4" />
              <p className="text-sm text-zinc-500">
                No workflows match "{filter}"
              </p>
            </div>
          )}
      </div>

      {/* Click outside handlers */}
      {(menuOpen || showSortDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setMenuOpen(null);
            setShowSortDropdown(false);
          }}
        />
      )}
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

    // Default node dimensions
    const defaultW = 280;
    const defaultH = 180;

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    nodes.forEach((node) => {
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

    const scaledNodes = nodes.map((node) => ({
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
        <div className="w-10 h-14 bg-zinc-700/50 rounded" />
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
