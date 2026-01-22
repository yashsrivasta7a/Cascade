import { z } from "zod/v4";
import { router, protectedProcedure } from "../server";
import { TRPCError } from "@trpc/server";
import {
  saveWorkflowData,
  getWorkflowData,
  getWorkflowNodes,
} from "@/lib/services/workflow-nodes";
import type { Node, Edge } from "reactflow";

// =============================================================================
// OPENAPI RESPONSE SCHEMAS
// =============================================================================

const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number(),
  isPublished: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  nodesJson: z.unknown(),
  edgesJson: z.unknown(),
  viewportJson: z.unknown().nullable(),
});

const WorkflowListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number(),
  isPublished: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  _count: z.object({
    executions: z.number(),
  }),
  thumbnailNodes: z.array(z.object({
    id: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    width: z.number().optional(),
    height: z.number().optional(),
  })),
  thumbnailEdges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
  })),
});

const ExecutionSummarySchema = z.object({
  id: z.string(),
  status: z.string(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  actualCost: z.number().nullable(),
  createdAt: z.date(),
});

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
  list: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/workflows",
        tags: ["Workflows"],
        summary: "List all workflows",
        description: "Returns all workflows for the authenticated user, ordered by last updated",
        protect: true,
      },
    })
    .input(z.void())
    .output(z.object({ workflows: z.array(WorkflowListItemSchema) }))
    .query(async ({ ctx }) => {
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
        nodesJson: true,
        edgesJson: true,
        _count: {
          select: {
            executions: true,
          },
        },
      },
    });

    // Transform for thumbnails - only keep position/size data for nodes
    const workflowsWithThumbnails = workflows.map((workflow) => {
      let thumbnailNodes: Array<{ id: string; position: { x: number; y: number }; width?: number; height?: number }> = [];
      let thumbnailEdges: Array<{ id: string; source: string; target: string }> = [];

      try {
        const nodes = workflow.nodesJson as Array<{ id?: string; position?: { x: number; y: number }; measured?: { width?: number; height?: number }; width?: number; height?: number }> | null;
        if (Array.isArray(nodes)) {
          thumbnailNodes = nodes.map((n, i) => ({
            id: n.id || `node-${i}`,
            position: n.position || { x: 0, y: 0 },
            width: n.measured?.width || n.width,
            height: n.measured?.height || n.height,
          }));
        }
      } catch {
        // Invalid nodes data
      }

      try {
        const edges = workflow.edgesJson as Array<{ id?: string; source?: string; target?: string }> | null;
        if (Array.isArray(edges)) {
          thumbnailEdges = edges.map((e, i) => ({
            id: e.id || `edge-${i}`,
            source: e.source || "",
            target: e.target || "",
          })).filter((e) => e.source && e.target);
        }
      } catch {
        // Invalid edges data
      }

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        version: workflow.version,
        isPublished: workflow.isPublished,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        _count: workflow._count,
        thumbnailNodes,
        thumbnailEdges,
      };
    });

    return { workflows: workflowsWithThumbnails };
  }),

  // Get a single workflow by ID
  get: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/workflows/{id}",
        tags: ["Workflows"],
        summary: "Get workflow by ID",
        description: "Returns a single workflow with its recent executions",
        protect: true,
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({
      workflow: WorkflowSchema.extend({
        executions: z.array(ExecutionSummarySchema),
      }),
    }))
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
    .meta({
      openapi: {
        method: "POST",
        path: "/workflows",
        tags: ["Workflows"],
        summary: "Create a new workflow",
        description: "Creates a new workflow with the provided nodes and edges",
        protect: true,
      },
    })
    .input(WorkflowCreateSchema)
    .output(z.object({ workflow: WorkflowSchema }))
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

  // Update an existing workflow (auto-creates version on save)
  update: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/workflows/{id}",
        tags: ["Workflows"],
        summary: "Update a workflow",
        description: "Updates an existing workflow. Auto-creates a version snapshot when nodes or edges change.",
        protect: true,
      },
    })
    .input(WorkflowUpdateSchema)
    .output(z.object({ workflow: WorkflowSchema }))
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

      // Auto-create version snapshot when nodes or edges change
      if (updateData.nodesJson || updateData.edgesJson) {
        // Get the latest version number
        const latestVersion = await ctx.db.workflowVersion.findFirst({
          where: { workflowId: id },
          orderBy: { version: "desc" },
          select: { version: true },
        });

        const newVersion = (latestVersion?.version ?? 0) + 1;
        data.version = newVersion;

        // Count nodes for display
        const nodesJson = (updateData.nodesJson ?? existing.nodesJson) as unknown[];
        const nodeCount = Array.isArray(nodesJson) ? nodesJson.length : 0;

        // Create version snapshot
        await ctx.db.workflowVersion.create({
          data: {
            workflowId: id,
            version: newVersion,
            name: (updateData.name ?? existing.name) as string,
            nodesJson: updateData.nodesJson ?? existing.nodesJson,
            edgesJson: updateData.edgesJson ?? existing.edgesJson,
            viewportJson: updateData.viewportJson ?? existing.viewportJson,
            message: `Auto-saved`,
            nodeCount,
          },
        });
      }

      const workflow = await ctx.db.workflow.update({
        where: { id },
        data,
      });

      return { workflow };
    }),

  // Duplicate a workflow
  duplicate: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/workflows/{id}/duplicate",
        tags: ["Workflows"],
        summary: "Duplicate a workflow",
        description: "Creates a copy of an existing workflow with '(Copy)' appended to the name",
        protect: true,
      },
    })
    .input(z.object({ id: z.string() }))
    .output(WorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and get original workflow
      const original = await ctx.db.workflow.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });

      if (!original) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      // Create duplicate with "(Copy)" appended to name
      const duplicated = await ctx.db.workflow.create({
        data: {
          userId: ctx.userId,
          name: `${original.name} (Copy)`,
          description: original.description,
          nodesJson: original.nodesJson ?? [],
          edgesJson: original.edgesJson ?? [],
          viewportJson: original.viewportJson ?? { x: 0, y: 0, zoom: 1 },
          version: 1,
          isPublished: false,
        },
      });

      return duplicated;
    }),

  // Delete a workflow
  delete: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/workflows/{id}",
        tags: ["Workflows"],
        summary: "Delete a workflow",
        description: "Permanently deletes a workflow and all associated versions",
        protect: true,
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({ success: z.boolean() }))
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

  // Get paginated nodes (for large workflows with 1000+ nodes)
  getNodes: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/workflows/{id}/nodes",
        tags: ["Workflows"],
        summary: "Get paginated workflow nodes",
        description: "Returns nodes with pagination support for large workflows",
        protect: true,
      },
    })
    .input(z.object({
      id: z.string(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      type: z.string().optional(),
    }))
    .output(z.object({
      nodes: z.array(z.unknown()),
      nextCursor: z.string().optional(),
      total: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const workflow = await ctx.db.workflow.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true },
      });

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      const result = await getWorkflowNodes(input.id, {
        cursor: input.cursor,
        limit: input.limit,
        type: input.type,
      });

      return result;
    }),

  // Update with normalized storage (efficient for large workflows)
  updateNormalized: protectedProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/workflows/{id}/normalized",
        tags: ["Workflows"],
        summary: "Update workflow with normalized storage",
        description: "Updates workflow using normalized tables for efficient storage of large workflows",
        protect: true,
      },
    })
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      nodesJson: z.array(z.unknown()),
      edgesJson: z.array(z.unknown()),
      viewportJson: z.object({
        x: z.number(),
        y: z.number(),
        zoom: z.number(),
      }).optional(),
    }))
    .output(z.object({ success: z.boolean(), nodeCount: z.number(), edgeCount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { id, nodesJson, edgesJson, ...metadata } = input;

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

      // Save to normalized tables
      await saveWorkflowData(id, nodesJson as Node[], edgesJson as Edge[]);

      // Update metadata if provided
      if (Object.keys(metadata).length > 0) {
        await ctx.db.workflow.update({
          where: { id },
          data: metadata,
        });
      }

      return {
        success: true,
        nodeCount: nodesJson.length,
        edgeCount: edgesJson.length,
      };
    }),

  // Get migration status for a workflow
  getMigrationStatus: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(z.object({
      isNormalized: z.boolean(),
      nodeCount: z.number(),
      edgeCount: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const workflow = await ctx.db.workflow.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { isNormalized: true, nodesJson: true, edgesJson: true },
      });

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      const nodesJson = workflow.nodesJson as unknown[];
      const edgesJson = workflow.edgesJson as unknown[];

      return {
        isNormalized: workflow.isNormalized,
        nodeCount: Array.isArray(nodesJson) ? nodesJson.length : 0,
        edgeCount: Array.isArray(edgesJson) ? edgesJson.length : 0,
      };
    }),
});


