import { NextRequest, NextResponse } from "next/server";
import { runs } from "@trigger.dev/sdk/v3";

// =============================================================================
// GET RUNS DIRECTLY FROM TRIGGER.DEV
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const status = searchParams.get("status"); // COMPLETED, FAILED, EXECUTING, etc.

    // Fetch runs from Trigger.dev API
    const runsList = await runs.list({
      limit,
      status: status ? [status as any] : undefined,
    });

    // Transform to match our history panel format
    const executions = runsList.data.map((run) => {
      // Map Trigger.dev status to our status
      let mappedStatus = "PENDING";
      if (run.status === "COMPLETED") mappedStatus = "COMPLETED";
      else if (run.status === "FAILED" || run.status === "CRASHED" || run.status === "SYSTEM_FAILURE") mappedStatus = "FAILED";
      else if (run.status === "CANCELED" || run.status === "INTERRUPTED") mappedStatus = "CANCELLED";
      else if (run.status === "EXECUTING" || run.status === "REATTEMPTING") mappedStatus = "RUNNING";
      else if (run.status === "QUEUED" || run.status === "PENDING" || run.status === "WAITING_FOR_DEPLOY") mappedStatus = "PENDING";

      return {
        id: run.id,
        triggerRunId: run.id,
        status: mappedStatus,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        completedAt: run.finishedAt,
        taskIdentifier: run.taskIdentifier,
        // Duration in ms
        durationMs: run.startedAt && run.finishedAt 
          ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
          : undefined,
        // For now, we don't have node-level details from Trigger.dev directly
        // Those are stored in our database
        nodeExecutions: [],
        // Error if failed
        error: run.status === "FAILED" || run.status === "CRASHED" ? "Execution failed" : undefined,
      };
    });

    return NextResponse.json({
      executions,
      pagination: {
        hasMore: runsList.data.length === limit,
      },
      source: "trigger.dev",
    });
  } catch (error) {
    console.error("[GET /api/trigger-runs] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch runs from Trigger.dev",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


