import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/test/db-check - Check all database tables
export async function GET() {
  try {
    // Count all tables
    const [
      userCount,
      workflowCount,
      workflowExecutionCount,
      nodeExecutionCount,
      quickExecutionCount,
      providerWebhookCount,
    ] = await Promise.all([
      db.user.count(),
      db.workflow.count(),
      db.workflowExecution.count(),
      db.nodeExecution.count(),
      db.quickExecution.count(),
      db.providerWebhook.count(),
    ]);

    // Get recent executions
    const recentWorkflowExecutions = await db.workflowExecution.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        error: true,
      },
    });

    const recentNodeExecutions = await db.nodeExecution.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nodeType: true,
        nodeLabel: true,
        status: true,
        providerUsed: true,
        createdAt: true,
        completedAt: true,
        error: true,
      },
    });

    const recentQuickExecutions = await db.quickExecution.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nodeType: true,
        nodeLabel: true,
        status: true,
        provider: true,
        model: true,
        createdAt: true,
        completedAt: true,
        durationMs: true,
        error: true,
      },
    });

    return NextResponse.json({
      status: "ok",
      database: "connected",
      counts: {
        users: userCount,
        workflows: workflowCount,
        workflowExecutions: workflowExecutionCount,
        nodeExecutions: nodeExecutionCount,
        quickExecutions: quickExecutionCount,
        providerWebhooks: providerWebhookCount,
      },
      recentWorkflowExecutions,
      recentNodeExecutions,
      recentQuickExecutions,
    });
  } catch (error) {
    console.error("[GET /api/test/db-check] Error:", error);
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}


