import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { buildWorkflow } from "../utils/workflow-builder.js";
import { isValidNodeType, getNodeInfoList, getRequiredConfig, getMissingConfig, hasRequiredConfig, type RequiredConfigParam } from "../data/nodes.js";
import {
  createWorkflow,
  triggerWorkflowExecution,
  getExecution,
  listExecutions,
  uploadMedia,
} from "../utils/api-client.js";
import { logger } from "../utils/logger.js";
import type { NodeSpec } from "../schemas/index.js";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// CONVENIENCE TOOL DEFINITIONS
// Higher-level tools that combine multiple operations
// =============================================================================

export const convenienceToolDefinitions: Tool[] = [
  {
    name: "save_and_execute",
    description: `Build, save, and execute a workflow in one step. 
    
This is the easiest way to run a workflow - just specify the nodes and inputs.

CRITICAL RULES:
1. All user inputs MUST go through Input nodes:
   - Text/prompts → include {type:"input",inputType:"text"} and pass value to "input-1"
   - Images → include {type:"input",inputType:"image"} and pass URL to "input-1"  
   - Videos → include {type:"input",inputType:"video"} and pass URL to "input-1"
   - Audio → include {type:"input",inputType:"audio"} and pass URL to "input-1"

2. NEVER make assumptions about node configuration parameters!
   - If a node requires parameters (like crop-image needs x, y, width, height), ASK THE USER for them first
   - Do NOT use default values or guess - always ask the user what values they want
   - The tool will return "missingConfig" if required parameters are not provided

Example usage:
- LLM chat: nodes=[{type:"input",inputType:"text"},{type:"openrouter"},{type:"output"}], inputs={"input-1":"Hello!"}
- Image gen: nodes=[{type:"input",inputType:"text"},{type:"seedream"},{type:"output"}], inputs={"input-1":"a sunset"}
- Crop image: ASK USER for xPercent, yPercent, widthPercent, heightPercent FIRST, then: nodes=[{type:"input",inputType:"image"},{type:"crop-image",config:{xPercent:0,yPercent:0,widthPercent:100,heightPercent:50}},{type:"output"}]

The input node receives the user's value, then passes it to the connected processing node.
NEVER set inputs directly on processing nodes - always use Input nodes.`,
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
  {
    name: "upload_media",
    description: `Upload an image, video, or audio file to get a CDN URL.

Use this to convert base64 data into a permanent URL that can be used in workflows.

The returned URL can then be passed to workflow inputs like:
- save_and_execute with inputs: { "input-1": "<returned_url>" }
- execute_workflow with inputs: { "input-1": "<returned_url>" }

Supported formats:
- Images: PNG, JPEG, WebP, GIF
- Videos: MP4, WebM, MOV
- Audio: MP3, WAV, OGG, AAC

Size limit: ~3MB (base64 encoding adds ~33% overhead)`,
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "Base64 data URL (e.g., 'data:image/png;base64,iVBORw0...'). If an HTTP URL is provided, it will be returned as-is.",
        },
        type: {
          type: "string",
          enum: ["image", "video", "audio"],
          description: "Optional media type hint. Auto-detected from MIME type if not provided.",
        },
        filename: {
          type: "string",
          description: "Optional filename for the uploaded file.",
        },
      },
      required: ["data"],
    },
  },
  {
    name: "quick_vision",
    description: `Quick image analysis - describe or analyze an image using AI vision.

Provide an image (base64 or URL) and optionally a prompt to guide the analysis.
Uses GPT-4o or other vision-capable models.

Examples:
- Describe what's in an image
- Read text from screenshots
- Analyze charts or diagrams
- Identify objects or people`,
    inputSchema: {
      type: "object",
      properties: {
        image: {
          type: "string",
          description: "Image to analyze - either a base64 data URL (e.g., 'data:image/png;base64,...') or an HTTP URL.",
        },
        prompt: {
          type: "string",
          description: "Optional prompt to guide the analysis (default: 'Describe this image in detail').",
        },
        model: {
          type: "string",
          description: "Optional model (default: 'openai/gpt-4o'). Must be a vision-capable model.",
        },
      },
      required: ["image"],
    },
  },
  {
    name: "upload_local_file",
    description: `Upload a local image/video/audio file to CDN and get a URL.

Reads a file from your local disk, converts it to base64, and uploads to Transloadit CDN.
The returned URL can be used in workflows.

Supported formats:
- Images: PNG, JPEG, WebP, GIF
- Videos: MP4, WebM, MOV  
- Audio: MP3, WAV, OGG, AAC

Size limit: ~3MB`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to the local file (e.g., 'D:/images/photo.png' or '/Users/me/image.jpg').",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "analyze_local_image",
    description: `Analyze a local image file using AI vision - all in one step.

Reads an image from your local disk, uploads it to CDN, and analyzes it with GPT-4o.
This combines upload_local_file + quick_vision into a single convenient tool.

Just provide the file path and optionally a prompt.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to the local image file (e.g., 'D:/images/photo.png').",
        },
        prompt: {
          type: "string",
          description: "Optional prompt to guide the analysis (default: 'Describe this image in detail').",
        },
        model: {
          type: "string",
          description: "Optional model (default: 'openai/gpt-4o'). Must be a vision-capable model.",
        },
      },
      required: ["path"],
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

interface UploadMediaArgs {
  data: string;
  type?: "image" | "video" | "audio";
  filename?: string;
}

interface QuickVisionArgs {
  image: string;
  prompt?: string;
  model?: string;
}

interface UploadLocalFileArgs {
  path: string;
}

interface AnalyzeLocalImageArgs {
  path: string;
  prompt?: string;
  model?: string;
}

const API_BASE = process.env.CASCADE_API_URL || "https://cascade-ys7.vercel.app";

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

// =============================================================================
// FORMATTING HELPERS - Create markdown tables for display
// =============================================================================

/**
 * Format pipeline/execution steps as a markdown table
 */
function formatPipelineTable(nodeOutputs: NodeOutputInfo[]): string {
  if (!nodeOutputs || nodeOutputs.length === 0) {
    return "No pipeline steps.";
  }

  const rows: string[] = [];
  rows.push("| # | Node | Type | Status | Output |");
  rows.push("|---|------|------|--------|--------|");

  nodeOutputs.forEach((node, index) => {
    const status = node.status === "completed" ? "✅" : node.status === "failed" ? "❌" : "⏳";
    
    // Create output preview
    let outputPreview = "-";
    if (node.output) {
      const out = node.output as Record<string, unknown>;
      if (out.text && typeof out.text === "string") {
        outputPreview = out.text.length > 50 ? out.text.substring(0, 50) + "..." : out.text;
        outputPreview = outputPreview.replace(/\|/g, "\\|").replace(/\n/g, " ");
      } else if (out.type === "image" || out.type === "video" || out.type === "audio") {
        outputPreview = `[${out.type}]`;
      } else if (out.url) {
        outputPreview = "[media]";
      }
    }
    if (node.error) {
      outputPreview = `Error: ${node.error.substring(0, 40)}...`;
    }

    rows.push(`| ${index + 1} | ${node.label} | ${node.nodeType} | ${status} | ${outputPreview} |`);
  });

  return rows.join("\n");
}

/**
 * Format generated assets as a markdown table
 */
function formatAssetsTable(downloadableItems: DownloadableItem[]): string {
  if (!downloadableItems || downloadableItems.length === 0) {
    return "No generated assets.";
  }

  const rows: string[] = [];
  rows.push("| Type | Format | Created By | URL |");
  rows.push("|------|--------|------------|-----|");

  downloadableItems.forEach((item) => {
    const typeIcon = item.type === "image" ? "🖼️" : item.type === "video" ? "🎬" : item.type === "audio" ? "🔊" : "📁";
    rows.push(`| ${typeIcon} ${item.type} | ${item.format || "-"} | ${item.createdBy.label} | ${item.url} |`);
  });

  return rows.join("\n");
}

/**
 * Create a complete formatted response with tables
 */
function createFormattedResponse(
  status: string,
  output: unknown,
  nodeOutputs: NodeOutputInfo[],
  downloadableItems: DownloadableItem[],
  workflowUrl?: string,
  error?: string
): string {
  const sections: string[] = [];

  // Status header
  if (status === "completed") {
    sections.push("## ✅ Workflow Completed\n");
  } else if (status === "failed") {
    sections.push(`## ❌ Workflow Failed\n\n**Error:** ${error || "Unknown error"}\n`);
  } else {
    sections.push(`## ⏳ Workflow ${status}\n`);
  }

  // Final output if text
  if (output) {
    const out = output as Record<string, unknown>;
    if (out.text && typeof out.text === "string") {
      sections.push("### Final Output\n");
      sections.push("```");
      sections.push(out.text);
      sections.push("```\n");
    }
  }

  // Pipeline table
  sections.push("### Pipeline\n");
  sections.push(formatPipelineTable(nodeOutputs));
  sections.push("");

  // Assets table
  if (downloadableItems && downloadableItems.length > 0) {
    sections.push("\n### Generated Assets\n");
    sections.push(formatAssetsTable(downloadableItems));
    sections.push("");
  }

  // Workflow link
  if (workflowUrl) {
    sections.push(`\n**View in Cascade:** ${workflowUrl}`);
  }

  return sections.join("\n");
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

    // Check for missing required configuration parameters
    // IMPORTANT: Do not make assumptions - ask the user!
    const missingConfigs: Array<{
      nodeType: string;
      nodeIndex: number;
      missingParams: RequiredConfigParam[];
    }> = [];

    for (let i = 0; i < nodes.length; i++) {
      const nodeSpec = nodes[i];
      if (hasRequiredConfig(nodeSpec.type)) {
        const missing = getMissingConfig(nodeSpec.type, nodeSpec.config as Record<string, unknown> | undefined);
        if (missing.length > 0) {
          missingConfigs.push({
            nodeType: nodeSpec.type,
            nodeIndex: i,
            missingParams: missing,
          });
        }
      }
    }

    // If there are missing required configs, return prompt to ask user
    if (missingConfigs.length > 0) {
      const paramDescriptions = missingConfigs.map(mc => {
        const paramList = mc.missingParams.map(p => {
          let desc = `  - ${p.name}: ${p.description}`;
          if (p.options) desc += ` (options: ${p.options.join(", ")})`;
          if (p.min !== undefined || p.max !== undefined) {
            desc += ` (range: ${p.min ?? 0}-${p.max ?? 100})`;
          }
          return desc;
        }).join("\n");
        return `**${mc.nodeType}** (node ${mc.nodeIndex + 1}) requires:\n${paramList}`;
      }).join("\n\n");

      return {
        success: false,
        needsUserInput: true,
        missingConfig: missingConfigs,
        message: `Cannot execute workflow - missing required parameters. Please ask the user for these values:\n\n${paramDescriptions}`,
        instructions: "DO NOT make assumptions or use default values. Ask the user to provide specific values for each missing parameter, then call this tool again with the config values included in each node specification.",
        example: missingConfigs.length > 0 
          ? `Example: After getting user values, include them like: {type:"${missingConfigs[0].nodeType}", config:{${missingConfigs[0].missingParams.map(p => `${p.name}: <user_value>`).join(", ")}}}`
          : undefined,
      };
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
    const workflowUrl = `${API_BASE}/workflows/${saved.workflow.id}`;

    // Create formatted output for display
    const formattedOutput = createFormattedResponse(
      result.status,
      result.output,
      result.nodeOutputs,
      result.downloadableItems,
      workflowUrl,
      result.error
    );

    return {
      success: result.status === "completed",
      workflowId: saved.workflow.id,
      workflowName: name,
      workflowUrl,
      executionId: execution.executionId,
      status: result.status,
      // Formatted output for display (SHOW THIS TO USER)
      _formattedOutput: formattedOutput,
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
        workflowUrl = `${API_BASE}/workflows/${execResult.execution.workflowId}`;
      }
    } catch {
      // Ignore errors getting workflow URL
    }

    // Create formatted output for display
    const formattedOutput = createFormattedResponse(
      result.status,
      result.output,
      result.nodeOutputs,
      result.downloadableItems,
      workflowUrl,
      result.error
    );

    if (result.status === "completed") {
      return {
        success: true,
        status: "completed",
        // Formatted output for display (SHOW THIS TO USER)
        _formattedOutput: formattedOutput,
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
      // Formatted output for display (SHOW THIS TO USER)
      _formattedOutput: formattedOutput,
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
    const workflowUrl = `${API_BASE}/workflows/${saved.workflow.id}`;

    // Create formatted output
    const formattedOutput = createFormattedResponse(
      result.status,
      result.output,
      result.nodeOutputs,
      result.downloadableItems,
      workflowUrl,
      result.error
    );

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
        // Formatted output for display (SHOW THIS TO USER)
        _formattedOutput: formattedOutput,
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
      // Formatted output for display (SHOW THIS TO USER)
      _formattedOutput: formattedOutput,
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
    const workflowUrl = `${API_BASE}/workflows/${saved.workflow.id}`;

    // Create formatted output
    const formattedOutput = createFormattedResponse(
      result.status,
      result.output,
      result.nodeOutputs,
      result.downloadableItems,
      workflowUrl,
      result.error
    );

    if (result.status === "completed") {
      const output = result.output as { url?: string; type?: string } | null;
      return {
        success: true,
        imageUrl: output?.url,
        prompt,
        workflowId: saved.workflow.id,
        workflowUrl,
        executionId: execution.executionId,
        // Formatted output for display (SHOW THIS TO USER)
        _formattedOutput: formattedOutput,
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
      // Formatted output for display (SHOW THIS TO USER)
      _formattedOutput: formattedOutput,
      nodeOutputs: result.nodeOutputs,
      workflowNodes: result.workflowNodes,
      downloadableItems: result.downloadableItems,
    };
  });

  // upload_media - Upload base64 media to CDN
  handlers.set("upload_media", async (args: unknown) => {
    const { data, type, filename } = args as UploadMediaArgs;

    if (!data) throw new Error("Missing required parameter: data");

    // Check if it's already an HTTP URL
    if (data.startsWith("http://") || data.startsWith("https://")) {
      logger.info(`Upload media: Already a URL, returning as-is`);
      return {
        success: true,
        url: data,
        message: "URL provided directly, no upload needed.",
      };
    }

    // Validate it looks like a data URL
    if (!data.startsWith("data:")) {
      throw new Error(
        "Invalid data format. Expected a base64 data URL starting with 'data:' (e.g., 'data:image/png;base64,...') or an HTTP URL."
      );
    }

    logger.info(`Upload media: Uploading ${type || "media"} to CDN...`);

    const result = await uploadMedia(data, { type, filename });

    return {
      success: true,
      url: result.url,
      mimeType: result.mimeType,
      message: `Media uploaded successfully. Use this URL in your workflow inputs.`,
    };
  });

  // quick_vision - Analyze an image using AI vision
  handlers.set("quick_vision", async (args: unknown) => {
    const { 
      image, 
      prompt = "Describe this image in detail.", 
      model = "openai/gpt-4o" 
    } = args as QuickVisionArgs;

    if (!image) throw new Error("Missing required parameter: image");

    logger.info(`Quick Vision: Analyzing image with ${model}...`);

    // Step 1: Upload image if it's base64
    let imageUrl = image;
    if (image.startsWith("data:")) {
      logger.info(`Quick Vision: Uploading base64 image to CDN...`);
      const uploadResult = await uploadMedia(image, { type: "image" });
      imageUrl = uploadResult.url;
      logger.info(`Quick Vision: Image uploaded to ${imageUrl.slice(0, 60)}...`);
    } else if (!image.startsWith("http://") && !image.startsWith("https://")) {
      throw new Error(
        "Invalid image format. Expected a base64 data URL (data:image/...) or an HTTP URL."
      );
    }

    // Step 2: Build a vision workflow with image URL in openrouter config
    const nodes: NodeSpec[] = [
      { type: "input", inputType: "text" },
      { type: "openrouter", config: { model, imageUrl } },
      { type: "output" },
    ];

    const workflow = buildWorkflow("Quick Vision", nodes);

    // Step 3: Save the workflow
    const saved = await createWorkflow({
      name: `Quick Vision - ${new Date().toISOString().split("T")[0]}`,
      nodesJson: workflow.nodes,
      edgesJson: workflow.edges,
      viewportJson: { x: 0, y: 0, zoom: 1 },
    });

    // Step 4: Execute with the prompt
    const execution = await triggerWorkflowExecution(saved.workflow.id, {
      "input-1": prompt,
    });

    // Step 5: Wait for result
    const result = await waitForCompletion(execution.executionId, 120000);
    const workflowUrl = `${API_BASE}/workflows/${saved.workflow.id}`;

    // Create formatted output
    const formattedOutput = createFormattedResponse(
      result.status,
      result.output,
      result.nodeOutputs,
      result.downloadableItems,
      workflowUrl,
      result.error
    );

    if (result.status === "completed") {
      const output = result.output as { text?: string; type?: string } | string | null;
      const text = typeof output === "string" 
        ? output 
        : output?.text ?? JSON.stringify(output);

      return {
        success: true,
        analysis: text,
        model,
        imageUrl,
        prompt,
        workflowId: saved.workflow.id,
        workflowUrl,
        executionId: execution.executionId,
        // Formatted output for display (SHOW THIS TO USER)
        _formattedOutput: formattedOutput,
        nodeOutputs: result.nodeOutputs,
        workflowNodes: result.workflowNodes,
        downloadableItems: result.downloadableItems,
      };
    }

    return {
      success: false,
      error: result.error,
      workflowId: saved.workflow.id,
      workflowUrl,
      executionId: execution.executionId,
      // Formatted output for display (SHOW THIS TO USER)
      _formattedOutput: formattedOutput,
      nodeOutputs: result.nodeOutputs,
      workflowNodes: result.workflowNodes,
      downloadableItems: result.downloadableItems,
    };
  });

  // upload_local_file - Read local file and upload to CDN
  handlers.set("upload_local_file", async (args: unknown) => {
    const { path: filePath } = args as UploadLocalFileArgs;

    if (!filePath) throw new Error("Missing required parameter: path");

    logger.info(`Upload local file: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");

    // Determine MIME type from extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".aac": "audio/aac",
    };

    const mimeType = mimeTypes[ext];
    if (!mimeType) {
      throw new Error(`Unsupported file type: ${ext}. Supported: ${Object.keys(mimeTypes).join(", ")}`);
    }

    // Create data URL
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    // Determine media type
    let mediaType: "image" | "video" | "audio" = "image";
    if (mimeType.startsWith("video/")) mediaType = "video";
    else if (mimeType.startsWith("audio/")) mediaType = "audio";

    logger.info(`Upload local file: Uploading ${mediaType} (${mimeType}) to CDN...`);

    // Upload to CDN
    const result = await uploadMedia(dataUrl, {
      type: mediaType,
      filename: path.basename(filePath),
    });

    return {
      success: true,
      url: result.url,
      mimeType: result.mimeType || mimeType,
      originalPath: filePath,
      message: `File uploaded successfully. Use this URL in your workflows.`,
    };
  });

  // analyze_local_image - Read local image, upload, and analyze with vision
  handlers.set("analyze_local_image", async (args: unknown) => {
    const {
      path: filePath,
      prompt = "Describe this image in detail.",
      model = "openai/gpt-4o",
    } = args as AnalyzeLocalImageArgs;

    if (!filePath) throw new Error("Missing required parameter: path");

    logger.info(`Analyze local image: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Verify it's an image
    const ext = path.extname(filePath).toLowerCase();
    const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    if (!imageExts.includes(ext)) {
      throw new Error(`Not an image file: ${ext}. Supported: ${imageExts.join(", ")}`);
    }

    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");

    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const mimeType = mimeTypes[ext];
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    logger.info(`Analyze local image: Uploading to CDN...`);

    // Upload to CDN
    const uploadResult = await uploadMedia(dataUrl, {
      type: "image",
      filename: path.basename(filePath),
    });
    const imageUrl = uploadResult.url;

    logger.info(`Analyze local image: Analyzing with ${model}...`);

    // Build vision workflow
    const nodes: NodeSpec[] = [
      { type: "input", inputType: "text" },
      { type: "openrouter", config: { model, imageUrl } },
      { type: "output" },
    ];

    const workflow = buildWorkflow("Analyze Local Image", nodes);

    // Save workflow
    const saved = await createWorkflow({
      name: `Analyze Image - ${path.basename(filePath)} - ${new Date().toISOString().split("T")[0]}`,
      nodesJson: workflow.nodes,
      edgesJson: workflow.edges,
      viewportJson: { x: 0, y: 0, zoom: 1 },
    });

    // Execute with prompt
    const execution = await triggerWorkflowExecution(saved.workflow.id, {
      "input-1": prompt,
    });

    // Wait for result
    const result = await waitForCompletion(execution.executionId, 120000);
    const workflowUrl = `${API_BASE}/workflows/${saved.workflow.id}`;

    // Create formatted output
    const formattedOutput = createFormattedResponse(
      result.status,
      result.output,
      result.nodeOutputs,
      result.downloadableItems,
      workflowUrl,
      result.error
    );

    if (result.status === "completed") {
      const output = result.output as { text?: string; type?: string } | string | null;
      const text = typeof output === "string"
        ? output
        : output?.text ?? JSON.stringify(output);

      return {
        success: true,
        analysis: text,
        model,
        imageUrl,
        originalPath: filePath,
        prompt,
        workflowId: saved.workflow.id,
        workflowUrl,
        executionId: execution.executionId,
        // Formatted output for display (SHOW THIS TO USER)
        _formattedOutput: formattedOutput,
        nodeOutputs: result.nodeOutputs,
        workflowNodes: result.workflowNodes,
        downloadableItems: result.downloadableItems,
      };
    }

    return {
      success: false,
      error: result.error,
      originalPath: filePath,
      imageUrl,
      workflowId: saved.workflow.id,
      workflowUrl,
      executionId: execution.executionId,
      // Formatted output for display (SHOW THIS TO USER)
      _formattedOutput: formattedOutput,
      nodeOutputs: result.nodeOutputs,
      workflowNodes: result.workflowNodes,
      downloadableItems: result.downloadableItems,
    };
  });
}
