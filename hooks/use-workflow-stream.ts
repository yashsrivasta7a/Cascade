import { useCallback, useRef, useState } from "react";
import type { Node, Edge } from "reactflow";

// =============================================================================
// WORKFLOW STREAM HOOK - Real-time execution via SSE
// =============================================================================

// Sanitize nodes before sending to API - removes large base64 data
function sanitizeNodesForRequest(nodes: Node[]): Node[] {
  const isHttpUrl = (url: string) => url.startsWith("http://") || url.startsWith("https://");
  
  return nodes.map((node) => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip runtime state that shouldn't be sent
      if (key === "status" || key === "progress" || key === "error") {
        continue;
      }
      
      // Handle string values - keep HTTP URLs, truncate large base64
      if (typeof value === "string") {
        if (isHttpUrl(value)) {
          sanitized[key] = value;
        } else if (value.startsWith("data:") && value.length > 50000) {
          // Skip large base64 data (>50KB) - it will be fetched from source nodes
          continue;
        } else {
          sanitized[key] = value;
        }
        continue;
      }
      
      // Handle objects with url property
      if (typeof value === "object" && value !== null && "url" in value) {
        const obj = value as { url?: string };
        if (typeof obj.url === "string") {
          if (obj.url.startsWith("data:") && obj.url.length > 50000) {
            continue; // Skip objects with large base64 URLs
          }
        }
      }
      
      sanitized[key] = value;
    }
    
    return { ...node, data: sanitized };
  });
}

export type NodeStatus = "queued" | "running" | "completed" | "failed";

export interface NodeStatusUpdate {
  nodeId: string;
  status: NodeStatus;
  nodeType?: string;
  output?: unknown;
  error?: string;
  progress?: number;
}

export interface WorkflowStreamCallbacks {
  onWorkflowStarted?: (data: { workflowExecutionId: string; estimatedCost: number }) => void;
  onNodeQueued?: (nodeId: string, nodeType: string) => void;
  onNodeStarted?: (nodeId: string, nodeType: string) => void;
  onNodeProgress?: (nodeId: string, progress: number) => void;
  onNodeCompleted?: (nodeId: string, nodeType: string, output: unknown) => void;
  onNodeFailed?: (nodeId: string, nodeType: string, error: string) => void;
  onWorkflowCompleted?: (data: { successCount: number; failCount: number; status: string }) => void;
  onError?: (error: string) => void;
}

export interface UseWorkflowStreamOptions {
  workflowId: string;
  callbacks?: WorkflowStreamCallbacks;
}

export function useWorkflowStream({ workflowId, callbacks }: UseWorkflowStreamOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatusUpdate>>(new Map());
  const [workflowExecutionId, setWorkflowExecutionId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateNodeStatus = useCallback((nodeId: string, update: Partial<NodeStatusUpdate>) => {
    setNodeStatuses(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(nodeId) || { nodeId, status: "queued" as NodeStatus };
      newMap.set(nodeId, { ...existing, ...update });
      return newMap;
    });
  }, []);

  const runWorkflow = useCallback(async (nodes: Node[], edges: Edge[]) => {
    if (isRunning) {
      console.warn("[useWorkflowStream] Workflow already running");
      return;
    }

    // Reset state
    setIsRunning(true);
    setNodeStatuses(new Map());
    setWorkflowExecutionId(null);

    // Create abort controller for cleanup
    abortControllerRef.current = new AbortController();

    try {
      // Sanitize nodes to remove large base64 data before sending
      const sanitizedNodes = sanitizeNodesForRequest(nodes);
      
      const response = await fetch("/api/workflow/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, nodes: sanitizedNodes, edges }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log("[useWorkflowStream] Stream ended");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        let currentEvent = "";
        let currentData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6);
          } else if (line === "" && currentEvent && currentData) {
            // End of event, process it
            try {
              const data = JSON.parse(currentData);
              processEvent(currentEvent, data);
            } catch (e) {
              console.error("[useWorkflowStream] Failed to parse event data:", e);
            }
            currentEvent = "";
            currentData = "";
          }
        }
      }

    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.log("[useWorkflowStream] Stream aborted");
      } else {
        console.error("[useWorkflowStream] Error:", error);
        callbacks?.onError?.(error instanceof Error ? error.message : "Unknown error");
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }

    function processEvent(event: string, data: unknown) {
      console.log(`[useWorkflowStream] Event: ${event}`, data);

      switch (event) {
        case "workflow-started": {
          const { workflowExecutionId: id, estimatedCost } = data as { 
            workflowExecutionId: string; 
            estimatedCost: number;
          };
          setWorkflowExecutionId(id);
          callbacks?.onWorkflowStarted?.({ workflowExecutionId: id, estimatedCost });
          break;
        }

        case "node-queued": {
          const { nodeId, nodeType } = data as { nodeId: string; nodeType: string };
          updateNodeStatus(nodeId, { status: "queued", nodeType });
          callbacks?.onNodeQueued?.(nodeId, nodeType);
          break;
        }

        case "node-started": {
          const { nodeId, nodeType } = data as { nodeId: string; nodeType: string };
          updateNodeStatus(nodeId, { status: "running", nodeType });
          callbacks?.onNodeStarted?.(nodeId, nodeType);
          break;
        }

        case "node-progress": {
          const { nodeId, progress } = data as { nodeId: string; progress: number };
          updateNodeStatus(nodeId, { progress });
          callbacks?.onNodeProgress?.(nodeId, progress);
          break;
        }

        case "node-completed": {
          const { nodeId, nodeType, output } = data as { 
            nodeId: string; 
            nodeType: string; 
            output: unknown;
          };
          updateNodeStatus(nodeId, { status: "completed", nodeType, output });
          callbacks?.onNodeCompleted?.(nodeId, nodeType, output);
          break;
        }

        case "node-failed": {
          const { nodeId, nodeType, error } = data as { 
            nodeId: string; 
            nodeType: string; 
            error: string;
          };
          updateNodeStatus(nodeId, { status: "failed", nodeType, error });
          callbacks?.onNodeFailed?.(nodeId, nodeType, error);
          break;
        }

        case "workflow-completed": {
          const { successCount, failCount, status } = data as { 
            successCount: number; 
            failCount: number; 
            status: string;
          };
          callbacks?.onWorkflowCompleted?.({ successCount, failCount, status });
          break;
        }

        case "error": {
          const { message } = data as { message: string };
          callbacks?.onError?.(message);
          break;
        }

        default:
          console.warn(`[useWorkflowStream] Unknown event: ${event}`);
      }
    }
  }, [workflowId, isRunning, callbacks, updateNodeStatus]);

  const cancelWorkflow = useCallback(async () => {
    // Abort the SSE stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Cancel on the server side (including Trigger.dev runs)
    if (workflowExecutionId) {
      try {
        const response = await fetch(`/api/executions/${workflowExecutionId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "workflow" }),
        });
        
        if (!response.ok) {
          console.error("[useWorkflowStream] Failed to cancel on server");
        } else {
          console.log("[useWorkflowStream] Workflow cancelled on server");
        }
      } catch (error) {
        console.error("[useWorkflowStream] Error cancelling workflow:", error);
      }
    }
    
    setIsRunning(false);
  }, [workflowExecutionId]);

  const getNodeStatus = useCallback((nodeId: string): NodeStatusUpdate | undefined => {
    return nodeStatuses.get(nodeId);
  }, [nodeStatuses]);

  return {
    runWorkflow,
    cancelWorkflow,
    isRunning,
    nodeStatuses,
    getNodeStatus,
    workflowExecutionId,
  };
}
