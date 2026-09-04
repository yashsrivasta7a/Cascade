"use client";

import { useMemo } from "react";
import { Download, Plus, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { UserMenu } from "@/components/layout";
import { trpc } from "@/lib/trpc/react";
import { formatCredits } from "@/lib/credits";
import { cn } from "@/lib/utils";

const DEV_BONUS_CREDITS = 1000000;

export default function BillingPage() {
 const utils = trpc.useUtils();
 const { data: stats, isLoading: isLoadingStats } = trpc.credits.getStats.useQuery();
 const { data: transactionsData, isLoading: isLoadingTransactions } = trpc.credits.getTransactions.useQuery({ limit: 15 });

 const addCreditsMutation = trpc.credits.addCredits.useMutation({
 onSuccess: () => {
 utils.credits.getStats.invalidate();
 utils.credits.getBalance.invalidate();
 utils.credits.getTransactions.invalidate();
 },
 });

 const usageStats = useMemo(() => {
 if (!stats) return null;
 return {
 formattedBalance: stats.formattedBalance,
 dollarValue: stats.dollarValue,
 totalSpent: stats.totalSpent,
 transactionCount: stats.transactionCount,
 };
 }, [stats]);

 const transactions = transactionsData?.transactions ?? [];

 return (
 <div className="h-full flex flex-col bg-white dark:bg-[#09090b] relative overflow-hidden">
 {/* Header */}
 <div className="relative z-10 shrink-0 px-8 py-5 flex items-center justify-between border-b border-blue-100 dark:border-zinc-800/60 bg-white dark:bg-[#09090b]/80 ">
 <h1 className="text-[17px] font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Billing & Usage</h1>
 <div className="flex items-center gap-4">
 <UserMenu />
 </div>
 </div>

 <div className="flex-1 overflow-auto p-8">
 <div className="max-w-[900px] mx-auto space-y-12 pb-16">
 
 {/* Overview Section */}
 <section>
 <h2 className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100 mb-3 tracking-wide uppercase">Overview</h2>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 dark:bg-zinc-800/80 rounded-xl overflow-hidden border border-blue-100 dark:border-zinc-800/60 shadow-sm">
 <div className="bg-white dark:bg-zinc-900/80 p-6 flex flex-col">
 <p className="text-[13px] text-slate-700 dark:text-zinc-400 mb-2 font-medium">Available Credits</p>
 {isLoadingStats ? (
 <div className="mt-1 flex items-center h-[36px]">
 <Loader2 className="w-5 h-5 animate-spin text-slate-800" />
 </div>
 ) : (
 <div className="flex items-baseline gap-2 mt-1">
 <span className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
 {usageStats?.formattedBalance ?? "0"}
 </span>
 </div>
 )}
 </div>
 <div className="bg-white dark:bg-zinc-900/80 p-6 flex flex-col">
 <p className="text-[13px] text-slate-700 dark:text-zinc-400 mb-2 font-medium">Total Lifetime Usage</p>
 <div className="flex items-baseline gap-2 mt-1">
 <span className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
 {formatCredits(usageStats?.totalSpent ?? 0)}
 </span>
 </div>
 </div>
 <div className="bg-white dark:bg-zinc-900/80 p-6 flex flex-col justify-center gap-2.5">
 <button
 onClick={() => addCreditsMutation.mutate({ amount: DEV_BONUS_CREDITS, type: "BONUS", description: "Dev bonus" })}
 disabled={addCreditsMutation.isPending}
 className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[13px] font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-white transition-colors disabled:opacity-50 shadow-sm"
 >
 {addCreditsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
 Add Funds
 </button>
 <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900/80 border border-blue-100 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-[13px] font-medium rounded-lg hover:bg-white/60 dark:hover:bg-zinc-800/50 transition-colors shadow-sm">
 <Download className="w-4 h-4" />
 Statements
 </button>
 </div>
 </div>
 </section>

 {/* Plans Section */}
 <section>
 <h2 className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100 mb-3 tracking-wide uppercase">Subscription</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="p-6 bg-white dark:bg-zinc-900/80 border border-blue-100 dark:border-zinc-800/60 rounded-xl shadow-sm flex flex-col relative overflow-hidden group">
 <div className="flex justify-between items-start mb-6">
 <div>
 <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">Hobby</h3>
 <p className="text-[13px] text-slate-700 dark:text-zinc-400 mt-1">100K credits/month</p>
 </div>
 <div className="text-right">
 <span className="text-[17px] font-semibold text-slate-900 dark:text-zinc-100">$0</span>
 <span className="text-[13px] font-medium text-slate-700 dark:text-zinc-400"> / mo</span>
 </div>
 </div>
 <div className="mt-auto">
 <button className="w-full py-2 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-500 text-[13px] font-medium rounded-lg cursor-not-allowed">
 Downgrade
 </button>
 </div>
 </div>

 <div className="p-6 bg-white dark:bg-zinc-900/80 border-2 border-gray-900 dark:border-zinc-300 rounded-xl shadow-sm flex flex-col relative">
 <div className="absolute top-0 right-6 -translate-y-1/2 px-2 py-0.5 bg-gray-900 dark:bg-zinc-300 text-white dark:text-zinc-900 text-[10px] font-bold tracking-widest uppercase rounded-full shadow-sm">
 Active
 </div>
 <div className="flex justify-between items-start mb-6">
 <div>
 <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">Professional</h3>
 <p className="text-[13px] text-slate-700 dark:text-zinc-400 mt-1">Unlimited workflows, 500K credits</p>
 </div>
 <div className="text-right">
 <span className="text-[17px] font-semibold text-slate-900 dark:text-zinc-100">$29</span>
 <span className="text-[13px] font-medium text-slate-700 dark:text-zinc-400"> / mo</span>
 </div>
 </div>
 <div className="mt-auto">
 <button className="w-full py-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[13px] font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-white transition-colors shadow-sm">
 Manage Plan
 </button>
 </div>
 </div>
 </div>
 </section>

 {/* Transactions */}
 <section>
 <h2 className="text-[13px] font-semibold text-slate-900 dark:text-zinc-100 mb-3 tracking-wide uppercase">Ledger</h2>
 <div className="bg-white dark:bg-zinc-900/80 border border-blue-100 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="border-b border-blue-100 dark:border-zinc-800/60 bg-gray-50/50 dark:bg-zinc-800/30">
 <th className="py-3 px-6 text-[11px] font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-widest w-32">Date</th>
 <th className="py-3 px-6 text-[11px] font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-widest">Description</th>
 <th className="py-3 px-6 text-[11px] font-semibold text-slate-700 dark:text-zinc-400 uppercase tracking-widest text-right">Amount</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/40">
 {isLoadingTransactions ? (
 <tr>
 <td colSpan={3} className="py-12 text-center">
 <Loader2 className="w-5 h-5 animate-spin text-slate-800 mx-auto" />
 </td>
 </tr>
 ) : transactions.length === 0 ? (
 <tr>
 <td colSpan={3} className="py-12 text-center text-[13px] text-slate-700 dark:text-zinc-500">
 No transactions found.
 </td>
 </tr>
 ) : (
 transactions.map((tx: any) => {
 const isPositive = tx.amount > 0;
 return (
 <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
 <td className="py-3 px-6 text-[13px] text-slate-700 dark:text-zinc-500 whitespace-nowrap tabular-nums">
 {new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
 </td>
 <td className="py-3 px-6 text-[13px] text-slate-900 dark:text-zinc-300 font-medium">
 {tx.description || tx.type}
 </td>
 <td className="py-3 px-6 text-[13px] font-medium text-right whitespace-nowrap">
 <div className="flex items-center justify-end gap-1.5">
 {isPositive ? (
 <ArrowDownRight className="w-3.5 h-3.5 text-slate-900 dark:text-zinc-300" />
 ) : (
 <ArrowUpRight className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-600" />
 )}
 <span className={cn(
 "tabular-nums",
 isPositive ? "text-slate-900 dark:text-zinc-100" : "text-slate-700 dark:text-zinc-500"
 )}>
 {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
 </span>
 </div>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </section>

 </div>
 </div>
 </div>
 );
}
