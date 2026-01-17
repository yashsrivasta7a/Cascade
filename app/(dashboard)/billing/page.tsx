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
import { Button, Badge, DotPattern, PageBackground } from "@/components/ui";
import { UserMenu } from "@/components/layout";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/react";
import { formatCredits, creditsToDollars, NODE_CREDIT_COSTS } from "@/lib/credits";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";

const transactionTypeConfig = {
  PURCHASE: { icon: Plus, label: "Purchase", color: "text-white/70" },
  EXECUTION: { icon: Zap, label: "Execution", color: "text-white/60" },
  REFUND: { icon: RefreshCcw, label: "Refund", color: "text-white/70" },
  BONUS: { icon: Gift, label: "Bonus", color: "text-white/70" },
  ADJUSTMENT: { icon: Settings, label: "Adjustment", color: "text-white/60" },
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

const generateCreditCosts = () => {
  const paidNodes = Object.entries(NODE_DEFINITIONS)
    .filter(([_, def]) => !def.isUtility && def.estimatedCost > 0)
    .map(([type, def]) => ({
      type: type as AINodeType,
      label: def.label,
      cost: NODE_CREDIT_COSTS[type as AINodeType] || def.estimatedCost,
      category: def.category,
    }))
    .sort((a, b) => b.cost - a.cost);

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
const DEV_BONUS_CREDITS = 1000000;

export default function BillingPage() {
  const [notification, setNotification] = useState<{ type: "success" | "info"; message: string } | null>(null);
  const utils = trpc.useUtils();

  const { data: stats, isLoading: isLoadingStats } = trpc.credits.getStats.useQuery();
  const { data: transactionsData, isLoading: isLoadingTransactions } = trpc.credits.getTransactions.useQuery({ limit: 10 });

  const addCreditsMutation = trpc.credits.addCredits.useMutation({
    onSuccess: () => {
      utils.credits.getStats.invalidate();
      utils.credits.getBalance.invalidate();
      utils.credits.getTransactions.invalidate();
      setNotification({
        type: "info",
        message: `Development Mode: Added ${formatCredits(DEV_BONUS_CREDITS)} credits!`,
      });
    },
  });

  const usageStats = useMemo(() => {
    if (!stats) return null;
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
    <PageBackground>
      {/* Header */}
      <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b border-[#6b6b6b] dark:border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-200 dark:bg-zinc-800/50 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-amber-600 dark:text-zinc-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Billing & Credits</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-500">Manage your subscription</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button leftIcon={<CreditCard className="w-4 h-4" />} variant="outline" size="sm">
            Manage Subscription
          </Button>
          <UserMenu />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Notification */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-amber-50 dark:bg-zinc-900/50 border border-amber-200 dark:border-zinc-800/60 rounded-xl flex items-start gap-3"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">Development Mode</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-500">{notification.message}</p>
                </div>
                <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bento Grid */}
          <div className="grid grid-cols-12 gap-4">
            {/* Main Credit Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="col-span-12 lg:col-span-8">
              <div className="relative p-6 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl overflow-hidden">
                <DotPattern className="text-amber-500/5" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-200 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 flex items-center justify-center">
                        <Coins className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Credit Balance</h2>
                        <p className="text-xs text-gray-500 dark:text-zinc-500">{usageStats?.dollarValue ?? "$0.00"} equivalent</p>
                      </div>
                    </div>
                    <Badge variant="accent" className="flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Pro
                    </Badge>
                  </div>

                  {isLoadingStats ? (
                    <div className="flex items-center gap-2 mb-6">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-500 dark:text-zinc-500" />
                      <span className="text-gray-500 dark:text-zinc-500">Loading...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-4xl font-bold text-gray-900 dark:text-white">{usageStats?.formattedBalance ?? "0"}</span>
                        <span className="text-gray-500 dark:text-zinc-500">credits</span>
                      </div>
                      <div className="h-2.5 bg-gray-300 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${usageStats?.usagePercentage ?? 0}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mb-6">{usageStats?.usagePercentage?.toFixed(0) ?? 0}% of plan</p>
                    </>
                  )}

                  <div className="flex gap-3">
                    <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => addCreditsMutation.mutate({ amount: DEV_BONUS_CREDITS, type: "BONUS", description: "Dev bonus" })} isLoading={addCreditsMutation.isPending}>
                      Buy Credits
                    </Button>
                    <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>Export</Button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-4">
              <div className="relative p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl overflow-hidden group hover:border-blue-300 dark:hover:border-blue-500/20 transition-colors">
                <DotPattern className="text-blue-500/5 group-hover:text-blue-500/10 transition-colors" />
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-200 dark:bg-blue-500/10 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">Total Spent</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCredits(usageStats?.totalSpent ?? 0)}</p>
                  </div>
                </div>
              </div>
              <div className="relative p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl overflow-hidden group hover:border-blue-300 dark:hover:border-blue-500/20 transition-colors">
                <DotPattern className="text-blue-500/5 group-hover:text-blue-500/10 transition-colors" />
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-200 dark:bg-blue-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">Transactions</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{usageStats?.transactionCount ?? 0}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Credit Costs */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="col-span-12 lg:col-span-5">
              <div className="p-5 bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-500 dark:text-zinc-500" /> Credit Costs
                  </h3>
                  <a href="/ledger" className="text-xs text-gray-500 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-white flex items-center gap-1">
                    View all <ChevronRight className="w-3 h-3" />
                  </a>
                </div>
                <div className="space-y-3">
                  {creditCosts.slice(0, 5).map((item, i) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600 dark:text-zinc-400 truncate max-w-[140px]">{item.label}</span>
                        <span className="text-xs text-gray-500 dark:text-zinc-500">{item.cost}</span>
                      </div>
                      <div className="h-1 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${item.percentage}%` }} transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }} className="h-full bg-gray-400 dark:bg-zinc-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Transaction History */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="col-span-12 lg:col-span-7">
              <div className="bg-white dark:bg-zinc-900/50 border border-[#6b6b6b] dark:border-zinc-800/60 rounded-xl overflow-hidden h-full flex flex-col">
                <div className="p-4 border-b border-[#6b6b6b] dark:border-zinc-800/60 flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-gray-500 dark:text-zinc-500" /> Transactions
                  </h3>
                  <a href="/ledger"><Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>View All</Button></a>
                </div>
                <div className="flex-1 divide-y divide-gray-200 dark:divide-zinc-800/50">
                  {isLoadingTransactions ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-500 dark:text-zinc-500" /></div>
                  ) : transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-zinc-500">
                      <Coins className="w-6 h-6 mb-2 opacity-50" />
                      <p className="text-sm">No transactions yet</p>
                    </div>
                  ) : (
                    transactions.slice(0, 5).map((tx: typeof transactions[number]) => {
                      const config = transactionTypeConfig[tx.type as keyof typeof transactionTypeConfig] ?? transactionTypeConfig.EXECUTION;
                      const isPositive = tx.amount > 0;
                      return (
                        <div key={tx.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800/80 flex items-center justify-center">
                              {isPositive ? <ArrowDownRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <ArrowUpRight className="w-4 h-4 text-gray-500 dark:text-zinc-400" />}
                            </div>
                            <div>
                              <p className="text-sm text-gray-900 dark:text-white">{tx.description || config.label}</p>
                              <p className="text-xs text-gray-500 dark:text-zinc-600">{new Date(tx.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={cn("text-sm font-bold", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-zinc-400")}>
                              {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Plans */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-500 mb-4">Plans & Pricing</h3>
            <div className="grid grid-cols-3 gap-4">
              {plans.map((plan, i) => (
                <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}>
                  <div className={cn(
                    "relative p-6 bg-white dark:bg-zinc-900/50 border rounded-xl overflow-hidden h-full flex flex-col",
                    plan.current ? "border-blue-400 dark:border-blue-500/30" : "border-[#6b6b6b] dark:border-zinc-800/60"
                  )}>
                    {plan.popular && (
                      <Badge variant="accent" className="absolute top-4 right-4 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Popular
                      </Badge>
                    )}
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{plan.name}</h4>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">${plan.price}</span>
                      <span className="text-gray-500 dark:text-zinc-500">/mo</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-4">{formatCredits(plan.credits)} credits/month</p>
                    <ul className="space-y-2 mb-6 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="text-sm text-gray-600 dark:text-zinc-400 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-zinc-600" /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button variant={plan.current ? "outline" : "primary"} className="w-full" disabled={plan.current}>
                      {plan.current ? "Current Plan" : "Upgrade"}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
