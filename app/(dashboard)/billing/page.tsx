"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  CreditCard,
  TrendingDown,
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
  Loader2,
  Gift,
  RefreshCcw,
  Settings,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { Header } from "@/components/layout";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/react";
import { formatCredits, creditsToDollars } from "@/lib/credits";

// Transaction type icons and colors
const transactionTypeConfig = {
  PURCHASE: {
    icon: Plus,
    color: "emerald",
    label: "Purchase",
    bgColor: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    amountColor: "text-emerald-400",
  },
  EXECUTION: {
    icon: Zap,
    color: "amber",
    label: "Execution",
    bgColor: "bg-amber-500/10",
    iconColor: "text-amber-400",
    amountColor: "text-zinc-300",
  },
  REFUND: {
    icon: RefreshCcw,
    color: "blue",
    label: "Refund",
    bgColor: "bg-blue-500/10",
    iconColor: "text-blue-400",
    amountColor: "text-blue-400",
  },
  BONUS: {
    icon: Gift,
    color: "violet",
    label: "Bonus",
    bgColor: "bg-violet-500/10",
    iconColor: "text-violet-400",
    amountColor: "text-violet-400",
  },
  ADJUSTMENT: {
    icon: Settings,
    color: "zinc",
    label: "Adjustment",
    bgColor: "bg-zinc-500/10",
    iconColor: "text-zinc-400",
    amountColor: "text-zinc-400",
  },
};

const plans = [
  {
    name: "Free",
    price: 0,
    credits: 100000,
    features: ["100K credits/month", "5 workflows", "Basic support", "Community access"],
    current: false,
  },
  {
    name: "Pro",
    price: 29,
    credits: 500000,
    features: ["500K credits/month", "Unlimited workflows", "Priority support", "Advanced analytics", "Team collaboration"],
    current: true,
    popular: true,
  },
  {
    name: "Enterprise",
    price: 99,
    credits: 2500000,
    features: ["2.5M credits/month", "Custom integrations", "Dedicated support", "SLA guarantee", "Custom branding", "SSO"],
    current: false,
  },
];

export default function BillingPage() {
  // Fetch credit stats
  const { data: stats, isLoading: isLoadingStats } = trpc.credits.getStats.useQuery();
  
  // Fetch transactions
  const { data: transactionsData, isLoading: isLoadingTransactions } = trpc.credits.getTransactions.useQuery({
    limit: 10,
  });

  // Calculate usage stats
  const usageStats = useMemo(() => {
    if (!stats) return null;
    
    // Assuming Pro plan for now (this would come from user subscription data)
    const maxCredits = 500000;
    const usagePercentage = Math.min(100, (stats.currentBalance / maxCredits) * 100);
    
    return {
      currentBalance: stats.currentBalance,
      formattedBalance: stats.formattedBalance,
      dollarValue: stats.dollarValue,
      maxCredits,
      usagePercentage,
      totalSpent: stats.totalSpent,
      transactionCount: stats.transactionCount,
    };
  }, [stats]);

  const transactions = transactionsData?.transactions ?? [];

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Billing & Credits"
        description="Manage your subscription and usage"
        showCredits
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
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 blur-3xl" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                        <Coins className="w-6 h-6 text-amber-950" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-zinc-100">Credit Balance</h2>
                        <p className="text-sm text-zinc-500">
                          {usageStats?.dollarValue ?? "$0.00"} equivalent value
                        </p>
                      </div>
                    </div>
                    <Badge variant="accent" className="flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      Pro
                    </Badge>
                  </div>

                  <div className="mb-6">
                    {isLoadingStats ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                        <span className="text-zinc-400">Loading balance...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-5xl font-bold text-gradient-static">
                            {usageStats?.formattedBalance ?? "0"}
                          </span>
                          <span className="text-xl text-zinc-500">credits</span>
                        </div>
                        <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${usageStats?.usagePercentage ?? 0}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-sm">
                          <span className="text-zinc-500">
                            {usageStats?.usagePercentage?.toFixed(0) ?? 0}% of plan remaining
                          </span>
                          <span className="text-zinc-500">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Monthly reset
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Button leftIcon={<Plus className="w-4 h-4" />}>
                      Buy More Credits
                    </Button>
                    <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
                      Export Report
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
                    <p className="text-xs text-zinc-500">Total Spent</p>
                    <p className="text-2xl font-bold text-zinc-100 tabular-nums">
                      {isLoadingStats ? (
                        <span className="text-zinc-400 animate-pulse">...</span>
                      ) : (
                        formatCredits(usageStats?.totalSpent ?? 0)
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-zinc-500">
                  {creditsToDollars(usageStats?.totalSpent ?? 0)} in provider costs
                </p>
              </Card>

              <Card variant="elevated" className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Transactions</p>
                    <p className="text-2xl font-bold text-zinc-100 tabular-nums">
                      {isLoadingStats ? (
                        <span className="text-zinc-400 animate-pulse">...</span>
                      ) : (
                        usageStats?.transactionCount ?? 0
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-zinc-500">
                  Total credit transactions
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
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                    Credit Costs
                  </h3>
                </div>

                <div className="space-y-4">
                  {[
                    { label: "Video (Seedance)", cost: "25K", percentage: 60, color: "violet" },
                    { label: "Lipsync", cost: "15K", percentage: 45, color: "blue" },
                    { label: "Audio (ElevenLabs)", cost: "8K", percentage: 30, color: "emerald" },
                    { label: "Image (Seedream)", cost: "5K", percentage: 20, color: "amber" },
                    { label: "LLM (OpenRouter)", cost: "2K", percentage: 10, color: "cyan" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-zinc-300">{item.label}</span>
                        <span className="text-sm text-zinc-400 tabular-nums">{item.cost}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.percentage}%` }}
                          transition={{ duration: 0.5, delay: 0.4 + i * 0.05 }}
                          className={cn(
                            "h-full rounded-full",
                            item.color === "violet" && "bg-violet-500",
                            item.color === "emerald" && "bg-emerald-500",
                            item.color === "amber" && "bg-amber-500",
                            item.color === "blue" && "bg-blue-500",
                            item.color === "cyan" && "bg-cyan-500",
                            item.color === "zinc" && "bg-zinc-500"
                          )}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-zinc-500">
                  Estimated credits per node execution
                </p>
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
                  {isLoadingTransactions ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                      <Coins className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">No transactions yet</p>
                      <p className="text-xs mt-1">Run a workflow to see your credit usage</p>
                    </div>
                  ) : (
                    transactions.map((tx, i) => {
                      const config = transactionTypeConfig[tx.type as keyof typeof transactionTypeConfig] ?? transactionTypeConfig.EXECUTION;
                      const Icon = config.icon;
                      const isPositive = tx.amount > 0;
                      const metadata = tx.metadata as { nodeType?: string } | null;
                      
                      return (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.05 }}
                          className="px-5 py-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", config.bgColor)}>
                              {isPositive ? (
                                <ArrowDownRight className={cn("w-5 h-5", config.iconColor)} />
                              ) : (
                                <ArrowUpRight className={cn("w-5 h-5", config.iconColor)} />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-zinc-100">
                                {tx.description || config.label}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-zinc-500">
                                  {new Date(tx.createdAt).toLocaleDateString()}
                                </span>
                                {metadata?.nodeType && (
                                  <>
                                    <span className="text-zinc-700">•</span>
                                    <span className="text-xs text-zinc-500">{metadata.nodeType}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={cn("text-sm font-semibold tabular-nums", isPositive ? config.amountColor : "text-zinc-300")}>
                              {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
                            </span>
                            <p className="text-xs text-zinc-600 tabular-nums">
                              bal: {tx.balanceAfter.toLocaleString()}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
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
                      plan.current && "ring-2 ring-amber-500/30"
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
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 pointer-events-none" />
                    )}

                    <div className="relative flex-1">
                      <h4 className="text-xl font-bold text-zinc-100 mb-2">{plan.name}</h4>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-4xl font-bold text-gradient-static">
                          ${plan.price}
                        </span>
                        <span className="text-zinc-500">/month</span>
                      </div>
                      <p className="text-sm text-amber-400 mb-6">
                        {formatCredits(plan.credits)} credits/month
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
