import type { Edge, Node } from "reactflow";
import { z } from "zod";
import { type AINodeType, NODE_DEFINITIONS } from "@/types/nodes";
import {
  NodeInputSchemas,
  NodeOutputSchemas,
  NodeProviders,
  NodePrimaryOutputType,
  type ProviderId,
  type AnyOut,
} from "./node-schemas";
import { estimateNodeCost } from "@/lib/credits";
import { checkCache, cacheResult } from "@/lib/cache";
import { NODE_CONFIG } from "@/lib/config";
import { showSkipWarning, showAllSkippedWarning } from "@/lib/toast";

// Re-export from extracted modules for backward compatibility
export { uploadMediaToCDN, preprocessInputForAPI } from "./media-upload";
export { computeNodeInputHash, hasNodeInputsChanged, hasUpstreamChanges } from "./input-hash";
export {
  getNodeDefaults,
  topoSort,
  getUpstreamNodes,
  nodeHasOutput,
  withTimeout,
  parseDurationMs,
  DEFAULT_NODE_TIMEOUT_MS,
  NODE_TIMEOUT_MS,
  TRIGGER_NODE_TYPES,
  LOCAL_NODE_TYPES,
} from "./node-utils";
export { GraphIndex, getGraphIndex, clearGraphIndexCache } from "./graph-index";
export {
  getIncomingTextForContext,
  getIncomingTextForPrompt,
  getIncomingMedia,
  getIncomingSettingsFromLLM,
  getNodeOutputPreviewFromData,
  getConnectedPreviewFromLastOutputs,
  type OutputByNode,
} from "./input-builder";
export { buildNodeInput } from "./build-input";
export {
  executeWithProvider,
  pollNodeStatus,
  providerIsConfigured,
  type ExecutionContext,
} from "./provider-execution";

// Import for internal use
import { computeNodeInputHash, hasNodeInputsChanged } from "./input-hash";
import {
  topoSort,
  getUpstreamNodes,
  nodeHasOutput,
  withTimeout,
  parseDurationMs,
  DEFAULT_NODE_TIMEOUT_MS,
  NODE_TIMEOUT_MS,
} from "./node-utils";
import {
  getNodeOutputPreviewFromData,
  getConnectedPreviewFromLastOutputs,
  type OutputByNode,
} from "./input-builder";
import { buildNodeInput } from "./build-input";
import { executeWithProvider, providerIsConfigured } from "./provider-execution";
import { getGraphIndex } from "./graph-index";

// Types exported for backward compatibility
export type NodeRunStatus = "queued" | "running" | "completed" | "failed";

export interface RunCallbacks {
  onNodeStatus?: (nodeId: string, status: NodeRunStatus, patch?: Record<string, unknown>) => void;
  onNodeResult?: (nodeId: string, resultText: string, output: AnyOut) => void;
}

// NOTE: buildNodeInput, providerIsConfigured, pollNodeStatus, executeWithProvider
// have been extracted to build-input.ts and provider-execution.ts

/**
 * PARALLEL WORKFLOW EXECUTION
 * 
 * Execution order is determined by dependencies:
 * 1. Nodes with no incoming edges (root nodes) start immediately IN PARALLEL
 * 2. When a node completes, all nodes that only depended on it become ready
 * 3. Ready nodes start immediately IN PARALLEL
 * 4. This continues until all nodes are complete
 * 
 * Example with two independent pipelines:
 *   Pipeline A: LLM1 → Image1 → Video1
 *   Pipeline B: LLM2 → Image2 → Video2
 * 
 * Execution:
 *   - LLM1 and LLM2 start simultaneously (both are roots)
 *   - When LLM1 finishes, Image1 starts immediately
 *   - When LLM2 finishes, Image2 starts immediately
 *   - Both Image nodes run in parallel
 *   - And so on...
 */
export async function runWorkflow(
  nodes: Node[],
  edges: Edge[],
  callbacks: RunCallbacks = {},
  workflowId?: string
): Promise<void> {
  console.log("[RunWorkflow] Starting PARALLEL workflow execution");
  console.log("[RunWorkflow] Nodes:", nodes.map(n => ({ id: n.id, type: n.type })));
  console.log("[RunWorkflow] Edges:", edges.map(e => ({ source: e.source, target: e.target })));
  
  const outputs: OutputByNode = new Map();
  const allNodes = topoSort(nodes, edges); // Memoized topological sort
  
  // Use GraphIndex for O(1) lookups (cached if graph unchanged)
  const graph = getGraphIndex(nodes, edges);
  const dependencies = graph.dependencies;
  const dependents = graph.dependents;
  
  // ==========================================================================
  // ALL NODES SKIPPED CHECK - Warn if every node is skipped
  // ==========================================================================
  const allNodesSkipped = allNodes.every(node => {
    const nodeData = node.data as Record<string, unknown> | undefined;
    return nodeData?.skip === true;
  });
  
  if (allNodesSkipped && allNodes.length > 0) {
    console.log("[RunWorkflow] All nodes are skipped - nothing to execute");
    showAllSkippedWarning();
    // Mark all as completed with skip status
    for (const node of allNodes) {
      const nodeData = node.data as Record<string, unknown>;
      const existingResult = nodeData?.result as string | undefined;
      if (existingResult) {
        callbacks.onNodeStatus?.(node.id, "completed", { skipped: true, progress: 100 });
      } else {
        callbacks.onNodeStatus?.(node.id, "failed", { 
          error: "Skip enabled but no cached output available",
          skipped: true 
        });
      }
    }
    return;
  }
  
  // Track node states
  const completed = new Set<string>();
  const failed = new Set<string>();
  const running = new Set<string>();
  
  // Find nodes that can run (no pending dependencies)
  const getReadyNodes = (): Node[] => {
    const ready: Node[] = [];
    for (const node of allNodes) {
      if (completed.has(node.id) || failed.has(node.id) || running.has(node.id)) {
        continue;
      }
      const deps = dependencies.get(node.id)!;
      const allDepsComplete = [...deps].every(d => completed.has(d));
      const anyDepFailed = [...deps].some(d => failed.has(d));
      
      if (anyDepFailed) {
        // Skip this node - a dependency failed
        failed.add(node.id);
        callbacks.onNodeStatus?.(node.id, "failed", { 
          error: "Dependency failed",
          progress: 0 
        });
        continue;
      }
      
      if (allDepsComplete) {
        ready.push(node);
      }
    }
    return ready;
  };
  
  // Execute a single node
  // I/O node types that are passthrough (don't need execution)
  const IO_NODE_TYPES = ["image-input", "video-input", "audio-input", "comment"];
  
  const executeNode = async (node: Node): Promise<void> => {
    const type = node.type as AINodeType;
    const inputSchema = NodeInputSchemas[type] as z.ZodTypeAny;
    const outputSchema = NodeOutputSchemas[type] as z.ZodTypeAny;
    const data = (node.data ?? {}) as any;

    if (!inputSchema || !outputSchema) {
      callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
      failed.add(node.id);
      return;
    }

    // ==========================================================================
    // I/O NODE HANDLING - These are passthrough nodes
    // ==========================================================================
    if (IO_NODE_TYPES.includes(type)) {
      console.log(`[RunWorkflow] I/O node ${node.id} (${type}) - passthrough handling`);
      console.log(`[RunWorkflow] I/O node data:`, JSON.stringify(data).slice(0, 500));
      // Input nodes: use their result/value as output
      if (type === "image-input" || type === "video-input" || type === "audio-input") {
        // Try multiple possible property names for the uploaded file
        const result = data.result || data.value || data.url || data.file;
        const mediaType = type === "image-input" ? "image" : type === "video-input" ? "video" : "audio";
        console.log(`[RunWorkflow] Input node ${node.id} result:`, result ? `${String(result).slice(0, 100)}...` : 'undefined', `mediaType: ${mediaType}`);
        
        if (result && typeof result === "string" && result.length > 0) {
          const passOutput: AnyOut = mediaType === "image" 
            ? { type: "image", image: { url: result } }
            : mediaType === "video"
            ? { type: "video", video: { url: result } }
            : { type: "audio", audio: { url: result } };
          
          outputs.set(node.id, passOutput);
          completed.add(node.id);
          callbacks.onNodeResult?.(node.id, result, passOutput);
          callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
          console.log(`[RunWorkflow] Input node ${node.id} completed with result`);
          return;
        } else {
          // No input file uploaded - provide more helpful error
          const dataKeys = Object.keys(data);
          console.error(`[RunWorkflow] Input node ${node.id} has no file. Data keys:`, dataKeys);
          callbacks.onNodeStatus?.(node.id, "failed", { 
            error: `No file uploaded to input node (${mediaType})`,
            details: `Please upload a ${mediaType} file to the input node before running the workflow`
          });
          failed.add(node.id);
          return;
        }
      }

      
      // Comment node: just mark as completed
      if (type === "comment") {
        completed.add(node.id);
        callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
        return;
      }
    }

    // ==========================================================================
    // SKIP CHECK - Use existing output if skip is enabled
    // ==========================================================================
    if (data.skip === true) {
      const existingResult = data.result as string | undefined;
      const nodeName = data.label || NODE_DEFINITIONS[type]?.label || type;
      
      if (existingResult && typeof existingResult === "string" && existingResult.trim().length > 0) {
        // Node has output - use it instead of executing
        console.log(`[RunWorkflow] Node ${node.id} (${type}) SKIPPED - using existing output`);
        
        // Determine output type based on node type
        const outputType = NodePrimaryOutputType[type];
        let skipOutput: AnyOut;
        
        if (outputType === "text") {
          skipOutput = { type: "text", text: existingResult };
        } else if (outputType === "image") {
          skipOutput = { type: "image", image: { url: existingResult } };
        } else if (outputType === "video") {
          skipOutput = { type: "video", video: { url: existingResult } };
        } else {
          skipOutput = { type: "audio", audio: { url: existingResult } };
        }
        
        outputs.set(node.id, skipOutput);
        completed.add(node.id);
        
        callbacks.onNodeResult?.(node.id, existingResult, skipOutput);
        callbacks.onNodeStatus?.(node.id, "completed", {
          progress: 100,
          skipped: true,
        });
        return;
      } else {
        // Skip enabled but no output available - show warning and fail
        console.log(`[RunWorkflow] Node ${node.id} (${type}) SKIP FAILED - no existing output`);
        showSkipWarning(nodeName);
        callbacks.onNodeStatus?.(node.id, "failed", {
          error: "Skip enabled but no cached output available",
          skipped: true,
        });
        failed.add(node.id);
        return;
      }
    }

    running.add(node.id);
    callbacks.onNodeStatus?.(node.id, "running", { progress: 10 });

    // Compute input hash for change detection
    const inputHash = computeNodeInputHash(node, edges, allNodes);

    const rawInput = buildNodeInput(node, edges, outputs, allNodes);
    console.log(`[RunWorkflow] Node ${node.id} (${type}) starting - Built input:`, {
      prompt: (rawInput as any)?.prompt?.slice(0, 100),
      context: (rawInput as any)?.context?.slice(0, 200),
      hasContext: !!(rawInput as any)?.context,
    });
    
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: parsed.error.issues.map((i) => i.message).join("; "),
        progress: 0,
      });
      running.delete(node.id);
      failed.add(node.id);
      return;
    }

    // Check cache for identical inputs (only if caching enabled)
    const useCache = (data as { useCache?: boolean }).useCache === true;
    let cacheHash: string | undefined;
    
    if (useCache) {
      try {
        const cacheCheck = await checkCache(type, parsed.data as Record<string, unknown>);
        cacheHash = cacheCheck.hash;
        
        if (cacheCheck.hit && cacheCheck.result) {
          console.log(`[RunWorkflow] Cache HIT for ${node.id} (${type}) - skipping execution`);
          
          const cachedOut = cacheCheck.result as AnyOut;
          const validated = outputSchema.safeParse(cachedOut);
          
          if (validated.success) {
            running.delete(node.id);
            outputs.set(node.id, cachedOut);
            completed.add(node.id);
            
            const resultText =
              cachedOut.type === "text"
                ? cachedOut.text
                : cachedOut.type === "image"
                  ? cachedOut.image.url
                  : cachedOut.type === "video"
                    ? cachedOut.video.url
                    : cachedOut.audio.url;

            callbacks.onNodeResult?.(node.id, resultText, cachedOut);
            callbacks.onNodeStatus?.(node.id, "completed", {
              progress: 100,
              fromCache: true,
              _lastInputHash: inputHash,
            });
            return;
          }
        }
      } catch (error) {
        console.warn(`[RunWorkflow] Cache check failed for ${node.id}, proceeding with execution:`, error);
      }
    } else {
      console.log(`[RunWorkflow] Cache DISABLED for ${node.id} (${type}) - executing fresh`);
    }

    // Provider fallback chain
    const nodeProvidersRaw = Array.isArray(data.providers) ? data.providers : undefined;
    const providers = (nodeProvidersRaw?.filter((p: unknown) => typeof p === "string" && p.trim()) as string[] | undefined)
      ?? (NodeProviders[type] as unknown as string[] | undefined)
      ?? ["fal"];

    const retryPerProvider =
      typeof data.retryPerProvider === "number" && Number.isFinite(data.retryPerProvider) && data.retryPerProvider > 0
        ? Math.floor(data.retryPerProvider)
        : 1;

    const timeoutMs =
      parseDurationMs(data.timeout) ??
      parseDurationMs(data.timeoutMs) ??
      parseDurationMs(data.nodeTimeout) ??
      NODE_TIMEOUT_MS[type] ??
      DEFAULT_NODE_TIMEOUT_MS;

    let lastError: string | undefined;
    let finalOut: AnyOut | undefined;
    let providerUsed: string | undefined;
    const attemptedProviders: string[] = [];

    for (const p of providers) {
      if (!providerIsConfigured(p as any)) continue;
      attemptedProviders.push(p);

      for (let attempt = 1; attempt <= retryPerProvider; attempt++) {
        callbacks.onNodeStatus?.(node.id, "running", {
          progress: 20 + (attempt * 10),
          providerTrying: p,
          providerAttempt: attempt,
        });

        try {
          const out = await withTimeout(
            executeWithProvider(type, p as any, parsed.data, {
              workflowId,
              nodeId: node.id,
              nodeLabel: data.label || NODE_DEFINITIONS[type]?.label || type,
            }),
            timeoutMs,
            `${type} (${p})`
          );
          const validated = outputSchema.safeParse(out);
          if (!validated.success) {
            throw new Error(`Output schema invalid: ${validated.error.issues.map((i) => i.message).join("; ")}`);
          }
          finalOut = validated.data as AnyOut;
          providerUsed = p;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          console.log(`[RunWorkflow] Node ${node.id} attempt ${attempt} failed: ${lastError}`);
        }
      }

      if (finalOut) break;
    }

    running.delete(node.id);

    if (!finalOut) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: lastError ?? "All providers failed",
        attemptedProviders,
        progress: 0,
      });
      failed.add(node.id);
      return;
    }

    outputs.set(node.id, finalOut);
    completed.add(node.id);
    
    console.log(`[RunWorkflow] Node ${node.id} completed. Output stored.`);
    
    const resultText =
      finalOut.type === "text"
        ? finalOut.text
        : finalOut.type === "image"
          ? finalOut.image.url
          : finalOut.type === "video"
            ? finalOut.video.url
            : finalOut.audio.url;

    // Cache successful result for future identical executions (only if caching enabled)
    if (useCache && cacheHash) {
      try {
        await cacheResult(cacheHash, type, finalOut as Record<string, unknown>);
      } catch (error) {
        console.warn(`[RunWorkflow] Failed to cache result for ${node.id}:`, error);
      }
    }

    callbacks.onNodeResult?.(node.id, resultText, finalOut);
    callbacks.onNodeStatus?.(node.id, "completed", {
      progress: 100,
      providerUsed,
      attemptedProviders,
      _lastInputHash: inputHash,
    });
  };
  
  // Mark all nodes as queued initially
  for (const node of allNodes) {
    const type = node.type as AINodeType;
    if (!NodeInputSchemas[type] || !NodeOutputSchemas[type]) {
      callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
      failed.add(node.id);
      continue;
    }
    callbacks.onNodeStatus?.(node.id, "queued");
  }
  
  // Identify independent pipelines for logging
  const rootNodes = allNodes.filter(n => dependencies.get(n.id)!.size === 0);
  console.log(`[RunWorkflow] Found ${rootNodes.length} root node(s) - these will start in PARALLEL:`, rootNodes.map(n => n.id));
  
  // Main execution loop - run nodes in parallel waves
  while (completed.size + failed.size < allNodes.length) {
    const readyNodes = getReadyNodes();
    
    if (readyNodes.length === 0) {
      // No nodes ready and not all complete - might be stuck
      if (running.size === 0) {
        console.error("[RunWorkflow] No nodes ready and none running - possible cycle or all failed");
        break;
      }
      // Wait a bit for running nodes to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    
    console.log(`[RunWorkflow] Starting ${readyNodes.length} node(s) in PARALLEL:`, readyNodes.map(n => `${n.id} (${n.type})`));
    
    // Start all ready nodes in parallel
    const promises = readyNodes.map(node => executeNode(node));
    
    // Wait for at least one to complete before checking for new ready nodes
    await Promise.race(promises);
    
    // Also wait for all current batch to settle before next iteration
    // This prevents starting too many concurrent operations
    await Promise.allSettled(promises);
  }
  
  const successCount = completed.size;
  const failCount = failed.size;
  console.log(`[RunWorkflow] Workflow execution completed: ${successCount} succeeded, ${failCount} failed`);
}

// Nodes that require server-side execution via Trigger.dev (async/webhook-based)
const ASYNC_NODE_TYPES: AINodeType[] = ["seedream", "seedvr", "seedance", "elevenlabs", "lipsync"];

/**
 * Run a single node WITH its dependencies.
 * If the node depends on parent nodes that haven't run yet, it will run them first.
 * 
 * @param nodeId - The ID of the node to run
 * @param nodes - All nodes in the workflow
 * @param edges - All edges in the workflow
 * @param callbacks - Callbacks for status updates
 * @param workflowId - Optional workflow ID for tracking
 * @param updateNodeData - Callback to update node data in the store (for propagating outputs)
 */
export async function runNodeWithDependencies(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  callbacks: RunCallbacks = {},
  workflowId?: string,
  updateNodeData?: (nodeId: string, data: Record<string, unknown>) => void
): Promise<void> {
  const targetNode = nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    console.error(`[runNodeWithDependencies] Node ${nodeId} not found`);
    return;
  }

  console.log(`[runNodeWithDependencies] Starting execution for node ${nodeId} (${targetNode.type})`);

  // Find all upstream dependencies
  const upstreamNodes = getUpstreamNodes(nodeId, nodes, edges);
  console.log(`[runNodeWithDependencies] Found ${upstreamNodes.length} upstream dependencies:`, 
    upstreamNodes.map(n => `${n.id} (${n.type})`));

  // SMART CHANGE DETECTION:
  // A node needs to run if:
  // 1. It has no output yet, OR
  // 2. Its inputs/settings have changed since last run, OR
  // 3. Any of its upstream nodes have changed
  const nodesToRun = upstreamNodes.filter(n => {
    // No output - definitely needs to run
    if (!nodeHasOutput(n)) {
      console.log(`[runNodeWithDependencies] Node ${n.id} has no output - needs to run`);
      return true;
    }
    
    // Has output - check if inputs changed
    if (hasNodeInputsChanged(n, edges, nodes)) {
      console.log(`[runNodeWithDependencies] Node ${n.id} inputs changed - needs to re-run`);
      return true;
    }
    
    console.log(`[runNodeWithDependencies] Node ${n.id} unchanged - can use cached result`);
    return false;
  });
  
  // Also check if the TARGET node itself needs to run due to changes
  const targetNeedsRun = !nodeHasOutput(targetNode) || hasNodeInputsChanged(targetNode, edges, nodes);
  console.log(`[runNodeWithDependencies] Target node ${nodeId} needs run: ${targetNeedsRun}`);
  
  console.log(`[runNodeWithDependencies] ${nodesToRun.length} upstream nodes need to run:`,
    nodesToRun.map(n => `${n.id} (${n.type})`));

  // If there are dependencies to run, execute them first using runWorkflow logic
  if (nodesToRun.length > 0) {
    // Include the target node in the execution
    const allNodesToRun = [...nodesToRun, targetNode];
    const nodesToRunIds = new Set(allNodesToRun.map(n => n.id));
    
    // Include ALL upstream nodes (even those with output) for edge filtering
    // This ensures data flows from completed nodes to running nodes
    const allUpstreamIds = new Set([...upstreamNodes.map(n => n.id), targetNode.id]);
    
    // Filter edges to include:
    // 1. Edges between nodes we're running
    // 2. Edges FROM upstream nodes with output TO nodes we're running
    const relevantEdges = edges.filter(e => 
      (allUpstreamIds.has(e.source) && nodesToRunIds.has(e.target)) ||
      (nodesToRunIds.has(e.source) && nodesToRunIds.has(e.target))
    );

    console.log(`[runNodeWithDependencies] Running ${allNodesToRun.length} nodes in dependency order`);
    console.log(`[runNodeWithDependencies] allUpstreamIds:`, [...allUpstreamIds]);
    console.log(`[runNodeWithDependencies] nodesToRunIds:`, [...nodesToRunIds]);
    console.log(`[runNodeWithDependencies] relevantEdges:`, relevantEdges.map(e => `${e.source} -> ${e.target}`));
    console.log(`[runNodeWithDependencies] All input edges:`, edges.filter(e => e.target === nodeId).map(e => `${e.source} -> ${e.target}`));

    // Pre-populate outputs from upstream nodes that already have results
    // This ensures data flows from completed nodes to running nodes
    const prePopulatedOutputs: OutputByNode = new Map();
    for (const upstreamNode of upstreamNodes) {
      if (nodeHasOutput(upstreamNode)) {
        const data = upstreamNode.data as Record<string, unknown>;
        const result = data.result as string;
        const nodeType = upstreamNode.type;
        
        // Determine output type based on node type
        let outputEntry: AnyOut;
        if (nodeType === "seedream" || nodeType === "seedvr" || nodeType === "crop-image" || nodeType === "image-input") {
          outputEntry = { type: "image", image: { url: result } };
        } else if (nodeType === "seedance" || nodeType === "lipsync" || nodeType === "merge-videos" || nodeType === "merge-audio-video" || nodeType === "video-input") {
          outputEntry = { type: "video", video: { url: result } };
        } else if (nodeType === "elevenlabs" || nodeType === "extract-audio" || nodeType === "audio-input") {
          outputEntry = { type: "audio", audio: { url: result } };
        } else {
          outputEntry = { type: "text", text: result };
        }
        
        prePopulatedOutputs.set(upstreamNode.id, outputEntry);
        console.log(`[runWorkflowWithDependencies] Pre-populated output from ${upstreamNode.id} (${nodeType}): ${result.slice(0, 50)}...`);
      }
    }

    // CRITICAL FIX: Include ALL upstream nodes (including pre-populated ones) 
    // so buildNodeInput can find parent node data when looking up results
    const allNodesForInput = [...upstreamNodes, targetNode];
    
    // Run the subset of the workflow
    await runWorkflowSubset(
      allNodesToRun,
      relevantEdges,
      {
        onNodeStatus: (id, status, patch) => {
          callbacks.onNodeStatus?.(id, status, patch);
        },
        onNodeResult: (id, resultText, output) => {
          callbacks.onNodeResult?.(id, resultText, output);
          
          // Update the node data in the store so outputs propagate
          if (updateNodeData) {
            updateNodeData(id, { result: resultText, status: "completed" });
          }
        },
      },
      workflowId,
      prePopulatedOutputs,
      allNodesForInput // Pass ALL upstream nodes for input building
    );
  } else {
    // No upstream dependencies - check if target node itself needs to run
    if (!targetNeedsRun) {
      // Target node has result and inputs unchanged - skip execution
      console.log(`[runNodeWithDependencies] Target node ${nodeId} unchanged - skipping execution, using cached result`);
      
      // Still notify as "completed" with existing result
      const targetData = targetNode.data as Record<string, unknown>;
      if (targetData.result) {
        callbacks.onNodeStatus?.(nodeId, "completed", { result: targetData.result });
      }
      return;
    }
    
    // No dependencies needed, run the target node directly
    console.log(`[runNodeWithDependencies] No dependencies needed, running ${nodeId} directly`);
    await runSingleNode(nodeId, nodes, edges, callbacks, workflowId);
  }
}

/**
 * Run a subset of a workflow - used for running dependencies.
 * Similar to runWorkflow but operates on a subset of nodes.
 * @param prePopulatedOutputs - Optional pre-populated outputs from nodes that already completed
 * @param allNodesForInput - Optional array of ALL nodes (including pre-populated) for input building
 */
async function runWorkflowSubset(
  nodes: Node[],
  edges: Edge[],
  callbacks: RunCallbacks = {},
  workflowId?: string,
  prePopulatedOutputs?: OutputByNode,
  allNodesForInput?: Node[]
): Promise<void> {
  console.log("[runWorkflowSubset] Starting execution for", nodes.length, "nodes");
  console.log("[runWorkflowSubset] All nodes for input building:", allNodesForInput?.length || nodes.length);
  
  // Start with pre-populated outputs if provided (from upstream nodes that already have results)
  const outputs: OutputByNode = prePopulatedOutputs ? new Map(prePopulatedOutputs) : new Map();
  console.log("[runWorkflowSubset] Pre-populated outputs:", outputs.size);
  
  // CRITICAL: Get IDs of pre-populated nodes - these are already "completed"
  const prePopulatedNodeIds = prePopulatedOutputs ? new Set(prePopulatedOutputs.keys()) : new Set<string>();
  console.log("[runWorkflowSubset] Pre-populated node IDs:", [...prePopulatedNodeIds]);
  
  const allNodes = topoSort(nodes, edges);
  
  // CRITICAL: Use allNodesForInput for buildNodeInput if provided
  // This includes pre-populated upstream nodes so their data can be found
  const nodesForInputBuilding = allNodesForInput || allNodes;
  console.log("[runWorkflowSubset] Nodes for input building:", nodesForInputBuilding.map(n => `${n.id} (${n.type})`));
  
  // Build dependency graph - include pre-populated node IDs in the lookup
  const nodeById = new Map<string, Node>(allNodes.map(n => [n.id, n]));
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  
  for (const node of allNodes) {
    dependencies.set(node.id, new Set());
    dependents.set(node.id, new Set());
  }
  
  // Build dependencies - also count pre-populated nodes as valid sources
  for (const edge of edges) {
    const source = edge.source;
    const target = edge.target;
    
    // Include edge if target is in our nodes AND (source is in our nodes OR source has pre-populated output)
    const targetInNodes = nodeById.has(target);
    const sourceInNodes = nodeById.has(source);
    const sourceIsPrePopulated = prePopulatedNodeIds.has(source);
    
    if (targetInNodes && (sourceInNodes || sourceIsPrePopulated)) {
      dependencies.get(target)!.add(source);
      if (sourceInNodes) {
        dependents.get(source)!.add(target);
      }
    }
  }
  
  // Initialize completed set with pre-populated node IDs
  // These nodes already have output and don't need to run
  const completed = new Set<string>(prePopulatedNodeIds);
  const failed = new Set<string>();
  const running = new Set<string>();
  
  console.log("[runWorkflowSubset] Initial completed set (pre-populated):", [...completed]);
  
  const getReadyNodes = (): Node[] => {
    const ready: Node[] = [];
    for (const node of allNodes) {
      if (completed.has(node.id) || failed.has(node.id) || running.has(node.id)) {
        continue;
      }
      const deps = dependencies.get(node.id)!;
      const allDepsComplete = [...deps].every(d => completed.has(d));
      const anyDepFailed = [...deps].some(d => failed.has(d));
      
      if (anyDepFailed) {
        failed.add(node.id);
        callbacks.onNodeStatus?.(node.id, "failed", { 
          error: "Dependency failed",
          progress: 0 
        });
        continue;
      }
      
      if (allDepsComplete) {
        ready.push(node);
      }
    }
    return ready;
  };
  
  // I/O node types that are passthrough (don't need execution)
  const IO_NODE_TYPES = ["image-input", "video-input", "audio-input", "comment"];
  
  const executeNode = async (node: Node): Promise<void> => {
    const type = node.type as AINodeType;
    const inputSchema = NodeInputSchemas[type] as z.ZodTypeAny;
    const outputSchema = NodeOutputSchemas[type] as z.ZodTypeAny;
    const data = (node.data ?? {}) as any;

    if (!inputSchema || !outputSchema) {
      callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
      failed.add(node.id);
      return;
    }

    // ==========================================================================
    // I/O NODE HANDLING - These are passthrough nodes
    // ==========================================================================
    if (IO_NODE_TYPES.includes(type)) {
      console.log(`[runWorkflowSubset] I/O node ${node.id} (${type}) - passthrough handling`);
      
      // Input nodes: use their result/value as output
      if (type === "image-input" || type === "video-input" || type === "audio-input") {
        const result = data.result || data.value || data.url || data.file;
        const mediaType = type === "image-input" ? "image" : type === "video-input" ? "video" : "audio";
        
        if (result && typeof result === "string" && result.length > 0) {
          const passOutput: AnyOut = mediaType === "image" 
            ? { type: "image", image: { url: result } }
            : mediaType === "video"
            ? { type: "video", video: { url: result } }
            : { type: "audio", audio: { url: result } };
          
          outputs.set(node.id, passOutput);
          completed.add(node.id);
          callbacks.onNodeResult?.(node.id, result, passOutput);
          callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
          return;
        } else {
          callbacks.onNodeStatus?.(node.id, "failed", { 
            error: `No file uploaded to input node (${mediaType})`,
            details: `Please upload a ${mediaType} file to the input node before running the workflow`
          });
          failed.add(node.id);
          return;
        }
      }
      

      
      // Comment node: just mark as completed
      if (type === "comment") {
        completed.add(node.id);
        callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
        return;
      }
    }

    // ==========================================================================
    // SKIP CHECK - Use existing output if skip is enabled
    // ==========================================================================
    if (data.skip === true) {
      const existingResult = data.result as string | undefined;
      const nodeName = data.label || NODE_DEFINITIONS[type]?.label || type;
      
      if (existingResult && typeof existingResult === "string" && existingResult.trim().length > 0) {
        // Node has output - use it instead of executing
        console.log(`[runWorkflowSubset] Node ${node.id} (${type}) SKIPPED - using existing output`);
        
        // Determine output type based on node type
        const outputType = NodePrimaryOutputType[type];
        let skipOutput: AnyOut;
        
        if (outputType === "text") {
          skipOutput = { type: "text", text: existingResult };
        } else if (outputType === "image") {
          skipOutput = { type: "image", image: { url: existingResult } };
        } else if (outputType === "video") {
          skipOutput = { type: "video", video: { url: existingResult } };
        } else {
          skipOutput = { type: "audio", audio: { url: existingResult } };
        }
        
        outputs.set(node.id, skipOutput);
        completed.add(node.id);
        
        callbacks.onNodeResult?.(node.id, existingResult, skipOutput);
        callbacks.onNodeStatus?.(node.id, "completed", {
          progress: 100,
          skipped: true,
        });
        return;
      } else {
        // Skip enabled but no output available - show warning and fail
        console.log(`[runWorkflowSubset] Node ${node.id} (${type}) SKIP FAILED - no existing output`);
        showSkipWarning(nodeName);
        callbacks.onNodeStatus?.(node.id, "failed", {
          error: "Skip enabled but no cached output available",
          skipped: true,
        });
        failed.add(node.id);
        return;
      }
    }

    running.add(node.id);
    callbacks.onNodeStatus?.(node.id, "running", { progress: 10 });

    // Compute input hash for change detection
    const inputHash = computeNodeInputHash(node, edges, nodesForInputBuilding);

    // CRITICAL: Use nodesForInputBuilding to include pre-populated upstream nodes
    const rawInput = buildNodeInput(node, edges, outputs, nodesForInputBuilding);
    console.log(`[runWorkflowSubset] Node ${node.id} (${type}) starting with input:`, JSON.stringify(rawInput).slice(0, 200));
    
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: parsed.error.issues.map((i) => i.message).join("; "),
        progress: 0,
      });
      running.delete(node.id);
      failed.add(node.id);
      return;
    }

    // Check cache (only if caching enabled)
    const useCache = (data as { useCache?: boolean }).useCache === true;
    let cacheHash: string | undefined;
    
    if (useCache) {
      try {
        const cacheCheck = await checkCache(type, parsed.data as Record<string, unknown>);
        cacheHash = cacheCheck.hash;
        
        if (cacheCheck.hit && cacheCheck.result) {
          console.log(`[runWorkflowSubset] Cache HIT for ${node.id} (${type})`);
          
          const cachedOut = cacheCheck.result as AnyOut;
          const validated = outputSchema.safeParse(cachedOut);
          
          if (validated.success) {
            running.delete(node.id);
            outputs.set(node.id, cachedOut);
            completed.add(node.id);
            
            const resultText =
              cachedOut.type === "text"
                ? cachedOut.text
                : cachedOut.type === "image"
                  ? cachedOut.image.url
                  : cachedOut.type === "video"
                    ? cachedOut.video.url
                    : cachedOut.audio.url;

            callbacks.onNodeResult?.(node.id, resultText, cachedOut);
            callbacks.onNodeStatus?.(node.id, "completed", {
              progress: 100,
              fromCache: true,
              _lastInputHash: inputHash,
            });
            return;
          }
        }
      } catch (error) {
        console.warn(`[runWorkflowSubset] Cache check failed for ${node.id}:`, error);
      }
    } else {
      console.log(`[runWorkflowSubset] Cache DISABLED for ${node.id} (${type}) - executing fresh`);
    }

    // Provider execution
    const nodeProvidersRaw = Array.isArray(data.providers) ? data.providers : undefined;
    const providers = (nodeProvidersRaw?.filter((p: unknown) => typeof p === "string" && p.trim()) as string[] | undefined)
      ?? (NodeProviders[type] as unknown as string[] | undefined)
      ?? ["fal"];

    const retryPerProvider =
      typeof data.retryPerProvider === "number" && Number.isFinite(data.retryPerProvider) && data.retryPerProvider > 0
        ? Math.floor(data.retryPerProvider)
        : 1;

    const timeoutMs =
      parseDurationMs(data.timeout) ??
      parseDurationMs(data.timeoutMs) ??
      parseDurationMs(data.nodeTimeout) ??
      NODE_TIMEOUT_MS[type] ??
      DEFAULT_NODE_TIMEOUT_MS;

    let lastError: string | undefined;
    let finalOut: AnyOut | undefined;
    let providerUsed: string | undefined;
    const attemptedProviders: string[] = [];

    for (const p of providers) {
      if (!providerIsConfigured(p as any)) continue;
      attemptedProviders.push(p);

      for (let attempt = 1; attempt <= retryPerProvider; attempt++) {
        callbacks.onNodeStatus?.(node.id, "running", {
          progress: 20 + (attempt * 10),
          providerTrying: p,
          providerAttempt: attempt,
        });

        try {
          const out = await withTimeout(
            executeWithProvider(type, p as any, parsed.data, {
              workflowId,
              nodeId: node.id,
              nodeLabel: data.label || NODE_DEFINITIONS[type]?.label || type,
            }),
            timeoutMs,
            `${type} (${p})`
          );
          const validated = outputSchema.safeParse(out);
          if (!validated.success) {
            throw new Error(`Output schema invalid: ${validated.error.issues.map((i) => i.message).join("; ")}`);
          }
          finalOut = validated.data as AnyOut;
          providerUsed = p;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          console.log(`[runWorkflowSubset] Node ${node.id} attempt ${attempt} failed: ${lastError}`);
        }
      }

      if (finalOut) break;
    }

    running.delete(node.id);

    if (!finalOut) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: lastError ?? "All providers failed",
        attemptedProviders,
        progress: 0,
      });
      failed.add(node.id);
      return;
    }

    outputs.set(node.id, finalOut);
    completed.add(node.id);
    
    const resultText =
      finalOut.type === "text"
        ? finalOut.text
        : finalOut.type === "image"
          ? finalOut.image.url
          : finalOut.type === "video"
            ? finalOut.video.url
            : finalOut.audio.url;

    // Cache result (only if caching enabled)
    if (useCache && cacheHash) {
      try {
        await cacheResult(cacheHash, type, finalOut as Record<string, unknown>);
      } catch (error) {
        console.warn(`[runWorkflowSubset] Failed to cache result for ${node.id}:`, error);
      }
    }

    callbacks.onNodeResult?.(node.id, resultText, finalOut);
    callbacks.onNodeStatus?.(node.id, "completed", {
      progress: 100,
      providerUsed,
      attemptedProviders,
      _lastInputHash: inputHash,
    });
  };
  
  // Mark all nodes as queued
  for (const node of allNodes) {
    const type = node.type as AINodeType;
    if (!NodeInputSchemas[type] || !NodeOutputSchemas[type]) {
      callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
      failed.add(node.id);
      continue;
    }
    callbacks.onNodeStatus?.(node.id, "queued");
  }
  
  // Execute nodes sequentially for dependency runs (simpler and more predictable)
  while (completed.size + failed.size < allNodes.length) {
    const readyNodes = getReadyNodes();
    
    if (readyNodes.length === 0) {
      if (running.size === 0) {
        console.error("[runWorkflowSubset] No nodes ready and none running");
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    
    // Run one node at a time for dependency execution (sequential is safer)
    const nodeToRun = readyNodes[0];
    console.log(`[runWorkflowSubset] Running node: ${nodeToRun.id} (${nodeToRun.type})`);
    await executeNode(nodeToRun);
  }
  
  console.log(`[runWorkflowSubset] Completed: ${completed.size} succeeded, ${failed.size} failed`);
}

export async function runSingleNode(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  callbacks: RunCallbacks = {},
  workflowId?: string
): Promise<void> {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const type = node.type as AINodeType;
  const startTime = Date.now();
  const inputSchema = NodeInputSchemas[type] as z.ZodTypeAny | undefined;
  const outputSchema = NodeOutputSchemas[type] as z.ZodTypeAny | undefined;
  const data = (node.data ?? {}) as Record<string, unknown>;

  if (!inputSchema || !outputSchema) {
    callbacks.onNodeStatus?.(node.id, "failed", { error: `Missing schemas for node type: ${type}` });
    return;
  }

  // ==========================================================================
  // I/O NODE HANDLING - These are passthrough nodes
  // ==========================================================================
  const IO_NODE_TYPES = ["image-input", "video-input", "audio-input", "comment"];
  
  if (IO_NODE_TYPES.includes(type)) {
    console.log(`[runSingleNode] I/O node ${node.id} (${type}) - passthrough handling`);
    console.log(`[runSingleNode] I/O node data:`, JSON.stringify(data).slice(0, 500));
    
    // Input nodes: use their result/value as output
    if (type === "image-input" || type === "video-input" || type === "audio-input") {
      // Try multiple possible property names for the uploaded file
      const result = (data.result || data.value || data.url || data.file) as string | undefined;
      const mediaType = type === "image-input" ? "image" : type === "video-input" ? "video" : "audio";
      console.log(`[runSingleNode] Input node ${node.id} result:`, result ? `${String(result).slice(0, 100)}...` : 'undefined', `mediaType: ${mediaType}`);
      
      if (result && typeof result === "string" && result.length > 0) {
        const passOutput: AnyOut = mediaType === "image" 
          ? { type: "image", image: { url: result } }
          : mediaType === "video"
          ? { type: "video", video: { url: result } }
          : { type: "audio", audio: { url: result } };
        
        callbacks.onNodeResult?.(node.id, result, passOutput);
        callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
        console.log(`[runSingleNode] Input node ${node.id} completed with result`);
        return;
      } else {
        // No input file uploaded - provide more helpful error
        const dataKeys = Object.keys(data);
        console.error(`[runSingleNode] Input node ${node.id} has no file. Data keys:`, dataKeys);
        callbacks.onNodeStatus?.(node.id, "failed", { 
          error: `No file uploaded to input node (${mediaType})`,
          details: `Please upload a ${mediaType} file to the input node before running the workflow`
        });
        return;
      }
    }
    
    // Output and comment nodes - just mark as completed
    callbacks.onNodeStatus?.(node.id, "completed", { progress: 100 });
    return;
  }

  // ==========================================================================
  // SKIP CHECK - Use existing output if skip is enabled
  // ==========================================================================
  if (data.skip === true) {
    const existingResult = data.result as string | undefined;
    const nodeName = (data.label as string) || NODE_DEFINITIONS[type]?.label || type;
    
    if (existingResult && typeof existingResult === "string" && existingResult.trim().length > 0) {
      // Node has output - use it instead of executing
      console.log(`[runSingleNode] Node ${node.id} (${type}) SKIPPED - using existing output`);
      
      // Determine output type based on node type
      const outputType = NodePrimaryOutputType[type];
      let skipOutput: AnyOut;
      
      if (outputType === "text") {
        skipOutput = { type: "text", text: existingResult };
      } else if (outputType === "image") {
        skipOutput = { type: "image", image: { url: existingResult } };
      } else if (outputType === "video") {
        skipOutput = { type: "video", video: { url: existingResult } };
      } else {
        skipOutput = { type: "audio", audio: { url: existingResult } };
      }
      
      callbacks.onNodeResult?.(node.id, existingResult, skipOutput);
      callbacks.onNodeStatus?.(node.id, "completed", {
        progress: 100,
        skipped: true,
      });
      return;
    } else {
      // Skip enabled but no output available - show warning and fail
      console.log(`[runSingleNode] Node ${node.id} (${type}) SKIP FAILED - no existing output`);
      showSkipWarning(nodeName);
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: "Skip enabled but no cached output available",
        skipped: true,
      });
      return;
    }
  }

  callbacks.onNodeStatus?.(node.id, "queued");
  callbacks.onNodeStatus?.(node.id, "running", { progress: 10 });

  // Compute input hash BEFORE execution for change detection on re-runs
  const inputHash = computeNodeInputHash(node, edges, nodes);
  console.log(`[runSingleNode] Input hash for ${nodeId}: ${inputHash}`);

  // Build input the same way full workflow runs do, so media inputs like
  // `inputImage` become schema fields like `{ image: { url } }`.
  const rawInput = buildNodeInput(node, edges, new Map(), nodes);

  // For "run node", also allow a context fallback from connected node output previews.
  const preview = getConnectedPreviewFromLastOutputs(nodes, edges, node.id);
  if (!(rawInput as any)?.context && preview) {
    (rawInput as any).context = preview;
  }

  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    callbacks.onNodeStatus?.(node.id, "failed", {
      error: parsed.error.issues.map((i) => i.message).join("; "),
      progress: 0,
    });
    return;
  }

  // Debug: Log parsed data for crop-image
  if (type === "crop-image") {
    const parsedData = parsed.data as Record<string, unknown>;
    console.log(`[runSingleNode:crop-image] PARSED.DATA:`, JSON.stringify({
      xPercent: parsedData.xPercent,
      yPercent: parsedData.yPercent,
      widthPercent: parsedData.widthPercent,
      heightPercent: parsedData.heightPercent,
    }));
  }

  // Check cache for identical inputs (skip re-execution if cached)
  const useCache = (node.data as { useCache?: boolean } | undefined)?.useCache === true;
  let cacheHash: string | undefined;
  
  if (useCache) {
    try {
      const cacheCheck = await checkCache(type, parsed.data as Record<string, unknown>);
      cacheHash = cacheCheck.hash;
      
      if (cacheCheck.hit && cacheCheck.result) {
        console.log(`[runSingleNode] Cache HIT for ${type} - skipping execution`);
        
        const cachedOut = cacheCheck.result as AnyOut;
        const validated = outputSchema.safeParse(cachedOut);
        
        if (validated.success) {
          const resultText =
            cachedOut.type === "text"
              ? cachedOut.text
              : cachedOut.type === "image"
                ? cachedOut.image.url
                : cachedOut.type === "video"
                  ? cachedOut.video.url
                  : cachedOut.audio.url;

          callbacks.onNodeResult?.(node.id, resultText, cachedOut);
          callbacks.onNodeStatus?.(node.id, "completed", {
            progress: 100,
            fromCache: true,
            _lastInputHash: inputHash, // Save hash for change detection
          });
          return;
        }
      }
    } catch (error) {
      console.warn("[runSingleNode] Cache check failed, proceeding with execution:", error);
    }
  } else {
    console.log(`[runSingleNode] Cache DISABLED for ${type} - executing fresh`);
  }

  // For async nodes (fal.ai), use the API which tracks via Trigger.dev
  if (ASYNC_NODE_TYPES.includes(type)) {
    const nodeData = (node.data ?? {}) as Record<string, unknown>;
    try {
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: type,
          input: { ...(parsed.data as Record<string, unknown>), nodeId }, // Include nodeId so polling can match
          workflowId, // Link to workflow for Activity tab filtering
          nodeId, // React Flow node ID
          nodeLabel: nodeData.label || NODE_DEFINITIONS[type]?.label || type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const responseData = await response.json();
      
      // The node is now running via Trigger.dev - polling will update status
      callbacks.onNodeStatus?.(node.id, "running", {
        progress: 25,
        providerUsed: "fal",
        triggerRunId: responseData.triggerRunId,
        nodeExecutionId: responseData.nodeExecutionId,
      });

      // Don't wait here - the polling in page.tsx will handle status updates
      console.log(`[runSingleNode] ${type} submitted to Trigger.dev: ${responseData.triggerRunId}`);
      return;
    } catch (error) {
      callbacks.onNodeStatus?.(node.id, "failed", {
        error: error instanceof Error ? error.message : String(error),
        progress: 0,
      });
      return;
    }
  }

  // For synchronous nodes (openrouter, merge-videos, etc.), run locally
  const nodeDataSync = (node.data ?? {}) as Record<string, unknown>;
  const nodeProvidersRaw = Array.isArray(nodeDataSync.providers) ? nodeDataSync.providers : undefined;
  const providers = (nodeProvidersRaw?.filter((p: unknown) => typeof p === "string" && p.trim()) as string[] | undefined)
    ?? (NodeProviders[type] as unknown as string[] | undefined)
    ?? ["mock"];

  const retryPerProvider =
    typeof nodeDataSync.retryPerProvider === "number" && Number.isFinite(nodeDataSync.retryPerProvider) && nodeDataSync.retryPerProvider > 0
      ? Math.floor(nodeDataSync.retryPerProvider)
      : 1;

  const timeoutMs =
    parseDurationMs(nodeDataSync.timeout) ??
    parseDurationMs(nodeDataSync.timeoutMs) ??
    parseDurationMs(nodeDataSync.nodeTimeout) ??
    NODE_TIMEOUT_MS[type] ??
    DEFAULT_NODE_TIMEOUT_MS;

  let lastError: string | undefined;
  let finalOut: AnyOut | undefined;
  let providerUsed: string | undefined;
  const attemptedProviders: string[] = [];

  for (const p of providers) {
    if (!providerIsConfigured(p as any)) continue;
    attemptedProviders.push(p);

    for (let attempt = 1; attempt <= retryPerProvider; attempt++) {
      callbacks.onNodeStatus?.(node.id, "running", {
        progress: 20,
        providerTrying: p,
        providerAttempt: attempt,
      });

      try {
        const out = await withTimeout(
          executeWithProvider(type, p as any, parsed.data, {
            workflowId,
            nodeId: node.id,
            nodeLabel: (nodeDataSync.label as string) || NODE_DEFINITIONS[type]?.label || type,
          }),
          timeoutMs,
          `${type} (${p})`
        );
        const validated = outputSchema.safeParse(out);
        if (!validated.success) {
          throw new Error(`Output schema invalid: ${validated.error.issues.map((i) => i.message).join("; ")}`);
        }
        finalOut = validated.data as AnyOut;
        providerUsed = p;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    if (finalOut) break;
  }

  if (!finalOut) {
    callbacks.onNodeStatus?.(node.id, "failed", {
      error: lastError ?? "All providers failed",
      attemptedProviders,
      progress: 0,
    });
    return;
  }

  const resultText =
    finalOut.type === "text"
      ? finalOut.text
      : finalOut.type === "image"
        ? finalOut.image.url
        : finalOut.type === "video"
          ? finalOut.video.url
          : finalOut.audio.url;

  // Deduct credits and record execution for synchronous nodes (utility nodes)
  // Note: openrouter handles its own credit deduction in /api/nodes/llm/stream
  if (type !== "openrouter") {
    try {
      const creditCost = estimateNodeCost(type, parsed.data as Record<string, unknown>);
      const durationMs = Date.now() - startTime;
      const nodeLabel = (node.data as any)?.label || type;
      
      const response = await fetch("/api/nodes/deduct-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: type,
          creditCost,
          input: parsed.data,
          workflowId,
          nodeId: node.id,
          nodeLabel,
          durationMs,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[runSingleNode] Recorded ${type} execution, credits: ${creditCost}, execution: ${result.executionId}`);
      } else {
        console.warn(`[runSingleNode] Failed to record execution for ${type}`);
      }
    } catch (error) {
      console.warn(`[runSingleNode] Execution recording error for ${type}:`, error);
    }
  }

  // Cache successful result for future identical executions (only if caching enabled)
  if (useCache && cacheHash) {
    try {
      await cacheResult(cacheHash, type, finalOut as Record<string, unknown>);
    } catch (error) {
      console.warn("[runSingleNode] Failed to cache result:", error);
    }
  }

  callbacks.onNodeResult?.(node.id, resultText, finalOut);
  callbacks.onNodeStatus?.(node.id, "completed", {
    progress: 100,
    providerUsed,
    attemptedProviders,
    _lastInputHash: inputHash, // Save hash for change detection on re-runs
  });
}



