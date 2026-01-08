import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeNode } from "@/app/trigger/node-executor";

// =============================================================================
// TEST OPENROUTER VIA TRIGGER.DEV
// =============================================================================

// POST /api/test/openrouter - Test OpenRouter node execution via Trigger.dev
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const prompt = body.prompt ?? "Say 'Hello from Trigger.dev!' in a creative way.";

    // Create a test user if not exists
    const testUserId = "test-user-openrouter";
    await db.user.upsert({
      where: { id: testUserId },
      create: {
        id: testUserId,
        email: "test-openrouter@flowsmith.dev",
        credits: 10000,
      },
      update: {},
    });

    // Create a mock workflow execution for tracking
    const mockWorkflow = await db.workflow.upsert({
      where: { id: "test-openrouter-workflow" },
      create: {
        id: "test-openrouter-workflow",
        userId: testUserId,
        name: "OpenRouter Test",
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
        estimatedCost: 1,
        startedAt: new Date(),
      },
    });

    // Create node execution record
    const nodeExecution = await db.nodeExecution.create({
      data: {
        workflowExecutionId: workflowExecution.id,
        nodeId: "test-node-1",
        nodeType: "openrouter",
        nodeLabel: "Test OpenRouter LLM",
        status: "QUEUED",
        inputJson: {
          prompt,
          model: "openai/gpt-4o-mini",
          temperature: 0.7,
          maxTokens: 200,
        },
      },
    });

    console.log(`[Test OpenRouter] Starting execution ${nodeExecution.id}`);

    // Trigger the node execution via Trigger.dev
    const handle = await executeNode.trigger({
      nodeExecutionId: nodeExecution.id,
      workflowExecutionId: workflowExecution.id,
      nodeId: "test-node-1",
      nodeType: "openrouter",
      input: {
        prompt,
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 200,
      },
    });

    console.log(`[Test OpenRouter] Triggered with handle ${handle.id}`);

    return NextResponse.json({
      status: "triggered",
      message: "OpenRouter node execution started via Trigger.dev!",
      nodeExecutionId: nodeExecution.id,
      workflowExecutionId: workflowExecution.id,
      triggerRunId: handle.id,
      prompt,
      checkStatusAt: `/api/test/openrouter/${nodeExecution.id}`,
    });
  } catch (error) {
    console.error("[POST /api/test/openrouter] Error:", error);
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// GET /api/test/openrouter - Check status of all recent OpenRouter test executions
export async function GET() {
  try {
    const recentExecutions = await db.nodeExecution.findMany({
      where: {
        nodeType: "openrouter",
        nodeLabel: "Test OpenRouter LLM",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        inputJson: true,
        outputJson: true,
        error: true,
        createdAt: true,
        completedAt: true,
        providerUsed: true,
      },
    });

    return NextResponse.json({
      status: "ok",
      executions: recentExecutions,
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}


