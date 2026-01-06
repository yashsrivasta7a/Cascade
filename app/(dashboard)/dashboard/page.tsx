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
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { Header } from "@/components/layout";

const stats = [
  {
    label: "Total Workflows",
    value: "12",
    change: "+3",
    changeLabel: "from last month",
    icon: Workflow,
    color: "cyan",
  },
  {
    label: "Executions Today",
    value: "847",
    change: "+12%",
    changeLabel: "from yesterday",
    icon: Zap,
    color: "violet",
  },
  {
    label: "Avg. Runtime",
    value: "2.4s",
    change: "-0.3s",
    changeLabel: "improvement",
    icon: Clock,
    color: "emerald",
  },
  {
    label: "Success Rate",
    value: "99.2%",
    change: "+0.5%",
    changeLabel: "this week",
    icon: TrendingUp,
    color: "amber",
  },
];

const recentActivity = [
  {
    id: 1,
    workflow: "Customer Onboarding",
    status: "success",
    time: "2 mins ago",
    duration: "1.2s",
  },
  {
    id: 2,
    workflow: "Content Generation",
    status: "success",
    time: "5 mins ago",
    duration: "4.8s",
  },
  {
    id: 3,
    workflow: "Lead Scoring",
    status: "warning",
    time: "12 mins ago",
    duration: "2.1s",
  },
  {
    id: 4,
    workflow: "Customer Onboarding",
    status: "success",
    time: "15 mins ago",
    duration: "1.4s",
  },
  {
    id: 5,
    workflow: "Support Ticket Triage",
    status: "success",
    time: "23 mins ago",
    duration: "0.8s",
  },
];

const quickActions = [
  { label: "New Workflow", icon: Plus, href: "/workflows/new" },
  { label: "View All", icon: Workflow, href: "/workflows" },
];

export default function DashboardPage() {
  return (
    <div className="h-full flex flex-col">
      <Header
        title="Dashboard"
        description="Welcome back! Here's your workflow overview."
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card variant="elevated" className="p-5 relative overflow-hidden group">
                {/* Background Glow */}
                <div
                  className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20 ${
                    stat.color === "cyan"
                      ? "bg-cyan-500"
                      : stat.color === "violet"
                      ? "bg-violet-500"
                      : stat.color === "emerald"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  }`}
                />

                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        stat.color === "cyan"
                          ? "bg-cyan-500/10 text-cyan-400"
                          : stat.color === "violet"
                          ? "bg-violet-500/10 text-violet-400"
                          : stat.color === "emerald"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-zinc-600" />
                  </div>

                  <p className="text-sm text-zinc-500 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-zinc-100 mb-2">{stat.value}</p>
                  <p className="text-xs">
                    <span
                      className={
                        stat.change.startsWith("+")
                          ? "text-emerald-400"
                          : stat.change.startsWith("-")
                          ? "text-cyan-400"
                          : "text-zinc-500"
                      }
                    >
                      {stat.change}
                    </span>{" "}
                    <span className="text-zinc-600">{stat.changeLabel}</span>
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
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
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </div>

              <div className="divide-y divide-zinc-800/50">
                {recentActivity.map((activity, i) => (
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
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {activity.status === "success" ? (
                          <CheckCircle2 className="w-4 h-4" />
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
                        variant={activity.status === "success" ? "success" : "warning"}
                      >
                        {activity.status === "success" ? "Success" : "Warning"}
                      </Badge>
                      <span className="text-xs text-zinc-500 w-12 text-right">
                        {activity.duration}
                      </span>
                    </div>
                  </motion.div>
                ))}
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
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-zinc-100">8 Active Workflows</span>
                </div>
                <p className="text-sm text-zinc-400 mb-4">
                  Your workflows are running smoothly with 99.2% success rate.
                </p>
                <Button variant="primary" size="sm" className="w-full">
                  <Play className="w-4 h-4" />
                  Monitor All
                </Button>
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
                  <span className="text-zinc-100">2,450 / 5,000</span>
                  <span className="text-zinc-500">49%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "49%" }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500">Resets in 15 days</p>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}


