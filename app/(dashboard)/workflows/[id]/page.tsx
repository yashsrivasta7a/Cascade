"use client";

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  MousePointer2,
  BoxSelect,
  Loader2,
  Check,
  Save,
  Layers,
  Activity,
  Target,
  LayoutGrid,
  Square,
  FolderOpen,
  Coins,
  Undo2,
  Redo2,
  MessageSquare,
  RotateCcw,
  Keyboard,
  ChevronLeft,
} from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { FlowCanvas } from "@/components/flow/flow-canvas";
import { NodeContextMenu } from "@/components/flow/node-context-menu";
import { NodeTypeModal } from "@/components/flow/node-type-modal";
import { NodePalette, ActivityPanel, AssetManagerPanel, CreditsPanel } from "@/components/flow";
import { KeyboardShortcutsModal } from "@/components/flow/keyboard-shortcuts-modal";
import type { WorkflowError } from "@/components/flow";
import { WorkflowSidebar } from "@/components/flow/workflow-sidebar";
import { useFlowStore } from "@/store";
import type { Node, Edge } from "reactflow";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { RunModal } from "@/components/flow/run-modal";
import { NodeProviders } from "@/lib/workflow/node-schemas";
import { trpc } from "@/lib/trpc/react";
import { estimateNodeCost } from "@/lib/credits";
import { useWorkflowStream, useRealtimeWorkflowV2, useWorkflowRealtimeSubscription, type WorkflowStreamCallbacks, type RealtimeWorkflowCallbacks, type WorkflowRealtimeCallbacks } from "@/hooks";
import { ThemeToggle } from "@/components/ui";
import { autoLayoutNodes } from "@/lib/workflow/auto-layout";
import { cn } from "@/lib/utils";
import { showInsufficientCredits, showDuplicateNameWarning } from "@/lib/toast";

// Fields that contain media URLs that should be persisted
const MEDIA_FIELDS = [
  "result", "outputVideo", "outputAudio", "outputImage",
  "croppedImage", "mergedVideo", "extractedAudio",
  "generatedImage", "generatedVideo", "generatedAudio",
  "inputVideo1", "inputVideo2", "inputImage", "inputAudio",
  "inputVideo", "inputFrame", "image", "video", "audio", "frame"
];

// Helper to check if a URL is a CDN/HTTP URL (not base64)
const isHttpUrl = (url: string) => url.startsWith("http://") || url.startsWith("https://");

// Upload base64 media to CDN and return HTTP URL
async function uploadMediaToCDN(dataUrl: string, type: "image" | "video" | "audio"): Promise<string | null> {
  try {
    const response = await fetch("/api/media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, type }),
    });
    
    if (!response.ok) {
      console.warn("[uploadMediaToCDN] Failed to upload media:", response.status);
      return null;
    }
    
    const result = await response.json();
    return result.url || null;
  } catch (error) {
    console.error("[uploadMediaToCDN] Error:", error);
    return null;
  }
}

// Detect media type from data URL
function getMediaTypeFromDataUrl(dataUrl: string): "image" | "video" | "audio" | null {
  if (dataUrl.startsWith("data:image/")) return "image";
  if (dataUrl.startsWith("data:video/")) return "video";
  if (dataUrl.startsWith("data:audio/")) return "audio";
  return null;
}

// Persist all base64 media in nodes to CDN before saving
async function persistMediaToCDN(nodes: unknown[]): Promise<unknown[]> {
  const persistedNodes = await Promise.all(
    nodes.map(async (node) => {
      const n = node as Record<string, unknown>;
      const data = (n.data ?? {}) as Record<string, unknown>;
      const updatedData: Record<string, unknown> = { ...data };
      let hasChanges = false;
      
      // Check each media field for base64 data that needs uploading
      for (const field of MEDIA_FIELDS) {
        const value = data[field];
        
        if (typeof value === "string" && value.startsWith("data:") && value.length > 5000) {
          // This is base64 data - upload to CDN
          const mediaType = getMediaTypeFromDataUrl(value);
          if (mediaType) {
            const httpUrl = await uploadMediaToCDN(value, mediaType);
            if (httpUrl) {
              updatedData[field] = httpUrl;
              hasChanges = true;
            }
          }
        }
      }
      
      return hasChanges ? { ...n, data: updatedData } : n;
    })
  );
  
  return persistedNodes;
}

// Sanitize node data for storage - removes large base64 content (after CDN upload)
function sanitizeNodesForStorage(nodes: unknown[]): unknown[] {
  return nodes.map((node) => {
    const n = node as Record<string, unknown>;
    const data = (n.data ?? {}) as Record<string, unknown>;
    
    // Create sanitized data - remove large base64 content but keep HTTP URLs
    const sanitizedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip runtime state
      if (key === "status" || key === "progress" || key === "error") continue;
      
      // Handle media fields - keep HTTP URLs, skip large base64
      if (MEDIA_FIELDS.includes(key)) {
        if (typeof value === "string") {
          if (isHttpUrl(value)) {
            sanitizedData[key] = value; // Keep HTTP URLs
            continue;
          }
          if (value.startsWith("data:") && value.length > 10000) {
            continue; // Skip large base64 (should have been uploaded)
          }
          // Keep small base64 (thumbnails etc)
          sanitizedData[key] = value;
          continue;
        }
        // Skip undefined/null
        if (value === undefined || value === null) continue;
      }
      
      // Check for base64 strings in any field
      if (typeof value === "string" && value.startsWith("data:") && value.length > 10000) {
        continue; // Skip large base64 data
      }
      
      // Check for objects with url property
      if (typeof value === "object" && value !== null && "url" in value) {
        const obj = value as { url?: string };
        if (typeof obj.url === "string") {
          if (obj.url.startsWith("data:") && obj.url.length > 10000) {
            continue; // Skip objects with large base64 URLs
          }
          // Keep objects with HTTP URLs or small base64
          sanitizedData[key] = value;
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

// Keyboard shortcut component
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 rounded border border-zinc-600 text-zinc-400 font-mono">
      {children}
    </kbd>
  );
}

// Inner component that uses useSearchParams (must be wrapped in Suspense)
function WorkflowEditorContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const workflowId = params?.id ?? "unknown";
  const focusParam = searchParams?.get("focus");
  const { loadFlow, setNodes, nodes, edges, setEdges, viewport, isWorkflowRunning, setWorkflowRunning, setWorkflowId, focusNode, focusNodeId, selectedNode, undo, redo, canUndo, canRedo, addNode, isAnyNodeUploading } = useFlowStore();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [assetManagerOpen, setAssetManagerOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [workflowSidebarOpen, setWorkflowSidebarOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [placingComment, setPlacingComment] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"pan" | "select">("pan");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  
  // Fetch real credit balance from API with real-time updates
  const { data: creditsData, refetch: refetchCredits } = trpc.credits.getBalance.useQuery(undefined, {
    staleTime: 5_000, // Cache for 5 seconds
    refetchInterval: 10_000, // Auto-refetch every 10 seconds
  });
  const creditBalance = creditsData?.credits ?? 0;
  const [workflowName, setWorkflowName] = useState("My Workflow");
  const [dbWorkflowId, setDbWorkflowId] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [workflowErrors, setWorkflowErrors] = useState<WorkflowError[]>([]);
  const [isNameTaken, setIsNameTaken] = useState(false);
  const [debouncedName, setDebouncedName] = useState("");
  
  // Debounce workflow name for duplicate checking
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedName(workflowName);
    }, 500);
    return () => clearTimeout(timer);
  }, [workflowName]);
  
  // Check if workflow name already exists (debounced)
  const { data: nameCheckData } = trpc.workflow.checkNameExists.useQuery(
    { name: debouncedName, excludeId: dbWorkflowId ?? undefined },
    {
      enabled: debouncedName.length > 0 && debouncedName !== "My Workflow",
    }
  );
  
  // Update isNameTaken state and show toast when name is taken
  useEffect(() => {
    const taken = nameCheckData?.exists ?? false;
    setIsNameTaken(taken);
    if (taken && debouncedName.length > 0) {
      showDuplicateNameWarning(debouncedName);
    }
  }, [nameCheckData?.exists, debouncedName]);
  
  // Ref for stop workflow function (used in keyboard handler)
  const stopWorkflowRef = useRef<(() => void) | null>(null);
  
  // Ref for save function (used in keyboard handler)
  const saveRef = useRef<(() => void) | null>(null);

  // Keyboard shortcuts (panel toggles only - canvas shortcuts are in FlowCanvas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      
      const key = e.key.toLowerCase();
      
      // Handle Ctrl/Cmd+S for save
      if ((e.ctrlKey || e.metaKey) && key === "s") {
        e.preventDefault();
        e.stopPropagation();
        saveRef.current?.();
        return;
      }
      
      // Don't intercept other modifier key combos (let FlowCanvas handle Ctrl+C, Ctrl+V, etc.)
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
      if (hasModifier) {
        return;
      }
      
      switch (key) {
        case "n":
          e.preventDefault();
          e.stopPropagation();
          setPaletteOpen(prev => !prev);
          break;
        case "h":
        case "e":
          e.preventDefault();
          e.stopPropagation();
          setActivityOpen(prev => !prev);
          break;
        case "a":
          e.preventDefault();
          e.stopPropagation();
          setAssetManagerOpen(prev => !prev);
          break;
        case "c":
          e.preventDefault();
          e.stopPropagation();
          setCreditsOpen(prev => !prev);
          break;
        case "r":
          e.preventDefault();
          e.stopPropagation();
          if (!isWorkflowRunning && !isFinalizing && !isAnyNodeUploading()) setIsRunModalOpen(true);
          break;
        case "w":
        case "t":
          e.preventDefault();
          e.stopPropagation();
          setWorkflowSidebarOpen(prev => !prev);
          break;
        case "g":
          e.preventDefault();
          e.stopPropagation();
          handleAutoLayout();
          break;
        case "s":
          e.preventDefault();
          e.stopPropagation();
          setShortcutsOpen(prev => !prev);
          break;
        case "escape":
          // If workflow is running (but not finalizing), stop it
          if (isWorkflowRunning && !isFinalizing) {
            e.preventDefault();
            e.stopPropagation();
            // We'll call handleStopWorkflow via a ref since this is in an effect
            stopWorkflowRef.current?.();
          } else if (!isFinalizing) {
            // Otherwise, close all panels and modals
            setPaletteOpen(false);
            setActivityOpen(false);
            setAssetManagerOpen(false);
            setCreditsOpen(false);
            setWorkflowSidebarOpen(false);
            setIsAddModalOpen(false);
            setIsRunModalOpen(false);
            setShortcutsOpen(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isWorkflowRunning, isFinalizing, router]);

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
        (workflow.nodesJson as unknown as Node[]) || [],
        (workflow.edgesJson as unknown as Edge[]) || []
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
        setActivityOpen(true);
      }
    });
  }, [nodes, workflowErrors]);

  // NOTE: Polling removed - using Trigger.dev realtime hooks instead
  // The useRealtimeWorkflow hook connects directly to Trigger.dev for real-time updates
  // This avoids Vercel's SSE buffering issues entirely

  // Fetch errors from database for this workflow (no polling - relies on realtime updates)
  const { data: dbErrorsData } = trpc.execution.getErrors.useQuery(
    { workflowId: dbWorkflowId ?? "", limit: 50 },
    {
      enabled: Boolean(dbWorkflowId) && activityOpen,
    }
  );

  // Merge database errors with local errors
  useEffect(() => {
    if (dbErrorsData?.errors) {
      const dbErrors: WorkflowError[] = dbErrorsData.errors.map((e: { id: string; nodeId: string; nodeName: string; nodeType: string; message: string; providerUsed?: string | null; timestamp: string; inputs?: Record<string, unknown> | null }) => ({
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
  // Returns the workflow ID after saving (for use in handleRunWorkflow)
  const handleSave = useCallback(async (): Promise<string | null> => {
    setSaveStatus("saving");

    try {
      // First, upload any base64 media to CDN (Transloadit)
      const persistedNodes = await persistMediaToCDN(nodes as unknown[]);
      
      // Update nodes in store with persisted URLs so they show after save
      const nodesWithUrls = persistedNodes as typeof nodes;
      setNodes(nodesWithUrls);
      
      // Then sanitize (removes any remaining large base64)
      const sanitizedNodes = sanitizeNodesForStorage(persistedNodes);

      const workflowData = {
        name: workflowName,
        nodesJson: sanitizedNodes,
        edgesJson: edges as unknown[],
        viewportJson: viewport,
      };

      if (dbWorkflowId) {
        // Update existing workflow
        await updateMutation.mutateAsync({
          id: dbWorkflowId,
          ...workflowData,
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
        return dbWorkflowId;
      } else {
        // Create new workflow - use mutateAsync to get the result
        const result = await createMutation.mutateAsync(workflowData);
        const newId = result.workflow?.id ?? null;
        if (newId) {
          setDbWorkflowId(newId);
        }
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
        return newId;
      }
    } catch (error) {
      console.error("[handleSave] Error saving workflow:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
      return null;
    }
  }, [nodes, edges, viewport, workflowName, dbWorkflowId, updateMutation, createMutation, setNodes]);

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
    // Only include connected nodes (nodes that are part of the workflow graph)
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    
    // If no edges, include all nodes; otherwise only connected ones
    const workflowNodes = edges.length === 0 
      ? nodes 
      : nodes.filter(n => connectedNodeIds.has(n.id));
    
    return workflowNodes.map((n) => {
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
  }, [nodes, edges]);

  // Ref to store markAsLocalRun function (set by useWorkflowRealtimeSubscription)
  const markAsLocalRunRef = useRef<((runId: string) => void) | null>(null);

  // Realtime workflow callbacks (using Trigger.dev React hooks - bypasses Vercel SSE buffering)
  const realtimeCallbacks: RealtimeWorkflowCallbacks = useMemo(() => ({
    onWorkflowStarted: ({ triggerRunId }) => {
      // Mark this run as locally triggered (so subscription doesn't treat it as external)
      markAsLocalRunRef.current?.(triggerRunId);
    },
    onNodeQueued: (nodeId) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...(n.data as Record<string, unknown>), status: "queued", progress: 0 } }
            : n
        )
      );
    },
    onNodeStarted: (nodeId) => {
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
      // Update node status and store output preview
      const outputData = output as { 
        type?: string; 
        text?: string; 
        image?: { url: string }; 
        video?: { url: string }; 
        audio?: { url: string };
      };
      
      // Extract result text (for text nodes) or URL (for media nodes)
      let resultPreview = "";
      let mediaUrl = "";
      
      if (outputData?.type === "text" && outputData.text) {
        // For text outputs, check if it's not a truncation placeholder
        if (!outputData.text.startsWith("[base64-data:") && !outputData.text.includes("[truncated:")) {
          resultPreview = outputData.text;
        }
      } else {
        // For media, get the URL (HTTP or base64)
        mediaUrl = outputData?.image?.url || outputData?.video?.url || outputData?.audio?.url || "";
        // Skip if it's a sanitized placeholder
        if (mediaUrl.startsWith("[base64-data:") || mediaUrl.startsWith("[base64:")) {
          mediaUrl = "";
        }
        resultPreview = mediaUrl;
      }
      
      // Use updateNode ONLY to both update the source node AND propagate to connected nodes
      // Don't use setNodes separately as that prevents change detection in updateNode
      const { updateNode, propagateOutput } = useFlowStore.getState();
      
      // Build the update data
      const updateData: Record<string, unknown> = {
        status: "completed",
        progress: 100,
        outputType: outputData?.type,
      };
      
      if (mediaUrl) {
        updateData.result = mediaUrl;
        // For input nodes, also set 'value' so the UI shows the preview
        // The InputNode component checks data.value to decide whether to show preview
        if (nodeType === "input" || nodeType?.includes("-input")) {
          updateData.value = mediaUrl;
        }
      } else if (resultPreview) {
        updateData.result = resultPreview;
        // For input nodes, also set 'value'
        if (nodeType === "input" || nodeType?.includes("-input")) {
          updateData.value = resultPreview;
        }
      }
      
      // Update the node - this will also trigger propagation via updateNode's logic
      updateNode(nodeId, updateData);
      
      // Also explicitly call propagateOutput to ensure downstream nodes get the output
      // This handles the result -> inputVideo1/inputVideo2 mapping correctly
      const resultUrl = mediaUrl || resultPreview;
      if (resultUrl) {
        // Small delay to ensure node update is complete before propagation
        setTimeout(() => {
          propagateOutput(nodeId, resultUrl);
        }, 10);
      }
      
      // Refetch credits after each node completes
      void refetchCredits();
    },
    onNodeFailed: (nodeId, _nodeType, error) => {
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
      setActivityOpen(true);
    },
    onWorkflowCompleted: async ({ workflowExecutionId }) => {
      // Set finalizing state - keeps the UI showing "running" until outputs are displayed
      setIsFinalizing(true);
      
      // FALLBACK: Fetch outputs from database for any nodes that didn't receive realtime events
      // This handles cases where SSE connection was interrupted (e.g., Fast Refresh, network issues)
      if (workflowExecutionId) {
        try {
          const response = await fetch(`/api/workflow-executions/${workflowExecutionId}`);
          if (response.ok) {
            const data = await response.json();
            const nodeExecutions = data.execution?.nodeExecutions || [];
            
            const { updateNode, propagateOutput, nodes: currentNodes } = useFlowStore.getState();
            let outputsApplied = 0;
            
            for (const ne of nodeExecutions) {
              if (ne.status === "COMPLETED" && ne.outputJson) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const outputData = ne.outputJson as Record<string, any>;
                
                // Check if this node already has output set (from SSE)
                // Use currentNodes from store to get the latest state
                const currentNode = currentNodes.find((n: { id: string }) => n.id === ne.nodeId);
                const currentData = (currentNode?.data as Record<string, unknown>) || {};
                
                // Skip if node already has a result (SSE event was received)
                if (currentData.result) {
                  continue;
                }
                
                // Extract media URL from output
                let mediaUrl = "";
                let resultPreview = "";
                
                if (outputData?.type === "text" && outputData?.text) {
                  resultPreview = String(outputData.text).slice(0, 100);
                } else {
                  mediaUrl = outputData?.image?.url || outputData?.video?.url || outputData?.audio?.url || "";
                  // Skip sanitized placeholders
                  if (mediaUrl.startsWith("[base64-data:") || mediaUrl.startsWith("[base64:")) {
                    mediaUrl = "";
                  }
                  resultPreview = mediaUrl;
                }
                
                if (mediaUrl || resultPreview) {
                  const updateData: Record<string, unknown> = {
                    status: "completed",
                    progress: 100,
                    outputType: outputData?.type,
                  };
                  
                  if (mediaUrl) {
                    updateData.result = mediaUrl;
                  } else if (resultPreview) {
                    updateData.result = resultPreview;
                  }
                  
                  updateNode(ne.nodeId, updateData);
                  outputsApplied++;
                  
                  // Also propagate to downstream nodes
                  const resultUrl = mediaUrl || resultPreview;
                  if (resultUrl) {
                    setTimeout(() => {
                      propagateOutput(ne.nodeId, resultUrl);
                    }, 10);
                  }
                }
              }
            }
            
            
            // Finalize ALL node statuses based on database - ensure no nodes stuck in queued/running
            const { setNodes: finalSetNodes } = useFlowStore.getState();
            const nodeStatusMap = new Map<string, string>();
            for (const ne of nodeExecutions) {
              nodeStatusMap.set(ne.nodeId, ne.status);
            }
            
            finalSetNodes((prevNodes) => 
              prevNodes.map((n) => {
                const nodeData = n.data as Record<string, unknown>;
                const dbStatus = nodeStatusMap.get(n.id);
                
                // If node is still showing queued/running but has a final status in DB, update it
                if ((nodeData.status === "queued" || nodeData.status === "running") && dbStatus) {
                  const finalStatus = dbStatus === "COMPLETED" ? "completed" 
                    : dbStatus === "FAILED" ? "failed" 
                    : "completed";
                  return { ...n, data: { ...nodeData, status: finalStatus, progress: 100 } };
                }
                return n;
              })
            );
          }
        } catch (err) {
          console.error(`[Realtime] Failed to fetch outputs from database:`, err);
        }
      }
      
      // Also finalize any remaining queued/running nodes that weren't in the database
      setNodes((prevNodes) => 
        prevNodes.map((n) => {
          const nodeData = n.data as Record<string, unknown>;
          if (nodeData.status === "queued" || nodeData.status === "running") {
            return { ...n, data: { ...nodeData, status: "completed", progress: 100 } };
          }
          return n;
        })
      );
      
      // Small delay to ensure React has time to render the outputs
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setIsFinalizing(false);
      setWorkflowRunning(false);
      void refetchCredits();
    },
    onError: (message) => {
      // Check if it's an insufficient credits error and show toast
      if (message.toLowerCase().includes("insufficient credits")) {
        // Parse credits from message if available (format: "Required: X, Available: Y")
        const match = message.match(/Required:\s*([\d,]+).*Available:\s*([\d,]+)/i);
        if (match) {
          const required = parseInt(match[1].replace(/,/g, ""), 10);
          const available = parseInt(match[2].replace(/,/g, ""), 10);
          showInsufficientCredits(required, available);
        } else {
          showInsufficientCredits();
        }
      }
      
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
      setActivityOpen(true);
      setWorkflowRunning(false);
    },
  }), [nodes, setNodes, refetchCredits, setWorkflowRunning, setIsFinalizing]);

  // Realtime workflow hook V2 - uses Trigger.dev Realtime API with metadata
  // Direct WebSocket connection to Trigger.dev, bypasses Vercel entirely
  const { 
    runWorkflow: runWorkflowRealtimeV2, 
    isRunning: isRealtimeV2Running, 
    cancelWorkflow: cancelWorkflowV2,
    RealtimeSubscriber,
  } = useRealtimeWorkflowV2(
    dbWorkflowId ?? workflowId,
    realtimeCallbacks
  );

  // Workflow-wide realtime subscription - sees ALL executions including from MCP
  // Uses useRealtimeRunsWithTag to subscribe to workflow tag without polling
  const workflowSubscriptionCallbacks: WorkflowRealtimeCallbacks = useMemo(() => ({
    onExecutionDiscovered: ({ triggerRunId, isExternal, nodes: executionNodes }) => {
      if (isExternal) {
        // External execution detected (from MCP or API) - set workflow as running
        console.log(`[WorkflowPage] External execution discovered: ${triggerRunId}, isExternal: ${isExternal}`);
        console.log(`[WorkflowPage] Execution nodes count: ${executionNodes?.length ?? 0}`);
        setWorkflowRunning(true);
        
        // Update input node values from the execution snapshot
        // This shows the input values that were passed via MCP/API in the UI
        if (executionNodes && executionNodes.length > 0) {
          // Extract value - handle both string and { url: string } formats
          // The trigger route sets media values as { url: "..." } but UI expects a string
          const extractValue = (val: unknown): string | null => {
            if (typeof val === "string") return val;
            if (val && typeof val === "object" && "url" in val) {
              return (val as { url: string }).url;
            }
            return null;
          };

          // Log execution nodes for debugging
          for (const en of executionNodes) {
            if (en.type === "input" || (en.data as Record<string, unknown>)?.nodeType === "input") {
              const enData = (en.data ?? {}) as Record<string, unknown>;
              console.log(`[WorkflowPage] Input node ${en.id}: value=${extractValue(enData.value)?.slice(0, 50)}...`);
            }
          }

          setNodes((prev) => {
            console.log(`[WorkflowPage] Updating ${prev.length} nodes with execution data`);
            return prev.map((node) => {
              // Find matching node in execution snapshot
              const executionNode = executionNodes.find((en) => en.id === node.id);
              if (!executionNode) return node;
              
              const executionData = (executionNode.data ?? {}) as Record<string, unknown>;
              const currentData = (node.data ?? {}) as Record<string, unknown>;
              
              // For input nodes, update with the execution values (value, result)
              if (node.type === "input" || currentData.nodeType === "input") {
                const updates: Record<string, unknown> = { ...currentData };
                
                // Copy value and result from execution (normalized to string)
                if (executionData.value !== undefined) {
                  const extractedValue = extractValue(executionData.value);
                  updates.value = extractedValue;
                  console.log(`[WorkflowPage] Setting ${node.id}.value = ${extractedValue?.slice(0, 50)}...`);
                }
                if (executionData.result !== undefined) {
                  updates.result = extractValue(executionData.result);
                }
                
                return { ...node, data: updates };
              }
              
              return node;
            });
          });
        }
      }
    },
    onNodeQueued: realtimeCallbacks.onNodeQueued,
    onNodeStarted: realtimeCallbacks.onNodeStarted,
    onNodeProgress: realtimeCallbacks.onNodeProgress,
    onNodeCompleted: realtimeCallbacks.onNodeCompleted,
    onNodeFailed: realtimeCallbacks.onNodeFailed,
    onWorkflowCompleted: (data) => {
      realtimeCallbacks.onWorkflowCompleted?.({
        ...data,
        workflowExecutionId: data.workflowExecutionId,
      });
    },
    onError: realtimeCallbacks.onError,
  }), [realtimeCallbacks, setWorkflowRunning]);

  const {
    isSubscribed: isWorkflowSubscribed,
    activeRunCount,
    markAsLocalRun,
    RunSubscribers: WorkflowRunSubscribers,
  } = useWorkflowRealtimeSubscription(
    dbWorkflowId ?? workflowId,
    workflowSubscriptionCallbacks
  );

  // Update the ref so realtimeCallbacks can use markAsLocalRun
  useEffect(() => {
    markAsLocalRunRef.current = markAsLocalRun;
  }, [markAsLocalRun]);
  
  // Cancel function (V2 only - no polling fallback)
  const cancelWorkflow = useCallback(async () => {
    await cancelWorkflowV2();
  }, [cancelWorkflowV2]);
  
  // Handle stop/cancel workflow
  const handleStopWorkflow = useCallback(async () => {
    await cancelWorkflow();
    setWorkflowRunning(false);

    // Update all running/queued nodes to cancelled status
    setNodes((prev) =>
      prev.map((n) => {
        const nodeData = n.data as Record<string, unknown>;
        if (nodeData.status === "running" || nodeData.status === "queued") {
          return { ...n, data: { ...nodeData, status: "cancelled" } };
        }
        return n;
      })
    );
  }, [cancelWorkflow, setWorkflowRunning, setNodes]);
  
  // Update refs for keyboard handler
  useEffect(() => {
    stopWorkflowRef.current = handleStopWorkflow;
  }, [handleStopWorkflow]);
  
  useEffect(() => {
    saveRef.current = handleSave;
  }, [handleSave]);

  const handleRunWorkflow = useCallback(async () => {
    // Only include connected nodes for cost calculation
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    const workflowNodes = edges.length === 0 
      ? nodes 
      : nodes.filter(n => connectedNodeIds.has(n.id));
    
    // Calculate estimated cost using dynamic estimation (only connected nodes)
    const estimatedCost = workflowNodes.reduce((sum, n) => {
      const nodeData = (n.data ?? {}) as Record<string, unknown>;
      return sum + estimateNodeCost(n.type as string, nodeData);
    }, 0);

    // Check if user has enough credits
    if (creditBalance < estimatedCost) {
      // Show toast notification for insufficient credits
      showInsufficientCredits(estimatedCost, creditBalance);
      
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
      setActivityOpen(true);
      return;
    }

    setWorkflowRunning(true);

    // Save workflow first if not saved, and get the workflow ID
    let effectiveWorkflowId = dbWorkflowId;
    if (!dbWorkflowId) {
      const savedId = await handleSave();
      if (!savedId) {
        // Save failed, abort run
        setWorkflowRunning(false);
        const newError: WorkflowError = {
          id: `save-${Date.now()}`,
          nodeId: "workflow",
          nodeName: "Save Failed",
          nodeType: "system",
          severity: "critical",
          message: "Failed to save workflow before running. Please try again.",
          timestamp: new Date(),
          canRetry: true,
        };
        setWorkflowErrors(prev => [newError, ...prev]);
        setActivityOpen(true);
        return;
      }
      effectiveWorkflowId = savedId;
    }

    // Reset statuses (only for connected nodes that will run)
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

    // Use Trigger.dev Realtime (V2) - direct WebSocket to Trigger.dev
    await runWorkflowRealtimeV2(
      nodes as Parameters<typeof runWorkflowRealtimeV2>[0], 
      edges as Parameters<typeof runWorkflowRealtimeV2>[1],
      effectiveWorkflowId ?? undefined
    );
  }, [edges, nodes, setNodes, setWorkflowRunning, dbWorkflowId, handleSave, creditBalance, runWorkflowRealtimeV2]);

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

  // Add a comment node at a specific position (called from FlowCanvas when clicking in placement mode)
  const handlePlaceComment = useCallback((position: { x: number; y: number }) => {
    const newNodeId = `comment-${Date.now()}`;
    // Random color index from 0-15 (16 color options)
    const randomColorIndex = Math.floor(Math.random() * 16);
    const newNode: Node = {
      id: newNodeId,
      type: "comment",
      position,
      data: {
        label: "Comment",
        text: "",
        width: 200,
        height: 100,
        colorIndex: randomColorIndex,
      },
    };
    addNode(newNode);
    setPlacingComment(false);
  }, [addNode]);

  // Toggle comment placement mode
  const handleToggleCommentMode = useCallback(() => {
    setPlacingComment((prev) => !prev);
  }, []);

  // Auto-arrange nodes in a left-to-right tree layout
  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    
    // Record history before layout for undo support
    const { recordHistory, triggerFitView } = useFlowStore.getState();
    recordHistory();
    
    // Apply auto-layout algorithm
    const layoutedNodes = autoLayoutNodes(nodes, edges);
    setNodes(layoutedNodes);
    
    // Trigger fit view to center on the workflow after layout
    setTimeout(() => triggerFitView(), 50);
  }, [nodes, edges, setNodes]);

  // Clear all node inputs and outputs (reset workflow data)
  const handleClearAll = useCallback(() => {
    setNodes(
      nodes.map((node) => {
        // Skip comment nodes - they don't have inputs/outputs
        if (node.type === "comment") return node;
        
        // Get the base data properties to keep (label, description, etc.)
        const data = node.data as Record<string, unknown>;
        return {
          ...node,
          data: {
            label: data.label,
            description: data.description,
            provider: data.provider,
            estimatedCost: data.estimatedCost,
            nodeType: data.nodeType,
            // Reset status
            status: "idle",
            progress: undefined,
            error: undefined,
            // Clear results/outputs
            result: undefined,
            actualCost: undefined,
          },
        };
      })
    );
  }, [nodes, setNodes]);

  return (
    <div className="h-full bg-gray-100 dark:bg-[#101010]">
      {/* Trigger.dev Realtime subscriber - renders null but activates WebSocket subscription */}
      {RealtimeSubscriber}
      {/* Workflow-wide realtime subscription - sees executions from MCP/API without polling */}
      {WorkflowRunSubscribers}
      <div className="relative h-full overflow-hidden">
        {/* Canvas */}
        <FlowCanvas 
          className="h-full w-full" 
          storageKey={`workflow:${workflowId}`} 
          placingComment={placingComment}
          onPlaceComment={handlePlaceComment}
          onCancelPlacement={() => setPlacingComment(false)}
          selectionMode={selectionMode}
          onSelectionModeChange={setSelectionMode}
        />

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
          {/* Back to Workflows Button */}
          <button
            onClick={() => setWorkflowSidebarOpen(true)}
            className="group flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 dark:bg-blue-500/10 hover:bg-blue-500/20 dark:hover:bg-blue-500/20 backdrop-blur-xl border border-blue-300 dark:border-blue-500/30 hover:border-blue-400 dark:hover:border-blue-500/50 rounded-xl transition-all shadow-lg shadow-blue-500/10 dark:shadow-blue-500/5"
          >
            <ChevronLeft className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">Workflows</span>
          </button>

          {/* Workflow Name Input */}
          <div className={cn(
            "flex items-center bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border rounded-xl px-3 py-1.5 shadow-lg shadow-gray-200/50 dark:shadow-black/20 group transition-colors",
            isNameTaken 
              ? "border-red-400 dark:border-red-500/50 focus-within:border-red-500 dark:focus-within:border-red-500" 
              : "border-gray-200 dark:border-zinc-800 focus-within:border-gray-300 dark:focus-within:border-zinc-700"
          )}>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className={cn(
                "w-48 text-sm font-medium bg-transparent border-none focus:outline-none placeholder-gray-400 dark:placeholder-zinc-600",
                isNameTaken ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-zinc-200"
              )}
              placeholder="Workflow Name"
            />
            {isNameTaken && (
              <span className="text-red-500 text-xs ml-1" title="This name is already taken">!</span>
            )}
          </div>
        </div>

        {/* Top Right: Credits + Versions + Theme */}
        <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
          {/* Theme Toggle */}
          <ThemeToggle size="sm" />
          
          {/* Credit Balance Display - Click to open Credits Panel */}
          <button
            onClick={() => setCreditsOpen((v) => !v)}
            className={`flex items-center gap-2 bg-white/90 dark:bg-zinc-950/90 border rounded-xl px-3 py-1.5 transition-colors group shadow-lg shadow-gray-200/50 dark:shadow-black/20 ${
              creditsOpen
                ? "border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10"
                : "border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 hover:bg-gray-50/90 dark:hover:bg-zinc-900/90"
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-inner ${
              creditsOpen ? "shadow-amber-500/30" : ""
            }`}>
              <span className="text-[10px] text-amber-950 font-bold">$</span>
            </div>
            <div className="flex flex-col">
              <span className={`text-xs font-semibold tabular-nums leading-none ${
                creditsOpen ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-zinc-100"
              }`}>
                {creditsData?.formatted ?? "..."}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-zinc-500 leading-none">credits</span>
            </div>
          </button>
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
            <div className="absolute inset-0 bg-gray-500/10 dark:bg-white/[0.03] rounded-2xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity" />
            
            {/* Main bar - Glass effect */}
            <div className="relative flex items-center gap-0.5 bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl backdrop-saturate-150 border border-gray-200 dark:border-white/[0.08] rounded-2xl px-1.5 py-1.5 shadow-xl shadow-gray-300/50 dark:shadow-2xl dark:shadow-black/40">
              {/* Glass inner highlight */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-gray-100/50 dark:from-white/[0.05] to-transparent pointer-events-none" />
              
              {/* ═══ GROUP 1: Canvas Tools ═══ */}
              
              {/* Nodes toggle */}
              <div className="relative">
                <motion.button
                  onClick={() => setPaletteOpen((v) => !v)}
                  onMouseEnter={() => setHoveredAction("nodes")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                    paletteOpen 
                      ? "text-blue-600 dark:text-blue-400" 
                      : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  <Layers className="w-4 h-4 relative z-10" />
                  {paletteOpen && (
                    <>
                      <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md" />
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl border border-blue-500/30"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    </>
                  )}
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "nodes" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-zinc-300">Nodes</span>
                        <Kbd>N</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Add Comment */}
              <div className="relative">
                <motion.button
                  onClick={handleToggleCommentMode}
                  onMouseEnter={() => setHoveredAction("comment")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                    placingComment 
                      ? "text-amber-600 dark:text-amber-400" 
                      : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  <MessageSquare className="w-4 h-4 relative z-10" />
                  {placingComment && (
                    <>
                      <div className="absolute inset-0 bg-amber-500/20 rounded-xl blur-md" />
                      <motion.div
                        layoutId="activeIndicatorComment"
                        className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-amber-600/20 rounded-xl border border-amber-500/30"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    </>
                  )}
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "comment" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <span className="text-xs text-gray-700 dark:text-zinc-300">
                        {placingComment ? "Click canvas to place" : "Add Comment"}
                      </span>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Keyboard Shortcuts */}
              <div className="relative">
                <motion.button
                  onClick={() => setShortcutsOpen(true)}
                  onMouseEnter={() => setHoveredAction("shortcuts")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className="p-2.5 rounded-xl text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200"
                >
                  <Keyboard className="w-4 h-4" />
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "shortcuts" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-zinc-300">Shortcuts</span>
                        <Kbd>S</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-300 dark:via-zinc-600/50 to-transparent mx-1" />

              {/* ═══ GROUP 2: Panels ═══ */}

              {/* Timeline toggle */}
              <div className="relative">
                <motion.button
                  onClick={() => setActivityOpen((v) => !v)}
                  onMouseEnter={() => setHoveredAction("activity")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                    activityOpen 
                      ? "text-blue-400" 
                      : workflowErrors.length > 0
                        ? "text-blue-400 hover:bg-white/5"
                        : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  <Activity className="w-4 h-4 relative z-10" />
                  {workflowErrors.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                      {workflowErrors.length > 9 ? "9+" : workflowErrors.length}
                    </span>
                  )}
                  {activityOpen && (
                    <>
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
                  {hoveredAction === "activity" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-zinc-300">Timeline</span>
                        <Kbd>H</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Asset Manager toggle */}
              <div className="relative">
                <motion.button
                  onClick={() => setAssetManagerOpen((v) => !v)}
                  onMouseEnter={() => setHoveredAction("assets")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                    assetManagerOpen 
                      ? "text-purple-400" 
                      : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  <FolderOpen className="w-4 h-4 relative z-10" />
                  {assetManagerOpen && (
                    <>
                      <div className="absolute inset-0 bg-purple-500/20 rounded-xl blur-md" />
                      <motion.div
                        layoutId="activeIndicator3"
                        className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-purple-600/20 rounded-xl border border-purple-500/30"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    </>
                  )}
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "assets" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-zinc-300">Assets</span>
                        <Kbd>A</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Credits toggle */}
              <div className="relative">
                <motion.button
                  onClick={() => setCreditsOpen((v) => !v)}
                  onMouseEnter={() => setHoveredAction("credits")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                    creditsOpen 
                      ? "text-amber-400" 
                      : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  <Coins className="w-4 h-4 relative z-10" />
                  {creditsOpen && (
                    <>
                      <div className="absolute inset-0 bg-amber-500/20 rounded-xl blur-md" />
                      <motion.div
                        layoutId="activeIndicator4"
                        className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-amber-600/20 rounded-xl border border-amber-500/30"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    </>
                  )}
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "credits" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-zinc-300">Credits</span>
                        <Kbd>C</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-300 dark:via-zinc-600/50 to-transparent mx-1" />

              {/* ═══ GROUP 3: Canvas Settings ═══ */}

              {/* Auto-Arrange button */}
              <div className="relative">
                <motion.button
                  onClick={handleAutoLayout}
                  onMouseEnter={() => setHoveredAction("layout")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-2.5 rounded-xl transition-all duration-200 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                >
                  <LayoutGrid className="w-4 h-4 relative z-10" />
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "layout" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-zinc-300">Auto-Arrange</span>
                        <Kbd>G</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Clear All */}
              <div className="relative">
                <motion.button
                  onClick={handleClearAll}
                  onMouseEnter={() => setHoveredAction("clear")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className="p-2.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
                >
                  <RotateCcw className="w-4 h-4" />
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "clear" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <span className="text-xs text-gray-700 dark:text-zinc-300">Clear All</span>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-300 dark:via-zinc-600/50 to-transparent mx-1" />

              {/* ═══ GROUP 4: History ═══ */}

              {/* Undo */}
              <div className="relative">
                <motion.button
                  onClick={() => canUndo() && undo()}
                  onMouseEnter={() => setHoveredAction("undo")}
                  onMouseLeave={() => setHoveredAction(null)}
                  disabled={!canUndo()}
                  whileTap={{ scale: canUndo() ? 0.95 : 1 }}
                  className={`p-2.5 rounded-xl transition-all duration-200 ${
                    canUndo()
                      ? "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                      : "text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <Undo2 className="w-4 h-4" />
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "undo" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-zinc-300">Undo</span>
                        <Kbd>Ctrl+Z</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Redo */}
              <div className="relative">
                <motion.button
                  onClick={() => canRedo() && redo()}
                  onMouseEnter={() => setHoveredAction("redo")}
                  onMouseLeave={() => setHoveredAction(null)}
                  disabled={!canRedo()}
                  whileTap={{ scale: canRedo() ? 0.95 : 1 }}
                  className={`p-2.5 rounded-xl transition-all duration-200 ${
                    canRedo()
                      ? "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                      : "text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <Redo2 className="w-4 h-4" />
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "redo" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-zinc-300">Redo</span>
                        <Kbd>Ctrl+Y</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-300 dark:via-zinc-600/50 to-transparent mx-1" />

              {/* ═══ GROUP 5: Actions ═══ */}

              {/* Save */}
              <div className="relative">
                <motion.button
                  onClick={handleSave}
                  onMouseEnter={() => setHoveredAction("save")}
                  onMouseLeave={() => setHoveredAction(null)}
                  disabled={saveStatus === "saving"}
                  whileTap={{ scale: 0.95 }}
                  className="p-2.5 rounded-xl text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200 disabled:opacity-50"
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
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-zinc-300">
                          {saveStatus === "saved" ? "Saved!" : "Save"}
                        </span>
                        <Kbd>Ctrl</Kbd>
                        <span className="text-xs text-gray-400 dark:text-zinc-600">+</span>
                        <Kbd>S</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-300 dark:via-zinc-600/50 to-transparent mx-1" />

              {/* Run/Stop button - use all running states for reliability */}
              {(() => {
                const isRunning = isWorkflowRunning || isRealtimeV2Running;
                const isUploading = isAnyNodeUploading();
                const isDisabled = isFinalizing || isUploading;
                return (
                  <div className="relative group/runwrap">
                    <motion.button
                      onClick={() => {
                        if (isDisabled) return;
                        if (isRunning) {
                          handleStopWorkflow();
                        } else {
                          setIsRunModalOpen(true);
                        }
                      }}
                      onMouseEnter={() => setHoveredAction("run")}
                      onMouseLeave={() => setHoveredAction(null)}
                      whileTap={{ scale: isDisabled ? 1 : 0.98 }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
                        isFinalizing 
                          ? "bg-amber-100 text-amber-600 border-2 border-amber-400 cursor-wait dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/50"
                          : isUploading
                            ? "bg-zinc-100 text-zinc-400 border-2 border-zinc-300 cursor-not-allowed dark:bg-zinc-800/50 dark:text-zinc-500 dark:border-zinc-700"
                            : isRunning 
                              ? "bg-red-100 hover:bg-red-200 text-red-600 border-2 border-red-400 hover:border-red-500 dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-400 dark:border-red-500/50 dark:hover:border-red-500/70"
                              : "bg-blue-100 hover:bg-blue-200 text-blue-600 border-2 border-blue-400 hover:border-blue-500 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 dark:text-blue-400 dark:border-blue-500/50 dark:hover:border-blue-500/70"
                      )}
                      disabled={isDisabled}
                    >
                      {isFinalizing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isRunning ? (
                        <Square className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      <span>
                        {isFinalizing ? "Finalizing..." : isUploading ? "Uploading..." : isRunning ? "Stop" : "Execute"}
                      </span>
                    </motion.button>
                    
                    <AnimatePresence>
                      {hoveredAction === "run" && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-700 dark:text-zinc-300">
                              {isFinalizing ? "Loading outputs..." : isUploading ? "Wait for uploads to finish" : isRunning ? "Stop" : "Execute"}
                            </span>
                            {!isUploading && <Kbd>{isFinalizing ? "..." : isRunning ? "Esc" : "R"}</Kbd>}
                          </div>
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        </div>

        {/* Floating context menu near selected node */}
        <NodeContextMenu />

        {/* Timeline Panel (runs + versions) */}
        <ActivityPanel 
          workflowId={dbWorkflowId ?? workflowId} 
          isOpen={activityOpen}
          onClose={() => setActivityOpen(false)}
          onNodeClick={(nodeId) => focusNode(nodeId)}
          errors={workflowErrors}
          onClearErrors={() => setWorkflowErrors([])}
          onRetryNode={(nodeId) => {
            focusNode(nodeId);
            setActivityOpen(false);
          }}
          onVersionRestore={(nodesJson, edgesJson, viewportJson) => {
            loadFlow(nodesJson as Node[], edgesJson as Edge[]);
            window.location.reload();
          }}
        />

        {/* Asset Manager Panel */}
        <AssetManagerPanel
          isOpen={assetManagerOpen}
          onClose={() => setAssetManagerOpen(false)}
          onNodeClick={(nodeId) => focusNode(nodeId)}
        />

        {/* Credits Panel */}
        <CreditsPanel
          workflowId={dbWorkflowId ?? workflowId}
          isOpen={creditsOpen}
          onClose={() => setCreditsOpen(false)}
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
      />

      <RunModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        onRun={handleRunWorkflow}
        workflowName={workflowName}
        nodes={runNodesEstimate()}
        creditBalance={creditBalance}
      />

      {/* Pan/Select Mode Floating Bar - Left of main bottom bar */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="fixed bottom-5 z-50"
        style={{ right: 'calc(50% + 280px + 1.5%)' }}
      >
        <div className="relative group">
          {/* Subtle glow effect - same as main bar */}
          <div className="absolute inset-0 bg-gray-500/10 dark:bg-white/[0.03] rounded-2xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity" />
          
          {/* Main container - Glass effect matching bottom bar */}
          <div className="relative flex items-center gap-0.5 bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl backdrop-saturate-150 border border-gray-200 dark:border-white/[0.08] rounded-2xl px-1.5 py-1.5 shadow-xl shadow-gray-300/50 dark:shadow-2xl dark:shadow-black/40">
            {/* Glass inner highlight */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-gray-100/50 dark:from-white/[0.05] to-transparent pointer-events-none" />
            
            <div className="relative">
              <motion.button
                onClick={() => setSelectionMode("pan")}
                onMouseEnter={() => setHoveredAction("pan")}
                onMouseLeave={() => setHoveredAction(null)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "relative p-2.5 rounded-xl transition-all duration-200",
                  selectionMode === "pan"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                )}
              >
                <MousePointer2 className="w-4 h-4 relative z-10" />
                {selectionMode === "pan" && (
                  <>
                    <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md" />
                    <motion.div
                      layoutId="panSelectIndicator"
                      className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl border border-blue-500/30"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  </>
                )}
              </motion.button>
              
              <AnimatePresence>
                {hoveredAction === "pan" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                  >
                    <span className="text-xs text-gray-700 dark:text-zinc-300">Pan Mode</span>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="relative">
              <motion.button
                onClick={() => setSelectionMode("select")}
                onMouseEnter={() => setHoveredAction("select")}
                onMouseLeave={() => setHoveredAction(null)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "relative p-2.5 rounded-xl transition-all duration-200",
                  selectionMode === "select"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                )}
              >
                <BoxSelect className="w-4 h-4 relative z-10" />
                {selectionMode === "select" && (
                  <>
                    <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md" />
                    <motion.div
                      layoutId="panSelectIndicator"
                      className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl border border-blue-500/30"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  </>
                )}
              </motion.button>
              
              <AnimatePresence>
                {hoveredAction === "select" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 whitespace-nowrap shadow-lg"
                  >
                    <span className="text-xs text-gray-700 dark:text-zinc-300">Select Mode</span>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white dark:bg-zinc-900 rotate-45 border-r border-b border-gray-200 dark:border-zinc-700" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}

// Loading fallback for Suspense
function WorkflowEditorLoading() {
  return (
    <div className="h-full bg-gray-100 dark:bg-[#101010] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  );
}

// Main page component with Suspense boundary for useSearchParams
export default function WorkflowEditorPage() {
  return (
    <Suspense fallback={<WorkflowEditorLoading />}>
      <WorkflowEditorContent />
    </Suspense>
  );
}
