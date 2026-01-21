import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { buildWorkflow } from "../utils/workflow-builder.js";
import { isValidNodeType, getNodeInfoList } from "../data/nodes.js";
import {
  createWorkflow,
  triggerWorkflowExecution,
  getExecution,
  listExecutions,
} from "../utils/api-client.js";
import { logger } from "../utils/logger.js";
import type { NodeSpec } from "../schemas/index.js";

// =============================================================================
// CONVENIENCE TOOL DEFINITIONS
// Higher-level tools that combine multiple operations
// =============================================================================

export const convenienceToolDefinitions: Tool[] = [
  {
    name: "save_and_execute",
    description: `Build, save, and execute a workflow in one step. 
    
This is the easiest way to run a workflow - just specify the nodes and inputs.

Example usage:
- To generate an image: nodes=[{type:"input",inputType:"text"},{type:"seedream"},{type:"output"}], inputs={"input-1":"a beautiful sunset"}
- To ask an LLM: nodes=[{type:"input",inputType:"text"},{type:"openrouter"},{type:"output"}], inputs={"input-1":"Write a poem"}

IMPORTANT: You MUST ask the user for input values before calling this tool.`,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the workflow",
        },
        nodes: {
          type: "array",
          description: "Array of node specifications",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              inputType: { type: "string", enum: ["text", "image", "video", "audio"] },
              config: { type: "object" },
            },
            required: ["type"],
          },
        },
        inputs: {
          type: "object",
          description: "Input values keyed by node ID (e.g., {'input-1': 'user text here'})",
        },
      },
      required: ["name", "nodes", "inputs"],
    },
  },
  {
    name: "get_execution_result",
    description: `Get the final output/result of a workflow execution. 
    
Use this after execute_workflow to get the actual output (text, image URL, etc.).
Automatically polls for completion if the execution is still running.`,
    inputSchema: {
      type: "object",
      properties: {
        executionId: {
          type: "string",
          description: "The execution ID to get results for",
        },
        timeout: {
          type: "number",
          description: "Max seconds to wait for completion (default: 120)",
        },
      },
      required: ["executionId"],
    },
  },
  {
    name: "retry_execution",
    description: "Retry a failed workflow execution with the same or updated inputs.",
    inputSchema: {
      type: "object",
      properties: {
        executionId: {
          type: "string",
          description: "The failed execution ID to retry",
        },
        inputs: {
          type: "object",
          description: "Optional: Updated input values. If not provided, uses original inputs.",
        },
      },
      required: ["executionId"],
    },
  },
  {
    name: "quick_llm",
    description: `Quick LLM text generation - the fastest way to get an AI response.
    
Just provide a prompt and get a response. No workflow setup needed.`,
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The prompt/question for the LLM",
        },
        model: {
          type: "string",
          description: "Optional model (default: openai/gpt-4o-mini)",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "quick_image",
    description: `Quick image generation - the fastest way to generate an image.
    
Just provide a description and get an image URL.`,
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Description of the image to generate",
        },
      },
      required: ["prompt"],
    },
  },
];

// =============================================================================
// CONVENIENCE TOOL HANDLERS
// =============================================================================

interface SaveAndExecuteArgs {
  name: string;
  nodes: NodeSpec[];
  inputs: Record<string, unknown>;
}

interface GetExecutionResultArgs {
  executionId: string;
  timeout?: number;
}

interface RetryExecutionArgs {
  executionId: string;
  inputs?: Record<string, unknown>;
}

interface QuickLlmArgs {
  prompt: string;
  model?: string;
}

interface QuickImageArgs {
  prompt: string;
}

const API_BASE = process.env.FLOWSMITH_API_URL || "http://localhost:3000";

// Node output info for response
interface NodeOutputInfo {
  nodeId: string;
  nodeType: string;
  label: string;
  status: string;
  output: unknown;
  error?: string | null;
}

// Workflow node info for response
interface WorkflowNodeInfo {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

// Downloadable item info
interface DownloadableItem {
  url: string;
  type: "image" | "video" | "audio" | "file";
  format?: string;
  createdBy: {
    nodeId: string;
    nodeType: string;
    label: string;
  };
}

// Helper to extract downloadable items from node outputs
function extractDownloadables(nodes: NodeOutputInfo[]): DownloadableItem[] {
  const downloadables: DownloadableItem[] = [];
  
  // Node types that produce media
  const mediaNodeTypes: Record<string, "image" | "video" | "audio"> = {
    "seedream": "image",
    "seedvr": "image",      // upscaled image
    "seedance": "video",
    "elevenlabs": "audio",
    "lipsync": "video",
    "merge-audio-video": "video",
    "merge-videos": "video",
    "extract-audio": "audio",
    "crop-image": "image",
  };

  for (const node of nodes) {
    if (node.status !== "completed" || !node.output) continue;
    
    const output = node.output as Record<string, unknown>;
    
    // Check for URL in output
    const url = output.url || output.videoUrl || output.audioUrl || output.imageUrl;
    if (typeof url === "string" && url.startsWith("http")) {
      // Determine type from node type or output type field
      let type: "image" | "video" | "audio" | "file" = mediaNodeTypes[node.nodeType] || "file";
      
      // Override with output type if specified
      if (output.type === "image") type = "image";
      else if (output.type === "video") type = "video";
      else if (output.type === "audio") type = "audio";
      
      // Try to detect from URL extension
      const urlLower = url.toLowerCase();
      if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/)) type = "image";
      else if (urlLower.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/)) type = "video";
      else if (urlLower.match(/\.(mp3|wav|ogg|aac|m4a|flac)(\?|$)/)) type = "audio";
      
      // Extract format from URL
      const formatMatch = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
      const format = formatMatch ? formatMatch[1].toLowerCase() : undefined;
      
      downloadables.push({
        url,
        type,
        format,
        createdBy: {
          nodeId: node.nodeId,
          nodeType: node.nodeType,
          label: node.label,
        },
      });
    }
    
    // Check for multiple URLs in array outputs
    if (Array.isArray(output.urls)) {
      for (const itemUrl of output.urls) {
        if (typeof itemUrl === "string" && itemUrl.startsWith("http")) {
          const type = mediaNodeTypes[node.nodeType] || "file";
          const formatMatch = itemUrl.match(/\.([a-zA-Z0-9]+)(\?|$)/);
          downloadables.push({
            url: itemUrl,
            type,
            format: formatMatch ? formatMatch[1].toLowerCase() : undefined,
            createdBy: {
              nodeId: node.nodeId,
              nodeType: node.nodeType,
              label: node.label,
            },
          });
        }
      }
    }
  }
  
  return downloadables;
}

// Helper to wait for execution completion
async function waitForCompletion(
  executionId: string,
  timeoutMs: number = 120000
): Promise<{
  status: string;
  output: unknown;
  nodeOutputs: NodeOutputInfo[];
  workflowNodes: WorkflowNodeInfo[];
  downloadableItems: DownloadableItem[];
  error?: string;
}> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await getExecution(executionId);
      const exec = result.execution;

      // Build node outputs array
      const nodeOutputs: NodeOutputInfo[] = exec.nodes.map((n) => ({
        nodeId: n.id,
        nodeType: n.nodeType,
        label: n.label || n.nodeType,
        status: n.status,
        output: n.output,
        error: n.error,
      }));

      // Build workflow nodes array from snapshot
      const workflowNodes: WorkflowNodeInfo[] = exec.workflowSnapshot?.nodes?.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })) || [];

      // Extract downloadable items
      const downloadableItems = extractDownloadables(nodeOutputs);

      if (exec.status === "completed" || exec.status === "COMPLETED") {
        // Find the output node's result
        const outputNode = exec.nodes.find(
          (n) => n.nodeType === "output" || n.nodeType?.includes("output")
        );
        return {
          status: "completed",
          output: outputNode?.output ?? exec.nodes[exec.nodes.length - 1]?.output,
          nodeOutputs,
          workflowNodes,
          downloadableItems,
        };
      }

      if (exec.status === "failed" || exec.status === "FAILED") {
        const failedNode = exec.nodes.find((n) => n.status === "failed" || n.status === "FAILED");
        return {
          status: "failed",
          output: null,
          nodeOutputs,
          workflowNodes,
          downloadableItems,
          error: failedNode?.error ?? "Execution failed",
        };
      }

      if (exec.status === "cancelled" || exec.status === "CANCELLED") {
        return {
          status: "cancelled",
          output: null,
          nodeOutputs,
          workflowNodes,
          downloadableItems,
          error: "Execution was cancelled",
        };
      }

      // Still running, wait and retry
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      // API error, wait and retry
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  return {
    status: "timeout",
    output: null,
    nodeOutputs: [],
    workflowNodes: [],
    downloadableItems: [],
    error: `Execution did not complete within ${timeoutMs / 1000} seconds`,
  };
}

/**
 * Register convenience tool handlers
 */
export function registerConvenienceTools(
  handlers: Map<string, (args: unknown) => Promise<unknown>>
): void {
  // save_and_execute - Build, save, and execute in one step
  handlers.set("save_and_execute", async (args: unknown) => {
    const { name, nodes, inputs } = args as SaveAndExecuteArgs;

    if (!name) throw new Error("Missing required parameter: name");
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      throw new Error("Missing or empty nodes array");
    }
    if (!inputs || typeof inputs !== "object") {
      throw new Error("Missing inputs object. You must provide input values.");
    }

    logger.info(`Save and execute workflow: ${name}`);

    // Validate node types
    const invalidTypes: string[] = [];
    for (const nodeSpec of nodes) {
      if (!nodeSpec.type) throw new Error("Each node must have a 'type' property");
      if (!isValidNodeType(nodeSpec.type)) invalidTypes.push(nodeSpec.type);
    }

    if (invalidTypes.length > 0) {
      const allNodes = getNodeInfoList();
      const availableTypes = allNodes.map((n) => n.type).join(", ");
      throw new Error(`Invalid node type(s): ${invalidTypes.join(", ")}. Available: ${availableTypes}`);
    }

    // 1. Build the workflow
    const workflow = buildWorkflow(name, nodes);

    // 2. Save the workflow
    const saved = await createWorkflow({
      name,
      nodesJson: workflow.nodes,
      edgesJson: workflow.edges,
      viewportJson: { x: 0, y: 0, zoom: 1 },
    });

    // 3. Execute the workflow
    const execution = await triggerWorkflowExecution(saved.workflow.id, inputs);

    // 4. Wait for completion and get results
    const result = await waitForCompletion(execution.executionId, 120000);

    // Generate workflow URL
    const workflowUrl = `${API_BASE}/workflow/${saved.workflow.id}`;

    return {
      success: result.status === "completed",
      workflowId: saved.workflow.id,
      workflowName: name,
      workflowUrl,
      executionId: execution.executionId,
      status: result.status,
      // Final output (from output node)
      output: result.output,
      // Array 1: All node outputs
      nodeOutputs: result.nodeOutputs,
      // Array 2: Workflow nodes info
      workflowNodes: result.workflowNodes,
      // Array 3: Downloadable items (images, videos, audio)
      downloadableItems: result.downloadableItems,
      error: result.error,
      message: result.status === "completed"
        ? `Workflow "${name}" completed successfully. Open ${workflowUrl} to view.`
        : result.error || `Workflow "${name}" ${result.status}`,
    };
  });

  // get_execution_result - Get final output with polling
  handlers.set("get_execution_result", async (args: unknown) => {
    const { executionId, timeout = 120 } = args as GetExecutionResultArgs;

    if (!executionId) throw new Error("Missing required parameter: executionId");

    logger.info(`Getting execution result: ${executionId}`);

    const result = await waitForCompletion(executionId, timeout * 1000);

    // Try to get workflowId from execution for URL
    let workflowUrl: string | undefined;
    try {
      const execResult = await getExecution(executionId);
      if (execResult.execution.workflowId) {
        workflowUrl = `${API_BASE}/workflow/${execResult.execution.workflowId}`;
      }
    } catch {
      // Ignore errors getting workflow URL
    }

    if (result.status === "completed") {
      return {
        success: true,
        status: "completed",
        output: result.output,
        // Array 1: All node outputs
        nodeOutputs: result.nodeOutputs,
        // Array 2: Workflow nodes info
        workflowNodes: result.workflowNodes,
        // Array 3: Downloadable items
        downloadableItems: result.downloadableItems,
        workflowUrl,
        message: workflowUrl
          ? `Execution completed successfully. Open ${workflowUrl} to view.`
          : "Execution completed successfully",
      };
    }

    return {
      success: false,
      status: result.status,
      nodeOutputs: result.nodeOutputs,
      workflowNodes: result.workflowNodes,
      downloadableItems: result.downloadableItems,
      workflowUrl,
      error: result.error,
      message: result.error,
    };
  });

  // retry_execution - Retry a failed execution
  handlers.set("retry_execution", async (args: unknown) => {
    const { executionId, inputs: newInputs } = args as RetryExecutionArgs;

    if (!executionId) throw new Error("Missing required parameter: executionId");

    logger.info(`Retrying execution: ${executionId}`);

    // Get the original execution to find the workflow
    const original = await getExecution(executionId);
    if (!original.execution.workflowId) {
      throw new Error("Cannot retry: execution has no associated workflow");
    }

    // Trigger a new execution
    const execution = await triggerWorkflowExecution(
      original.execution.workflowId,
      newInputs
    );

    return {
      success: true,
      originalExecutionId: executionId,
      newExecutionId: execution.executionId,
      workflowId: original.execution.workflowId,
      message: "Retry started. Use get_execution_result to get the output.",
    };
  });

  // quick_llm - Fast LLM text generation
  handlers.set("quick_llm", async (args: unknown) => {
    const { prompt, model = "openai/gpt-4o-mini" } = args as QuickLlmArgs;

    if (!prompt) throw new Error("Missing required parameter: prompt");

    logger.info(`Quick LLM: ${prompt.substring(0, 50)}...`);

    // Build a simple LLM workflow
    const nodes: NodeSpec[] = [
      { type: "input", inputType: "text" },
      { type: "openrouter", config: { model } },
      { type: "output" },
    ];

    const workflow = buildWorkflow("Quick LLM", nodes);

    // Save
    const saved = await createWorkflow({
      name: `Quick LLM - ${new Date().toISOString().split("T")[0]}`,
      nodesJson: workflow.nodes,
      edgesJson: workflow.edges,
      viewportJson: { x: 0, y: 0, zoom: 1 },
    });

    // Execute
    const execution = await triggerWorkflowExecution(saved.workflow.id, {
      "input-1": prompt,
    });

    // Wait for result
    const result = await waitForCompletion(execution.executionId, 60000);
    const workflowUrl = `${API_BASE}/workflow/${saved.workflow.id}`;

    if (result.status === "completed") {
      // Extract text from output
      const output = result.output as { text?: string; type?: string } | string | null;
      const text = typeof output === "string" 
        ? output 
        : output?.text ?? JSON.stringify(output);

      return {
        success: true,
        response: text,
        model,
        workflowId: saved.workflow.id,
        workflowUrl,
        executionId: execution.executionId,
        // Array 1: All node outputs
        nodeOutputs: result.nodeOutputs,
        // Array 2: Workflow nodes info  
        workflowNodes: result.workflowNodes,
        // Array 3: Downloadable items
        downloadableItems: result.downloadableItems,
      };
    }

    return {
      success: false,
      error: result.error,
      workflowId: saved.workflow.id,
      workflowUrl,
      executionId: execution.executionId,
      nodeOutputs: result.nodeOutputs,
      workflowNodes: result.workflowNodes,
      downloadableItems: result.downloadableItems,
    };
  });

  // quick_image - Fast image generation
  handlers.set("quick_image", async (args: unknown) => {
    const { prompt } = args as QuickImageArgs;

    if (!prompt) throw new Error("Missing required parameter: prompt");

    logger.info(`Quick Image: ${prompt.substring(0, 50)}...`);

    // Build a simple image workflow
    const nodes: NodeSpec[] = [
      { type: "input", inputType: "text" },
      { type: "seedream" },
      { type: "output" },
    ];

    const workflow = buildWorkflow("Quick Image", nodes);

    // Save
    const saved = await createWorkflow({
      name: `Quick Image - ${new Date().toISOString().split("T")[0]}`,
      nodesJson: workflow.nodes,
      edgesJson: workflow.edges,
      viewportJson: { x: 0, y: 0, zoom: 1 },
    });

    // Execute
    const execution = await triggerWorkflowExecution(saved.workflow.id, {
      "input-1": prompt,
    });

    // Wait for result (image generation can take longer)
    const result = await waitForCompletion(execution.executionId, 180000);
    const workflowUrl = `${API_BASE}/workflow/${saved.workflow.id}`;

    if (result.status === "completed") {
      const output = result.output as { url?: string; type?: string } | null;
      return {
        success: true,
        imageUrl: output?.url,
        prompt,
        workflowId: saved.workflow.id,
        workflowUrl,
        executionId: execution.executionId,
        // Array 1: All node outputs
        nodeOutputs: result.nodeOutputs,
        // Array 2: Workflow nodes info
        workflowNodes: result.workflowNodes,
        // Array 3: Downloadable items
        downloadableItems: result.downloadableItems,
      };
    }

    return {
      success: false,
      error: result.error,
      workflowId: saved.workflow.id,
      workflowUrl,
      executionId: execution.executionId,
      nodeOutputs: result.nodeOutputs,
      workflowNodes: result.workflowNodes,
      downloadableItems: result.downloadableItems,
    };
  });
}
