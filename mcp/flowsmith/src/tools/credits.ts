import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getCreditBalance, getCreditStats } from "../utils/api-client.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// CREDITS TOOL DEFINITIONS
// =============================================================================

export const creditsToolDefinitions: Tool[] = [
  {
    name: "get_credits",
    description: "Get your current credit balance. Shows credits remaining and dollar value.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_credit_stats",
    description: "Get detailed credit statistics including spending history, totals, and recent transactions.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// =============================================================================
// CREDITS TOOL HANDLERS
// =============================================================================

/**
 * Register credits tool handlers
 */
export function registerCreditsTools(
  handlers: Map<string, (args: unknown) => Promise<unknown>>
): void {
  // get_credits - Simple balance check
  handlers.set("get_credits", async () => {
    logger.debug("Getting credit balance");

    try {
      const balance = await getCreditBalance();

      return {
        credits: balance.credits,
        formatted: balance.formatted,
        dollarValue: balance.dollarValue,
        message: `You have ${balance.formatted} credits (${balance.dollarValue})`,
      };
    } catch (error) {
      logger.error("Failed to get credit balance", error);
      throw new Error(
        `Failed to get credit balance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // get_credit_stats - Detailed stats
  handlers.set("get_credit_stats", async () => {
    logger.debug("Getting credit stats");

    try {
      const stats = await getCreditStats();

      return {
        balance: {
          credits: stats.currentBalance,
          formatted: stats.formattedBalance,
          dollarValue: stats.dollarValue,
        },
        memberSince: stats.memberSince,
        totals: {
          spent: stats.totalSpent,
          purchased: stats.totalPurchased,
          bonuses: stats.totalBonuses,
          transactions: stats.transactionCount,
        },
        recentTransactions: stats.recentTransactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          type: t.type,
          description: t.description,
          date: t.createdAt,
        })),
      };
    } catch (error) {
      logger.error("Failed to get credit stats", error);
      throw new Error(
        `Failed to get credit stats: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
