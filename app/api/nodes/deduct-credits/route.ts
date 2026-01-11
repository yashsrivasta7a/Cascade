import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdForApi } from "@/lib/user";
import { estimateNodeCost } from "@/lib/credits";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";

/**
 * Deduct credits for synchronous node execution (utility nodes)
 * Also creates a QuickExecution record for Activity tracking
 * Called after successful local execution in runSingleNode
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { userId, error } = await getUserIdForApi();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: error || "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { nodeType, creditCost: providedCost, input, workflowId, nodeId, nodeLabel, durationMs } = body;

    if (!nodeType) {
      return NextResponse.json(
        { success: false, error: "Missing nodeType" },
        { status: 400 }
      );
    }

    // Calculate cost (use provided cost or estimate)
    const creditCost = providedCost || estimateNodeCost(nodeType, input || {});

    // Get node definition for label
    const nodeDef = NODE_DEFINITIONS[nodeType as AINodeType];
    const displayLabel = nodeLabel || nodeDef?.label || nodeType;

    // Deduct credits and create QuickExecution in a transaction
    const result = await db.$transaction(async (tx) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      let newBalance = user.credits;

      // Only deduct if there's a cost
      if (creditCost > 0) {
        // Check if user has enough credits (warn but don't block)
        if (user.credits < creditCost) {
          console.warn(`[DeductCredits] User ${userId} has ${user.credits} credits but ${creditCost} required for ${nodeType}`);
        }

        newBalance = Math.max(0, user.credits - creditCost);

        // Update user balance
        await tx.user.update({
          where: { id: userId },
          data: { credits: newBalance },
        });

        // Create ledger entry
        await tx.creditTransaction.create({
          data: {
            userId,
            amount: -creditCost,
            balanceAfter: newBalance,
            type: "EXECUTION",
            description: `${nodeType} node execution`,
            metadata: {
              nodeType,
              source: "single-node-run",
              workflowId,
            },
          },
        });
      }

      // Create QuickExecution record for Activity tracking
      const quickExec = await tx.quickExecution.create({
        data: {
          userId,
          workflowId: workflowId || null,
          nodeId: nodeId || null,
          nodeType,
          nodeLabel: displayLabel,
          status: "COMPLETED",
          provider: "local",
          startedAt: new Date(Date.now() - (durationMs || 0)),
          completedAt: new Date(),
          durationMs: durationMs || 0,
          estimatedCost: creditCost,
          actualCost: creditCost,
          inputJson: {},
          outputJson: {},
        },
      });

      return {
        previousBalance: user.credits,
        newBalance,
        creditCost,
        executionId: quickExec.id,
      };
    });

    console.log(`[DeductCredits] Deducted ${creditCost} credits for ${nodeType} from user ${userId}, new balance: ${result.newBalance}, execution: ${result.executionId}`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[DeductCredits] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
