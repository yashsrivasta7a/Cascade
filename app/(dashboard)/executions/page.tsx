"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
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
  MoreHorizontal,
  Zap,
  Coins,
  Timer,
  Activity,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button, Card, Badge, Input } from "@/components/ui";
import { Header } from "@/components/layout";
import { cn } from "@/lib/utils";

type ExecutionStatus = "running" | "completed" | "failed" | "cancelled";

interface NodeExecution {
  id: string;
  nodeType: string;
  label: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  duration?: string;
  provider?: string;
  cost?: number;
  error?: string;
  output?: {
    type: "image" | "video" | "audio" | "text";
    url?: string;
    preview?: string;
  };
}

interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  duration?: string;
  totalCost: number;
  nodeCount: number;
  nodes: NodeExecution[];
}

const mockExecutions: Execution[] = [
  {
    id: "exec-001",
    workflowId: "wf-001",
    workflowName: "AI Video Generator",
    status: "completed",
    startedAt: "2026-01-05T10:30:00Z",
    completedAt: "2026-01-05T10:32:45Z",
    duration: "2m 45s",
    totalCost: 48,
    nodeCount: 4,
    nodes: [
      {
        id: "n1",
        nodeType: "openrouter",
        label: "Generate Script",
        status: "completed",
        startedAt: "10:30:00",
        completedAt: "10:30:12",
        duration: "12s",
        provider: "OpenRouter",
        cost: 2,
        output: { type: "text", preview: "In a world where technology..." },
      },
      {
        id: "n2",
        nodeType: "seedream",
        label: "Create Thumbnail",
        status: "completed",
        startedAt: "10:30:12",
        completedAt: "10:30:28",
        duration: "16s",
        provider: "ByteDance",
        cost: 5,
        output: { type: "image", url: "/demo/thumb.jpg" },
      },
      {
        id: "n3",
        nodeType: "elevenlabs",
        label: "Voice Narration",
        status: "completed",
        startedAt: "10:30:12",
        completedAt: "10:30:45",
        duration: "33s",
        provider: "ElevenLabs",
        cost: 8,
        output: { type: "audio", url: "/demo/voice.mp3" },
      },
      {
        id: "n4",
        nodeType: "seedance",
        label: "Generate Video",
        status: "completed",
        startedAt: "10:30:45",
        completedAt: "10:32:45",
        duration: "2m",
        provider: "ByteDance",
        cost: 25,
        output: { type: "video", url: "/demo/video.mp4" },
      },
    ],
  },
  {
    id: "exec-002",
    workflowId: "wf-002",
    workflowName: "Content Upscaler",
    status: "running",
    startedAt: "2026-01-05T10:35:00Z",
    totalCost: 8,
    nodeCount: 3,
    nodes: [
      {
        id: "n1",
        nodeType: "seedream",
        label: "Generate Base",
        status: "completed",
        startedAt: "10:35:00",
        completedAt: "10:35:18",
        duration: "18s",
        provider: "ByteDance",
        cost: 5,
        output: { type: "image" },
      },
      {
        id: "n2",
        nodeType: "seedvr",
        label: "Upscale 4x",
        status: "running",
        startedAt: "10:35:18",
        provider: "ByteDance",
        cost: 3,
      },
      {
        id: "n3",
        nodeType: "crop-image",
        label: "Crop Output",
        status: "completed",
        startedAt: "10:35:00",
        completedAt: "10:35:00",
        duration: "0s",
        provider: "Internal",
        cost: 0,
      },
    ],
  },
  {
    id: "exec-003",
    workflowId: "wf-001",
    workflowName: "AI Video Generator",
    status: "failed",
    startedAt: "2026-01-05T09:15:00Z",
    completedAt: "2026-01-05T09:15:42Z",
    duration: "42s",
    totalCost: 10,
    nodeCount: 4,
    nodes: [
      {
        id: "n1",
        nodeType: "openrouter",
        label: "Generate Script",
        status: "completed",
        startedAt: "09:15:00",
        completedAt: "09:15:10",
        duration: "10s",
        provider: "OpenRouter",
        cost: 2,
      },
      {
        id: "n2",
        nodeType: "seedream",
        label: "Create Thumbnail",
        status: "completed",
        startedAt: "09:15:10",
        completedAt: "09:15:25",
        duration: "15s",
        provider: "ByteDance",
        cost: 5,
      },
      {
        id: "n3",
        nodeType: "elevenlabs",
        label: "Voice Narration",
        status: "failed",
        startedAt: "09:15:10",
        completedAt: "09:15:42",
        duration: "32s",
        provider: "ElevenLabs",
        cost: 3,
        error: "Voice quota exceeded. Tried fallback providers: ElevenLabs (quota), Resemble (timeout)",
      },
      {
        id: "n4",
        nodeType: "seedance",
        label: "Generate Video",
        status: "cancelled",
        startedAt: "09:15:42",
        provider: "ByteDance",
        cost: 0,
      },
    ],
  },
];

const statusConfig = {
  running: {
    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    label: "Running",
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
};

function ExecutionTimeline({ nodes }: { nodes: NodeExecution[] }) {
  return (
    <div className="relative pl-6 space-y-4">
      {/* Timeline line */}
      <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-cyan-500/50 via-violet-500/50 to-zinc-500/50" />

      {nodes.map((node, index) => {
        const status = statusConfig[node.status];
        return (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            {/* Timeline dot */}
            <div
              className={cn(
                "absolute -left-4 top-3 w-3 h-3 rounded-full border-2",
                status.bg,
                status.border
              )}
            >
              {node.status === "running" && (
                <span className="absolute inset-0 rounded-full bg-cyan-500 animate-ping opacity-50" />
              )}
            </div>

            <div
              className={cn(
                "p-4 rounded-xl border transition-all hover:border-white/10",
                "bg-zinc-900/50 border-white/5"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", status.bg)}>
                    {status.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-zinc-100">{node.label}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-zinc-500">{node.nodeType}</span>
                      {node.provider && (
                        <>
                          <span className="text-zinc-700">•</span>
                          <span className="text-xs text-zinc-500">{node.provider}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {node.cost !== undefined && node.cost > 0 && (
                    <div className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
                      <Coins className="w-3 h-3" />
                      {node.cost}
                    </div>
                  )}
                  {node.duration && (
                    <div className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-800 px-2 py-1 rounded-lg">
                      <Timer className="w-3 h-3" />
                      {node.duration}
                    </div>
                  )}
                </div>
              </div>

              {/* Error message */}
              {node.error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mt-3">
                  <p className="text-xs text-red-400">{node.error}</p>
                </div>
              )}

              {/* Output preview */}
              {node.output && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                  {node.output.type === "text" && node.output.preview && (
                    <p className="text-xs text-zinc-400 truncate flex-1">
                      "{node.output.preview}"
                    </p>
                  )}
                  {node.output.url && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    <Eye className="w-3 h-3 mr-1" />
                    Preview
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function ExecutionsPage() {
  const [filter, setFilter] = useState<ExecutionStatus | "all">("all");
  const [expandedExecution, setExpandedExecution] = useState<string | null>("exec-001");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredExecutions = mockExecutions.filter((exec) => {
    if (filter !== "all" && exec.status !== filter) return false;
    if (searchQuery && !exec.workflowName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Execution History"
        description="View and debug your workflow runs"
        actions={
          <Button variant="ghost" leftIcon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Runs", value: "1,247", icon: Activity, color: "cyan" },
              { label: "Success Rate", value: "98.2%", icon: CheckCircle2, color: "emerald" },
              { label: "Avg Duration", value: "1m 23s", icon: Timer, color: "violet" },
              { label: "Credits Used", value: "4,582", icon: Coins, color: "amber" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card variant="default" className="p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        stat.color === "cyan" && "bg-cyan-500/10 text-cyan-400",
                        stat.color === "emerald" && "bg-emerald-500/10 text-emerald-400",
                        stat.color === "violet" && "bg-violet-500/10 text-violet-400",
                        stat.color === "amber" && "bg-amber-500/10 text-amber-400"
                      )}
                    >
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">{stat.label}</p>
                      <p className="text-xl font-bold text-zinc-100">{stat.value}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                className="w-64 h-9"
              />
              <div className="flex items-center gap-1 ml-4">
                {(["all", "running", "completed", "failed"] as const).map((status) => (
                  <Button
                    key={status}
                    variant={filter === status ? "primary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-8 px-3 text-xs capitalize",
                      filter === status && "bg-white/10 text-white"
                    )}
                    onClick={() => setFilter(status)}
                  >
                    {status === "all" ? "All" : statusConfig[status].label}
                  </Button>
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

          {/* Executions List */}
          <div className="space-y-4">
            {filteredExecutions.map((execution, i) => {
              const status = statusConfig[execution.status];
              const isExpanded = expandedExecution === execution.id;

              return (
                <motion.div
                  key={execution.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card variant="elevated" className="overflow-hidden">
                    {/* Execution Header */}
                    <button
                      onClick={() => setExpandedExecution(isExpanded ? null : execution.id)}
                      className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("p-2.5 rounded-xl", status.bg)}>
                          <div className={status.color}>{status.icon}</div>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-zinc-100">
                              {execution.workflowName}
                            </h3>
                            <Badge variant={execution.status === "completed" ? "success" : execution.status === "failed" ? "error" : "accent"}>
                              {status.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(execution.startedAt).toLocaleString()}
                            </span>
                            {execution.duration && (
                              <span className="flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {execution.duration}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {execution.nodeCount} nodes
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                          <Coins className="w-4 h-4" />
                          <span className="font-medium">{execution.totalCost}</span>
                          <span className="text-xs text-amber-400/60">credits</span>
                        </div>
                        <ChevronDown
                          className={cn(
                            "w-5 h-5 text-zinc-500 transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </div>
                    </button>

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
                          <div className="p-5 pt-0 border-t border-white/5">
                            <div className="flex items-center justify-between mb-4 mt-5">
                              <h4 className="text-sm font-medium text-zinc-400">
                                Execution Timeline
                              </h4>
                              <div className="flex items-center gap-2">
                                <Link href={`/workflows/${execution.workflowId}`}>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                                    <Eye className="w-3 h-3 mr-1" />
                                    View Workflow
                                  </Button>
                                </Link>
                                <Button variant="ghost" size="sm" className="h-7 text-xs">
                                  <Play className="w-3 h-3 mr-1" />
                                  Re-run
                                </Button>
                              </div>
                            </div>
                            <ExecutionTimeline nodes={execution.nodes} />
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

