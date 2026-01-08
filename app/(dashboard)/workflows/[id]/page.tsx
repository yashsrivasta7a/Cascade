"use client";

import { useEffect, useState, useCallback } from "react";
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
  History,
  Target,
  GitBranch,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { FlowCanvas } from "@/components/flow/flow-canvas";
import { NodeContextMenu } from "@/components/flow/node-context-menu";
import { NodeTypeModal } from "@/components/flow/node-type-modal";
import { NodePalette, ExecutionHistoryPanel, VersionHistoryPanel } from "@/components/flow";
import { WorkflowSidebar } from "@/components/flow/workflow-sidebar";
import { useFlowStore } from "@/store";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { RunModal } from "@/components/flow/run-modal";
import { NodeProviders } from "@/lib/workflow/node-schemas";
import { runWorkflow } from "@/lib/workflow/run-workflow";
import { trpc } from "@/lib/trpc/react";

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
  const workflowId = params?.id ?? "unknown";
  const focusParam = searchParams?.get("focus");
  const { loadFlow, setNodes, nodes, edges, setEdges, viewport, isWorkflowRunning, setWorkflowRunning, focusNode, focusNodeId } = useFlowStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [workflowSidebarOpen, setWorkflowSidebarOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [creditBalance] = useState(10_000);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [workflowName, setWorkflowName] = useState("My Workflow");
  const [dbWorkflowId, setDbWorkflowId] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

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
        case "escape":
          setPaletteOpen(false);
          setHistoryOpen(false);
          setVersionsOpen(false);
          setWorkflowSidebarOpen(false);
          setIsAddModalOpen(false);
          setIsRunModalOpen(false);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isWorkflowRunning]);

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
      return;
    }

    if (workflowData?.workflow) {
      const workflow = workflowData.workflow;
      setDbWorkflowId(workflow.id);
      setWorkflowName(workflow.name);
      loadFlow(
        (workflow.nodesJson as unknown[]) || [],
        (workflow.edgesJson as unknown[]) || []
      );
    }
  }, [workflowId, workflowData, loadFlow]);

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

      return {
        id: n.id,
        label: (n.data as { label?: string })?.label ?? def?.label ?? n.type,
        type: n.type as string,
        estimatedCost: def?.estimatedCost ?? 0,
        provider: primary,
        fallbackProviders: fallbacks.length ? fallbacks : undefined,
      };
    });
  }, [nodes]);

  const handleRunWorkflow = useCallback(async () => {
    setWorkflowRunning(true);
    
    // Save workflow first if not saved
    if (!dbWorkflowId) {
      await handleSave();
    }
    
    // Create workflow execution record
    let executionId: string | null = null;
    if (dbWorkflowId) {
      try {
        const result = await createExecutionMutation.mutateAsync({
          workflowId: dbWorkflowId,
          inputsJson: { nodes, edges },
        });
        executionId = result.execution?.id ?? null;
      } catch (error) {
        console.error("Failed to create execution record:", error);
      }
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

    try {
      await runWorkflow(nodes as Parameters<typeof runWorkflow>[0], edges as Parameters<typeof runWorkflow>[1], {
        onNodeStatus: (nodeId, status, patch) => {
          setNodes((prev) =>
            prev.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...(n.data as Record<string, unknown>), status, ...(patch ?? {}) } }
                : n
            )
          );
        },
        onNodeResult: (nodeId, resultText) => {
          setNodes((prev) =>
            prev.map((n) =>
              n.id === nodeId
                ? { ...n, data: { ...(n.data as Record<string, unknown>), result: resultText } }
                : n
            )
          );
        },
      });
      
      // Mark execution as completed
      if (executionId) {
        updateExecutionMutation.mutate({
          id: executionId,
          status: "COMPLETED",
        });
      }
    } catch (error) {
      // Mark execution as failed
      if (executionId) {
        updateExecutionMutation.mutate({
          id: executionId,
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setWorkflowRunning(false);
    }
  }, [edges, nodes, setNodes, setWorkflowRunning, dbWorkflowId, handleSave, createExecutionMutation, updateExecutionMutation]);

  return (
    <div className="h-full bg-zinc-950">
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

        {/* Top Left: Workflows Button + Name */}
        <div className="fixed top-3 left-3 z-50">
          <div className="flex items-center gap-2 bg-zinc-950/90 border border-zinc-800 rounded-xl px-2 py-1.5">
            <button
              onClick={() => setWorkflowSidebarOpen(true)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
              title="All Workflows"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-zinc-800" />
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="w-40 text-sm font-medium text-zinc-200 px-2 py-1 bg-transparent border-none focus:outline-none rounded hover:bg-zinc-800/30 transition-colors"
              placeholder="Workflow Name"
            />
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

              {/* History toggle */}
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
                  <History className="w-4 h-4 relative z-10" />
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
                        <span className="text-xs text-zinc-300">History</span>
                        <Kbd>H</Kbd>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 rotate-45 border-r border-b border-zinc-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Versions toggle */}
              <div className="relative">
                <motion.button
                  onClick={() => setVersionsOpen((v) => !v)}
                  onMouseEnter={() => setHoveredAction("versions")}
                  onMouseLeave={() => setHoveredAction(null)}
                  whileTap={{ scale: 0.95 }}
                  className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                    versionsOpen 
                      ? "text-blue-400" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <GitBranch className="w-4 h-4 relative z-10" />
                  {versionsOpen && (
                    <>
                      {/* Blue glow behind */}
                      <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md" />
                      <motion.div
                        layoutId="activeIndicator3"
                        className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl border border-blue-500/30"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    </>
                  )}
                </motion.button>
                
                <AnimatePresence>
                  {hoveredAction === "versions" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-700 whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-300">Versions</span>
                        <Kbd>V</Kbd>
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
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 rounded-xl blur-lg opacity-40 group-hover/runwrap:opacity-70 transition-opacity" />
                
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
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 bg-[length:200%_100%] group-hover/run:animate-shimmer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  
                  {/* Content */}
                  <div className="relative flex items-center gap-2">
                    {isWorkflowRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Play className="w-4 h-4 text-white" />
                    )}
                    <span className="text-sm font-semibold text-white tracking-wide">
                      {isWorkflowRunning ? "Running" : "Run"}
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
                        <span className="text-xs text-zinc-300">Run</span>
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

        {/* Execution History Panel (right side) */}
        <ExecutionHistoryPanel 
          workflowId={workflowId} 
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onNodeClick={(nodeId) => focusNode(nodeId)}
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
