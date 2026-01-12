import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { db } from "@/lib/db";
import { executeNode } from "@/app/trigger/node-executor";
import { estimateNodeCost, formatCredits } from "@/lib/credits";

// =============================================================================
// GENERIC NODE EXECUTION ENDPOINT - VIA TRIGGER.DEV
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

    const body = await request.json() as { nodeType?: string; input?: Record<string, unknown>; workflowId?: string };
    
    const nodeType = body?.nodeType;
    const input = body?.input ?? {};
    const workflowId = body?.workflowId;

    if (!nodeType || typeof nodeType !== "string") {
      return NextResponse.json(
        { 
          error: "Missing or invalid nodeType",
          usage: {
            nodeType: "openrouter | seedream | seedvr | etc.",
            input: "{ ...node-specific input }"
          }
        },
        { status: 400 }
      );
    }

    // Get or create the user in our database
    let user = await db.user.findUnique({ where: { id: clerkUserId } });
    if (!user) {
      // User might not exist yet - create with default credits
      user = await db.user.create({
        data: {
          id: clerkUserId,
          email: `user-${clerkUserId}@flowsmith.dev`,
          credits: 1_000_000, // Default 1M credits for new users
        },
      });
    }

    // Check if user has enough credits
    const estimatedCost = estimateNodeCost(nodeType, input);
    if (user.credits < estimatedCost) {
      console.log(`[Execute] Insufficient credits for ${nodeType}. Balance: ${user.credits}, Required: ${estimatedCost}`);
      return NextResponse.json(
        {
          error: `Insufficient credits. You have ${formatCredits(user.credits)} but need ${formatCredits(estimatedCost)} to run this node.`,
          insufficientCredits: true,
          balance: user.credits,
          required: estimatedCost,
        },
        { status: 402 } // Payment Required
      );
    }
    console.log(`[Execute] Credit check passed. Balance: ${user.credits}, Required: ${estimatedCost}`);

    // Get or create a workflow for this execution
    let workflow;
    if (workflowId) {
      workflow = await db.workflow.findUnique({ where: { id: workflowId } });
    }
    
    if (!workflow) {
      // Create a default workflow for ad-hoc node executions
      workflow = await db.workflow.upsert({
        where: { id: `adhoc-${clerkUserId}` },
        create: {
          id: `adhoc-${clerkUserId}`,
          userId: clerkUserId,
          name: "Ad-hoc Executions",
          nodesJson: [],
          edgesJson: [],
        },
        update: {},
      });
    }

    const workflowExecution = await db.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        userId: clerkUserId,
        status: "RUNNING",
        workflowSnapshot: {},
        estimatedCost: 5,
        startedAt: new Date(),
      },
    });

    // Get proper node label from definitions
    const nodeDef = NODE_DEFINITIONS[nodeType as AINodeType];
    const nodeLabel = nodeDef?.label || nodeType;

    // Use the actual nodeId from input if provided (for flow-based execution)
    const actualNodeId = typeof input.nodeId === "string" && input.nodeId 
      ? input.nodeId 
      : `${nodeType}-${Date.now()}`;

    console.log(`[Node Execute] Using nodeId: ${actualNodeId} (from input: ${input.nodeId})`);

    // Create node execution record
    const nodeExecution = await db.nodeExecution.create({
      data: {
        workflowExecutionId: workflowExecution.id,
        nodeId: actualNodeId,
        nodeType: nodeType,
        nodeLabel: nodeLabel,
        status: "QUEUED",
        inputJson: input as object,
      },
    });

    console.log(`[Node Execute] Starting ${nodeType} execution ${nodeExecution.id}`);

    // Trigger the node execution via Trigger.dev
    const handle = await executeNode.trigger({
      nodeExecutionId: nodeExecution.id,
      workflowExecutionId: workflowExecution.id,
      nodeId: nodeExecution.nodeId,
      nodeType: nodeType as AINodeType,
      input,
    });

    // Save the trigger run ID for tracking in Run History
    await db.workflowExecution.update({
      where: { id: workflowExecution.id },
      data: { triggerRunId: handle.id },
    });

    console.log(`[Node Execute] Triggered with handle ${handle.id}`);

    return NextResponse.json({
      status: "triggered",
      message: `${nodeType} node execution started via Trigger.dev!`,
      nodeExecutionId: nodeExecution.id,
      workflowExecutionId: workflowExecution.id,
      triggerRunId: handle.id,
      dashboardUrl: `https://cloud.trigger.dev/projects/v3/${process.env.TRIGGER_PROJECT_REF}/runs/${handle.id}`,
    });
  } catch (error) {
    console.error("[Node Execute] Error:", error);
    return NextResponse.json(
      { 
        status: "error", 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Node Execution via Trigger.dev",
    description: "This endpoint executes nodes through Trigger.dev for proper tracking",
    usage: {
      method: "POST",
      body: {
        nodeType: "string (openrouter | seedream | seedvr | etc.)",
        input: "object (node-specific input)"
      }
    },
    examples: {
      openrouter: { nodeType: "openrouter", input: { prompt: "Write a haiku", model: "openai/gpt-4o-mini" } },
      seedream: { nodeType: "seedream", input: { prompt: "A sunset over mountains" } },
    }
  });
}
