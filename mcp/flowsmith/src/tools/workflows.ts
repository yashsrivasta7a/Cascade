import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  listWorkflows,
  getWorkflow,
  getWorkflowByName,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  duplicateWorkflow,
  checkWorkflowTemplate,
  createOrGetWorkflowTemplate,
} from "../utils/api-client.js";
import { logger } from "../utils/logger.js";
import { hashWorkflowStructure, describeWorkflowStructure } from "../utils/workflow-hash.js";

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
    description: "Get a specific workflow by ID or name including its full nodes and edges data. Provide either 'id' or 'name' (not both).",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The workflow ID (starts with 'c')",
        },
        name: {
          type: "string",
          description: "The exact workflow name (unique per user)",
        },
      },
      required: [],
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
    description: `Update an existing workflow's STRUCTURE - name, description, nodes, edges, or publish status.

IMPORTANT: This is for updating workflow DESIGN, not for providing runtime inputs.
- To change workflow structure (add/remove nodes, change connections): use this tool
- To execute with user inputs: use execute_workflow with inputs for Input nodes

Do NOT use this to set prompts or media on processing nodes. User inputs should flow through Input nodes at execution time.`,
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
          description: "New nodes array for workflow structure (optional). Do not include runtime input values here.",
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
  id?: string;
  name?: string;
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
    const { id, name } = args as GetWorkflowArgs;
    
    if (!id && !name) {
      throw new Error("Missing required parameter: provide either 'id' or 'name'");
    }

    if (id && name) {
      throw new Error("Provide either 'id' or 'name', not both");
    }

    const lookupKey = id || name;
    logger.debug(`Getting workflow by ${id ? "id" : "name"}: ${lookupKey}`);
    
    try {
      // Fetch workflow by id or name
      const result = id 
        ? await getWorkflow(id) 
        : await getWorkflowByName(name!);
      
      const workflow = result.workflow;
      const nodes = workflow.nodesJson as Array<{ id: string; type?: string; data?: { mediaType?: string; label?: string } }>;
      
      // Identify input nodes that require user values at execution time
      const inputNodes = nodes
        .filter((n) => n.type === "input" || n.type?.includes("-input"))
        .map((n) => ({
          nodeId: n.id,
          inputType: n.data?.mediaType || n.type?.replace("-input", "") || "text",
          label: n.data?.label || "Input",
        }));
      
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
        // Highlight input nodes for execution
        inputNodes,
        executionHint: inputNodes.length > 0
          ? `To execute, provide inputs for: ${inputNodes.map((n) => `${n.nodeId} (${n.inputType})`).join(", ")}. Use execute_workflow with inputs: { "${inputNodes[0]?.nodeId}": "your value" }`
          : "No input nodes found. Workflow may not require user input.",
      };
    } catch (error) {
      logger.error(`Failed to get workflow by ${id ? "id" : "name"}: ${lookupKey}`, error);
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
      // Type the nodes for hashing
      type NodeData = { id: string; type?: string; data?: { mediaType?: string; label?: string } };
      type EdgeData = { source: string; target: string; sourceHandle?: string; targetHandle?: string };
      const typedNodes = nodes as NodeData[];
      const typedEdges = edges as EdgeData[];
      
      // Compute structure hash for template caching
      const structureHash = hashWorkflowStructure(
        typedNodes.map(n => ({
          id: n.id,
          type: n.type,
          position: { x: 0, y: 0 },
          data: n.data,
        })),
        typedEdges
      );
      
      logger.debug(`Workflow structure hash: ${structureHash.slice(0, 16)}...`);
      
      // Check if this structure is already cached
      let templateInfo: { cached: boolean; usageCount?: number } = { cached: false };
      try {
        const templateResult = await createOrGetWorkflowTemplate({
          structureHash,
          name,
          description: description || describeWorkflowStructure(
            typedNodes.map(n => ({
              id: n.id,
              type: n.type,
              position: { x: 0, y: 0 },
              data: n.data,
            }))
          ),
          nodesJson: nodes,
          edgesJson: edges,
        });
        
        templateInfo = {
          cached: templateResult.cached,
          usageCount: templateResult.template.usageCount,
        };
        
        if (templateResult.cached) {
          logger.info(`Template cache HIT for structure ${structureHash.slice(0, 16)}... (usage: ${templateResult.template.usageCount})`);
        } else {
          logger.info(`Template cache MISS - created new template ${structureHash.slice(0, 16)}...`);
        }
      } catch (templateError) {
        // Template caching is non-critical, continue with workflow creation
        logger.warn(`Template caching failed (non-critical):`, templateError);
      }
      
      // Create the actual workflow for the user
      const result = await createWorkflow({
        name,
        description,
        nodesJson: nodes,
        edgesJson: edges,
        viewportJson: { x: 0, y: 0, zoom: 1 },
      });

      // Identify required inputs from Input nodes
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
        // Template cache info
        templateCached: templateInfo.cached,
        templateUsageCount: templateInfo.usageCount,
        structureHash: structureHash.slice(0, 16), // Show first 16 chars
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
