import { z } from "zod";
import { router, protectedProcedure } from "../server";
import { TRPCError } from "@trpc/server";
import { 
  getNodeCost, 
  calculateWorkflowCost, 
  hasEnoughCredits,
  formatCredits,
  creditsToDollars,
  type TransactionType,
} from "@/lib/credits";

// =============================================================================
// CREDITS ROUTER
// =============================================================================

export const creditsRouter = router({
  /**
   * Get user's current credit balance
   */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { credits: true },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return {
      credits: user.credits,
      formatted: formatCredits(user.credits),
      dollarValue: creditsToDollars(user.credits),
    };
  }),

  /**
   * Get paginated transaction history
   */
  getTransactions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      const transactions = await ctx.db.creditTransaction.findMany({
        where: { userId: ctx.userId },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          balanceAfter: true,
          type: true,
          description: true,
          metadata: true,
          workflowExecutionId: true,
          nodeExecutionId: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined = undefined;
      if (transactions.length > limit) {
        const nextItem = transactions.pop();
        nextCursor = nextItem?.id;
      }

      return {
        transactions,
        nextCursor,
      };
    }),

  /**
   * Estimate cost for a workflow based on node types
   */
  estimateWorkflowCost: protectedProcedure
    .input(
      z.object({
        nodeTypes: z.array(z.string()),
      })
    )
    .query(async ({ ctx, input }) => {
      const { nodeTypes } = input;
      
      // Get user balance
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { credits: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const estimatedCost = calculateWorkflowCost(nodeTypes);
      const breakdown = nodeTypes.map((type) => ({
        nodeType: type,
        cost: getNodeCost(type),
      }));

      return {
        estimatedCost,
        breakdown,
        userBalance: user.credits,
        hasEnoughCredits: hasEnoughCredits(user.credits, estimatedCost),
        shortfall: Math.max(0, estimatedCost - user.credits),
      };
    }),

  /**
   * Check if user has sufficient credits for an amount
   */
  checkSufficientCredits: protectedProcedure
    .input(
      z.object({
        requiredCredits: z.number().min(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { credits: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const sufficient = hasEnoughCredits(user.credits, input.requiredCredits);

      return {
        sufficient,
        currentBalance: user.credits,
        requiredCredits: input.requiredCredits,
        shortfall: Math.max(0, input.requiredCredits - user.credits),
      };
    }),

  /**
   * Deduct credits from user's balance (internal use during execution)
   * Creates a ledger entry for auditing
   */
  deductCredits: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        description: z.string().optional(),
        workflowExecutionId: z.string().optional(),
        nodeExecutionId: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { amount, description, workflowExecutionId, nodeExecutionId, metadata } = input;

      // Use a transaction to ensure atomicity
      const result = await ctx.db.$transaction(async (tx) => {
        // Get current balance
        const user = await tx.user.findUnique({
          where: { id: ctx.userId },
          select: { credits: true },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // Check sufficient credits
        if (user.credits < amount) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient credits. Required: ${amount}, Available: ${user.credits}`,
          });
        }

        const newBalance = user.credits - amount;

        // Update user balance
        await tx.user.update({
          where: { id: ctx.userId },
          data: { credits: newBalance },
        });

        // Create ledger entry
        const transaction = await tx.creditTransaction.create({
          data: {
            userId: ctx.userId,
            amount: -amount, // Negative for deduction
            balanceAfter: newBalance,
            type: "EXECUTION",
            description: description || "Node execution",
            workflowExecutionId,
            nodeExecutionId,
            metadata: metadata || {},
          },
        });

        return {
          previousBalance: user.credits,
          newBalance,
          amountDeducted: amount,
          transactionId: transaction.id,
        };
      });

      return result;
    }),

  /**
   * Add credits to user's balance (for purchases, bonuses, etc.)
   */
  addCredits: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        type: z.enum(["PURCHASE", "BONUS", "REFUND", "ADJUSTMENT"]),
        description: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { amount, type, description, metadata } = input;

      const result = await ctx.db.$transaction(async (tx) => {
        // Get current balance
        const user = await tx.user.findUnique({
          where: { id: ctx.userId },
          select: { credits: true },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        const newBalance = user.credits + amount;

        // Update user balance
        await tx.user.update({
          where: { id: ctx.userId },
          data: { credits: newBalance },
        });

        // Create ledger entry
        const transaction = await tx.creditTransaction.create({
          data: {
            userId: ctx.userId,
            amount: amount, // Positive for addition
            balanceAfter: newBalance,
            type: type as TransactionType,
            description: description || `${type} credits`,
            metadata: metadata || {},
          },
        });

        return {
          previousBalance: user.credits,
          newBalance,
          amountAdded: amount,
          transactionId: transaction.id,
        };
      });

      return result;
    }),

  /**
   * Get summary stats for credits
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [user, recentTransactions, totals] = await Promise.all([
      ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { credits: true, createdAt: true },
      }),
      ctx.db.creditTransaction.findMany({
        where: { userId: ctx.userId },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true,
        },
      }),
      ctx.db.creditTransaction.groupBy({
        by: ["type"],
        where: { userId: ctx.userId },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Calculate totals by type
    const totalsByType: Record<string, { sum: number; count: number }> = {};
    for (const t of totals) {
      totalsByType[t.type] = {
        sum: t._sum.amount || 0,
        count: t._count,
      };
    }

    const totalSpent = Math.abs(totalsByType.EXECUTION?.sum || 0);
    const totalPurchased = totalsByType.PURCHASE?.sum || 0;
    const totalBonuses = totalsByType.BONUS?.sum || 0;

    return {
      currentBalance: user.credits,
      formattedBalance: formatCredits(user.credits),
      dollarValue: creditsToDollars(user.credits),
      memberSince: user.createdAt,
      totalSpent,
      totalPurchased,
      totalBonuses,
      transactionCount: totals.reduce((sum, t) => sum + t._count, 0),
      recentTransactions,
    };
  }),
});
