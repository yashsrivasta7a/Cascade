import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  listExecutions,
  getExecution,
  getLatestExecutionStatus,
  triggerWorkflowExecution,
  cancelExecution,
  getWorkflowByName,
} from "../utils/api-client.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// EXECUTION TOOL DEFINITIONS
// =============================================================================

export const executionToolDefinitions: Tool[] = [
  {
    name: "execute_workflow",
    description: `Start execution of a workflow by ID or name. 

CRITICAL: ALL user inputs MUST go through Input nodes, NOT directly to processing nodes.
- Text/prompts → text Input node (e.g., 'input-1')
- Images → image Input node  
- Videos → video Input node
- Audio → audio Input node

The inputs parameter should ONLY contain values for Input nodes (nodes with type="input" or type ending in "-input").
Do NOT set values on processing nodes like 'openrouter', 'seedream', etc. - they receive data from connected Input nodes.

Example: { "input-1": "Hello, how are you?" } - NOT { "openrouter-2": { "prompt": "..." } }`,
    inputSchema: {
      type: "object",
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow ID to execute (provide either workflowId or workflowName)",
        },
        workflowName: {
          type: "string",
          description: "The exact workflow name to execute (provide either workflowId or workflowName)",
        },
        inputs: {
          type: "object",
          description: "Input values ONLY for Input nodes, keyed by input node ID (e.g., { 'input-1': 'user text here' }). Never set values directly on processing nodes.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_execution",
    description: "Get detailed information about a specific execution including node statuses and outputs.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The execution ID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_execution_status",
    description: "Quick status check for the latest execution of a workflow. Useful for polling progress.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow ID to check",
        },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "list_executions",
    description: "List recent workflow executions with optional status filter.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status (optional)",
          enum: ["running", "completed", "failed", "cancelled"],
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 20, max: 100)",
        },
      },
      required: [],
    },
  },
  {
    name: "cancel_execution",
    description: "Cancel a running workflow execution.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The execution ID to cancel",
        },
      },
      required: ["id"],
    },
  },
];

// =============================================================================
// EXECUTION TOOL HANDLERS
// =============================================================================

interface ExecuteWorkflowArgs {
  workflowId?: string;
  workflowName?: string;
  inputs?: Record<string, unknown>;
}

interface GetExecutionArgs {
  id: string;
}

interface GetExecutionStatusArgs {
  workflowId: string;
}

interface ListExecutionsArgs {
  status?: string;
  limit?: number;
}

interface CancelExecutionArgs {
  id: string;
}

/**
 * Register execution tool handlers
 */
export function registerExecutionTools(handlers: Map<string, (args: unknown) => Promise<unknown>>): void {
  // execute_workflow
  handlers.set("execute_workflow", async (args: unknown) => {
    const { workflowId, workflowName, inputs } = args as ExecuteWorkflowArgs;
    
    if (!workflowId && !workflowName) {
      throw new Error("Missing required parameter: provide either 'workflowId' or 'workflowName'");
    }

    if (workflowId && workflowName) {
      throw new Error("Provide either 'workflowId' or 'workflowName', not both");
    }

    // Resolve workflow ID from name if needed
    let resolvedWorkflowId = workflowId;
    if (workflowName) {
      logger.info(`Looking up workflow by name: ${workflowName}`);
      try {
        const workflow = await getWorkflowByName(workflowName);
        resolvedWorkflowId = workflow.workflow.id;
        logger.info(`Resolved workflow name "${workflowName}" to ID: ${resolvedWorkflowId}`);
      } catch (error) {
        throw new Error(`Failed to find workflow with name "${workflowName}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    logger.info(`Executing workflow: ${resolvedWorkflowId}`);
    
    try {
      const result = await triggerWorkflowExecution(resolvedWorkflowId!, inputs);
      
      return {
        success: true,
        executionId: result.executionId,
        workflowId: resolvedWorkflowId,
        workflowName: workflowName || undefined,
        message: `Workflow execution started. Use get_execution_status to track progress.`,
      };
    } catch (error) {
      logger.error(`Failed to execute workflow: ${resolvedWorkflowId}`, error);
      throw new Error(`Failed to execute workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // get_execution
  handlers.set("get_execution", async (args: unknown) => {
    const { id } = args as GetExecutionArgs;
    
    if (!id) {
      throw new Error("Missing required parameter: id");
    }

    logger.debug(`Getting execution: ${id}`);
    
    try {
      const result = await getExecution(id);
      const exec = result.execution;
      
      return {
        id: exec.id,
        workflowId: exec.workflowId,
        workflowName: exec.workflowName,
        status: exec.status,
        startedAt: exec.startedAt,
        completedAt: exec.completedAt,
        duration: exec.duration,
        totalCost: exec.totalCost,
        nodeCount: exec.nodeCount,
        nodes: exec.nodes,
      };
    } catch (error) {
      logger.error(`Failed to get execution: ${id}`, error);
      throw new Error(`Failed to get execution: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // get_execution_status
  handlers.set("get_execution_status", async (args: unknown) => {
    const { workflowId } = args as GetExecutionStatusArgs;
    
    if (!workflowId) {
      throw new Error("Missing required parameter: workflowId");
    }

    logger.debug(`Getting execution status for workflow: ${workflowId}`);
    
    try {
      const result = await getLatestExecutionStatus(workflowId);
      
      if (!result.execution) {
        return {
          hasExecution: false,
          workflowId,
          message: "No executions found for this workflow",
        };
      }
      
      return {
        hasExecution: true,
        execution: result.execution,
        nodeStatuses: result.nodeStatuses,
        summary: {
          total: result.nodeStatuses.length,
          completed: result.nodeStatuses.filter((n) => n.status === "completed").length,
          running: result.nodeStatuses.filter((n) => n.status === "running").length,
          failed: result.nodeStatuses.filter((n) => n.status === "failed").length,
        },
      };
    } catch (error) {
      logger.error(`Failed to get execution status: ${workflowId}`, error);
      throw new Error(`Failed to get execution status: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // list_executions
  handlers.set("list_executions", async (args: unknown) => {
    const { status, limit } = (args as ListExecutionsArgs) || {};
    
    logger.debug("Listing executions", { status, limit });
    
    try {
      const result = await listExecutions({
        status: status?.toUpperCase(),
        limit: limit || 20,
      });
      
      return {
        executions: result.executions.map((exec) => ({
          id: exec.id,
          type: exec.type,
          workflowId: exec.workflowId,
          workflowName: exec.workflowName,
          status: exec.status,
          startedAt: exec.startedAt,
          completedAt: exec.completedAt,
          duration: exec.duration,
          totalCost: exec.totalCost,
          nodeCount: exec.nodeCount,
        })),
        count: result.executions.length,
        filter: status || "all",
      };
    } catch (error) {
      logger.error("Failed to list executions", error);
      throw new Error(`Failed to list executions: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // cancel_execution
  handlers.set("cancel_execution", async (args: unknown) => {
    const { id } = args as CancelExecutionArgs;
    
    if (!id) {
      throw new Error("Missing required parameter: id");
    }

    logger.info(`Cancelling execution: ${id}`);
    
    try {
      await cancelExecution(id);
      
      return {
        success: true,
        executionId: id,
        message: `Execution ${id} cancelled`,
      };
    } catch (error) {
      logger.error(`Failed to cancel execution: ${id}`, error);
      throw new Error(`Failed to cancel execution: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
