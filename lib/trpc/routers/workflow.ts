import { z } from "zod";
import { router, protectedProcedure } from "../server";
import { TRPCError } from "@trpc/server";

// Sanitize nodes to remove large base64 content when returning from DB
function sanitizeNodesFromStorage(nodesJson: unknown): unknown[] {
  if (!Array.isArray(nodesJson)) return [];
  
  return nodesJson.map((node) => {
    const n = node as Record<string, unknown>;
    const data = (n.data ?? {}) as Record<string, unknown>;
    
    // Remove any remaining large base64 data
    const sanitizedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Check for base64 strings
      if (typeof value === "string" && value.startsWith("data:") && value.length > 50000) {
        sanitizedData[key] = "[media data - reload to view]";
        continue;
      }
      
      // Check for objects with base64 url
      if (typeof value === "object" && value !== null && "url" in value) {
        const obj = value as { url?: string };
        if (typeof obj.url === "string" && obj.url.startsWith("data:") && obj.url.length > 50000) {
          sanitizedData[key] = { ...obj, url: "[media data - reload to view]" };
          continue;
        }
      }
      
      sanitizedData[key] = value;
    }
    
    return {
      ...n,
      data: sanitizedData,
    };
  });
}

// =============================================================================
// WORKFLOW ROUTER
// =============================================================================

const WorkflowCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  nodesJson: z.array(z.unknown()),
  edgesJson: z.array(z.unknown()),
  viewportJson: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
});

const WorkflowUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  nodesJson: z.array(z.unknown()).optional(),
  edgesJson: z.array(z.unknown()).optional(),
  viewportJson: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
  isPublished: z.boolean().optional(),
});

export const workflowRouter = router({
  // List all workflows for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const workflows = await ctx.db.workflow.findMany({
      where: { userId: ctx.userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        version: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            executions: true,
          },
        },
      },
    });

    return { workflows };
  }),

  // Get a single workflow by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = await ctx.db.workflow.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        include: {
          executions: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              status: true,
              startedAt: true,
              completedAt: true,
              actualCost: true,
              createdAt: true,
            },
          },
        },
      });

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      // Sanitize nodesJson to remove any large base64 data before returning
      const sanitizedWorkflow = {
        ...workflow,
        nodesJson: sanitizeNodesFromStorage(workflow.nodesJson),
      };

      return { workflow: sanitizedWorkflow };
    }),

  // Create a new workflow
  create: protectedProcedure
    .input(WorkflowCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.db.workflow.create({
        data: {
          userId: ctx.userId,
          name: input.name,
          description: input.description,
          nodesJson: input.nodesJson,
          edgesJson: input.edgesJson,
          viewportJson: input.viewportJson ?? null,
        },
      });

      return { workflow };
    }),

  // Update an existing workflow
  update: protectedProcedure
    .input(WorkflowUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Verify ownership
      const existing = await ctx.db.workflow.findFirst({
        where: { id, userId: ctx.userId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      const data: Record<string, unknown> = {};
      if (updateData.name !== undefined) data.name = updateData.name;
      if (updateData.description !== undefined) data.description = updateData.description;
      if (updateData.nodesJson !== undefined) data.nodesJson = updateData.nodesJson;
      if (updateData.edgesJson !== undefined) data.edgesJson = updateData.edgesJson;
      if (updateData.viewportJson !== undefined) data.viewportJson = updateData.viewportJson;
      if (updateData.isPublished !== undefined) data.isPublished = updateData.isPublished;

      // Increment version if nodes or edges changed
      if (updateData.nodesJson || updateData.edgesJson) {
        data.version = existing.version + 1;
      }

      const workflow = await ctx.db.workflow.update({
        where: { id },
        data,
      });

      return { workflow };
    }),

  // Delete a workflow
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.db.workflow.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      await ctx.db.workflow.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});


