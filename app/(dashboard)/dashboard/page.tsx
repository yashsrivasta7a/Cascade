"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Workflow,
  Zap,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
  Coins,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button, Badge, DotPattern, PageBackground } from "@/components/ui";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";

const statConfig = [
  { key: "totalWorkflows", label: "Total Workflows", icon: Layers, color: "violet" },
  { key: "executionsToday", label: "Executions Today", icon: Zap, color: "blue" },
  { key: "avgRuntime", label: "Avg. Runtime", icon: Clock, color: "emerald" },
  { key: "successRate", label: "Success Rate", icon: TrendingUp, color: "amber" },
] as const;

export default function DashboardPage() {
  const { data, isLoading, error, refetch, isFetching } = trpc.dashboard.stats.useQuery(
    undefined,
    {
      staleTime: 2 * 60 * 1000,
      refetchInterval: 60000,
    }
  );

  if (isLoading) {
    return (
      <PageBackground>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
            <span className="text-sm text-zinc-600">Loading dashboard...</span>
          </div>
        </div>
      </PageBackground>
    );
  }

  if (error) {
    return (
      <PageBackground>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-zinc-400">{error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </PageBackground>
    );
  }

  const stats = data?.stats;
  const recentActivity = data?.recentActivity ?? [];
  const activeWorkflows = data?.activeWorkflows ?? 0;
  const credits = data?.credits ?? { used: 0, total: 5000, remaining: 5000 };
  const creditPercent = Math.round((credits.used / credits.total) * 100);

  return (
    <PageBackground>
      {/* Header */}
      <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Dashboard</h1>
            <p className="text-[11px] text-zinc-500">Welcome back</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-8 px-3 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg flex items-center gap-1.5 transition-all"
        >
          <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          {statConfig.map((config, i) => {
            const stat = stats?.[config.key];
            const colorClasses = {
              violet: { bg: "bg-violet-500/10", text: "text-violet-400", hover: "hover:border-violet-500/20" },
              blue: { bg: "bg-blue-500/10", text: "text-blue-400", hover: "hover:border-blue-500/20" },
              emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", hover: "hover:border-emerald-500/20" },
              amber: { bg: "bg-amber-500/10", text: "text-amber-400", hover: "hover:border-amber-500/20" },
            }[config.color];

            return (
              <motion.div
                key={config.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className={cn(
                  "relative p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group transition-colors",
                  colorClasses.hover
                )}>
                  <DotPattern className={cn(
                    "transition-colors",
                    config.color === "violet" ? "text-violet-500/5 group-hover:text-violet-500/10" :
                    config.color === "blue" ? "text-blue-500/5 group-hover:text-blue-500/10" :
                    config.color === "emerald" ? "text-emerald-500/5 group-hover:text-emerald-500/10" :
                    "text-amber-500/5 group-hover:text-amber-500/10"
                  )} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colorClasses.bg)}>
                        <config.icon className={cn("w-5 h-5", colorClasses.text)} />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-600" />
                    </div>
                    <p className="text-xs text-zinc-500 mb-1">{config.label}</p>
                    <p className="text-2xl font-semibold text-white mb-1">{stat?.value ?? "—"}</p>
                    <p className="text-xs">
                      <span className={stat?.change?.startsWith("+") ? "text-emerald-400" : stat?.change?.startsWith("-") ? "text-red-400" : "text-zinc-500"}>
                        {stat?.change ?? "—"}
                      </span>{" "}
                      <span className="text-zinc-600">{stat?.changeLabel ?? ""}</span>
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-2"
          >
            <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-zinc-800/60 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Latest workflow executions</p>
                </div>
                <Link href="/executions">
                  <button className="text-xs text-zinc-500 hover:text-white transition-colors">
                    View All →
                  </button>
                </Link>
              </div>

              <div className="divide-y divide-zinc-800/50">
                {recentActivity.length === 0 ? (
                  <div className="px-5 py-12 text-center text-zinc-500 text-sm">
                    No recent activity. Run a workflow to see results here.
                  </div>
                ) : (
                  recentActivity.map((activity: { id: string; workflow: string; status: string; time: string; duration?: string }, i: number) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.03 }}
                      className="px-5 py-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          activity.status === "success" ? "bg-emerald-500/10" :
                          activity.status === "error" ? "bg-red-500/10" :
                          "bg-amber-500/10"
                        )}>
                          {activity.status === "success" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : activity.status === "error" ? (
                            <XCircle className="w-4 h-4 text-red-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{activity.workflow}</p>
                          <p className="text-xs text-zinc-500">{activity.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "px-2 py-1 text-[11px] font-medium rounded",
                          activity.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
                          activity.status === "error" ? "bg-red-500/10 text-red-400" :
                          "bg-amber-500/10 text-amber-400"
                        )}>
                          {activity.status === "success" ? "Success" : activity.status === "error" ? "Failed" : "Warning"}
                        </span>
                        {activity.duration && (
                          <span className="text-xs text-zinc-500 w-12 text-right font-mono">{activity.duration}</span>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            {/* Quick Actions */}
            <div className="p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl">
              <h2 className="text-sm font-semibold text-white mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link href="/workflows/new" className="block">
                  <Button variant="primary" className="w-full" leftIcon={<Plus className="w-4 h-4" />}>
                    New Workflow
                  </Button>
                </Link>
                <Link href="/workflows" className="block">
                  <Button variant="secondary" className="w-full" leftIcon={<Workflow className="w-4 h-4" />}>
                    View All
                  </Button>
                </Link>
              </div>
            </div>

            {/* Active Workflows */}
            <div className="relative p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
              <DotPattern className="text-blue-500/5" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  {activeWorkflows > 0 && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                  <span className="text-sm font-medium text-white">
                    {activeWorkflows} Active
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mb-4">
                  {activeWorkflows > 0
                    ? `Success rate: ${stats?.successRate?.value ?? "—"}`
                    : "No workflows currently running."}
                </p>
                <Link href="/executions" className="block">
                  <button className="w-full h-9 px-4 text-xs font-medium text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 rounded-lg flex items-center justify-center gap-2 transition-colors">
                    <Activity className="w-3.5 h-3.5" />
                    Monitor
                  </button>
                </Link>
              </div>
            </div>

            {/* Credits */}
            <div className="relative p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group hover:border-amber-500/20 transition-colors">
              <DotPattern className="text-amber-500/5 group-hover:text-amber-500/10 transition-colors" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-zinc-500">AI Credits</span>
                  </div>
                  <Badge variant="accent">Pro</Badge>
                </div>
                <div className="mb-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-white font-medium">
                      {credits.remaining.toLocaleString()}
                    </span>
                    <span className="text-zinc-500">{100 - creditPercent}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${100 - creditPercent}%` }}
                      transition={{ delay: 0.5, duration: 0.8 }}
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-600">of {credits.total.toLocaleString()} credits</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </PageBackground>
  );
}
