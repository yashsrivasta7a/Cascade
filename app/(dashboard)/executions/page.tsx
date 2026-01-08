"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Zap,
  Coins,
  Timer,
  Activity,
  RefreshCw,
  Search,
  Loader2,
  Image,
  Film,
  Volume2,
  Brain,
  Wrench,
  Target,
  ExternalLink,
  AlertCircle,
  Pause,
} from "lucide-react";
import { Button, Card, Badge, Input } from "@/components/ui";
import { Header } from "@/components/layout";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/react";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";

type ExecutionStatus = "running" | "completed" | "failed" | "cancelled" | "queued" | "waiting" | "pending" | "terminated";

interface NodeExecution {
  id: string;
  nodeId: string;
  nodeType: string;
  label: string;
  status: ExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: string;
  provider?: string | null;
  cost?: number;
  error?: string | null;
  output?: {
    type: "image" | "video" | "audio" | "text";
    url?: string;
    preview?: string;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diff = end - start;
  
  if (diff < 1000) return `${diff}ms`;
  if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
  return `${(diff / 60000).toFixed(1)}m`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// Get node category icon
function getNodeIcon(nodeType: string): React.ReactNode {
  const def = NODE_DEFINITIONS[nodeType as AINodeType];
  const category = def?.category;
  
  switch (category) {
    case "image":
      return <Image className="w-4 h-4" />;
    case "video":
      return <Film className="w-4 h-4" />;
    case "audio":
      return <Volume2 className="w-4 h-4" />;
    case "llm":
      return <Brain className="w-4 h-4" />;
    case "utility":
      return <Wrench className="w-4 h-4" />;
    default:
      return <Zap className="w-4 h-4" />;
  }
}

// Get category color
function getNodeColorClasses(nodeType: string): string {
  const def = NODE_DEFINITIONS[nodeType as AINodeType];
  const color = def?.color;
  
  switch (color) {
    case "emerald":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    case "violet":
      return "text-violet-400 bg-violet-500/10 border-violet-500/30";
    case "amber":
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "blue":
      return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    case "zinc":
      return "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
    default:
      return "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
  }
}

const statusConfig = {
  running: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    label: "Running",
  },
  queued: {
    icon: <Clock className="w-4 h-4" />,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/30",
    label: "Queued",
  },
  pending: {
    icon: <Clock className="w-4 h-4" />,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/30",
    label: "Pending",
  },
  waiting: {
    icon: <Pause className="w-4 h-4" />,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Waiting",
  },
  completed: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    label: "Completed",
  },
  failed: {
    icon: <XCircle className="w-4 h-4" />,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Failed",
  },
  cancelled: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/30",
    label: "Cancelled",
  },
  terminated: {
    icon: <AlertCircle className="w-4 h-4" />,
    color: "text-zinc-500",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/30",
    label: "Terminated",
  },
};

// =============================================================================
// NODE TIMELINE COMPONENT
// =============================================================================

interface ExecutionTimelineProps {
  nodes: NodeExecution[];
  workflowId?: string;
}

function ExecutionTimeline({ nodes, workflowId }: ExecutionTimelineProps) {
  const router = useRouter();

  const handleNodeClick = (node: NodeExecution, index: number) => {
    if (workflowId) {
      // Navigate to workflow and focus on the node
      router.push(`/workflows/${workflowId}?focus=${node.nodeType}:${index}`);
    }
  };

  return (
    <div className="relative pl-8 space-y-3">
      {/* Timeline line */}
      <div className="absolute left-3 top-4 bottom-4 w-px bg-gradient-to-b from-cyan-500/40 via-violet-500/40 to-zinc-600/40" />

      {nodes.map((node, index) => {
        const status = statusConfig[node.status] ?? statusConfig.queued;
        const nodeDef = NODE_DEFINITIONS[node.nodeType as AINodeType];
        const nodeColor = getNodeColorClasses(node.nodeType);
        const providerDisplay = node.provider || nodeDef?.provider || "—";
        
        return (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="relative"
          >
            {/* Timeline dot with status icon */}
            <div
              className={cn(
                "absolute -left-5 top-5 w-5 h-5 rounded-full border-2 border-zinc-900 flex items-center justify-center",
                status.bg.replace("/10", "/80")
              )}
            >
              {node.status === "running" && (
                <>
                  <span className="absolute inset-0 rounded-full bg-cyan-500 animate-ping opacity-50" />
                  <Loader2 className={cn("w-3 h-3 animate-spin", status.color)} />
                </>
              )}
              {node.status === "completed" && (
                <CheckCircle2 className={cn("w-3 h-3", status.color)} />
              )}
              {node.status === "failed" && (
                <XCircle className={cn("w-3 h-3", status.color)} />
              )}
              {node.status !== "running" && node.status !== "completed" && node.status !== "failed" && (
                <Clock className={cn("w-3 h-3", status.color)} />
              )}
            </div>

            <button
              onClick={() => handleNodeClick(node, index)}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all group",
                "bg-zinc-900/50 border-zinc-800/50",
                "hover:bg-zinc-900/80 hover:border-zinc-700/50"
              )}
            >
              <div className="flex items-start gap-4">
                {/* LEFT: Status Badge - Completion status */}
                <div className={cn(
                  "shrink-0 w-24 flex flex-col items-center justify-center py-2 px-3 rounded-xl",
                  status.bg.replace("/10", "/20"),
                  "border",
                  node.status === "completed" && "border-emerald-500/30",
                  node.status === "failed" && "border-red-500/30",
                  node.status === "running" && "border-cyan-500/30",
                  node.status !== "completed" && node.status !== "failed" && node.status !== "running" && "border-zinc-700/30"
                )}>
                  <div className={cn("mb-1", status.color)}>
                    {status.icon}
                  </div>
                  <span className={cn("text-[10px] font-bold uppercase tracking-wide", status.color)}>
                    {status.label}
                  </span>
                </div>

                {/* CENTER: Node info + Provider */}
                <div className="flex-1 min-w-0">
                  {/* Node Name with icon */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center border", nodeColor)}>
                      {getNodeIcon(node.nodeType)}
                    </div>
                    <h4 className="font-semibold text-zinc-100 truncate">
                      {nodeDef?.label || node.label}
                    </h4>
                  </div>
                  
                  {/* Provider Name - Prominent */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <Zap className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs font-medium text-violet-300">
                        {providerDisplay}
                      </span>
                    </div>
                    
                    {node.duration && (
                      <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <Timer className="w-3.5 h-3.5" />
                        {node.duration}
                      </div>
                    )}
                    
                    {node.cost !== undefined && node.cost > 0 && (
                      <div className="flex items-center gap-1 text-xs text-amber-400">
                        <Coins className="w-3.5 h-3.5" />
                        {node.cost} credits
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: Focus hint */}
                {workflowId && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1.5 text-zinc-500">
                    <Target className="w-4 h-4" />
                    <span className="text-xs">Focus</span>
                  </div>
                )}
              </div>

              {/* Error message */}
              {node.error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">{node.error}</p>
                </div>
              )}

              {/* Output preview */}
              {node.output && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/50">
                  {node.output.type === "text" && node.output.preview && (
                    <p className="text-xs text-zinc-400 truncate flex-1 italic">
                      "{node.output.preview}"
                    </p>
                  )}
                  {node.output.url && (
                    <a 
                      href={node.output.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </a>
                  )}
                </div>
              )}
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ExecutionsPage() {
  const [filter, setFilter] = useState<ExecutionStatus | "all">("all");
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search query
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Use tRPC query for fetching executions
  const { data, isLoading, error, refetch, isFetching } = trpc.execution.list.useQuery(
    {
      status: filter !== "all" ? filter : undefined,
      search: debouncedSearch || undefined,
    },
    {
      refetchInterval: 10000, // Refresh every 10 seconds for running executions
    }
  );

  // Auto-expand first running execution
  useEffect(() => {
    if (data?.executions && !expandedExecution) {
      const runningExec = data.executions.find((e) => e.status === "running");
      if (runningExec) {
        setExpandedExecution(runningExec.id);
      }
    }
  }, [data?.executions, expandedExecution]);

  const executions = data?.executions ?? [];
  const stats = data?.stats ?? { totalRuns: 0, successRate: "—", avgDuration: "—", creditsUsed: 0 };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <Header
        title="Execution History"
        description="View and debug your workflow runs"
        actions={
          <Button
            variant="ghost"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Refresh
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto">
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Runs", value: stats.totalRuns.toLocaleString(), icon: Activity, color: "cyan" },
              { label: "Success Rate", value: stats.successRate, icon: CheckCircle2, color: "emerald" },
              { label: "Avg Duration", value: stats.avgDuration, icon: Timer, color: "violet" },
              { label: "Credits Used", value: stats.creditsUsed.toLocaleString(), icon: Coins, color: "amber" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card variant="default" className="p-5 bg-zinc-900/50 border-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center",
                        stat.color === "cyan" && "bg-cyan-500/10 text-cyan-400",
                        stat.color === "emerald" && "bg-emerald-500/10 text-emerald-400",
                        stat.color === "violet" && "bg-violet-500/10 text-violet-400",
                        stat.color === "amber" && "bg-amber-500/10 text-amber-400"
                      )}
                    >
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold text-zinc-100">{stat.value}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 h-10 pl-10 pr-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </div>
              <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
                {(["all", "running", "completed", "failed"] as const).map((status) => (
                  <button
                    key={status}
                    className={cn(
                      "h-8 px-3.5 text-xs font-medium capitalize rounded-lg transition-all",
                      filter === status 
                        ? "bg-white/10 text-white" 
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                    onClick={() => setFilter(status)}
                  >
                    {status === "all" ? "All" : statusConfig[status]?.label ?? status}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" leftIcon={<Calendar className="w-4 h-4" />}>
                Date Range
              </Button>
              <Button variant="outline" size="sm" leftIcon={<Filter className="w-4 h-4" />}>
                Filters
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && executions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
              <p className="text-sm text-zinc-500 mt-4">Loading executions...</p>
            </div>
          )}

          {/* Error State */}
          {error && executions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-zinc-400">{error.message}</p>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && executions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                <Activity className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-400 font-medium">No executions found</p>
              <p className="text-zinc-500 text-sm">Run a workflow to see execution history here.</p>
              <Link href="/workflows">
                <Button variant="primary" leftIcon={<Play className="w-4 h-4" />}>
                  Go to Workflows
                </Button>
              </Link>
            </div>
          )}

          {/* Executions List */}
          <div className="space-y-4">
            {executions.map((execution, i) => {
              const status = statusConfig[execution.status as keyof typeof statusConfig] ?? statusConfig.queued;
              const isExpanded = expandedExecution === execution.id;
              
              const completedNodes = (execution.nodes as NodeExecution[]).filter(
                (n) => n.status === "completed"
              ).length;
              const totalNodes = (execution.nodes as NodeExecution[]).length;
              const progress = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;

              return (
                <motion.div
                  key={execution.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card 
                    variant="elevated" 
                    className={cn(
                      "overflow-hidden transition-all duration-200",
                      isExpanded && "ring-1 ring-zinc-700/50"
                    )}
                  >
                    {/* Execution Header */}
                    <button
                      onClick={() => setExpandedExecution(isExpanded ? null : execution.id)}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl", status.bg)}>
                          <div className={status.color}>{status.icon}</div>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-zinc-100">
                              {execution.workflowName}
                            </h3>
                            <span className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                              status.bg, status.color
                            )}>
                              {status.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-zinc-500">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              {execution.startedAt ? formatTimeAgo(execution.startedAt) : "—"}
                            </span>
                            {execution.duration && (
                              <span className="flex items-center gap-1.5">
                                <Timer className="w-3.5 h-3.5" />
                                {execution.duration}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5" />
                              {completedNodes}/{totalNodes} nodes
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {execution.totalCost > 0 && (
                          <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                            <Coins className="w-4 h-4" />
                            <span className="font-semibold">{execution.totalCost}</span>
                            <span className="text-xs text-amber-400/60">credits</span>
                          </div>
                        )}
                        <ChevronRight
                          className={cn(
                            "w-5 h-5 text-zinc-500 transition-transform duration-200",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </div>
                    </button>

                    {/* Progress bar for running */}
                    {execution.status === "running" && (
                      <div className="px-5 pb-3">
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Expanded Details */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="p-5 pt-0 border-t border-zinc-800/50">
                            <div className="flex items-center justify-between mb-5 mt-5">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-zinc-300">
                                  Execution Timeline
                                </h4>
                                <span className="text-xs text-zinc-600">
                                  Click a node to focus on canvas
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {execution.workflowId && (
                                  <Link href={`/workflows/${execution.workflowId}`}>
                                    <Button variant="ghost" size="sm" className="h-8 text-xs">
                                      <ExternalLink className="w-3 h-3 mr-1.5" />
                                      Open Workflow
                                    </Button>
                                  </Link>
                                )}
                                <Button variant="ghost" size="sm" className="h-8 text-xs">
                                  <Play className="w-3 h-3 mr-1.5" />
                                  Re-run
                                </Button>
                              </div>
                            </div>
                            {(execution.nodes as NodeExecution[]).length > 0 ? (
                              <ExecutionTimeline 
                                nodes={execution.nodes as NodeExecution[]} 
                                workflowId={execution.workflowId}
                              />
                            ) : (
                              <div className="text-center py-8">
                                <p className="text-sm text-zinc-500">No node executions recorded.</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
