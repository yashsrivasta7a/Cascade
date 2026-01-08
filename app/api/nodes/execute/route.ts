import { NextRequest, NextResponse } from "next/server";
import type { AINodeType } from "@/types/nodes";
import { db } from "@/lib/db";
import { executeNode } from "@/app/trigger/node-executor";

// =============================================================================
// GENERIC NODE EXECUTION ENDPOINT - VIA TRIGGER.DEV
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { nodeType?: string; input?: Record<string, unknown> };
    
    const nodeType = body?.nodeType;
    const input = body?.input ?? {};

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

    // Create a test user if not exists
    const testUserId = "test-user-node-execute";
    await db.user.upsert({
      where: { id: testUserId },
      create: {
        id: testUserId,
        email: "test-node@flowsmith.dev",
        credits: 10000,
      },
      update: {},
    });

    // Create a mock workflow execution for tracking
    const mockWorkflow = await db.workflow.upsert({
      where: { id: "test-node-execute-workflow" },
      create: {
        id: "test-node-execute-workflow",
        userId: testUserId,
        name: "Node Test Workflow",
        nodesJson: [],
        edgesJson: [],
      },
      update: {},
    });

    const workflowExecution = await db.workflowExecution.create({
      data: {
        workflowId: mockWorkflow.id,
        userId: testUserId,
        status: "RUNNING",
        workflowSnapshot: {},
        estimatedCost: 5,
        startedAt: new Date(),
      },
    });

    // Create node execution record
    const nodeExecution = await db.nodeExecution.create({
      data: {
        workflowExecutionId: workflowExecution.id,
        nodeId: `test-${nodeType}-${Date.now()}`,
        nodeType: nodeType,
        nodeLabel: `Test ${nodeType}`,
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
