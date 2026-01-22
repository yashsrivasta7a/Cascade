import { task, wait, runs, metadata } from "@trigger.dev/sdk";
import { config } from "dotenv";
import { db } from "@/lib/db";
import { executeNode, type NodeExecutorPayload } from "./node-executor";
import type { AINodeType } from "@/types/nodes";
import type { Node, Edge } from "reactflow";
import { NODE_CONFIG } from "@/lib/config";
import {
  HANDLE_TO_SCHEMA_FIELD,
  NODE_DATA_TO_SCHEMA,
  normalizeAsset,
  inferOutputType,
} from "./helpers/handle-mapping";
import {
  canFieldAcceptLLMInput,
  parseLLMToFieldValue,
} from "./helpers/llm-parser";

// =============================================================================
// NODE STATUS TYPES FOR METADATA
// =============================================================================
interface NodeStatus {
  status: "queued" | "started" | "completed" | "failed";
  nodeType: string;
  nodeLabel?: string;
  output?: unknown;
  error?: string;
  timestamp: number;
}

// Load environment variables for Trigger.dev workers
config({ path: ".env" });
config({ path: ".env.local" });

// NOTE: Node executors are registered inside executeNode task
// No engine import here to avoid FFmpeg bundling for Vercel

// =============================================================================
// WORKFLOW EXECUTOR TASK - True DAG Execution with Chain Parallelism
// =============================================================================
// 
// Each chain runs independently in parallel. Nodes only wait for their
// SPECIFIC dependencies, not for entire "waves" or "levels".
// 
// Example: node1 → node2 → final_node
//                              ↑
//          node3 ──────────────┘
// 
// If node1=2s, node2=5s, node3=10s:
// - t=0: node1 starts, node3 starts (parallel - no deps)
// - t=2s: node1 done → node2 starts immediately
// - t=7s: node2 done
// - t=10s: node3 done → final_node starts (both deps satisfied)
//
// =============================================================================

export interface WorkflowExecutorPayload {
  workflowExecutionId: string;
  workflowId: string;
  userId: string;
  nodes: Node[];
  edges: Edge[];
}

// Build dependency graph
function buildDependencyGraph(nodes: Node[], edges: Edge[]) {
  const dependencies = new Map<string, Set<string>>();
  const nodeIds = new Set(nodes.map(n => n.id));

  // Initialize all nodes with empty dependency sets
  for (const node of nodes) {
    dependencies.set(node.id, new Set());
  }

  // Build dependency relationships from edges
  
  for (const edge of edges) {
    
    
    // Validate that both source and target exist in nodes
    if (!nodeIds.has(edge.source)) {
      
      continue;
    }
    if (!nodeIds.has(edge.target)) {
      
      continue;
    }
    
    // Add dependency: target depends on source
    const targetDeps = dependencies.get(edge.target);
    if (targetDeps) {
      targetDeps.add(edge.source);
      
    }
  }

  return { dependencies };
}

// Helper functions imported from ./helpers

// Build input for a node
function buildNodeInput(
  node: Node,
  edges: Edge[],
  outputs: Map<string, Record<string, unknown>>,
  allNodes: Node[]
): Record<string, unknown> {
  const nodeData = (node.data ?? {}) as Record<string, unknown>;
  const nodeType = node.type as string;
  const incomingEdges = edges.filter((e) => e.target === node.id);
  const input: Record<string, unknown> = { ...nodeData };

  
  
  
  
  // Log all node data fields for media-related nodes
  const mediaNodeTypes = ["merge-audio-video", "merge-videos", "extract-audio", "lipsync", "seedance", "seedvr"];
  if (mediaNodeTypes.includes(nodeType)) {
    
    for (const key of Object.keys(nodeData)) {
      const val = nodeData[key];
      if (val && typeof val === "string" && val.length > 100) {
        const preview = val.startsWith("data:") ? `[base64:${val.length}]` : val.slice(0, 80) + "...";
        
      } else if (val && typeof val === "object" && "url" in (val as object)) {
        const url = (val as { url: string }).url;
        const preview = url.startsWith("data:") ? `[base64:${url.length}]` : url.slice(0, 80) + "...";
        
      }
    }
  }

  // =========================================================================
  // STEP 1: Normalize node data (uploaded videos/audio/images) to schema format
  // =========================================================================
  for (const [dataField, schemaField] of Object.entries(NODE_DATA_TO_SCHEMA)) {
    const value = nodeData[dataField];
    if (value) {
      const normalized = normalizeAsset(value);
      if (normalized) {
        input[schemaField] = normalized;
        
      }
    } else if (mediaNodeTypes.includes(nodeType) && ["inputVideo", "inputAudio", "inputImage", "video", "audio", "image"].includes(dataField)) {
      
    }
  }

  // Special handling for direct video/audio/image fields that might be strings OR objects
  // This handles both manual uploads (URLs as strings) and propagated outputs (AssetRef objects)
  const normalizeMediaField = (fieldName: string, data: unknown) => {
    if (!data) return;
    const normalized = normalizeAsset(data);
    if (normalized?.url) {
      input[fieldName] = normalized;
      
    }
  };
  
  // Normalize direct media fields (these may be strings or AssetRef objects)
  normalizeMediaField("video", nodeData.video);
  normalizeMediaField("video1", nodeData.video1);
  normalizeMediaField("video2", nodeData.video2);
  normalizeMediaField("audio", nodeData.audio);
  normalizeMediaField("image", nodeData.image);
  normalizeMediaField("frame", nodeData.frame);

  // =========================================================================
  // STEP 2: Override with outputs from connected upstream nodes
  // =========================================================================
  for (const edge of incomingEdges) {
    const upstreamOutput = outputs.get(edge.source);
    const sourceNode = allNodes.find(n => n.id === edge.source);
    const sourceNodeType = sourceNode?.type || "unknown";
    const sourceHandle = edge.sourceHandle || "";
    const targetHandle = edge.targetHandle || "";
    
    // Debug: Log I/O node output handling
    if (sourceNodeType.includes("input") || sourceNodeType === "output") {
      console.log(`[buildNodeInput] Processing edge from I/O node ${edge.source} (${sourceNodeType}) to ${nodeType}`);
      console.log(`[buildNodeInput] I/O upstream output:`, upstreamOutput ? JSON.stringify(upstreamOutput).slice(0, 200) : 'undefined');
    }
    
    
    
    // =========================================================================
    // Handle SETTINGS connections - these transfer node data values, not outputs
    // Settings connections have sourceHandle ending with "-setting"
    // =========================================================================
    if (sourceHandle.endsWith("-setting") && sourceNode) {
      // Extract the settings field name from the sourceHandle (e.g., "xPercent-setting" → "xPercent")
      const settingsField = sourceHandle.replace(/-setting$/, "");
      const sourceNodeData = (sourceNode.data ?? {}) as Record<string, unknown>;
      const settingsValue = sourceNodeData[settingsField];
      
      if (settingsValue !== undefined) {
        // Set the target field to the settings value from source node
        input[targetHandle] = settingsValue;
        
      } else {
        
      }
      continue; // Skip the media output handling below
    }
    
    if (!upstreamOutput) {
      
      continue;
    }
    
    
    
    // Get the handle name and map to schema field
    // If targetHandle is empty, infer from source node type
    let rawHandle = edge.targetHandle ?? "";
    let schemaField = HANDLE_TO_SCHEMA_FIELD[rawHandle] ?? rawHandle;
    
    // If no target handle specified, infer based on source output type and node type
    if (!rawHandle || !schemaField) {
      const inferredType = inferOutputType(sourceNodeType);
      if (nodeType === "merge-videos") {
        // For merge-videos, assign to video1 or video2 based on what's already set
        if (!input.video1) {
          schemaField = "video1";
        } else if (!input.video2) {
          schemaField = "video2";
        } else {
          schemaField = "video1"; // Override
        }
      } else if (nodeType === "merge-audio-video" || nodeType === "lipsync") {
        // Infer from source output type
        schemaField = inferredType === "audio" ? "audio" : "video";
      } else {
        schemaField = inferredType;
      }
      
    }
    
    // Handle different output types
    let outputSet = false;
    
    if (upstreamOutput.type === "text" && "text" in upstreamOutput) {
      const textOutput = upstreamOutput.text as string;
      
      // Check if source is an LLM (openrouter) and target field can accept parsed input
      const isLLMSource = sourceNodeType === "openrouter";
      
      if (isLLMSource && targetHandle && canFieldAcceptLLMInput(nodeType, targetHandle)) {
        // Parse LLM text output to the appropriate type for the target field
        
        const parseResult = parseLLMToFieldValue(textOutput, nodeType, targetHandle);
        
        if (parseResult.success && parseResult.value !== undefined) {
          input[targetHandle] = parseResult.value;
          
          outputSet = true;
        } else {
          
          // Fall through to default text handling
        }
      }
      
      // Default text handling (context/prompt)
      if (!outputSet) {
        input.context = textOutput;
        if (rawHandle === "prompt" || rawHandle === "Prompt" || schemaField === "prompt") {
          input.prompt = textOutput;
        }
        
        outputSet = true;
      }
    }
    
    if (upstreamOutput.type === "image" && "image" in upstreamOutput) {
      const imageAsset = upstreamOutput.image as { url?: string };
      // Only override if upstream has a valid URL - don't overwrite manual uploads with undefined
      if (imageAsset?.url) {
        input[schemaField] = upstreamOutput.image;
        if (schemaField === "image" || schemaField === "frame") {
          input.imageUrl = imageAsset.url;
          input.inputImage = imageAsset.url;
        }
        
        outputSet = true;
      } else {
        
      }
    }
    
    if (upstreamOutput.type === "video" && "video" in upstreamOutput) {
      const videoAsset = upstreamOutput.video as { url?: string; mimeType?: string };
      // Only override if upstream has a valid URL - don't overwrite manual uploads with undefined
      if (videoAsset?.url) {
        input[schemaField] = upstreamOutput.video;
        
        // Also set URL aliases
        const urlField = schemaField + "Url";
        input[urlField] = videoAsset.url;
        if (schemaField === "video") {
          input.videoUrl = videoAsset.url;
        }
        
        
        outputSet = true;
      } else {
        
      }
    }
    
    if (upstreamOutput.type === "audio" && "audio" in upstreamOutput) {
      const audioAsset = upstreamOutput.audio as { url?: string; mimeType?: string };
      // Only override if upstream has a valid URL - don't overwrite manual uploads with undefined
      if (audioAsset?.url) {
        input[schemaField] = upstreamOutput.audio;
        input.audioUrl = audioAsset.url;
        
        
        outputSet = true;
      } else {
        
      }
    }
    
    // Fallback: If output type wasn't matched, try to infer from source node type and set directly
    if (!outputSet) {
      const inferredType = inferOutputType(sourceNodeType);
      
      
      // Try to extract the asset from the output based on inferred type
      const assetKey = inferredType === "text" ? "text" : inferredType;
      const asset = upstreamOutput[assetKey] as { url?: string } | string | undefined;
      
      if (asset) {
        if (typeof asset === "string") {
          // Text output
          if (schemaField === "prompt" || schemaField === "text") {
            input[schemaField] = asset;
          } else {
            input.context = asset;
          }
        } else if (asset.url) {
          // Media output
          input[schemaField] = asset;
          
        }
      } else {
        
      }
    }
  }

  // =========================================================================
  // STEP 3: Final validation - log what we have
  // =========================================================================
  const definedKeys = Object.keys(input).filter(k => input[k] !== undefined && input[k] !== null && input[k] !== "");
  
  return input;
}

export const executeWorkflow = task({
  id: "execute-workflow",
  // Use small machine - workflow orchestration doesn't need heavy compute
  // Individual nodes use medium-2x for FFmpeg processing
  machine: { preset: "small-1x" },
  retry: {
    maxAttempts: 1,
  },
  queue: {
    concurrencyLimit: 10, // Allow multiple workflows to run
  },

  run: async (payload: WorkflowExecutorPayload) => {
    const { workflowExecutionId, nodes, edges } = payload;

    // Debug: Log I/O node data at the start
    console.log(`[WorkflowExecutor] Starting workflow ${workflowExecutionId} with ${nodes.length} nodes`);
    for (const node of nodes) {
      if (node.type?.includes("input") || node.type === "output") {
        const nodeData = (node.data ?? {}) as Record<string, unknown>;
        console.log(`[WorkflowExecutor] I/O node ${node.id} (${node.type}) data:`, JSON.stringify({
          result: nodeData.result ? `${String(nodeData.result).slice(0, 100)}...` : undefined,
          value: nodeData.value ? `${String(nodeData.value).slice(0, 100)}...` : undefined,
          dataKeys: Object.keys(nodeData),
        }));
      }
    }

    // Update workflow status
    await db.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: { status: "RUNNING", startedAt: new Date() },
    });
    
    // Update metadata for workflow started
    await metadata.set("workflow", {
      status: "started",
      timestamp: Date.now(),
    });

    // ==========================================================================
    // ALL NODES SKIPPED CHECK - Complete early if all nodes are skipped
    // ==========================================================================
    const allNodesSkipped = nodes.every(node => {
      const nodeData = (node.data ?? {}) as Record<string, unknown>;
      return nodeData.skip === true;
    });
    
    if (allNodesSkipped && nodes.length > 0) {
      
      
      // Create node execution records and mark as completed/failed based on output
      for (const node of nodes) {
        const nodeType = node.type as AINodeType;
        const nodeData = (node.data ?? {}) as Record<string, unknown>;
        const existingResult = nodeData.result as string | undefined;
        const nodeName = (nodeData.label as string) || nodeType;
        
        const hasOutput = existingResult && typeof existingResult === "string" && existingResult.trim().length > 0;
        
        await db.nodeExecution.create({
          data: {
            workflowExecutionId,
            nodeId: node.id,
            nodeType,
            nodeLabel: nodeName,
            status: hasOutput ? "COMPLETED" : "FAILED",
            startedAt: new Date(),
            completedAt: new Date(),
            error: hasOutput ? null : `Skip enabled but no cached output available for "${nodeName}"`,
          },
        });
      }
      
      // Mark workflow as completed
      await db.workflowExecution.update({
        where: { id: workflowExecutionId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      
      return { status: "all_skipped", message: "All nodes were skipped" };
    }

    // Build dependency graph for DAG execution
    const { dependencies } = buildDependencyGraph(nodes, edges);
    
    // Log dependencies for debugging
    
    for (const [nodeId, deps] of dependencies.entries()) {
      const node = nodes.find(n => n.id === nodeId);
      const depsList = [...deps].map(d => {
        const depNode = nodes.find(n => n.id === d);
        return `${d} (${depNode?.type || "unknown"})`;
      });
      
    }

    // Track state for DAG execution
    const outputs = new Map<string, Record<string, unknown>>();
    const nodeExecutionIds = new Map<string, string>();
    const pendingNodes = new Set(nodes.map(n => n.id));
    const runningNodes = new Map<string, { runId: string; node: Node }>();
    const completedNodes = new Set<string>();
    const failedNodes = new Set<string>(); // Nodes that failed or have failed dependencies

    // Create all node execution records upfront
    
    for (const node of nodes) {
      const nodeType = node.type as AINodeType;
      const nodeLabel = (node.data as Record<string, unknown>)?.label as string | undefined;

      try {
        const nodeExecution = await db.nodeExecution.create({
          data: {
            workflowExecutionId,
            nodeId: node.id,
            nodeType,
            nodeLabel: nodeLabel ?? node.type,
            status: "QUEUED",
          },
        });
        nodeExecutionIds.set(node.id, nodeExecution.id);
        
      } catch (err) {
        console.error(`[DAG] FAILED to create node execution for ${node.id}:`, err);
        throw err; // Re-throw to fail the task
      }
    }
    

    // Helper: Check if a node can start (all its dependencies are completed, none failed)
    const canStart = (nodeId: string): boolean => {
      const deps = dependencies.get(nodeId) ?? new Set();
      for (const depId of deps) {
        if (failedNodes.has(depId)) {
          return false; // Dependency failed - this node can't start
        }
        if (!completedNodes.has(depId)) {
          return false; // Dependency not yet complete
        }
      }
      return true;
    };

    // Helper: Check if a node has any failed dependencies
    const hasDependencyFailed = (nodeId: string): boolean => {
      const deps = dependencies.get(nodeId) ?? new Set();
      for (const depId of deps) {
        if (failedNodes.has(depId)) {
          return true;
        }
      }
      return false;
    };

    // Helper: Mark a node and all its downstream dependents as failed
    const markNodeAndDependentsFailed = async (failedNodeId: string, originalError?: string) => {
      const toMark = [failedNodeId];
      const marked = new Set<string>();
      
      while (toMark.length > 0) {
        const nodeId = toMark.shift()!;
        if (marked.has(nodeId)) continue;
        marked.add(nodeId);
        
        failedNodes.add(nodeId);
        pendingNodes.delete(nodeId);
        runningNodes.delete(nodeId); // Also remove from running if present
        
        // Update database for this node
        const nodeExecutionId = nodeExecutionIds.get(nodeId);
        if (nodeExecutionId) {
          const isOriginalFailure = nodeId === failedNodeId;
          const errorMessage = isOriginalFailure 
            ? (originalError ?? "Node execution failed")
            : `Dependency failed: ${failedNodeId}`;
          
          try {
            await db.nodeExecution.update({
              where: { id: nodeExecutionId },
              data: { 
                status: "FAILED", 
                error: errorMessage,
                completedAt: new Date(),
              },
            });
            
          } catch (err) {
            console.error(`[DAG] Failed to update node ${nodeId} status in DB:`, err);
          }
        }
        
        // Find all nodes that depend on this node
        for (const [otherId, deps] of dependencies.entries()) {
          if (deps.has(nodeId) && !marked.has(otherId) && !completedNodes.has(otherId)) {
            toMark.push(otherId);
          }
        }
      }
      
      
    };

    // Helper: Start a node (non-blocking) - or skip if skip=true and has output
    // I/O node types that are passthrough (don't need execution)
    const IO_NODE_TYPES = ["input", "image-input", "video-input", "audio-input", "output", "comment"];
    
    const startNode = async (node: Node) => {
      const nodeType = node.type as AINodeType;
      const nodeExecutionId = nodeExecutionIds.get(node.id)!;
      const nodeData = (node.data ?? {}) as Record<string, unknown>;
      
      // =======================================================================
      // I/O NODE HANDLING - These are passthrough nodes
      // =======================================================================
      if (IO_NODE_TYPES.includes(nodeType)) {
        console.log(`[WorkflowExecutor] I/O node ${node.id} (${nodeType}) - passthrough handling`);
        console.log(`[WorkflowExecutor] I/O node data keys:`, Object.keys(nodeData));
        
        // Specialized input nodes (image-input, video-input, audio-input)
        if (nodeType === "image-input" || nodeType === "video-input" || nodeType === "audio-input") {
          const rawResult = nodeData.result || nodeData.value || nodeData.url || nodeData.file;
          // Handle both string URLs and {url: "..."} objects
          const result = typeof rawResult === 'string' 
            ? rawResult 
            : (rawResult as { url?: string } | undefined)?.url;
          console.log(`[WorkflowExecutor] Specialized input node ${node.id} result:`, result ? `${result.slice(0, 80)}...` : 'undefined');
          
          if (result && typeof result === "string" && result.length > 0) {
            const outputType = nodeType === "image-input" ? "image" : nodeType === "video-input" ? "video" : "audio";
            const passOutput: Record<string, unknown> = outputType === "image" 
              ? { type: "image", image: { url: result } }
              : outputType === "video"
              ? { type: "video", video: { url: result } }
              : { type: "audio", audio: { url: result } };
            
            outputs.set(node.id, passOutput);
            completedNodes.add(node.id);
            pendingNodes.delete(node.id);
            
            // Update database
            await db.nodeExecution.update({
              where: { id: nodeExecutionId },
              data: {
                status: "COMPLETED",
                startedAt: new Date(),
                completedAt: new Date(),
                outputJson: passOutput as object,
              },
            });
            
            // Update metadata for realtime
            await metadata.set(`node:${node.id}`, {
              status: "completed",
              nodeType,
              nodeLabel: (nodeData.label as string) || nodeType,
              output: passOutput,
              timestamp: Date.now(),
            });
            
            console.log(`[WorkflowExecutor] Specialized input node ${node.id} completed with result`);
            return;
          } else {
            // No input file uploaded
            const errorMsg = `No file uploaded to ${nodeType.replace('-input', '')} input node`;
            console.error(`[WorkflowExecutor] Specialized input node ${node.id} failed: ${errorMsg}`);
            
            await db.nodeExecution.update({
              where: { id: nodeExecutionId },
              data: {
                status: "FAILED",
                startedAt: new Date(),
                completedAt: new Date(),
                error: errorMsg,
              },
            });
            
            await metadata.set(`node:${node.id}`, {
              status: "failed",
              nodeType,
              nodeLabel: (nodeData.label as string) || nodeType,
              error: errorMsg,
              timestamp: Date.now(),
            });
            
            await markNodeAndDependentsFailed(node.id, errorMsg);
            return;
          }
        }
        
        // Universal input node (with mediaType selector)
        if (nodeType === "input") {
          const rawResult = nodeData.result || nodeData.value || nodeData.url || nodeData.file;
          // Handle both string URLs and {url: "..."} objects
          const result = typeof rawResult === 'string' 
            ? rawResult 
            : (rawResult as { url?: string } | undefined)?.url;
          const mediaType = nodeData.mediaType as string | undefined;
          const resultPreview = result ? `${result.slice(0, 80)}...` : JSON.stringify(rawResult)?.slice(0, 80);
          console.log(`[WorkflowExecutor] Input node ${node.id} result:`, resultPreview ?? 'undefined', `mediaType: ${mediaType}`);
          
          if (result && typeof result === "string" && result.length > 0 && mediaType) {
            const outputType = mediaType;
            const passOutput: Record<string, unknown> = outputType === "image" 
              ? { type: "image", image: { url: result } }
              : outputType === "video"
              ? { type: "video", video: { url: result } }
              : outputType === "audio"
              ? { type: "audio", audio: { url: result } }
              : { type: "text", text: result };
            
            outputs.set(node.id, passOutput);
            completedNodes.add(node.id);
            pendingNodes.delete(node.id);
            
            // Update database
            await db.nodeExecution.update({
              where: { id: nodeExecutionId },
              data: {
                status: "COMPLETED",
                startedAt: new Date(),
                completedAt: new Date(),
                outputJson: passOutput as object,
              },
            });
            
            // Update metadata for realtime
            await metadata.set(`node:${node.id}`, {
              status: "completed",
              nodeType,
              nodeLabel: (nodeData.label as string) || nodeType,
              output: passOutput,
              timestamp: Date.now(),
            });
            
            console.log(`[WorkflowExecutor] Input node ${node.id} completed with result`);
            return;
          } else {
            // No input file uploaded
            const errorMsg = `No file uploaded to ${nodeType.replace('-input', '')} input node`;
            console.error(`[WorkflowExecutor] Input node ${node.id} failed: ${errorMsg}`);
            
            await db.nodeExecution.update({
              where: { id: nodeExecutionId },
              data: {
                status: "FAILED",
                startedAt: new Date(),
                completedAt: new Date(),
                error: errorMsg,
              },
            });
            
            await metadata.set(`node:${node.id}`, {
              status: "failed",
              nodeType,
              nodeLabel: (nodeData.label as string) || nodeType,
              error: errorMsg,
              timestamp: Date.now(),
            });
            
            await markNodeAndDependentsFailed(node.id, errorMsg);
            return;
          }
        }
        
        // Output node: get value from connected upstream node
        if (nodeType === "output") {
          const incomingEdge = edges.find(e => e.target === node.id);
          if (incomingEdge) {
            const sourceOutput = outputs.get(incomingEdge.source);
            if (sourceOutput) {
              outputs.set(node.id, sourceOutput);
              completedNodes.add(node.id);
              pendingNodes.delete(node.id);
              
              // Get result text
              const resultText = sourceOutput.type === "text" 
                ? (sourceOutput.text as string)
                : sourceOutput.type === "image" 
                ? ((sourceOutput.image as { url: string })?.url)
                : sourceOutput.type === "video"
                ? ((sourceOutput.video as { url: string })?.url)
                : ((sourceOutput.audio as { url: string })?.url);
              
              await db.nodeExecution.update({
                where: { id: nodeExecutionId },
                data: {
                  status: "COMPLETED",
                  startedAt: new Date(),
                  completedAt: new Date(),
                  outputJson: sourceOutput as object,
                },
              });
              
              await metadata.set(`node:${node.id}`, {
                status: "completed",
                nodeType,
                nodeLabel: (nodeData.label as string) || "Output",
                output: sourceOutput,
                timestamp: Date.now(),
              });
              
              console.log(`[WorkflowExecutor] Output node ${node.id} completed with result: ${resultText?.slice(0, 50)}...`);
              return;
            }
          }
          
          // No input connected - just mark as completed
          completedNodes.add(node.id);
          pendingNodes.delete(node.id);
          
          await db.nodeExecution.update({
            where: { id: nodeExecutionId },
            data: {
              status: "COMPLETED",
              startedAt: new Date(),
              completedAt: new Date(),
            },
          });
          
          await metadata.set(`node:${node.id}`, {
            status: "completed",
            nodeType,
            nodeLabel: (nodeData.label as string) || "Output",
            timestamp: Date.now(),
          });
          
          console.log(`[WorkflowExecutor] Output node ${node.id} completed (no input connected)`);
          return;
        }
        
        // Comment node: just mark as completed
        if (nodeType === "comment") {
          completedNodes.add(node.id);
          pendingNodes.delete(node.id);
          
          await db.nodeExecution.update({
            where: { id: nodeExecutionId },
            data: {
              status: "COMPLETED",
              startedAt: new Date(),
              completedAt: new Date(),
            },
          });
          
          console.log(`[WorkflowExecutor] Comment node ${node.id} completed`);
          return;
        }
      }
      
      // =======================================================================
      // SKIP CHECK - If skip=true and node has existing output, use it
      // =======================================================================
      if (nodeData.skip === true) {
        const existingResult = nodeData.result as string | undefined;
        const nodeName = (nodeData.label as string) || nodeType;
        
        if (existingResult && typeof existingResult === "string" && existingResult.trim().length > 0) {
          
          
          // Determine output type based on node type
          const outputType = inferOutputType(nodeType);
          let skipOutput: Record<string, unknown>;
          
          if (outputType === "text") {
            skipOutput = { type: "text", text: existingResult };
          } else if (outputType === "image") {
            skipOutput = { type: "image", image: { url: existingResult } };
          } else if (outputType === "video") {
            skipOutput = { type: "video", video: { url: existingResult } };
          } else {
            skipOutput = { type: "audio", audio: { url: existingResult } };
          }
          
          // Store output for downstream nodes
          outputs.set(node.id, skipOutput);
          completedNodes.add(node.id);
          pendingNodes.delete(node.id);
          
          // Update database to mark as completed (skipped)
          await db.nodeExecution.update({
            where: { id: nodeExecutionId },
            data: {
              status: "COMPLETED",
              startedAt: new Date(),
              completedAt: new Date(),
              outputJson: skipOutput as object,
              error: null,
            },
          });
          
          
          return; // Don't actually execute the node
        } else {
          // Skip enabled but no output - mark as failed
          
          await db.nodeExecution.update({
            where: { id: nodeExecutionId },
            data: {
              status: "FAILED",
              startedAt: new Date(),
              completedAt: new Date(),
              error: `Skip enabled but no cached output available for "${nodeName}"`,
            },
          });
          
          await markNodeAndDependentsFailed(node.id, `Skip enabled but no cached output available for "${nodeName}"`);
          return;
        }
      }

      
      const input = buildNodeInput(node, edges, outputs, nodes);

      // Update DB: mark as RUNNING and store input
      await db.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: { 
          status: "RUNNING",
          startedAt: new Date(),
          inputJson: input as object,
        },
      });

      // Trigger the node (non-blocking) - returns immediately
      const handle = await executeNode.trigger({
        nodeExecutionId,
        workflowExecutionId,
        nodeId: node.id,
        nodeType,
        input,
      });

      // Save the trigger task ID to the database for tracking/debugging
      await db.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: { triggerTaskId: handle.id },
      });

      runningNodes.set(node.id, { runId: handle.id, node });
      pendingNodes.delete(node.id);
      
      
      // Update metadata with node status (legacy - may not propagate to React hooks)
      const nodeLabel = (nodeData.label as string) || nodeType;
      await metadata.set(`node:${node.id}`, {
        status: "started",
        nodeType,
        nodeLabel,
        timestamp: Date.now(),
      } satisfies NodeStatus);
    };

    // Start all nodes that have no dependencies
    
    
    // Keep starting nodes until no more can be started
    // This handles the case where skipped nodes complete instantly and unblock dependents
    let startedAny = true;
    while (startedAny) {
      startedAny = false;
      for (const node of nodes) {
        if (canStart(node.id) && pendingNodes.has(node.id)) {
          await startNode(node);
          startedAny = true;
        }
      }
    }

    // Poll until all processable nodes are done
    const POLL_INTERVAL_SECONDS = 2;
    const MAX_ITERATIONS = 900; // 30 minutes max (900 * 2s)
    let iteration = 0;

    // Terminal states that indicate the run is done (success or failure)
    // IMPORTANT: RESCHEDULED means Trigger.dev created a NEW run for retry,
    // but we're tracking the OLD run ID which will never complete.
    // Treat as failure since we can't easily track the new run.
    const TERMINAL_FAILURE_STATES = new Set([
      "FAILED",
      "CRASHED", 
      "SYSTEM_FAILURE",
      "CANCELED",
      "TIMED_OUT",
      "EXPIRED",
      "RESCHEDULED",  // Task was rescheduled for retry - OLD run won't complete
      "INTERRUPTED",  // Task was interrupted
      "FROZEN",       // Task is frozen - treat as failure
    ]);

    // States that mean "still processing" - keep polling
    const ACTIVE_STATES = new Set([
      "PENDING",
      "QUEUED", 
      "EXECUTING",
      "WAITING",
      "WAITING_ON_SCHEDULE",
      "DELAYED",
    ]);

    while ((runningNodes.size > 0 || pendingNodes.size > 0) && iteration < MAX_ITERATIONS) {
      iteration++;
      
      // First, check pending nodes that have failed dependencies and mark them
      for (const pendingNodeId of Array.from(pendingNodes)) {
        if (hasDependencyFailed(pendingNodeId)) {
          
          await markNodeAndDependentsFailed(pendingNodeId, "Dependency failed");
        }
      }
      
      // Check if any pending nodes can now start (handles skipped nodes completing instantly)
      for (const pendingNodeId of Array.from(pendingNodes)) {
        if (canStart(pendingNodeId)) {
          const pendingNode = nodes.find(n => n.id === pendingNodeId);
          if (pendingNode) {
            
            await startNode(pendingNode);
          }
        }
      }
      
      // Check each running node for completion
      const nodesToCheck = Array.from(runningNodes.entries());
      
      for (const [nodeId, { runId, node }] of nodesToCheck) {
        try {
          const run = await runs.retrieve(runId);
          const nodeType = node.type as AINodeType;
          const status = run.status;

          

          // Check for completion
          if (status === "COMPLETED") {
            
            
            // Extract and store output
            const taskOutput = run.output as { output?: Record<string, unknown> } | undefined;
            if (taskOutput?.output) {
              outputs.set(nodeId, taskOutput.output);
              console.log(`[DAG] Stored output for ${nodeId}:`, {
                type: taskOutput.output.type,
                hasVideo: "video" in taskOutput.output,
                hasAudio: "audio" in taskOutput.output,
                hasImage: "image" in taskOutput.output,
              });
            } else {
              
              outputs.set(nodeId, {});
            }

            completedNodes.add(nodeId);
            runningNodes.delete(nodeId);
            
            // Update metadata with node completion (legacy - may not propagate to React hooks)
            const nodeData = (node.data ?? {}) as Record<string, unknown>;
            const nodeLabel = (nodeData.label as string) || nodeType;
            await metadata.set(`node:${nodeId}`, {
              status: "completed",
              nodeType,
              nodeLabel,
              output: taskOutput?.output,
              timestamp: Date.now(),
            } satisfies NodeStatus);
            
            // Update nodeExecution as a FALLBACK
            // The node executor should have already saved the output, but DB connection
            // issues on Trigger.dev workers can cause silent failures.
            // We update here to ensure the output is saved.
            const nodeExecutionId = nodeExecutionIds.get(nodeId);
            if (nodeExecutionId && taskOutput?.output) {
              try {
                await db.nodeExecution.update({
                  where: { id: nodeExecutionId },
                  data: { 
                    status: "COMPLETED",
                    completedAt: new Date(),
                    outputJson: taskOutput.output as object,
                  },
                });
                
              } catch (err) {
                console.error(`[DAG] Failed to update nodeExecution ${nodeExecutionId}:`, err);
              }
            }

            // Check if any pending nodes can now start
            for (const pendingNodeId of Array.from(pendingNodes)) {
              if (canStart(pendingNodeId)) {
                const pendingNode = nodes.find(n => n.id === pendingNodeId);
                if (pendingNode) {
                  
                  await startNode(pendingNode);
                }
              }
            }
          } else if (TERMINAL_FAILURE_STATES.has(status)) {
            // Handle all terminal failure states (including RESCHEDULED, INTERRUPTED, FROZEN)
            console.error(`[DAG] Node ${nodeId} (${nodeType}) FAILED with terminal status: ${status}`);
            
            runningNodes.delete(nodeId);
            
            // Update metadata with node failure (legacy - may not propagate to React hooks)
            const nodeData = (node.data ?? {}) as Record<string, unknown>;
            const nodeLabel = (nodeData.label as string) || nodeType;
            await metadata.set(`node:${nodeId}`, {
              status: "failed",
              nodeType,
              nodeLabel,
              error: `Failed with status: ${status}`,
              timestamp: Date.now(),
            } satisfies NodeStatus);
            
            // Mark this node and all its dependents as failed (updates DB for all)
            await markNodeAndDependentsFailed(nodeId, `Failed with status: ${status}`);
          } else if (!ACTIVE_STATES.has(status)) {
            // Unknown status - log warning but treat as still running for safety
            // This prevents infinite loops if Trigger.dev adds new statuses
            
          }
          // If PENDING, QUEUED, EXECUTING, WAITING, etc. - continue polling
        } catch (err) {
          console.error(`[DAG] Error checking run status for ${nodeId}:`, err);
          // If we can't retrieve the run (e.g., network error), keep trying
          // But if it's a "not found" error, treat as failure
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (errorMsg.includes("not found") || errorMsg.includes("404")) {
            console.error(`[DAG] Run ${runId} not found, marking node ${nodeId} as failed`);
            runningNodes.delete(nodeId);
            await markNodeAndDependentsFailed(nodeId, "Run not found");
          }
        }
      }

      // Wait before next poll if there are still nodes to process
      if (runningNodes.size > 0 || pendingNodes.size > 0) {
        const runningNodesList = [...runningNodes.keys()].join(", ");
        const pendingNodesList = [...pendingNodes].join(", ");
        
        await wait.for({ seconds: POLL_INTERVAL_SECONDS });
      }
    }

    // Final debug log before exiting the loop
    
    

    // Check if we timed out
    if (iteration >= MAX_ITERATIONS) {
      console.error(`[DAG] Workflow timed out after ${MAX_ITERATIONS * POLL_INTERVAL_SECONDS}s`);
      await db.workflowExecution.update({
        where: { id: workflowExecutionId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: "Workflow execution timed out",
        },
      });
      return {
        success: false,
        workflowExecutionId,
        error: "Workflow execution timed out",
        partialOutputs: Object.fromEntries(outputs),
      };
    }

    // Determine final workflow status
    const hasFailures = failedNodes.size > 0;
    const hasSuccesses = completedNodes.size > 0;
    
    let finalStatus: "COMPLETED" | "FAILED" | "PARTIAL";
    let errorMessage: string | undefined;
    
    if (hasFailures && hasSuccesses) {
      // Some succeeded, some failed - partial success
      finalStatus = "COMPLETED"; // Mark as completed but with errors noted
      errorMessage = `Partial completion: ${completedNodes.size} succeeded, ${failedNodes.size} failed`;
      
    } else if (hasFailures && !hasSuccesses) {
      // All failed
      finalStatus = "FAILED";
      errorMessage = `All ${failedNodes.size} nodes failed`;
      
    } else {
      // All succeeded
      finalStatus = "COMPLETED";
      
    }

    await db.workflowExecution.update({
      where: { id: workflowExecutionId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        error: errorMessage,
      },
    });

    // Update metadata with workflow completion (legacy - may not propagate to React hooks)
    await metadata.set("workflow", {
      status: "completed",
      successCount: completedNodes.size,
      failCount: failedNodes.size,
      finalStatus,
      timestamp: Date.now(),
    });

    // ==========================================================================
    // PERSIST EXECUTION VALUES BACK TO WORKFLOW
    // This allows users to see the last execution's input values when reopening
    // ==========================================================================
    if (finalStatus === "COMPLETED" && outputs.size > 0) {
      try {
        // Build updated nodes with execution values
        const updatedNodes = nodes.map(node => {
          const nodeOutput = outputs.get(node.id);
          if (!nodeOutput) return node;
          
          const nodeType = node.type as string;
          const nodeData = { ...(node.data ?? {}) } as Record<string, unknown>;
          
          // For input nodes, persist the value/result
          if (nodeType === "input" || nodeType.includes("-input")) {
            // Extract URL from output based on type
            let resultUrl: string | undefined;
            if (nodeOutput.type === "video" && nodeOutput.video) {
              resultUrl = (nodeOutput.video as { url: string }).url;
            } else if (nodeOutput.type === "image" && nodeOutput.image) {
              resultUrl = (nodeOutput.image as { url: string }).url;
            } else if (nodeOutput.type === "audio" && nodeOutput.audio) {
              resultUrl = (nodeOutput.audio as { url: string }).url;
            } else if (nodeOutput.type === "text" && nodeOutput.text) {
              resultUrl = nodeOutput.text as string;
            }
            
            if (resultUrl) {
              nodeData.value = resultUrl;
              nodeData.result = resultUrl;
            }
          }
          
          // For processing nodes, persist the result
          if (nodeOutput && !["input", "output", "comment"].includes(nodeType)) {
            let resultUrl: string | undefined;
            if (nodeOutput.type === "video" && nodeOutput.video) {
              resultUrl = (nodeOutput.video as { url: string }).url;
            } else if (nodeOutput.type === "image" && nodeOutput.image) {
              resultUrl = (nodeOutput.image as { url: string }).url;
            } else if (nodeOutput.type === "audio" && nodeOutput.audio) {
              resultUrl = (nodeOutput.audio as { url: string }).url;
            } else if (nodeOutput.type === "text" && nodeOutput.text) {
              resultUrl = nodeOutput.text as string;
            }
            
            if (resultUrl) {
              nodeData.result = resultUrl;
            }
          }
          
          return { ...node, data: nodeData };
        });
        
        // Save updated nodes back to workflow
        await db.workflow.update({
          where: { id: payload.workflowId },
          data: {
            nodesJson: updatedNodes as object[],
            updatedAt: new Date(),
          },
        });
        
        console.log(`[WorkflowExecutor] Persisted execution values back to workflow ${payload.workflowId}`);
      } catch (persistError) {
        // Don't fail the workflow if persistence fails - just log
        console.error(`[WorkflowExecutor] Failed to persist execution values:`, persistError);
      }
    }

    return {
      success: !hasFailures || hasSuccesses, // Success if any node completed
      workflowExecutionId,
      completedNodes: [...completedNodes],
      failedNodes: [...failedNodes],
      nodeOutputs: Object.fromEntries(outputs),
    };
  },
});
