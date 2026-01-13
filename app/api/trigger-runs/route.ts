import { NextRequest, NextResponse } from "next/server";
import { runs } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db";
import { getUserIdForApi } from "@/lib/user";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";

// =============================================================================
// GET RUNS - MERGED FROM TRIGGER.DEV + DATABASE + QUICK EXECUTIONS
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const status = searchParams.get("status"); // COMPLETED, FAILED, EXECUTING, etc.
    const workflowId = searchParams.get("workflowId"); // Filter by specific workflow

    // Try to get user ID for filtering quick executions
    let userId: string | null = null;
    try {
      const userResult = await getUserIdForApi();
      userId = userResult.userId;
    } catch {
      // User auth is optional
    }

    // If workflowId is specified, fetch directly from database instead of Trigger.dev
    // This is more efficient and accurate for per-workflow filtering
    if (workflowId && workflowId !== "new") {
      // Fetch workflow executions (full workflow runs)
      const dbExecutions = await db.workflowExecution.findMany({
        where: {
          workflowId,
          ...(userId ? { userId } : {}),
        },
        orderBy: { startedAt: "desc" },
        take: limit,
        include: {
          workflow: { select: { name: true, id: true } },
          nodeExecutions: {
            orderBy: [
              { completedAt: { sort: "asc", nulls: "last" } },
              { startedAt: { sort: "asc", nulls: "last" } },
            ],
            select: {
              id: true,
              nodeId: true,
              nodeType: true,
              nodeLabel: true,
              status: true,
              providerUsed: true,
              error: true,
              startedAt: true,
              completedAt: true,
              actualCost: true,
            },
          },
        },
      });

      // Also fetch QuickExecution records for this workflow (individual node runs)
      const quickExecutions = await db.quickExecution.findMany({
        where: {
          workflowId,
          ...(userId ? { userId } : {}),
        },
        orderBy: { startedAt: "desc" },
        take: limit,
      });

      // Transform workflow executions
      const workflowExecs = dbExecutions.map((exec) => {
        // Calculate effective workflow status based on node statuses
        const nodeStatuses = exec.nodeExecutions.map(ne => ne.status);
        const allCompleted = nodeStatuses.length > 0 && nodeStatuses.every(s => s === "COMPLETED");
        const anyFailed = nodeStatuses.some(s => s === "FAILED");
        const anyRunning = nodeStatuses.some(s => s === "RUNNING" || s === "WAITING");
        const anyQueued = nodeStatuses.some(s => s === "QUEUED");
        
        // Derive workflow status from nodes if the stored status doesn't match reality
        let effectiveStatus = exec.status;
        if (anyFailed && effectiveStatus !== "FAILED") {
          effectiveStatus = "FAILED";
        } else if ((anyRunning || anyQueued) && effectiveStatus !== "RUNNING") {
          effectiveStatus = "RUNNING";
        } else if (allCompleted && (effectiveStatus === "RUNNING" || effectiveStatus === "PENDING")) {
          effectiveStatus = "COMPLETED";
        }
        // Keep PENDING status if no nodes exist yet (execution just started)
        else if (exec.status === "PENDING" && nodeStatuses.length === 0) {
          effectiveStatus = "PENDING";
        }

        return {
          id: exec.id,
          triggerRunId: exec.triggerRunId,
          status: effectiveStatus,
          createdAt: exec.createdAt.toISOString(),
          startedAt: exec.startedAt?.toISOString(),
          completedAt: exec.completedAt?.toISOString(),
          taskIdentifier: "workflow-execution",
          workflowName: exec.workflow?.name,
          workflowId: exec.workflowId,
          durationMs: exec.startedAt && exec.completedAt 
            ? new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()
            : undefined,
          nodeExecutions: exec.nodeExecutions.map((ne) => ({
            id: ne.id,
            nodeId: ne.nodeId,
            nodeLabel: ne.nodeLabel || ne.nodeType,
            nodeType: ne.nodeType,
            status: ne.status,
            providerUsed: ne.providerUsed,
            error: ne.error,
            startedAt: ne.startedAt?.toISOString(),
            completedAt: ne.completedAt?.toISOString(),
            actualCost: ne.actualCost || 0,
          })),
          error: exec.error,
        };
      });

      // Transform quick executions (individual node runs via Play button)
      const quickExecs = quickExecutions.map((exec) => {
        const nodeDef = NODE_DEFINITIONS[exec.nodeType as AINodeType];
        return {
          id: exec.id,
          triggerRunId: null,
          status: exec.status.toUpperCase(),
          createdAt: exec.createdAt.toISOString(),
          startedAt: exec.startedAt?.toISOString(),
          completedAt: exec.completedAt?.toISOString(),
          taskIdentifier: `quick-${exec.nodeType}`,
          workflowName: exec.nodeLabel || nodeDef?.label || exec.nodeType,
          workflowId: exec.workflowId,
          durationMs: exec.durationMs,
          nodeExecutions: [{
            id: exec.id,
            nodeId: exec.nodeId || exec.id,
            nodeLabel: exec.nodeLabel || nodeDef?.label || exec.nodeType,
            nodeType: exec.nodeType,
            status: exec.status.toUpperCase(),
            providerUsed: exec.provider || "internal",
            error: exec.error,
            startedAt: exec.startedAt?.toISOString(),
            completedAt: exec.completedAt?.toISOString(),
            actualCost: exec.actualCost || 0,
          }],
          error: exec.error,
          isQuickExecution: true,
        };
      });

      // Merge and sort: RUNNING/PENDING executions first, then by start time (newest first)
      const allExecutions = [...workflowExecs, ...quickExecs]
        .sort((a, b) => {
          // Active executions (RUNNING or PENDING) always come first
          const activeStatuses = ["RUNNING", "PENDING"];
          const aActive = activeStatuses.includes(a.status) ? 1 : 0;
          const bActive = activeStatuses.includes(b.status) ? 1 : 0;
          if (aActive !== bActive) return bActive - aActive;
          
          // Then sort by start time (newest first)
          const aTime = new Date(a.startedAt || a.createdAt).getTime();
          const bTime = new Date(b.startedAt || b.createdAt).getTime();
          return bTime - aTime;
        })
        .slice(0, limit);

      return NextResponse.json({
        executions: allExecutions,
        pagination: {
          hasMore: dbExecutions.length === limit || quickExecutions.length === limit,
        },
        source: "db-workflow-filtered",
      });
    }

    // Fetch runs from Trigger.dev API (for global view)
    let runsList: { data: any[] } = { data: [] };
    try {
      runsList = await runs.list({
        limit,
        status: status ? [status as any] : undefined,
      });
    } catch (triggerError) {
      console.warn("[GET /api/trigger-runs] Trigger.dev fetch failed:", triggerError);
      // Continue without trigger.dev data
    }

    // Get Trigger run IDs for database lookup
    const triggerRunIds = runsList.data.map(r => r.id);
    
    // Fetch corresponding workflow executions from our database
    // These have the real node execution details with proper labels
    const dbExecutions = await db.workflowExecution.findMany({
      where: {
        triggerRunId: { in: triggerRunIds },
      },
      include: {
        workflow: { select: { name: true, id: true } },
        nodeExecutions: {
          orderBy: [
            { completedAt: { sort: "asc", nulls: "last" } },
            { startedAt: { sort: "asc", nulls: "last" } },
          ],
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
            nodeLabel: true,
            status: true,
            providerUsed: true,
            error: true,
            startedAt: true,
            completedAt: true,
            actualCost: true,
          },
        },
      },
    });

    // Also fetch standalone node executions (from single node runs via /api/nodes/execute)
    const standaloneNodeExecutions = await db.nodeExecution.findMany({
      where: {
        workflowExecution: {
          triggerRunId: { in: triggerRunIds },
        },
      },
      include: {
        workflowExecution: {
          select: {
            triggerRunId: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: limit * 5, // Fetch more to cover all runs
    });

    // Create lookup maps
    const dbExecByTriggerId = new Map(dbExecutions.map(e => [e.triggerRunId, e]));
    const nodeExecsByTriggerId = new Map<string, typeof standaloneNodeExecutions>();
    for (const ne of standaloneNodeExecutions) {
      const triggerId = ne.workflowExecution?.triggerRunId;
      if (triggerId) {
        if (!nodeExecsByTriggerId.has(triggerId)) {
          nodeExecsByTriggerId.set(triggerId, []);
        }
        nodeExecsByTriggerId.get(triggerId)!.push(ne);
      }
    }

    console.log(`[trigger-runs] Trigger runs: ${runsList.data.length}, DB execs: ${dbExecutions.length}`);
    if (dbExecutions.length > 0) {
      console.log(`[trigger-runs] DB exec triggerRunIds: ${dbExecutions.map(e => e.triggerRunId).join(', ')}`);
    }
    
    // Transform to match our history panel format
    const executions = runsList.data.map((run) => {
      // Map Trigger.dev status to our status
      let mappedStatus = "PENDING";
      if (run.status === "COMPLETED") mappedStatus = "COMPLETED";
      else if (run.status === "FAILED" || run.status === "CRASHED" || run.status === "SYSTEM_FAILURE") mappedStatus = "FAILED";
      else if (run.status === "CANCELED" || run.status === "INTERRUPTED") mappedStatus = "CANCELLED";
      else if (run.status === "EXECUTING" || run.status === "REATTEMPTING") mappedStatus = "RUNNING";
      else if (run.status === "QUEUED" || run.status === "PENDING" || run.status === "WAITING_FOR_DEPLOY") mappedStatus = "PENDING";

      // Get node executions from database
      const dbExec = dbExecByTriggerId.get(run.id);
      const dbNodeExecutions = dbExec?.nodeExecutions || nodeExecsByTriggerId.get(run.id) || [];
      
      if (dbNodeExecutions.length > 0) {
        console.log(`[trigger-runs] Run ${run.id}: found ${dbNodeExecutions.length} node execs, nodeIds: ${dbNodeExecutions.map((ne: any) => `${ne.nodeId}:${ne.status}`).join(', ')}`);
      }
      
      // Map database node executions to our format
      const nodeExecutions = dbNodeExecutions.map((ne: any) => ({
        id: ne.id,
        nodeId: ne.nodeId,
        nodeLabel: ne.nodeLabel || ne.nodeType,
        nodeType: ne.nodeType,
        status: ne.status,
        providerUsed: ne.providerUsed,
        error: ne.error,
        startedAt: ne.startedAt?.toISOString?.() ?? ne.startedAt,
        completedAt: ne.completedAt?.toISOString?.() ?? ne.completedAt,
        actualCost: ne.actualCost || 0,
      }));

      // Determine effective status: use database status if node is FAILED even if Trigger says RUNNING
      // This handles cases where the task is retrying but already failed
      let effectiveStatus = mappedStatus;
      if (nodeExecutions.length > 0) {
        const allNodesFailed = nodeExecutions.every((ne: any) => ne.status === "FAILED");
        const anyNodeFailed = nodeExecutions.some((ne: any) => ne.status === "FAILED");
        const allNodesCompleted = nodeExecutions.every((ne: any) => ne.status === "COMPLETED");
        
        if (allNodesFailed) {
          effectiveStatus = "FAILED";
        } else if (allNodesCompleted) {
          effectiveStatus = "COMPLETED";
        } else if (anyNodeFailed && mappedStatus === "RUNNING") {
          // Some nodes failed but task is still running (retrying) - show as FAILED
          effectiveStatus = "FAILED";
        }
      }

      return {
        id: run.id,
        triggerRunId: run.id,
        status: effectiveStatus,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        completedAt: run.finishedAt,
        taskIdentifier: run.taskIdentifier,
        workflowName: dbExec?.workflow?.name,
        workflowId: dbExec?.workflowId,
        // Duration in ms
        durationMs: run.startedAt && run.finishedAt 
          ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
          : undefined,
        // Include real node executions from database
        nodeExecutions,
        // Error if failed
        error: run.status === "FAILED" || run.status === "CRASHED" ? "Execution failed" : undefined,
      };
    });

    // Fetch QuickExecution records (utility nodes, OpenRouter, etc.)
    const quickExecutions = await db.quickExecution.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    // Transform quick executions to match our format
    const quickExecutionRecords = quickExecutions.map((exec) => {
      const nodeDef = NODE_DEFINITIONS[exec.nodeType as AINodeType];
      
      return {
        id: exec.id,
        triggerRunId: null,
        status: exec.status.toUpperCase(),
        createdAt: exec.createdAt.toISOString(),
        startedAt: exec.startedAt?.toISOString(),
        completedAt: exec.completedAt?.toISOString(),
        taskIdentifier: `quick-${exec.nodeType}`,
        workflowName: exec.nodeLabel || nodeDef?.label || exec.nodeType,
        durationMs: exec.durationMs,
        nodeExecutions: [{
          id: exec.id,
          nodeId: exec.id,
          nodeLabel: exec.nodeLabel || nodeDef?.label || exec.nodeType,
          nodeType: exec.nodeType,
          status: exec.status.toUpperCase(),
          providerUsed: exec.provider || "internal",
          error: exec.error,
          startedAt: exec.startedAt?.toISOString(),
          completedAt: exec.completedAt?.toISOString(),
          actualCost: exec.actualCost || 0,
        }],
        error: exec.error,
        isQuickExecution: true,
      };
    });

    // Merge trigger.dev executions with quick executions
    // Sort: RUNNING/PENDING executions first, then by start time (newest first)
    const allExecutions = [...executions, ...quickExecutionRecords]
      .sort((a, b) => {
        // Active executions (RUNNING or PENDING) always come first
        const activeStatuses = ["RUNNING", "PENDING"];
        const aActive = activeStatuses.includes(a.status) ? 1 : 0;
        const bActive = activeStatuses.includes(b.status) ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        
        // Then sort by start time (newest first)
        const aTime = new Date(a.startedAt || a.createdAt).getTime();
        const bTime = new Date(b.startedAt || b.createdAt).getTime();
        return bTime - aTime;
      })
      .slice(0, limit);

    return NextResponse.json({
      executions: allExecutions,
      pagination: {
        hasMore: runsList.data.length === limit || quickExecutions.length === limit,
      },
      source: "trigger.dev+db+quick",
    });
  } catch (error) {
    console.error("[GET /api/trigger-runs] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch runs",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


