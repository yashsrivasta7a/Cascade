import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  duplicateWorkflow,
} from "../utils/api-client.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// WORKFLOW TOOL DEFINITIONS
// =============================================================================

export const workflowToolDefinitions: Tool[] = [
  {
    name: "list_workflows",
    description: "List all saved workflows for the current user. Returns workflow ID, name, description, version, and execution count.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_workflow",
    description: "Get a specific workflow by ID including its full nodes and edges data.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The workflow ID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_workflow",
    description: "Create and save a new workflow. Use build_workflow first to generate nodes/edges, then pass them here to save.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the workflow",
        },
        description: {
          type: "string",
          description: "Optional description",
        },
        nodes: {
          type: "array",
          description: "Array of node objects (from build_workflow)",
          items: { type: "object" },
        },
        edges: {
          type: "array",
          description: "Array of edge objects (from build_workflow)",
          items: { type: "object" },
        },
      },
      required: ["name", "nodes", "edges"],
    },
  },
  {
    name: "update_workflow",
    description: "Update an existing workflow. Can update name, description, nodes, edges, or publish status.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The workflow ID to update",
        },
        name: {
          type: "string",
          description: "New name (optional)",
        },
        description: {
          type: "string",
          description: "New description (optional)",
        },
        nodes: {
          type: "array",
          description: "New nodes array (optional)",
          items: { type: "object" },
        },
        edges: {
          type: "array",
          description: "New edges array (optional)",
          items: { type: "object" },
        },
        isPublished: {
          type: "boolean",
          description: "Publish status (optional)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_workflow",
    description: "Permanently delete a workflow by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The workflow ID to delete",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "duplicate_workflow",
    description: "Create a copy of an existing workflow with '(Copy)' appended to the name.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The workflow ID to duplicate",
        },
      },
      required: ["id"],
    },
  },
];

// =============================================================================
// WORKFLOW TOOL HANDLERS
// =============================================================================

interface GetWorkflowArgs {
  id: string;
}

interface CreateWorkflowArgs {
  name: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
}

interface UpdateWorkflowArgs {
  id: string;
  name?: string;
  description?: string;
  nodes?: unknown[];
  edges?: unknown[];
  isPublished?: boolean;
}

interface DeleteWorkflowArgs {
  id: string;
}

interface DuplicateWorkflowArgs {
  id: string;
}

/**
 * Register workflow CRUD tool handlers
 */
export function registerWorkflowTools(handlers: Map<string, (args: unknown) => Promise<unknown>>): void {
  // list_workflows
  handlers.set("list_workflows", async () => {
    logger.debug("Listing workflows");
    
    try {
      const result = await listWorkflows();
      
      return {
        workflows: result.workflows.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          version: w.version,
          isPublished: w.isPublished,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
          executionCount: w._count.executions,
        })),
        count: result.workflows.length,
      };
    } catch (error) {
      logger.error("Failed to list workflows", error);
      throw new Error(`Failed to list workflows: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // get_workflow
  handlers.set("get_workflow", async (args: unknown) => {
    const { id } = args as GetWorkflowArgs;
    
    if (!id) {
      throw new Error("Missing required parameter: id");
    }

    logger.debug(`Getting workflow: ${id}`);
    
    try {
      const result = await getWorkflow(id);
      const workflow = result.workflow;
      
      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        version: workflow.version,
        isPublished: workflow.isPublished,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        nodes: workflow.nodesJson,
        edges: workflow.edgesJson,
        viewport: workflow.viewportJson,
      };
    } catch (error) {
      logger.error(`Failed to get workflow: ${id}`, error);
      throw new Error(`Failed to get workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // create_workflow
  handlers.set("create_workflow", async (args: unknown) => {
    const { name, description, nodes, edges } = args as CreateWorkflowArgs;
    
    if (!name) {
      throw new Error("Missing required parameter: name");
    }
    if (!nodes || !Array.isArray(nodes)) {
      throw new Error("Missing or invalid nodes array");
    }
    if (!edges || !Array.isArray(edges)) {
      throw new Error("Missing or invalid edges array");
    }

    logger.debug(`Creating workflow: ${name}`);
    
    try {
      const result = await createWorkflow({
        name,
        description,
        nodesJson: nodes,
        edgesJson: edges,
        viewportJson: { x: 0, y: 0, zoom: 1 },
      });

      // Identify required inputs from Input nodes
      type NodeData = { id: string; type?: string; data?: { mediaType?: string; label?: string } };
      const typedNodes = nodes as NodeData[];
      const requiredInputs = typedNodes
        .filter((n) => n.type === "input" || n.type?.includes("-input"))
        .map((n) => ({
          nodeId: n.id,
          type: n.data?.mediaType || n.type?.replace("-input", "") || "text",
          label: n.data?.label || "Input",
        }));
      
      return {
        success: true,
        id: result.workflow.id,
        name: result.workflow.name,
        version: result.workflow.version,
        message: `Workflow "${name}" created successfully`,
        requiredInputs,
        nextStep: requiredInputs.length > 0
          ? `ASK THE USER: Before executing, ask what input they want to provide for: ${requiredInputs.map((i: { label: string; type: string }) => `${i.label} (${i.type})`).join(", ")}`
          : "Workflow is ready to execute. No user inputs required.",
      };
    } catch (error) {
      logger.error(`Failed to create workflow: ${name}`, error);
      throw new Error(`Failed to create workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // update_workflow
  handlers.set("update_workflow", async (args: unknown) => {
    const { id, name, description, nodes, edges, isPublished } = args as UpdateWorkflowArgs;
    
    if (!id) {
      throw new Error("Missing required parameter: id");
    }

    logger.debug(`Updating workflow: ${id}`);
    
    try {
      const updateData: {
        id: string;
        name?: string;
        description?: string;
        nodesJson?: unknown[];
        edgesJson?: unknown[];
        isPublished?: boolean;
      } = { id };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (nodes !== undefined) updateData.nodesJson = nodes;
      if (edges !== undefined) updateData.edgesJson = edges;
      if (isPublished !== undefined) updateData.isPublished = isPublished;

      const result = await updateWorkflow(updateData);
      
      return {
        success: true,
        id: result.workflow.id,
        name: result.workflow.name,
        version: result.workflow.version,
        message: `Workflow updated successfully`,
      };
    } catch (error) {
      logger.error(`Failed to update workflow: ${id}`, error);
      throw new Error(`Failed to update workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // delete_workflow
  handlers.set("delete_workflow", async (args: unknown) => {
    const { id } = args as DeleteWorkflowArgs;
    
    if (!id) {
      throw new Error("Missing required parameter: id");
    }

    logger.debug(`Deleting workflow: ${id}`);
    
    try {
      await deleteWorkflow(id);
      
      return {
        success: true,
        message: `Workflow ${id} deleted successfully`,
      };
    } catch (error) {
      logger.error(`Failed to delete workflow: ${id}`, error);
      throw new Error(`Failed to delete workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // duplicate_workflow
  handlers.set("duplicate_workflow", async (args: unknown) => {
    const { id } = args as DuplicateWorkflowArgs;
    
    if (!id) {
      throw new Error("Missing required parameter: id");
    }

    logger.debug(`Duplicating workflow: ${id}`);
    
    try {
      const result = await duplicateWorkflow(id);
      
      return {
        success: true,
        originalId: id,
        newId: result.id,
        name: result.name,
        message: `Workflow duplicated as "${result.name}"`,
      };
    } catch (error) {
      logger.error(`Failed to duplicate workflow: ${id}`, error);
      throw new Error(`Failed to duplicate workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
