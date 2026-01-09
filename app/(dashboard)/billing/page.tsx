"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
  AlertCircle,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { Header } from "@/components/layout";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/react";
import { formatCredits, creditsToDollars, NODE_CREDIT_COSTS } from "@/lib/credits";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";

// Transaction type icons and colors - using theme-consistent monochrome styling
const transactionTypeConfig = {
  PURCHASE: {
    icon: Plus,
    label: "Purchase",
    bgColor: "bg-white/5",
    iconColor: "text-white/70",
    amountColor: "text-white/90",
  },
  EXECUTION: {
    icon: Zap,
    label: "Execution",
    bgColor: "bg-white/5",
    iconColor: "text-white/60",
    amountColor: "text-white/70",
  },
  REFUND: {
    icon: RefreshCcw,
    label: "Refund",
    bgColor: "bg-white/5",
    iconColor: "text-white/70",
    amountColor: "text-white/80",
  },
  BONUS: {
    icon: Gift,
    label: "Bonus",
    bgColor: "bg-white/5",
    iconColor: "text-white/70",
    amountColor: "text-white/90",
  },
  ADJUSTMENT: {
    icon: Settings,
    label: "Adjustment",
    bgColor: "bg-white/5",
    iconColor: "text-white/60",
    amountColor: "text-white/70",
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

// Credit costs for different node types - for display purposes
// Generate credit costs from real NODE_DEFINITIONS data
// Only include paid nodes (AI nodes, not utility nodes)
const generateCreditCosts = () => {
  const paidNodes = Object.entries(NODE_DEFINITIONS)
    .filter(([_, def]) => !def.isUtility && def.estimatedCost > 0)
    .map(([type, def]) => ({
      type: type as AINodeType,
      label: def.label,
      cost: NODE_CREDIT_COSTS[type as AINodeType] || def.estimatedCost,
      category: def.category,
    }))
    .sort((a, b) => b.cost - a.cost); // Sort by cost descending

  const maxCost = paidNodes[0]?.cost || 1;
  
  return paidNodes.map(node => ({
    label: node.label,
    cost: formatCredits(node.cost),
    rawCost: node.cost,
    percentage: Math.round((node.cost / maxCost) * 100),
    category: node.category,
  }));
};

const creditCosts = generateCreditCosts();

// Development mode bonus credits
const DEV_BONUS_CREDITS = 1000000;

export default function BillingPage() {
  const [notification, setNotification] = useState<{ type: "success" | "info"; message: string } | null>(null);
  const utils = trpc.useUtils();

  // Fetch credit stats
  const { data: stats, isLoading: isLoadingStats } = trpc.credits.getStats.useQuery();
  
  // Fetch transactions
  const { data: transactionsData, isLoading: isLoadingTransactions } = trpc.credits.getTransactions.useQuery({
    limit: 10,
  });

  // Add credits mutation
  const addCreditsMutation = trpc.credits.addCredits.useMutation({
    onSuccess: () => {
      utils.credits.getStats.invalidate();
      utils.credits.getBalance.invalidate();
      utils.credits.getTransactions.invalidate();
      setNotification({
        type: "info",
        message: `Development Mode: Added ${formatCredits(DEV_BONUS_CREDITS)} credits! This is for testing purposes only.`,
      });
    },
    onError: (error) => {
      setNotification({
        type: "info",
        message: `Error: ${error.message}`,
      });
    },
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

  const handleBuyCredits = () => {
    addCreditsMutation.mutate({
      amount: DEV_BONUS_CREDITS,
      type: "BONUS",
      description: "Development mode bonus credits",
      metadata: { source: "dev_mode", timestamp: new Date().toISOString() },
    });
  };

  const dismissNotification = () => {
    setNotification(null);
  };

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
          {/* Development Mode Notification */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative"
              >
                <Card variant="elevated" className="p-4 border border-white/10">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-white/70" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white/90">Development Mode</p>
                      <p className="text-sm text-white/60 mt-0.5">{notification.message}</p>
                    </div>
                    <button
                      onClick={dismissNotification}
                      className="text-white/40 hover:text-white/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-12 gap-4">
            {/* Main Credit Card - Large */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-12 lg:col-span-8"
            >
              <Card variant="gradient" className="p-6 relative overflow-hidden h-full">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-gradient-to-br from-white/5 to-white/[0.02] blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-gradient-to-tr from-white/[0.03] to-transparent blur-2xl" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shadow-lg border border-white/10">
                        <Coins className="w-6 h-6 text-white/80" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Credit Balance</h2>
                        <p className="text-sm text-white/40">
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
                        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                        <span className="text-white/40">Loading balance...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-5xl font-bold text-white tracking-tight">
                            {usageStats?.formattedBalance ?? "0"}
                          </span>
                          <span className="text-xl text-white/40">credits</span>
                        </div>
                        <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${usageStats?.usagePercentage ?? 0}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className="h-full bg-gradient-to-r from-white/30 to-white/50 rounded-full"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-sm">
                          <span className="text-white/40">
                            {usageStats?.usagePercentage?.toFixed(0) ?? 0}% of plan remaining
                          </span>
                          <span className="text-white/40">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Monthly reset
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Button 
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={handleBuyCredits}
                      isLoading={addCreditsMutation.isPending}
                    >
                      Buy More Credits
                    </Button>
                    <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
                      Export Report
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Quick Stats - Stacked on right */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-4"
            >
              <Card variant="elevated" className="p-5 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                    <TrendingDown className="w-5 h-5 text-white/60" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Total Spent</p>
                    <p className="text-2xl font-bold text-white tabular-nums">
                      {isLoadingStats ? (
                        <span className="text-white/40 animate-pulse">...</span>
                      ) : (
                        formatCredits(usageStats?.totalSpent ?? 0)
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-white/40 ml-[52px]">
                  {creditsToDollars(usageStats?.totalSpent ?? 0)} in provider costs
                </p>
              </Card>

              <Card variant="elevated" className="p-5 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                    <Zap className="w-5 h-5 text-white/60" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Transactions</p>
                    <p className="text-2xl font-bold text-white tabular-nums">
                      {isLoadingStats ? (
                        <span className="text-white/40 animate-pulse">...</span>
                      ) : (
                        usageStats?.transactionCount ?? 0
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-white/40 ml-[52px]">
                  Total credit transactions
                </p>
              </Card>
            </motion.div>

            {/* Credit Costs - Compact card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="col-span-12 lg:col-span-5"
            >
              <Card variant="elevated" className="p-5 h-full">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-white/60" />
                    Credit Costs
                  </h3>
                  <a 
                    href="/ledger" 
                    className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
                  >
                    View all pricing
                    <ChevronRight className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-3">
                  {creditCosts.slice(0, 6).map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white/70 truncate max-w-[140px]">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/30">
                            {creditsToDollars(item.rawCost)}
                          </span>
                          <span className="text-sm text-white/50 tabular-nums">{item.cost}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.percentage}%` }}
                          transition={{ duration: 0.5, delay: 0.4 + i * 0.05 }}
                          className="h-full rounded-full bg-white/20"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-white/40">
                  Base estimates • Actual cost varies by input
                </p>
              </Card>
            </motion.div>

            {/* Transaction Ledger - Large card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="col-span-12 lg:col-span-7"
            >
              <Card variant="elevated" className="overflow-hidden h-full flex flex-col">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-white/60" />
                    Transaction History
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      leftIcon={<Download className="w-4 h-4" />}
                      onClick={() => {
                        if (transactions.length === 0) return;
                        const csv = [
                          ["Date", "Type", "Description", "Amount", "Balance After"].join(","),
                          ...transactions.map(tx => [
                            new Date(tx.createdAt).toISOString(),
                            tx.type,
                            `"${tx.description || ""}"`,
                            tx.amount,
                            tx.balanceAfter
                          ].join(","))
                        ].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `transactions-${new Date().toISOString().slice(0,10)}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      disabled={transactions.length === 0}
                    >
                      Export
                    </Button>
                    <a href="/ledger">
                      <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
                        View All
                      </Button>
                    </a>
                  </div>
                </div>

                <div className="flex-1 divide-y divide-white/5">
                  {isLoadingTransactions ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/40">
                      <Coins className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">No transactions yet</p>
                      <p className="text-xs mt-1 text-white/30">Run a workflow to see your credit usage</p>
                    </div>
                  ) : (
                    transactions.map((tx, i) => {
                      const config = transactionTypeConfig[tx.type as keyof typeof transactionTypeConfig] ?? transactionTypeConfig.EXECUTION;
                      const isPositive = tx.amount > 0;
                      const metadata = tx.metadata as { nodeType?: string } | null;
                      
                      return (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.05 }}
                          className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
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
                              <p className="text-sm font-medium text-white">
                                {tx.description || config.label}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-white/40">
                                  {new Date(tx.createdAt).toLocaleDateString()} at {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {metadata?.nodeType && (
                                  <>
                                    <span className="text-white/20">•</span>
                                    <span className="text-xs text-white/40">{metadata.nodeType}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={cn("text-sm font-semibold tabular-nums", isPositive ? config.amountColor : "text-white/70")}>
                              {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
                            </span>
                            <p className="text-xs text-white/30 tabular-nums">
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

          {/* Plans - Bento style */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Plans & Pricing</h3>
                <p className="text-sm text-white/40">Choose the plan that fits your needs</p>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className={cn(
                    "col-span-12 md:col-span-6",
                    plan.current ? "lg:col-span-6" : "lg:col-span-3"
                  )}
                >
                  <Card
                    variant={plan.current ? "gradient" : "elevated"}
                    className={cn(
                      "p-6 relative overflow-hidden h-full flex flex-col",
                      plan.current && "ring-1 ring-white/20"
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
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01] pointer-events-none" />
                    )}

                    <div className="relative flex-1">
                      <h4 className="text-xl font-bold text-white mb-2">{plan.name}</h4>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-4xl font-bold text-white tracking-tight">
                          ${plan.price}
                        </span>
                        <span className="text-white/40">/month</span>
                      </div>
                      <p className="text-sm text-white/60 mb-6">
                        {formatCredits(plan.credits)} credits/month
                      </p>

                      <ul className="space-y-2.5 mb-6">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm text-white/70">
                            <CheckCircle2 className="w-4 h-4 text-white/50 flex-shrink-0" />
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
          </div>
        </div>
      </div>
    </div>
  );
}
