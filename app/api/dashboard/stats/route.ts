import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// =============================================================================
// DASHBOARD STATS API
// =============================================================================

export async function GET() {
  try {
    let userId: string | null = null;

    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch {
      // Auth failed - use dev fallback
      userId = process.env.DEV_USER_ID ?? "dev-user";
    }

    if (!userId) {
      // In dev mode without Clerk, use a fallback
      userId = process.env.DEV_USER_ID ?? "dev-user";
    }

    // Get current date info for filtering
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfLastWeek = new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Fetch all stats in parallel
    const [
      totalWorkflows,
      workflowsLastMonth,
      todayExecutions,
      yesterdayExecutions,
      weekExecutions,
      lastWeekExecutions,
      recentExecutions,
      userCredits,
    ] = await Promise.all([
      // Total workflows
      db.workflow.count({ where: { userId } }),

      // Workflows created last month
      db.workflow.count({
        where: {
          userId,
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
      }),

      // Executions today
      db.workflowExecution.count({
        where: {
          workflow: { userId },
          startedAt: { gte: startOfToday },
        },
      }),

      // Executions yesterday
      db.workflowExecution.count({
        where: {
          workflow: { userId },
          startedAt: { gte: startOfYesterday, lt: startOfToday },
        },
      }),

      // This week's executions with status
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

      // Last week's executions with status
      db.workflowExecution.findMany({
        where: {
          workflow: { userId },
          startedAt: { gte: startOfLastWeek, lt: startOfWeek },
        },
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
        },
      }),

      // Recent 10 executions for activity feed (include nodeExecutions for status derivation)
      db.workflowExecution.findMany({
        where: { workflow: { userId } },
        orderBy: { startedAt: "desc" },
        take: 10,
        include: {
          workflow: { select: { name: true } },
          nodeExecutions: {
            select: { status: true },
          },
        },
      }),

      // User credits
      db.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      }),
    ]);

    // Calculate stats
    const workflowChange = totalWorkflows - workflowsLastMonth;

    const executionChangePercent = yesterdayExecutions > 0
      ? Math.round(((todayExecutions - yesterdayExecutions) / yesterdayExecutions) * 100)
      : todayExecutions > 0 ? 100 : 0;

    // Calculate average runtime (only completed)
    const completedWeekExecutions = weekExecutions.filter(
      (e: { status: string; startedAt: Date | null; completedAt: Date | null }) => e.status === "COMPLETED" && e.completedAt && e.startedAt
    );
    const avgRuntimeMs = completedWeekExecutions.length > 0
      ? completedWeekExecutions.reduce((sum: number, e: { completedAt: Date | null; startedAt: Date | null }) => {
          return sum + (new Date(e.completedAt!).getTime() - new Date(e.startedAt!).getTime());
        }, 0) / completedWeekExecutions.length
      : 0;

    const completedLastWeekExecutions = lastWeekExecutions.filter(
      (e: { status: string; startedAt: Date | null; completedAt: Date | null }) => e.status === "COMPLETED" && e.completedAt && e.startedAt
    );
    const lastWeekAvgRuntimeMs = completedLastWeekExecutions.length > 0
      ? completedLastWeekExecutions.reduce((sum: number, e: { completedAt: Date | null; startedAt: Date | null }) => {
          return sum + (new Date(e.completedAt!).getTime() - new Date(e.startedAt!).getTime());
        }, 0) / completedLastWeekExecutions.length
      : 0;

    const runtimeChangeMs = lastWeekAvgRuntimeMs - avgRuntimeMs; // Positive = improvement

    // Success rate
    const successfulWeek = weekExecutions.filter((e: { status: string }) => e.status === "COMPLETED").length;
    const successRateWeek = weekExecutions.length > 0
      ? (successfulWeek / weekExecutions.length) * 100
      : 100;

    const successfulLastWeek = lastWeekExecutions.filter((e: { status: string }) => e.status === "COMPLETED").length;
    const successRateLastWeek = lastWeekExecutions.length > 0
      ? (successfulLastWeek / lastWeekExecutions.length) * 100
      : 100;

    const successRateChange = successRateWeek - successRateLastWeek;

    // Format recent activity with effective status derivation
    const recentActivity = recentExecutions.map((exec: typeof recentExecutions[number]) => {
      const effectiveStatus = getEffectiveStatus(exec);
      const duration = exec.completedAt && exec.startedAt
        ? formatDuration(new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime())
        : undefined;

      return {
        id: exec.id,
        workflow: exec.workflow.name,
        status: effectiveStatus === "COMPLETED" ? "success" : effectiveStatus === "FAILED" ? "error" : "warning",
        time: exec.startedAt ? formatTimeAgo(exec.startedAt) : "—",
        duration,
      };
    });

    // Count truly running executions (using effective status to exclude stale/stuck ones)
    const runningCount = recentExecutions.filter((exec: typeof recentExecutions[number]) => {
      const effectiveStatus = getEffectiveStatus(exec);
      return effectiveStatus === "RUNNING" || effectiveStatus === "PENDING";
    }).length;

    return NextResponse.json({
      stats: {
        totalWorkflows: {
          value: totalWorkflows,
          change: workflowChange > 0 ? `+${workflowChange}` : String(workflowChange),
          changeLabel: "from last month",
        },
        executionsToday: {
          value: todayExecutions,
          change: executionChangePercent > 0 ? `+${executionChangePercent}%` : `${executionChangePercent}%`,
          changeLabel: "from yesterday",
        },
        avgRuntime: {
          value: formatDuration(avgRuntimeMs),
          change: runtimeChangeMs > 0 ? `-${formatDuration(runtimeChangeMs)}` : `+${formatDuration(Math.abs(runtimeChangeMs))}`,
          changeLabel: runtimeChangeMs >= 0 ? "improvement" : "slower",
        },
        successRate: {
          value: `${successRateWeek.toFixed(1)}%`,
          change: successRateChange >= 0 ? `+${successRateChange.toFixed(1)}%` : `${successRateChange.toFixed(1)}%`,
          changeLabel: "this week",
        },
      },
      recentActivity,
      activeWorkflows: runningCount,
      credits: {
        used: 5000 - (userCredits?.credits ?? 0),
        total: 5000,
        remaining: userCredits?.credits ?? 0,
      },
    });
  } catch (error) {
    console.error("[GET /api/dashboard/stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

// Stale execution timeout: 30 minutes
const STALE_EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Derive effective execution status based on node statuses and timeout.
 * This handles cases where executions are stuck in "RUNNING" status.
 */
function getEffectiveStatus(
  execution: {
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    nodeExecutions: { status: string }[];
  }
): string {
  const { status, startedAt, completedAt, nodeExecutions } = execution;
  
  // If already completed/failed/cancelled, use that status
  if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
    return status;
  }
  
  // If marked as RUNNING or PENDING, verify it's not stale
  if ((status === "RUNNING" || status === "PENDING") && startedAt) {
    const now = new Date();
    const runtimeMs = now.getTime() - new Date(startedAt).getTime();
    
    // Check if execution is stale (running > 30 minutes without completion)
    if (!completedAt && runtimeMs > STALE_EXECUTION_TIMEOUT_MS) {
      const nodeStatuses = nodeExecutions.map((ne) => ne.status);
      const anyFailed = nodeStatuses.some((s) => s === "FAILED");
      const allCompleted = nodeStatuses.length > 0 && nodeStatuses.every((s) => s === "COMPLETED");
      
      if (anyFailed) return "FAILED";
      if (allCompleted) return "COMPLETED";
      return "FAILED"; // Mark stale executions as failed
    }
    
    // Check node statuses for more accurate status
    if (nodeExecutions.length > 0) {
      const nodeStatuses = nodeExecutions.map((ne) => ne.status);
      const anyFailed = nodeStatuses.some((s) => s === "FAILED");
      const allCompleted = nodeStatuses.every((s) => s === "COMPLETED");
      const anyRunning = nodeStatuses.some((s) => s === "RUNNING" || s === "WAITING" || s === "QUEUED");
      
      if (anyFailed) return "FAILED";
      if (allCompleted) return "COMPLETED";
      if (anyRunning) return "RUNNING";
    }
  }
  
  return status;
}

