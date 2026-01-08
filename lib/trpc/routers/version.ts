import { z } from "zod";
import { router, protectedProcedure } from "../server";
import { db } from "@/lib/db";
import { TRPCError } from "@trpc/server";

export const versionRouter = router({
  // List all versions for a workflow
  list: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const versions = await db.workflowVersion.findMany({
        where: {
          workflowId: input.workflowId,
          workflow: {
            userId: ctx.userId,
          },
        },
        orderBy: {
          version: "desc",
        },
        select: {
          id: true,
          version: true,
          name: true,
          message: true,
          nodeCount: true,
          createdAt: true,
        },
      });

      return { versions };
    }),

  // Create a new version (save snapshot)
  create: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the workflow
      const workflow = await db.workflow.findFirst({
        where: {
          id: input.workflowId,
          userId: ctx.userId,
        },
      });

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      // Get the latest version number
      const latestVersion = await db.workflowVersion.findFirst({
        where: { workflowId: input.workflowId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const newVersion = (latestVersion?.version ?? 0) + 1;

      // Count nodes
      const nodesJson = workflow.nodesJson as unknown[];
      const nodeCount = Array.isArray(nodesJson) ? nodesJson.length : 0;

      // Create the version
      const version = await db.workflowVersion.create({
        data: {
          workflowId: input.workflowId,
          version: newVersion,
          name: workflow.name,
          nodesJson: workflow.nodesJson,
          edgesJson: workflow.edgesJson,
          viewportJson: workflow.viewportJson,
          message: input.message,
          nodeCount,
        },
      });

      // Update workflow version number
      await db.workflow.update({
        where: { id: input.workflowId },
        data: { version: newVersion },
      });

      return { version };
    }),

  // Restore a specific version
  restore: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      versionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the version to restore
      const versionToRestore = await db.workflowVersion.findFirst({
        where: {
          id: input.versionId,
          workflowId: input.workflowId,
          workflow: {
            userId: ctx.userId,
          },
        },
      });

      if (!versionToRestore) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      // First, save current state as a new version (so we don't lose it)
      const workflow = await db.workflow.findUnique({
        where: { id: input.workflowId },
      });

      if (workflow) {
        const latestVersion = await db.workflowVersion.findFirst({
          where: { workflowId: input.workflowId },
          orderBy: { version: "desc" },
          select: { version: true },
        });

        const autoSaveVersion = (latestVersion?.version ?? 0) + 1;
        const nodesJson = workflow.nodesJson as unknown[];
        const nodeCount = Array.isArray(nodesJson) ? nodesJson.length : 0;

        await db.workflowVersion.create({
          data: {
            workflowId: input.workflowId,
            version: autoSaveVersion,
            name: workflow.name,
            nodesJson: workflow.nodesJson,
            edgesJson: workflow.edgesJson,
            viewportJson: workflow.viewportJson,
            message: `Auto-saved before restoring to v${versionToRestore.version}`,
            nodeCount,
          },
        });
      }

      // Restore the workflow to the selected version
      const updatedWorkflow = await db.workflow.update({
        where: { id: input.workflowId },
        data: {
          name: versionToRestore.name,
          nodesJson: versionToRestore.nodesJson,
          edgesJson: versionToRestore.edgesJson,
          viewportJson: versionToRestore.viewportJson,
        },
      });

      return {
        workflow: updatedWorkflow,
        restoredVersion: versionToRestore.version,
      };
    }),

  // Delete a specific version
  delete: protectedProcedure
    .input(z.object({
      versionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const version = await db.workflowVersion.findFirst({
        where: {
          id: input.versionId,
          workflow: {
            userId: ctx.userId,
          },
        },
      });

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      await db.workflowVersion.delete({
        where: { id: input.versionId },
      });

      return { success: true };
    }),
});

