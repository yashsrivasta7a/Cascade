import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeWorkflow } from "@/app/trigger/workflow-executor";

// =============================================================================
// TEST ENDPOINT - Test Phase 1 Execution
// =============================================================================

// GET /api/test - Check if database connection works
export async function GET() {
  try {
    // Test database connection
    const userCount = await db.user.count();
    const workflowCount = await db.workflow.count();
    
    return NextResponse.json({
      status: "ok",
      database: "connected",
      counts: {
        users: userCount,
        workflows: workflowCount,
      },
      message: "Phase 1 database connection working!",
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// POST /api/test - Run a test workflow execution with OpenRouter
export async function POST() {
  try {
    // Create a test user if not exists
    const testUserId = "test-user-phase1";
    await db.user.upsert({
      where: { id: testUserId },
      create: {
        id: testUserId,
        email: "test@flowsmith.dev",
        credits: 10000,
      },
      update: {},
    });

    // Create a simple test workflow with OpenRouter LLM node
    const testWorkflow = await db.workflow.create({
      data: {
        userId: testUserId,
        name: "OpenRouter Test Workflow",
        description: "Testing OpenRouter LLM node execution via Trigger.dev",
        nodesJson: [
          {
            id: "node-1",
            type: "openrouter",
            position: { x: 100, y: 100 },
            data: {
              label: "Test LLM",
              prompt: "Say 'Hello from Trigger.dev!' in a creative way. Keep it under 50 words.",
              model: "openai/gpt-4o-mini",
              temperature: 0.7,
              maxTokens: 100,
            },
          },
        ],
        edgesJson: [],
      },
    });

    // Create execution record
    const execution = await db.workflowExecution.create({
      data: {
        workflowId: testWorkflow.id,
        userId: testUserId,
        status: "PENDING",
        workflowSnapshot: {
          nodes: testWorkflow.nodesJson,
          edges: testWorkflow.edgesJson,
        },
        estimatedCost: 5,
      },
    });

    // Trigger workflow execution
    const handle = await executeWorkflow.trigger({
      workflowExecutionId: execution.id,
      workflowId: testWorkflow.id,
      userId: testUserId,
      nodes: testWorkflow.nodesJson as any[],
      edges: testWorkflow.edgesJson as any[],
    });

    // Update with trigger run ID
    await db.workflowExecution.update({
      where: { id: execution.id },
      data: { triggerRunId: handle.id },
    });

    return NextResponse.json({
      status: "triggered",
      message: "Workflow execution started!",
      executionId: execution.id,
      triggerRunId: handle.id,
      workflowId: testWorkflow.id,
      checkStatusAt: `/api/executions/${execution.id}`,
    });
  } catch (error) {
    console.error("[POST /api/test] Error:", error);
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

