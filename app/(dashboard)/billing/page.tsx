"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Zap,
  Crown,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { Header } from "@/components/layout";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "debit" | "credit";
  amount: number;
  description: string;
  workflowName?: string;
  timestamp: string;
  provider?: string;
}

interface UsageByCategory {
  category: string;
  credits: number;
  percentage: number;
  color: string;
}

const mockTransactions: Transaction[] = [
  {
    id: "t1",
    type: "debit",
    amount: 48,
    description: "AI Video Generator execution",
    workflowName: "AI Video Generator",
    timestamp: "2026-01-05T10:32:45Z",
    provider: "ByteDance, ElevenLabs",
  },
  {
    id: "t2",
    type: "credit",
    amount: 5000,
    description: "Pro Plan - Monthly credits",
    timestamp: "2026-01-01T00:00:00Z",
  },
  {
    id: "t3",
    type: "debit",
    amount: 25,
    description: "Content Upscaler execution",
    workflowName: "Content Upscaler",
    timestamp: "2026-01-04T15:20:00Z",
    provider: "ByteDance",
  },
  {
    id: "t4",
    type: "debit",
    amount: 12,
    description: "Voice Generator execution",
    workflowName: "Voice Generator",
    timestamp: "2026-01-04T12:15:00Z",
    provider: "ElevenLabs",
  },
  {
    id: "t5",
    type: "debit",
    amount: 35,
    description: "Multi-scene Video execution",
    workflowName: "Multi-scene Video",
    timestamp: "2026-01-03T18:45:00Z",
    provider: "ByteDance, OpenRouter",
  },
];

const usageByCategory: UsageByCategory[] = [
  { category: "Video Generation", credits: 1250, percentage: 45, color: "violet" },
  { category: "Image Generation", credits: 680, percentage: 25, color: "emerald" },
  { category: "Text-to-Speech", credits: 420, percentage: 15, color: "amber" },
  { category: "LLM / Vision", credits: 280, percentage: 10, color: "blue" },
  { category: "Utility", credits: 120, percentage: 5, color: "zinc" },
];

const plans = [
  {
    name: "Free",
    price: 0,
    credits: 1000,
    features: ["1,000 credits/month", "5 workflows", "Basic support", "Community access"],
    current: false,
  },
  {
    name: "Pro",
    price: 29,
    credits: 5000,
    features: ["5,000 credits/month", "Unlimited workflows", "Priority support", "Advanced analytics", "Team collaboration"],
    current: true,
    popular: true,
  },
  {
    name: "Enterprise",
    price: 99,
    credits: 25000,
    features: ["25,000 credits/month", "Custom integrations", "Dedicated support", "SLA guarantee", "Custom branding", "SSO"],
    current: false,
  },
];

export default function BillingPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "90d">("30d");
  
  const currentCredits = 2450;
  const maxCredits = 5000;
  const usagePercentage = (currentCredits / maxCredits) * 100;
  const daysRemaining = 15;

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Billing & Credits"
        description="Manage your subscription and usage"
        actions={
          <Button leftIcon={<CreditCard className="w-4 h-4" />}>
            Manage Subscription
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Credits Overview */}
          <div className="grid grid-cols-3 gap-6">
            {/* Main Credit Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-2"
            >
              <Card variant="gradient" className="p-6 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 blur-3xl" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
                        <Coins className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-zinc-100">Credit Balance</h2>
                        <p className="text-sm text-zinc-500">Pro Plan • Renews in {daysRemaining} days</p>
                      </div>
                    </div>
                    <Badge variant="accent" className="flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      Pro
                    </Badge>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-5xl font-bold text-gradient-static">
                        {currentCredits.toLocaleString()}
                      </span>
                      <span className="text-xl text-zinc-500">/ {maxCredits.toLocaleString()}</span>
                    </div>
                    <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${usagePercentage}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <span className="text-zinc-500">{usagePercentage.toFixed(0)}% remaining</span>
                      <span className="text-zinc-500">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Resets Jan 20, 2026
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button leftIcon={<Plus className="w-4 h-4" />}>
                      Buy More Credits
                    </Button>
                    <Button variant="outline" leftIcon={<TrendingUp className="w-4 h-4" />}>
                      View Usage Report
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <Card variant="elevated" className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">This Month</p>
                    <p className="text-2xl font-bold text-zinc-100">2,550</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 flex items-center gap-1">
                  <span className="text-emerald-400">-12%</span> vs last month
                </p>
              </Card>

              <Card variant="elevated" className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Avg per Workflow</p>
                    <p className="text-2xl font-bold text-zinc-100">32</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 flex items-center gap-1">
                  credits per execution
                </p>
              </Card>
            </motion.div>
          </div>

          {/* Usage by Category & Transactions */}
          <div className="grid grid-cols-3 gap-6">
            {/* Usage Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card variant="elevated" className="p-5 h-full">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    Usage by Category
                  </h3>
                  <select className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-300">
                    <option value="30d">Last 30 days</option>
                    <option value="7d">Last 7 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>

                <div className="space-y-4">
                  {usageByCategory.map((category, i) => (
                    <motion.div
                      key={category.category}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-zinc-300">{category.category}</span>
                        <span className="text-sm text-zinc-400">{category.credits}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${category.percentage}%` }}
                          transition={{ duration: 0.5, delay: 0.4 + i * 0.05 }}
                          className={cn(
                            "h-full rounded-full",
                            category.color === "violet" && "bg-violet-500",
                            category.color === "emerald" && "bg-emerald-500",
                            category.color === "amber" && "bg-amber-500",
                            category.color === "blue" && "bg-blue-500",
                            category.color === "zinc" && "bg-zinc-500"
                          )}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Transaction Ledger */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="col-span-2"
            >
              <Card variant="elevated" className="overflow-hidden h-full flex flex-col">
                <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    Transaction History
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                      Export
                    </Button>
                    <Button variant="ghost" size="sm">
                      View All
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 divide-y divide-zinc-800/50">
                  {mockTransactions.map((tx, i) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      className="px-5 py-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            tx.type === "credit"
                              ? "bg-emerald-500/10"
                              : "bg-amber-500/10"
                          )}
                        >
                          {tx.type === "credit" ? (
                            <ArrowDownRight className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5 text-amber-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-100">
                            {tx.description}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-zinc-500">
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </span>
                            {tx.provider && (
                              <>
                                <span className="text-zinc-700">•</span>
                                <span className="text-xs text-zinc-500">{tx.provider}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          tx.type === "credit" ? "text-emerald-400" : "text-zinc-300"
                        )}
                      >
                        {tx.type === "credit" ? "+" : "-"}{tx.amount}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Plans */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">Plans & Pricing</h3>
                <p className="text-sm text-zinc-500">Choose the plan that fits your needs</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <Card
                    variant={plan.current ? "gradient" : "elevated"}
                    className={cn(
                      "p-6 relative overflow-hidden h-full flex flex-col",
                      plan.current && "ring-2 ring-cyan-500/30"
                    )}
                  >
                    {plan.popular && (
                      <div className="absolute top-4 right-4">
                        <Badge variant="accent" className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Popular
                        </Badge>
                      </div>
                    )}

                    {plan.current && (
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-violet-500/5 pointer-events-none" />
                    )}

                    <div className="relative flex-1">
                      <h4 className="text-xl font-bold text-zinc-100 mb-2">{plan.name}</h4>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-4xl font-bold text-gradient-static">
                          ${plan.price}
                        </span>
                        <span className="text-zinc-500">/month</span>
                      </div>
                      <p className="text-sm text-cyan-400 mb-6">
                        {plan.credits.toLocaleString()} credits/month
                      </p>

                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm text-zinc-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      variant={plan.current ? "outline" : "primary"}
                      className="w-full"
                      disabled={plan.current}
                    >
                      {plan.current ? "Current Plan" : "Upgrade"}
                    </Button>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

