"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { Header } from "@/components/layout";

interface DashboardStats {
  stats: {
    totalWorkflows: { value: number; change: string; changeLabel: string };
    executionsToday: { value: number; change: string; changeLabel: string };
    avgRuntime: { value: string; change: string; changeLabel: string };
    successRate: { value: string; change: string; changeLabel: string };
  };
  recentActivity: Array<{
    id: string;
    workflow: string;
    status: "success" | "error" | "warning";
    time: string;
    duration?: string;
  }>;
  activeWorkflows: number;
  credits: {
    used: number;
    total: number;
    remaining: number;
  };
}

const statConfig = [
  { key: "totalWorkflows", label: "Total Workflows", icon: Workflow, color: "cyan" },
  { key: "executionsToday", label: "Executions Today", icon: Zap, color: "violet" },
  { key: "avgRuntime", label: "Avg. Runtime", icon: Clock, color: "emerald" },
  { key: "successRate", label: "Success Rate", icon: TrendingUp, color: "amber" },
] as const;

const quickActions = [
  { label: "New Workflow", icon: Plus, href: "/workflows/new" },
  { label: "View All", icon: Workflow, href: "/workflows" },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="h-full flex flex-col">
        <Header
          title="Dashboard"
          description="Welcome back! Here's your workflow overview."
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="h-full flex flex-col">
        <Header
          title="Dashboard"
          description="Welcome back! Here's your workflow overview."
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-zinc-400">{error}</p>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const recentActivity = data?.recentActivity ?? [];
  const activeWorkflows = data?.activeWorkflows ?? 0;
  const credits = data?.credits ?? { used: 0, total: 5000, remaining: 5000 };
  const creditPercent = Math.round((credits.used / credits.total) * 100);

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Dashboard"
        description="Welcome back! Here's your workflow overview."
        actions={
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          {statConfig.map((config, i) => {
            const stat = stats?.[config.key];
            return (
              <motion.div
                key={config.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card variant="elevated" className="p-5 relative overflow-hidden group">
                  {/* Background Glow */}
                  <div
                    className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20 ${
                      config.color === "cyan"
                        ? "bg-cyan-500"
                        : config.color === "violet"
                        ? "bg-violet-500"
                        : config.color === "emerald"
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }`}
                  />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          config.color === "cyan"
                            ? "bg-cyan-500/10 text-cyan-400"
                            : config.color === "violet"
                            ? "bg-violet-500/10 text-violet-400"
                            : config.color === "emerald"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        <config.icon className="w-5 h-5" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-600" />
                    </div>

                    <p className="text-sm text-zinc-500 mb-1">{config.label}</p>
                    <p className="text-3xl font-bold text-zinc-100 mb-2">
                      {stat?.value ?? "—"}
                    </p>
                    <p className="text-xs">
                      <span
                        className={
                          stat?.change?.startsWith("+")
                            ? "text-emerald-400"
                            : stat?.change?.startsWith("-")
                            ? "text-cyan-400"
                            : "text-zinc-500"
                        }
                      >
                        {stat?.change ?? "—"}
                      </span>{" "}
                      <span className="text-zinc-600">{stat?.changeLabel ?? ""}</span>
                    </p>
                  </div>
                </Card>
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
            transition={{ delay: 0.4 }}
            className="col-span-2"
          >
            <Card variant="elevated" className="h-full">
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">Recent Activity</h2>
                  <p className="text-sm text-zinc-500">Latest workflow executions</p>
                </div>
                <Link href="/executions">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>

              <div className="divide-y divide-zinc-800/50">
                {recentActivity.length === 0 ? (
                  <div className="px-5 py-12 text-center text-zinc-500">
                    No recent activity. Run a workflow to see results here.
                  </div>
                ) : (
                  recentActivity.map((activity, i) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      className="px-5 py-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            activity.status === "success"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : activity.status === "error"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {activity.status === "success" ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : activity.status === "error" ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-100">
                            {activity.workflow}
                          </p>
                          <p className="text-xs text-zinc-500">{activity.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={
                            activity.status === "success"
                              ? "success"
                              : activity.status === "error"
                              ? "error"
                              : "warning"
                          }
                        >
                          {activity.status === "success"
                            ? "Success"
                            : activity.status === "error"
                            ? "Failed"
                            : "Warning"}
                        </Badge>
                        {activity.duration && (
                          <span className="text-xs text-zinc-500 w-12 text-right">
                            {activity.duration}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>

          {/* Quick Actions & Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-4"
          >
            {/* Quick Actions */}
            <Card variant="elevated" className="p-5">
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {quickActions.map((action) => (
                  <Link key={action.label} href={action.href}>
                    <Button variant="outline" className="w-full justify-start gap-3">
                      <action.icon className="w-4 h-4" />
                      {action.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </Card>

            {/* Active Workflows */}
            <Card variant="gradient" className="p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  {activeWorkflows > 0 && (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                  <span className="text-sm font-medium text-zinc-100">
                    {activeWorkflows} Active Workflow{activeWorkflows !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-4">
                  {activeWorkflows > 0
                    ? `Your workflows are running. Success rate: ${stats?.successRate?.value ?? "—"}`
                    : "No workflows currently running."}
                </p>
                <Link href="/executions">
                  <Button variant="primary" size="sm" className="w-full">
                    <Play className="w-4 h-4" />
                    Monitor All
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Credits */}
            <Card variant="elevated" className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-500">AI Credits</span>
                <Badge variant="accent">Pro Plan</Badge>
              </div>
              <div className="mb-2">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-zinc-100">
                    {credits.remaining.toLocaleString()} / {credits.total.toLocaleString()}
                  </span>
                  <span className="text-zinc-500">{100 - creditPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - creditPercent}%` }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500">Credits remaining</p>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
