import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdForApi, authenticateWithApiKeyDirect } from "@/lib/user";
import type { ExecutionStatus } from "@prisma/client";

// Helper to get userId from API key or fallback to getUserIdForApi
async function getUserId(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer sk_live_")) {
    const authResult = await authenticateWithApiKeyDirect(authHeader);
    if (authResult.user?.id) {
      return authResult.user.id;
    }
  }
  const { userId } = await getUserIdForApi();
  return userId;
}

// =============================================================================
// EXECUTIONS API
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const offset = parseInt(searchParams.get("offset") ?? "0");

    // Build where clause
    const where: {
      workflow: { userId: string; name?: { contains: string; mode: "insensitive" } };
      status?: ExecutionStatus;
    } = {
      workflow: { userId },
    };

    if (status && status !== "all") {
      where.status = status.toUpperCase() as ExecutionStatus;
    }

    if (search) {
      where.workflow = {
        userId,
        name: { contains: search, mode: "insensitive" },
      };
    }

    // Fetch executions with node executions
    const [executions, total] = await Promise.all([
      db.workflowExecution.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          workflow: { select: { id: true, name: true } },
          nodeExecutions: {
            orderBy: { startedAt: "asc" },
            select: {
              id: true,
              nodeId: true,
              nodeType: true,
              nodeLabel: true,
              status: true,
              startedAt: true,
              completedAt: true,
              error: true,
              outputJson: true,
              providerUsed: true,
              actualCost: true,
            },
          },
        },
      }),
      db.workflowExecution.count({ where }),
    ]);

    // Calculate aggregate stats
    const now = new Date();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [weekStats, totalRuns] = await Promise.all([
      db.workflowExecution.findMany({
        where: {
          workflow: { userId },
          startedAt: { gte: startOfWeek },
        },
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      db.workflowExecution.count({
        where: { workflow: { userId } },
      }),
    ]);

    // Calculate total credits used (from node executions)
    const allNodeExecutions = await db.nodeExecution.aggregate({
      where: {
        workflowExecution: { workflow: { userId } },
      },
      _sum: { actualCost: true },
    });

    const totalCreditsUsed = allNodeExecutions._sum.actualCost ?? 0;

    // Calculate success rate
    const successfulRuns = weekStats.filter((e: { status: string }) => e.status === "COMPLETED").length;
    const successRate = weekStats.length > 0 ? (successfulRuns / weekStats.length) * 100 : 100;

    // Calculate avg duration
    const completedRuns = weekStats.filter((e: { startedAt: Date | null; completedAt: Date | null }) => e.completedAt && e.startedAt);
    const avgDurationMs = completedRuns.length > 0
      ? completedRuns.reduce((sum: number, e: { startedAt: Date | null; completedAt: Date | null }) => {
          return sum + (new Date(e.completedAt!).getTime() - new Date(e.startedAt!).getTime());
        }, 0) / completedRuns.length
      : 0;

    // Also fetch quick executions (single node runs) for this user
    const quickExecutions = await db.quickExecution.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    // Format workflow executions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedWorkflowExecutions = executions.map((exec: any) => {
      const durationMs = exec.completedAt && exec.startedAt
        ? new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()
        : undefined;

      return {
        id: exec.id,
        type: "workflow" as const,
        workflowId: exec.workflow.id,
        workflowName: exec.workflow.name,
        status: exec.status.toLowerCase() as "running" | "completed" | "failed" | "cancelled",
        startedAt: exec.startedAt?.toISOString(),
        completedAt: exec.completedAt?.toISOString(),
        createdAt: exec.createdAt?.toISOString(),
        duration: durationMs ? formatDuration(durationMs) : undefined,
        totalCost: exec.nodeExecutions.reduce((sum: number, n: { actualCost?: number | null }) => sum + (n.actualCost ?? 0), 0),
        nodeCount: exec.nodeExecutions.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodes: exec.nodeExecutions.map((node: any) => {
          const nodeDurationMs = node.completedAt && node.startedAt
            ? new Date(node.completedAt).getTime() - new Date(node.startedAt).getTime()
            : undefined;

          const output = node.outputJson as { type?: string; url?: string; text?: string } | null;

          return {
            id: node.id,
            nodeType: node.nodeType,
            label: node.nodeLabel ?? node.nodeType,
            status: node.status.toLowerCase() as "running" | "completed" | "failed" | "cancelled",
            startedAt: node.startedAt?.toISOString()?.split("T")[1]?.slice(0, 8),
            completedAt: node.completedAt?.toISOString()?.split("T")[1]?.slice(0, 8),
            duration: nodeDurationMs ? formatDuration(nodeDurationMs) : undefined,
            provider: node.providerUsed,
            cost: node.actualCost ?? 0,
            error: node.error,
            output: output ? {
              type: output.type as "image" | "video" | "audio" | "text",
              url: output.url,
              preview: output.type === "text" ? output.text?.slice(0, 50) : undefined,
            } : undefined,
          };
        }),
      };
    });

    // Format quick executions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedQuickExecutions = quickExecutions.map((exec: any) => {
      const output = exec.outputJson as { type?: string; text?: string } | null;
      
      return {
        id: exec.id,
        type: "quick" as const,
        workflowId: null,
        workflowName: exec.nodeLabel ?? exec.nodeType,
        status: exec.status.toLowerCase() as "running" | "completed" | "failed",
        startedAt: exec.startedAt?.toISOString(),
        completedAt: exec.completedAt?.toISOString(),
        createdAt: exec.createdAt?.toISOString(),
        duration: exec.durationMs ? formatDuration(exec.durationMs) : undefined,
        totalCost: exec.actualCost ?? 0,
        nodeCount: 1,
        nodeExecutions: [{
          id: exec.id,
          nodeId: exec.id,
          nodeType: exec.nodeType,
          nodeLabel: exec.nodeLabel ?? exec.nodeType,
          status: exec.status,
          startedAt: exec.startedAt?.toISOString(),
          completedAt: exec.completedAt?.toISOString(),
          providerUsed: exec.provider,
          actualCost: exec.actualCost,
          error: exec.error,
        }],
        nodes: [{
          id: exec.id,
          nodeType: exec.nodeType,
          label: exec.nodeLabel ?? exec.nodeType,
          status: exec.status.toLowerCase() as "running" | "completed" | "failed",
          duration: exec.durationMs ? formatDuration(exec.durationMs) : undefined,
          provider: exec.provider,
          model: exec.model,
          cost: exec.actualCost ?? 0,
          error: exec.error,
          output: output ? {
            type: "text" as const,
            preview: output.text?.slice(0, 50),
          } : undefined,
        }],
      };
    });

    // Merge and sort by startedAt
    const formattedExecutions = [...formattedWorkflowExecutions, ...formattedQuickExecutions]
      .sort((a, b) => {
        const aTime = new Date(a.startedAt ?? a.createdAt ?? 0).getTime();
        const bTime = new Date(b.startedAt ?? b.createdAt ?? 0).getTime();
        return bTime - aTime;
      })
      .slice(0, limit);

    return NextResponse.json({
      executions: formattedExecutions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats: {
        totalRuns,
        successRate: `${successRate.toFixed(1)}%`,
        avgDuration: formatDuration(avgDurationMs),
        creditsUsed: totalCreditsUsed,
      },
    });
  } catch (error) {
    console.error("[GET /api/executions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch executions" },
      { status: 500 }
    );
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}
