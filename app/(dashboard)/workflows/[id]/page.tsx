"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Plus,
  MousePointer2,
  Loader2,
  Check,
  Save,
  ChevronLeft,
  Layers,
  Activity,
  Target,
  GitBranch,
  Bug,
  LayoutGrid,
} from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { FlowCanvas } from "@/components/flow/flow-canvas";
import { NodeContextMenu } from "@/components/flow/node-context-menu";
import { NodeTypeModal } from "@/components/flow/node-type-modal";
import { NodePalette, ExecutionHistoryPanel, VersionHistoryPanel, ErrorInspectorPanel } from "@/components/flow";
import type { WorkflowError } from "@/components/flow";
import { WorkflowSidebar } from "@/components/flow/workflow-sidebar";
import { useFlowStore } from "@/store";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { RunModal } from "@/components/flow/run-modal";
import { NodeProviders } from "@/lib/workflow/node-schemas";
import { trpc } from "@/lib/trpc/react";
import { estimateNodeCost } from "@/lib/credits";
import { useWorkflowStream, type WorkflowStreamCallbacks } from "@/hooks";

// Sanitize node data for storage - removes large base64 content
function sanitizeNodesForStorage(nodes: unknown[]): unknown[] {
  return nodes.map((node) => {
    const n = node as Record<string, unknown>;
    const data = (n.data ?? {}) as Record<string, unknown>;
    
    // Create sanitized data - remove large base64 content
    const sanitizedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip output fields that contain base64 data
      if (key === "outputVideo" || key === "outputAudio" || key === "outputImage" || 
          key === "croppedImage" || key === "mergedVideo" || key === "extractedAudio" ||
          key === "generatedImage" || key === "generatedVideo" || key === "generatedAudio") {
        continue;
      }
      
      // Skip result field (contains output data)
      if (key === "result") continue;
      
      // Skip status/progress (runtime state)
      if (key === "status" || key === "progress" || key === "error") continue;
      
      // Check for base64 strings
      if (typeof value === "string" && value.startsWith("data:") && value.length > 10000) {
        continue; // Skip large base64 data
      }
      
      // Check for objects with base64 url
      if (typeof value === "object" && value !== null && "url" in value) {
        const obj = value as { url?: string };
        if (typeof obj.url === "string" && obj.url.startsWith("data:") && obj.url.length > 10000) {
          continue; // Skip objects with large base64 URLs
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

// Keyboard shortcut component
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 rounded border border-zinc-600 text-zinc-400 font-mono">
      {children}
    </kbd>
  );
}

export default function WorkflowEditorPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const workflowId = params?.id ?? "unknown";
  const focusParam = searchParams?.get("focus");
  const { loadFlow, setNodes, nodes, edges, setEdges, viewport, isWorkflowRunning, setWorkflowRunning, setWorkflowId, focusNode, focusNodeId, selectedNode } = useFlowStore();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [workflowSidebarOpen, setWorkflowSidebarOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  
  // Fetch real credit balance from API with real-time updates
  const { data: creditsData, refetch: refetchCredits } = trpc.credits.getBalance.useQuery(undefined, {
    staleTime: 5_000, // Cache for 5 seconds
    refetchInterval: 10_000, // Auto-refetch every 10 seconds
  });
  const creditBalance = creditsData?.credits ?? 0;
  const [workflowName, setWorkflowName] = useState("My Workflow");
  const [dbWorkflowId, setDbWorkflowId] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [workflowErrors, setWorkflowErrors] = useState<WorkflowError[]>([]);
  
  // Keep refs to current state for polling (avoids stale closures)
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  
  const workflowErrorsRef = useRef(workflowErrors);
  useEffect(() => { workflowErrorsRef.current = workflowErrors; }, [workflowErrors]);
  
  const dbWorkflowIdRef = useRef(dbWorkflowId);
  useEffect(() => { dbWorkflowIdRef.current = dbWorkflowId; }, [dbWorkflowId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      
      const key = e.key.toLowerCase();
      
      switch (key) {
        case "n":
          e.preventDefault();
          e.stopPropagation();
          setPaletteOpen(prev => !prev);
          break;
        case "h":
          e.preventDefault();
          e.stopPropagation();
          setHistoryOpen(prev => !prev);
          break;
        case "v":
          e.preventDefault();
          e.stopPropagation();
          setVersionsOpen(prev => !prev);
          break;
        case "r":
          e.preventDefault();
          e.stopPropagation();
          if (!isWorkflowRunning) setIsRunModalOpen(true);
          break;
        case "w":
          e.preventDefault();
          e.stopPropagation();
          setWorkflowSidebarOpen(prev => !prev);
          break;
        case "t":
          e.preventDefault();
          e.stopPropagation();
          setWorkflowSidebarOpen(prev => !prev);
          break;
        case "e":
          e.preventDefault();
          e.stopPropagation();
          setErrorsOpen(prev => !prev);
          break;
        case "escape":
          setPaletteOpen(false);
          setHistoryOpen(false);
          setVersionsOpen(false);
          setWorkflowSidebarOpen(false);
          setErrorsOpen(false);
          setIsAddModalOpen(false);
          setIsRunModalOpen(false);
          break;
      }
    };

    // Use both window and document to ensure we catch the event
    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isWorkflowRunning, router]);

  // tRPC queries and mutations
  const utils = trpc.useUtils();
  
  const { data: workflowData } = trpc.workflow.get.useQuery(
    { id: workflowId },
    {
      enabled: workflowId !== "new" && workflowId !== "unknown",
      retry: false,
    }
  );

  const createMutation = trpc.workflow.create.useMutation({
    onSuccess: (data) => {
      if (data.workflow?.id) {
        setDbWorkflowId(data.workflow.id);
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      utils.workflow.list.invalidate();
    },
    onError: (error) => {
      console.error("Save failed:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  const updateMutation = trpc.workflow.update.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      utils.workflow.list.invalidate();
    },
    onError: (error) => {
      console.error("Save failed:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  const createExecutionMutation = trpc.execution.create.useMutation();
  const updateExecutionMutation = trpc.execution.updateStatus.useMutation();

  // Load existing workflow or start fresh
  useEffect(() => {
    if (workflowId === "new" || workflowId === "unknown") {
      loadFlow([], []);
      setWorkflowId(null);
      return;
    }

    if (workflowData?.workflow) {
      const workflow = workflowData.workflow;
      setDbWorkflowId(workflow.id);
      setWorkflowId(workflow.id); // Set in store for Activity tracking
      setWorkflowName(workflow.name);
      loadFlow(
        (workflow.nodesJson as unknown[]) || [],
        (workflow.edgesJson as unknown[]) || []
      );
    }
  }, [workflowId, workflowData, loadFlow, setWorkflowId]);

  // Handle focus parameter from URL (e.g., when navigating from executions page)
  useEffect(() => {
    if (focusParam && nodes.length > 0) {
      // Small delay to ensure the canvas is ready
      const timer = setTimeout(() => {
        focusNode(focusParam);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [focusParam, nodes.length, focusNode]);

  // Watch for node errors in the flow store
  useEffect(() => {
    const errorNodes = nodes.filter((n) => {
      const data = n.data as Record<string, unknown>;
      return data?.status === "failed" && data?.error;
    });

    errorNodes.forEach((node) => {
      const data = node.data as Record<string, unknown>;
      const errorMessage = data.error as string;
      const errorDetails = data.errorDetails as {
        provider?: string;
        executionId?: string;
        triggerRunId?: string;
        duration?: number;
        inputs?: Record<string, unknown>;
      } | undefined;
      
      const errorId = `${node.id}-${errorMessage}`;
      
      // Check if this error already exists
      const exists = workflowErrors.some((e) => e.id === errorId || 
        (e.nodeId === node.id && e.message === errorMessage));
      
      if (!exists) {
        const nodeDef = NODE_DEFINITIONS[node.type as AINodeType];
        const newError: WorkflowError = {
          id: errorId,
          nodeId: node.id,
          nodeName: (data.label as string) ?? nodeDef?.label ?? node.type ?? "Unknown Node",
          nodeType: node.type ?? "unknown",
          severity: "critical",
          message: errorMessage,
          timestamp: new Date(),
          canRetry: true,
          // Enhanced error details
          provider: errorDetails?.provider ?? (data.providerTrying as string) ?? undefined,
          executionId: errorDetails?.executionId,
          triggerRunId: errorDetails?.triggerRunId,
          duration: errorDetails?.duration,
          inputs: errorDetails?.inputs ?? (data.prompt ? { prompt: data.prompt } : undefined),
          details: nodeDef?.provider ? `Model: ${nodeDef.provider}` : undefined,
        };
        
        setWorkflowErrors((prev) => {
          // Double-check to avoid duplicates in concurrent updates
          if (prev.some((e) => e.id === errorId)) return prev;
          return [newError, ...prev];
        });
        setErrorsOpen(true);
      }
    });
  }, [nodes, workflowErrors]);

  // Poll for latest execution status using the same API as execution history
  useEffect(() => {
    if (!isWorkflowRunning) return;

    const pollStatus = async () => {
      try {
        // Use ref to get current nodes (avoids stale closures)
        const currentNodes = nodesRef.current;
        const currentNodeIds = new Set(currentNodes.map((n) => n.id));
        
        console.log("[Polling] Current flow nodeIds:", Array.from(currentNodeIds));
        
        // Also track node types for matching by type if ID doesn't match
        const nodesByType = new Map<string, string[]>();
        currentNodes.forEach((n) => {
          const type = n.type ?? "";
          if (!nodesByType.has(type)) nodesByType.set(type, []);
          nodesByType.get(type)!.push(n.id);
        });
        
        // Filter by workflowId to only show executions for this workflow
        const pollParams = new URLSearchParams();
        pollParams.set("limit", "10");
        if (dbWorkflowIdRef.current) {
          pollParams.set("workflowId", dbWorkflowIdRef.current);
        }
        const response = await fetch(`/api/trigger-runs?${pollParams.toString()}`);
        if (!response.ok) {
          console.log("[Polling] API response not ok:", response.status);
          return;
        }

        const data = await response.json();
        const executions = data.executions || [];
        
        console.log("[Polling] Got", executions.length, "executions");
        executions.slice(0, 3).forEach((exec: { nodeExecutions?: Array<{ nodeId: string; status: string }> }) => {
          const nes = exec.nodeExecutions || [];
          console.log("[Polling] Execution nodeIds:", nes.map(ne => `${ne.nodeId}:${ne.status}`));
        });

        // Find recent executions (within last 5 minutes) and try to match
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        for (const exec of executions) {
          const execTime = new Date(exec.startedAt || exec.createdAt).getTime();
          if (execTime < fiveMinutesAgo) continue; // Skip old executions
          
          const nodeExecutions = exec.nodeExecutions || [];
          if (nodeExecutions.length === 0) continue;
          
          // Try to match by nodeId first, then by nodeType
          const matchedUpdates: Array<{ flowNodeId: string; dbStatus: { status: string; error?: string; providerUsed?: string } }> = [];
          
          for (const ne of nodeExecutions as Array<{ nodeId: string; nodeType: string; status: string; error?: string; providerUsed?: string }>) {
            // Direct match by nodeId
            if (currentNodeIds.has(ne.nodeId)) {
              matchedUpdates.push({ flowNodeId: ne.nodeId, dbStatus: ne });
            } 
            // Match by nodeType if no direct match (for older executions)
            else if (nodesByType.has(ne.nodeType)) {
              const possibleNodes = nodesByType.get(ne.nodeType)!;
              // Use the first node of this type that's still "running"
              for (const flowNodeId of possibleNodes) {
                const flowNode = currentNodes.find((n) => n.id === flowNodeId);
                const flowStatus = (flowNode?.data as Record<string, unknown>)?.status;
                if (flowStatus === "running" || flowStatus === "queued") {
                  matchedUpdates.push({ flowNodeId, dbStatus: ne });
                  break;
                }
              }
            }
          }

          if (matchedUpdates.length > 0) {
            console.log("[Polling] Found matching executions:", matchedUpdates.map(m => `${m.flowNodeId}: ${m.dbStatus.status}`));
            
            setNodes((prev) =>
              prev.map((n) => {
                const match = matchedUpdates.find((m) => m.flowNodeId === n.id);
                if (!match) return n;
                
                const dbStatus = match.dbStatus;
                const currentData = n.data as Record<string, unknown>;
                const currentStatus = currentData.status as string | undefined;

                // Map database status to local status format
                const rawStatus = dbStatus.status?.toUpperCase?.() ?? "PENDING";
                let newStatus: string;
                switch (rawStatus) {
                  case "COMPLETED":
                    newStatus = "completed";
                    break;
                  case "FAILED":
                    newStatus = "failed";
                    break;
                  case "RUNNING":
                  case "WAITING":
                    newStatus = "running";
                    break;
                  case "QUEUED":
                  case "PENDING":
                    newStatus = "queued";
                    break;
                  default:
                    newStatus = currentStatus ?? "queued";
                }

                // Only update if status or error changed
                if (currentStatus === newStatus && currentData.error === dbStatus.error) return n;

                console.log(`[Polling] Updating node ${n.id}: ${currentStatus} → ${newStatus}`);
                
                return {
                  ...n,
                  data: {
                    ...currentData,
                    status: newStatus,
                    error: dbStatus.error ?? currentData.error,
                    providerUsed: dbStatus.providerUsed ?? currentData.providerUsed,
                  },
                };
              })
            );

            // Check if all matched nodes are complete
            const allDone = matchedUpdates.every(
              (m) => {
                const s = m.dbStatus.status?.toUpperCase?.();
                return s === "COMPLETED" || s === "FAILED";
              }
            );
            
            // Check if any node just completed (for real-time balance update)
            const anyCompleted = matchedUpdates.some(
              (m) => m.dbStatus.status?.toUpperCase?.() === "COMPLETED"
            );
            if (anyCompleted) {
              // Refetch credits after each node completes
              void refetchCredits();
            }
            
            if (allDone) {
              console.log("[Polling] All matched nodes done, stopping polling");
              setWorkflowRunning(false);
            }

            // Collect errors
            matchedUpdates
              .filter((m) => m.dbStatus.status?.toUpperCase?.() === "FAILED" && m.dbStatus.error)
              .forEach((m) => {
                const ne = m.dbStatus as { status: string; error: string; providerUsed?: string };
                const flowNode = currentNodes.find((n) => n.id === m.flowNodeId);
                const exists = workflowErrorsRef.current.some(
                  (e) => e.nodeId === m.flowNodeId && e.message === ne.error
                );
                if (!exists) {
                  const newError: WorkflowError = {
                    id: `api-${m.flowNodeId}-${Date.now()}`,
                    nodeId: m.flowNodeId,
                    nodeName: (flowNode?.data as Record<string, unknown>)?.label as string ?? flowNode?.type ?? "Node",
                    nodeType: flowNode?.type ?? "unknown",
                    severity: "critical",
                    message: ne.error,
                    details: ne.providerUsed ? `Provider: ${ne.providerUsed}` : undefined,
                    timestamp: new Date(),
                    canRetry: true,
                  };
                  setWorkflowErrors((prev) => [newError, ...prev]);
                  setErrorsOpen(true);
                }
              });

            break; // Found matching execution, stop looking
          }
        }
      } catch (error) {
        console.error("Failed to poll execution status:", error);
      }
    };

    // Poll immediately and then every 2 seconds
    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
    // Only re-create interval when isWorkflowRunning changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkflowRunning]);

  // Fetch errors from database for this workflow
  const { data: dbErrorsData } = trpc.execution.getErrors.useQuery(
    { workflowId: dbWorkflowId ?? "", limit: 50 },
    {
      enabled: Boolean(dbWorkflowId) && errorsOpen,
      refetchInterval: errorsOpen ? 5000 : false, // Poll every 5s when panel is open
    }
  );

  // Merge database errors with local errors
  useEffect(() => {
    if (dbErrorsData?.errors) {
      const dbErrors: WorkflowError[] = dbErrorsData.errors.map((e) => ({
        id: `db-${e.id}`,
        nodeId: e.nodeId,
        nodeName: e.nodeName,
        nodeType: e.nodeType,
        severity: "critical" as const,
        message: e.message,
        details: e.providerUsed ? `Provider: ${e.providerUsed}` : undefined,
        timestamp: new Date(e.timestamp),
        inputs: e.inputs ?? undefined,
        canRetry: true,
      }));

      // Add database errors that don't already exist
      setWorkflowErrors((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newErrors = dbErrors.filter((e) => !existingIds.has(e.id));
        if (newErrors.length === 0) return prev;
        return [...newErrors, ...prev].sort((a, b) => 
          b.timestamp.getTime() - a.timestamp.getTime()
        );
      });
    }
  }, [dbErrorsData]);

  // Save workflow to database (manual only)
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    
    // Sanitize nodes to remove large base64 content before saving
    const sanitizedNodes = sanitizeNodesForStorage(nodes as unknown[]);
    
    const workflowData = {
      name: workflowName,
      nodesJson: sanitizedNodes,
      edgesJson: edges as unknown[],
      viewportJson: viewport,
    };

    if (dbWorkflowId) {
      // Update existing workflow
      updateMutation.mutate({
        id: dbWorkflowId,
        ...workflowData,
      });
    } else {
      // Create new workflow
      createMutation.mutate(workflowData);
    }
  }, [nodes, edges, viewport, workflowName, dbWorkflowId, updateMutation, createMutation]);

  const handleAddNode = useCallback((nodeType: AINodeType) => {
    const nodeDef = NODE_DEFINITIONS[nodeType];
    if (!nodeDef) return;

    // Calculate position for new node
    const baseX = 250 + nodes.length * 100;
    const baseY = 200 + (nodes.length % 2) * 100;

    const newNode = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position: { x: baseX, y: baseY },
      data: {
        label: nodeDef.label,
        description: nodeDef.description,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      },
    };

    setNodes([...nodes, newNode]);
    setIsAddModalOpen(false);
  }, [nodes, setNodes]);

  const runNodesEstimate = useCallback(() => {
    return nodes.map((n) => {
      const def = NODE_DEFINITIONS[n.type as AINodeType];
      const providers = NodeProviders[n.type as AINodeType] ?? ["mock"];
      const primary = def?.provider ?? "Unknown";
      const fallbacks = providers.slice(1).map((p) => p.toUpperCase());
      const nodeData = (n.data ?? {}) as Record<string, unknown>;

      // Use dynamic cost estimation based on node input data
      const dynamicCost = estimateNodeCost(n.type as string, nodeData);

      return {
        id: n.id,
        label: (nodeData.label as string) ?? def?.label ?? n.type,
        type: n.type as string,
        estimatedCost: dynamicCost,
        provider: primary,
        fallbackProviders: fallbacks.length ? fallbacks : undefined,
      };
    });
  }, [nodes]);

  // SSE workflow stream callbacks
  const streamCallbacks: WorkflowStreamCallbacks = useMemo(() => ({
    onWorkflowStarted: ({ workflowExecutionId: id, estimatedCost }) => {
      console.log(`[SSE] Workflow started: ${id}, estimated cost: ${estimatedCost}`);
    },
    onNodeQueued: (nodeId, nodeType) => {
      console.log(`[SSE] Node queued: ${nodeId} (${nodeType})`);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...(n.data as Record<string, unknown>), status: "queued", progress: 0 } }
            : n
        )
      );
    },
    onNodeStarted: (nodeId, nodeType) => {
      console.log(`[SSE] Node started: ${nodeId} (${nodeType})`);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...(n.data as Record<string, unknown>), status: "running", progress: 25 } }
            : n
        )
      );
    },
    onNodeProgress: (nodeId, progress) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...(n.data as Record<string, unknown>), progress } }
            : n
        )
      );
    },
    onNodeCompleted: (nodeId, nodeType, output) => {
      console.log(`[SSE] Node completed: ${nodeId} (${nodeType})`, output);
      
      // Update node status and store output preview
      const outputData = output as { 
        type?: string; 
        text?: string; 
        image?: { url: string }; 
        video?: { url: string }; 
        audio?: { url: string };
      };
      
      // Extract result text (for text nodes) or URL (for media nodes)
      // Note: Large base64 data is sanitized server-side, so we may get placeholders
      let resultPreview = "";
      if (outputData?.type === "text" && outputData.text) {
        // For text outputs, check if it's not a truncation placeholder
        if (!outputData.text.startsWith("[base64-data:") && !outputData.text.includes("[truncated:")) {
          resultPreview = outputData.text;
        }
      } else {
        // For media, get the URL (which should be a real URL, not base64)
        resultPreview = outputData?.image?.url || outputData?.video?.url || outputData?.audio?.url || "";
        // Skip if it's a sanitized placeholder
        if (resultPreview.startsWith("[base64-data:")) {
          resultPreview = "";
        }
      }
      
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { 
                ...n, 
                data: { 
                  ...(n.data as Record<string, unknown>), 
                  status: "completed", 
                  progress: 100,
                  // Store the output type for display purposes
                  outputType: outputData?.type,
                } 
              }
            : n
        )
      );
      
      // Propagate text results for connected nodes (only for text outputs)
      // Node-to-node data propagation happens server-side, but we update UI here
      if (resultPreview && outputData?.type === "text") {
        const { updateNode } = useFlowStore.getState();
        updateNode(nodeId, { result: resultPreview });
      }
      
      // Refetch credits after each node completes
      void refetchCredits();
    },
    onNodeFailed: (nodeId, nodeType, error) => {
      console.log(`[SSE] Node failed: ${nodeId} (${nodeType}): ${error}`);
      
      // Update node status
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...(n.data as Record<string, unknown>), status: "failed", error, progress: 0 } }
            : n
        )
      );
      
      // Add to error list
      const node = nodes.find(n => n.id === nodeId);
      const nodeDef = NODE_DEFINITIONS[node?.type as AINodeType];
      const nodeData = node?.data as Record<string, unknown>;
      
      const newError: WorkflowError = {
        id: `${nodeId}-${Date.now()}`,
        nodeId,
        nodeName: (nodeData?.label as string) ?? nodeDef?.label ?? node?.type ?? "Unknown Node",
        nodeType: node?.type ?? "unknown",
        severity: "critical",
        message: error,
        timestamp: new Date(),
        inputs: nodeData,
        canRetry: true,
      };
      
      setWorkflowErrors(prev => [newError, ...prev]);
      setErrorsOpen(true);
    },
    onWorkflowCompleted: ({ successCount, failCount, status }) => {
      console.log(`[SSE] Workflow completed: ${successCount} succeeded, ${failCount} failed, status: ${status}`);
      setWorkflowRunning(false);
      void refetchCredits();
    },
    onError: (message) => {
      console.error(`[SSE] Error: ${message}`);
      
      const newError: WorkflowError = {
        id: `workflow-${Date.now()}`,
        nodeId: "workflow",
        nodeName: "Workflow Execution",
        nodeType: "workflow",
        severity: "critical",
        message,
        timestamp: new Date(),
        canRetry: true,
      };
      setWorkflowErrors(prev => [newError, ...prev]);
      setErrorsOpen(true);
      setWorkflowRunning(false);
    },
  }), [nodes, setNodes, refetchCredits, setWorkflowRunning]);

  // SSE workflow stream hook
  const { runWorkflow: runWorkflowSSE, isRunning: isSSERunning } = useWorkflowStream({
    workflowId: dbWorkflowId ?? workflowId,
    callbacks: streamCallbacks,
  });

  const handleRunWorkflow = useCallback(async () => {
    // Calculate estimated cost using dynamic estimation
    const estimatedCost = nodes.reduce((sum, n) => {
      const nodeData = (n.data ?? {}) as Record<string, unknown>;
      return sum + estimateNodeCost(n.type as string, nodeData);
    }, 0);
    
    // Check if user has enough credits
    if (creditBalance < estimatedCost) {
      const newError: WorkflowError = {
        id: `credits-${Date.now()}`,
        nodeId: "workflow",
        nodeName: "Insufficient Credits",
        nodeType: "credits",
        severity: "critical",
        message: `You need ${estimatedCost.toLocaleString()} credits but only have ${creditBalance.toLocaleString()}. Please add more credits to run this workflow.`,
        timestamp: new Date(),
        canRetry: false,
      };
      setWorkflowErrors(prev => [newError, ...prev]);
      setErrorsOpen(true);
      return;
    }
    
    setWorkflowRunning(true);
    
    // Save workflow first if not saved
    if (!dbWorkflowId) {
      await handleSave();
    }
    
    // Reset statuses
    setNodes(
      nodes.map((n) => ({
        ...n,
        data: {
          ...(n.data as Record<string, unknown>),
          status: "queued",
          progress: 0,
          error: undefined,
        },
      }))
    );

    // Use SSE streaming for real-time updates
    // The SSE stream will handle all status updates and completion
    await runWorkflowSSE(
      nodes as Parameters<typeof runWorkflowSSE>[0], 
      edges as Parameters<typeof runWorkflowSSE>[1]
    );
  }, [edges, nodes, setNodes, setWorkflowRunning, dbWorkflowId, handleSave, creditBalance, runWorkflowSSE]);

  // Calculate dynamic button color based on selected node
  const selectedNodeDef = selectedNode ? NODE_DEFINITIONS[selectedNode.type as AINodeType] : null;
  const activeColor = selectedNodeDef?.color ?? "blue";
  
  const buttonGradient = {
    blue: "from-blue-600 via-blue-500 to-blue-600",
    emerald: "from-emerald-600 via-emerald-500 to-emerald-600",
    violet: "from-violet-600 via-violet-500 to-violet-600",
    amber: "from-amber-600 via-amber-500 to-amber-600",
    zinc: "from-zinc-600 via-zinc-500 to-zinc-600",
  }[activeColor] ?? "from-blue-600 via-blue-500 to-blue-600";

  return (
    <div className="h-full bg-[#101010]">
      <div className="relative h-full overflow-hidden">
        {/* Canvas */}
        <FlowCanvas className="h-full w-full" storageKey={`workflow:${workflowId}`} />

        {/* Focus Center Indicator - shows briefly when focusing on a node */}
        <AnimatePresence>
          {focusNodeId && (
            <motion.div
              initial={{ opacity: 0, scale: 1.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 pointer-events-none z-30 flex items-center justify-center"
            >
              <div className="relative">
                {/* Crosshair */}
                <Target className="w-10 h-10 text-white/40" strokeWidth={1.5} />
                {/* Pulse ring */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border border-white/20 animate-ping" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Node Palette Sidebar */}
        {paletteOpen && (
          <div className="fixed left-3 top-16 bottom-3 z-40">
            <NodePalette onClose={() => setPaletteOpen(false)} />
          </div>
        )}

        {/* Top Left: Studio Menu + Workflow Name */}
        <div className="fixed top-3 left-3 z-50 flex items-center gap-3">
          {/* Studio Menu Button */}
          <button
            onClick={() => setWorkflowSidebarOpen(true)}
            className="group flex items-center gap-2 px-3 py-1.5 bg-zinc-950/90 hover:bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all shadow-lg shadow-black/20"
          >
            <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">Your Space</span>
          </button>

          {/* Workflow Name Input */}
          <div className="flex items-center bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-xl px-3 py-1.5 shadow-lg shadow-black/20 group focus-within:border-zinc-700 transition-colors">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="w-48 text-sm font-medium text-zinc-200 bg-transparent border-none focus:outline-none placeholder-zinc-600"
              placeholder="Workflow Name"
            />
          </div>
        </div>

        {/* Top Right: Credits + Versions */}
        <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
          {/* Credit Balance Display */}
          <a
            href="/billing"
            className="flex items-center gap-2 bg-zinc-950/90 border border-zinc-800 rounded-xl px-3 py-1.5 hover:border-zinc-700 hover:bg-zinc-900/90 transition-colors group"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-inner">
              <span className="text-[10px] text-amber-950 font-bold">$</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-zinc-100 tabular-nums leading-none">
                {creditsData?.formatted ?? "..."}
              </span>
              <span className="text-[10px] text-zinc-500 leading-none">credits</span>
            </div>
          </a>

          {/* Versions Button */}
          <div className="flex items-center gap-2 bg-zinc-950/90 border border-zinc-800 rounded-xl px-2 py-1.5">
            <button
              onClick={() => setVersionsOpen((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                versionsOpen 
                  ? "text-blue-400 bg-blue-500/10" 
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
              title="Version History (V)"
            >
              <GitBranch className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workflow Sidebar */}
        <WorkflowSidebar
          isOpen={workflowSidebarOpen}
          onClose={() => setWorkflowSidebarOpen(false)}
          currentWorkflowId={dbWorkflowId ?? workflowId}
        />

        {/* Bottom Center: Floating Actions Bar - Sleek Dark Theme with Blue Accents */}
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="relative group"
          >
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-zinc-600/10 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
            
            {/* Main bar */}
            <div className="relative flex items-center gap-0.5 bg-gradient-to-b from-zinc-800/95 to-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl px-1.5 py-1.5 shadow-2xl shadow-black/50">
              {/* Subtle inner glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent via-zinc-700/5 to-zinc-600/10 pointer-events-none" />
              
              {/* Nodes toggle */}
              <div className="relative">
                <motion.button
                  onClick={() => setPaletteOpen((v) => !v)}
                  onMouseEnter={() => setHoveredAction("nodes")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                    paletteOpen 
                      ? "text-blue-400" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Layers className="w-4 h-4 relative z-10" />
                  {paletteOpen && (
                    <>
                      {/* Blue glow behind */}
                      <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md" />
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl border border-blue-500/30"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    </>
                  )}
                </motion.button>
                
                {/* Tooltip with shortcut */}
                <AnimatePresence>
                  {hoveredAction === "nodes" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-700 whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-300">Nodes</span>
                        <Kbd>N</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 rotate-45 border-r border-b border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

                  {/* Add node */}
              <div className="relative">
                <motion.button
                  onClick={() => setIsAddModalOpen(true)}
                  onMouseEnter={() => setHoveredAction("add")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "add" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-700 whitespace-nowrap"
                    >
                      <span className="text-xs text-zinc-300">Add Node</span>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 rotate-45 border-r border-b border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Activity toggle */}
              <div className="relative">
                <motion.button
                  onClick={() => setHistoryOpen((v) => !v)}
                  onMouseEnter={() => setHoveredAction("history")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                    historyOpen 
                      ? "text-blue-400" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Activity className="w-4 h-4 relative z-10" />
                  {historyOpen && (
                    <>
                      {/* Blue glow behind */}
                      <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md" />
                      <motion.div
                        layoutId="activeIndicator2"
                        className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl border border-blue-500/30"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    </>
                  )}
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "history" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-700 whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-300">Activity</span>
                        <Kbd>H</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 rotate-45 border-r border-b border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Errors toggle */}
              <div className="relative">
                <motion.button
                  onClick={() => setErrorsOpen((v) => !v)}
                  onMouseEnter={() => setHoveredAction("errors")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                    errorsOpen 
                      ? "text-red-400" 
                      : workflowErrors.length > 0
                        ? "text-red-400 hover:bg-white/5"
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Bug className="w-4 h-4 relative z-10" />
                  {workflowErrors.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                      {workflowErrors.length > 9 ? "9+" : workflowErrors.length}
                    </span>
                  )}
                  {errorsOpen && (
                    <>
                      {/* Red glow behind */}
                      <div className="absolute inset-0 bg-red-500/20 rounded-xl blur-md" />
                      <motion.div
                        layoutId="activeIndicator4"
                        className="absolute inset-0 bg-gradient-to-br from-red-500/30 to-red-600/20 rounded-xl border border-red-500/30"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    </>
                  )}
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "errors" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-700 whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-300">Diagnostics</span>
                        <Kbd>E</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 rotate-45 border-r border-b border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-zinc-600/50 to-transparent mx-1" />

              {/* Save */}
              <div className="relative">
                <motion.button
                  onClick={handleSave}
                  onMouseEnter={() => setHoveredAction("save")}
                  onMouseLeave={() => setHoveredAction(null)}
                  disabled={saveStatus === "saving"}
                  whileTap={{ scale: 0.95 }}
                  className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-200 disabled:opacity-50"
                >
                  {saveStatus === "saving" ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  ) : saveStatus === "saved" ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "save" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-700 whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-300">
                          {saveStatus === "saved" ? "Saved!" : "Save"}
                        </span>
                        <Kbd>S</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 rotate-45 border-r border-b border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-zinc-600/50 to-transparent mx-1" />

              {/* Run button - Blue glowing gradient */}
              <div className="relative group/runwrap">
                {/* Outer glow */}
                <div className={`absolute -inset-1 bg-gradient-to-r ${buttonGradient} rounded-xl blur-lg opacity-40 group-hover/runwrap:opacity-70 transition-opacity`} />
                
                <motion.button
                  onClick={() => !isWorkflowRunning && setIsRunModalOpen(true)}
                  onMouseEnter={() => setHoveredAction("run")}
                  onMouseLeave={() => setHoveredAction(null)}
                  disabled={isWorkflowRunning}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.02 }}
                  className="relative flex items-center gap-2 px-4 py-2 rounded-xl overflow-hidden disabled:opacity-60 group/run"
                >
                  {/* Button gradient background - blue */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${buttonGradient} bg-[length:200%_100%] group-hover/run:animate-shimmer`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  
                  {/* Content */}
                  <div className="relative flex items-center gap-2">
                    {isWorkflowRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Play className="w-4 h-4 text-white" />
                    )}
                    <span className="text-sm font-semibold text-white tracking-wide">
                      {isWorkflowRunning ? "Executing" : "Execute"}
                    </span>
                  </div>
                  
                  {/* Shine effect */}
                  <div className="absolute inset-0 opacity-0 group-hover/run:opacity-100 transition-opacity">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/run:translate-x-full transition-transform duration-700" />
                  </div>
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "run" && !isWorkflowRunning && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-700 whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-300">Execute</span>
                        <Kbd>R</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 rotate-45 border-r border-b border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Floating context menu near selected node */}
        <NodeContextMenu />

        {/* Activity Panel (right side) - use dbWorkflowId for database filtering */}
        <ExecutionHistoryPanel 
          workflowId={dbWorkflowId ?? workflowId} 
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onNodeClick={(nodeId) => focusNode(nodeId)}
          offsetRight={errorsOpen ? 412 : 0}
        />

        {/* Version History Panel */}
        <VersionHistoryPanel
          workflowId={dbWorkflowId ?? workflowId}
          isOpen={versionsOpen}
          onClose={() => setVersionsOpen(false)}
          onRestore={(nodesJson, edgesJson, viewportJson) => {
            loadFlow(nodesJson, edgesJson);
            // Reload the page data
            window.location.reload();
          }}
        />

        {/* Diagnostics Panel */}
        <ErrorInspectorPanel
          isOpen={errorsOpen}
          onClose={() => setErrorsOpen(false)}
          errors={workflowErrors}
          onClearErrors={() => setWorkflowErrors([])}
          onRetryNode={(nodeId) => {
            // Focus on the node and user can re-run
            focusNode(nodeId);
            setErrorsOpen(false);
          }}
          onNodeClick={(nodeId) => {
            focusNode(nodeId);
            setErrorsOpen(false);
          }}
        />

        {/* Hint when has nodes but few - positioned above the floating bar */}
        {nodes.length > 0 && nodes.length < 3 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 pointer-events-none z-40"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <MousePointer2 className="w-3.5 h-3.5 text-zinc-500" />
              <p className="text-[11px] text-zinc-500">
                Drag from handle to add connected nodes
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Add Node Modal */}
      <NodeTypeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelect={handleAddNode}
        intent="add"
      />

      <RunModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        onRun={handleRunWorkflow}
        workflowName={workflowName}
        nodes={runNodesEstimate()}
        creditBalance={creditBalance}
      />
    </div>
  );
}
