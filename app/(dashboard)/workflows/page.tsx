"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  MoreHorizontal,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  Workflow,
  ArrowRight,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { Header } from "@/components/layout";

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  status: "active" | "draft" | "error";
  lastRun?: string;
  runs: number;
}

const workflows: WorkflowItem[] = [
  {
    id: "1",
    name: "Customer Onboarding",
    description: "Automated customer welcome flow with AI personalization",
    status: "active",
    lastRun: "2 hours ago",
    runs: 1247,
  },
  {
    id: "2",
    name: "Content Generation",
    description: "Generate blog posts using GPT-4 with auto-publishing",
    status: "active",
    lastRun: "5 mins ago",
    runs: 89,
  },
  {
    id: "3",
    name: "Lead Scoring",
    description: "AI-powered lead qualification and routing",
    status: "draft",
    runs: 0,
  },
  {
    id: "4",
    name: "Support Ticket Triage",
    description: "Automatically categorize and route support tickets",
    status: "error",
    lastRun: "1 day ago",
    runs: 3421,
  },
];

const statusConfig = {
  active: {
    badge: "success" as const,
    label: "Active",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  draft: {
    badge: "default" as const,
    label: "Draft",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  error: {
    badge: "error" as const,
    label: "Error",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
};

export default function WorkflowsPage() {
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
            { label: "Total Workflows", value: "12", change: "+2 this week", icon: <Workflow className="w-5 h-5 text-zinc-300" /> },
            { label: "Active", value: "8", change: "67% of total", icon: <CheckCircle2 className="w-5 h-5 text-zinc-300" /> },
            { label: "Total Runs", value: "4,758", change: "+12% this month", icon: <Play className="w-5 h-5 text-zinc-300" /> },
            { label: "Success Rate", value: "99.2%", change: "+0.5% this week", icon: <CheckCircle2 className="w-5 h-5 text-zinc-300" /> },
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
                  <div className="flex items-end gap-3">
                    <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
                    <span className="text-[10px] font-semibold text-zinc-300 bg-white/5 px-1.5 py-0.5 rounded-md mb-1.5 border border-white/10">
                      {stat.change}
                    </span>
                  </div>
                </div>

              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">Sort by:</span>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-zinc-300">
              Last Run
              <Clock className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
             <div className="relative">
                <input 
                  type="text" 
                  placeholder="Filter workflows..." 
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm w-64 focus:outline-none focus:border-white/20 transition-colors"
                />
             </div>
          </div>
        </div>

        {/* Workflow Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {workflows.map((workflow, i) => {
            const status = statusConfig[workflow.status];

            return (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <Link href={`/workflows/${workflow.id}`}>
                  <Card variant="elevated" hover className="p-0 group overflow-hidden">
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
                              {workflow.lastRun && (
                                <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {workflow.lastRun}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>

                      <p className="text-sm text-zinc-400 leading-relaxed mb-6 line-clamp-2">
                        {workflow.description}
                      </p>

                      <div className="grid grid-cols-3 gap-4 py-4 border-y border-white/5">
                        <div className="text-center border-r border-white/5">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Total Runs</p>
                          <p className="text-sm font-semibold text-zinc-200">{workflow.runs.toLocaleString()}</p>
                        </div>
                        <div className="text-center border-r border-white/5">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Avg Time</p>
                          <p className="text-sm font-semibold text-zinc-200">1.2s</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Success</p>
                          <p className="text-sm font-semibold text-zinc-200">99.8%</p>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-3 bg-white/[0.02] flex items-center justify-between group-hover:bg-white/[0.04] transition-colors">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map((j) => (
                          <div key={j} className="w-6 h-6 rounded-full border-2 border-zinc-950 bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-[8px] font-bold">
                            {String.fromCharCode(64 + j)}
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {workflow.status === "active" && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-white/5">
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="primary" size="sm" className="h-8 px-4 rounded-lg">
                          Editor
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

