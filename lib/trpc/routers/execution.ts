import { z } from "zod";
import { router, protectedProcedure } from "../server";
import { TRPCError } from "@trpc/server";

// =============================================================================
// EXECUTION ROUTER
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export const executionRouter = router({
  // List all executions with filters
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { status, search, limit = 20, offset = 0 } = input ?? {};

      // Build where clause
      const where: {
        workflow: { userId: string };
        status?: string;
        workflow?: { userId: string; name?: { contains: string; mode: "insensitive" } };
      } = {
        workflow: { userId: ctx.userId },
      };

      if (status && status !== "all") {
        where.status = status.toUpperCase();
      }

      if (search) {
        where.workflow = {
          userId: ctx.userId,
          name: { contains: search, mode: "insensitive" },
        };
      }

      // Fetch executions with node executions
      const [executions, total] = await Promise.all([
        ctx.db.workflowExecution.findMany({
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
        ctx.db.workflowExecution.count({ where }),
      ]);

      // Calculate aggregate stats
      const now = new Date();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [weekStats, totalRuns] = await Promise.all([
        ctx.db.workflowExecution.findMany({
          where: {
            workflow: { userId: ctx.userId },
            startedAt: { gte: startOfWeek },
          },
          select: {
            status: true,
            startedAt: true,
            completedAt: true,
          },
        }),
        ctx.db.workflowExecution.count({
          where: { workflow: { userId: ctx.userId } },
        }),
      ]);

      // Calculate total credits used
      const allNodeExecutions = await ctx.db.nodeExecution.aggregate({
        where: {
          workflowExecution: { workflow: { userId: ctx.userId } },
        },
        _sum: { actualCost: true },
      });

      const totalCreditsUsed = allNodeExecutions._sum.actualCost ?? 0;

      // Calculate success rate
      const successfulRuns = weekStats.filter((e) => e.status === "COMPLETED").length;
      const successRate = weekStats.length > 0 ? (successfulRuns / weekStats.length) * 100 : 100;

      // Calculate avg duration
      const completedRuns = weekStats.filter((e) => e.completedAt && e.startedAt);
      const avgDurationMs = completedRuns.length > 0
        ? completedRuns.reduce((sum, e) => {
            return sum + (new Date(e.completedAt!).getTime() - new Date(e.startedAt!).getTime());
          }, 0) / completedRuns.length
        : 0;

      // Also fetch quick executions
      const quickExecutions = await ctx.db.quickExecution.findMany({
        where: { userId: ctx.userId },
        orderBy: { startedAt: "desc" },
        take: limit,
      });

      // Format workflow executions
      const formattedWorkflowExecutions = executions.map((exec) => {
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
          totalCost: exec.nodeExecutions.reduce((sum, n) => sum + (n.actualCost ?? 0), 0),
          nodeCount: exec.nodeExecutions.length,
          nodes: exec.nodeExecutions.map((node) => {
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
      const formattedQuickExecutions = quickExecutions.map((exec) => {
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
          nodes: [{
            id: exec.id,
            nodeType: exec.nodeType,
            label: exec.nodeLabel ?? exec.nodeType,
            status: exec.status.toLowerCase() as "running" | "completed" | "failed",
            duration: exec.durationMs ? formatDuration(exec.durationMs) : undefined,
            provider: exec.provider,
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

      return {
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
      };
    }),

  // Get a single execution by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const execution = await ctx.db.workflowExecution.findFirst({
        where: {
          id: input.id,
          workflow: { userId: ctx.userId },
        },
        include: {
          workflow: { select: { id: true, name: true } },
          nodeExecutions: {
            orderBy: { startedAt: "asc" },
          },
        },
      });

      if (!execution) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Execution not found",
        });
      }

      return { execution };
    }),

  // Create a workflow execution
  create: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      inputsJson: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify workflow ownership
      const workflow = await ctx.db.workflow.findFirst({
        where: { id: input.workflowId, userId: ctx.userId },
      });

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      const execution = await ctx.db.workflowExecution.create({
        data: {
          workflowId: input.workflowId,
          status: "RUNNING",
          inputsJson: input.inputsJson ?? {},
          startedAt: new Date(),
        },
      });

      return { execution };
    }),

  // Get latest execution status for a workflow (for polling)
  getLatestStatus: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Get the most recent execution for this workflow
      const execution = await ctx.db.workflowExecution.findFirst({
        where: {
          workflowId: input.workflowId,
          workflow: { userId: ctx.userId },
        },
        orderBy: { startedAt: "desc" },
        include: {
          nodeExecutions: {
            select: {
              id: true,
              nodeId: true,
              nodeType: true,
              nodeLabel: true,
              status: true,
              error: true,
              providerUsed: true,
              startedAt: true,
              completedAt: true,
            },
          },
        },
      });

      if (!execution) {
        return { execution: null, nodeStatuses: [] };
      }

      const nodeStatuses = execution.nodeExecutions.map((ne) => ({
        nodeId: ne.nodeId,
        nodeType: ne.nodeType,
        nodeLabel: ne.nodeLabel,
        status: ne.status.toLowerCase() as "pending" | "queued" | "running" | "waiting" | "completed" | "failed",
        error: ne.error,
        providerUsed: ne.providerUsed,
      }));

      return {
        execution: {
          id: execution.id,
          status: execution.status.toLowerCase(),
          startedAt: execution.startedAt?.toISOString(),
          completedAt: execution.completedAt?.toISOString(),
        },
        nodeStatuses,
      };
    }),

  // Get recent errors for a workflow
  getErrors: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      // Fetch node executions with errors for this workflow
      const nodeExecutions = await ctx.db.nodeExecution.findMany({
        where: {
          workflowExecution: {
            workflowId: input.workflowId,
            workflow: { userId: ctx.userId },
          },
          status: "FAILED",
          error: { not: null },
        },
        orderBy: { completedAt: "desc" },
        take: input.limit,
        include: {
          workflowExecution: {
            select: {
              id: true,
              startedAt: true,
            },
          },
        },
      });

      const errors = nodeExecutions.map((ne) => ({
        id: ne.id,
        nodeId: ne.nodeId,
        nodeName: ne.nodeLabel ?? ne.nodeType,
        nodeType: ne.nodeType,
        message: ne.error ?? "Unknown error",
        timestamp: ne.completedAt?.toISOString() ?? ne.startedAt?.toISOString() ?? new Date().toISOString(),
        executionId: ne.workflowExecution.id,
        providerUsed: ne.providerUsed,
        inputs: ne.inputJson as Record<string, unknown> | null,
      }));

      return { errors };
    }),

  // Update execution status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["RUNNING", "COMPLETED", "FAILED", "CANCELLED"]),
      error: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through workflow
      const existing = await ctx.db.workflowExecution.findFirst({
        where: {
          id: input.id,
          workflow: { userId: ctx.userId },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Execution not found",
        });
      }

      const execution = await ctx.db.workflowExecution.update({
        where: { id: input.id },
        data: {
          status: input.status,
          error: input.error,
          completedAt: ["COMPLETED", "FAILED", "CANCELLED"].includes(input.status)
            ? new Date()
            : undefined,
        },
      });

      return { execution };
    }),
});


