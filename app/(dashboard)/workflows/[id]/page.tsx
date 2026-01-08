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
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui";
import { FlowCanvas } from "@/components/flow/flow-canvas";
import { NodeContextMenu } from "@/components/flow/node-context-menu";
import { NodeTypeModal } from "@/components/flow/node-type-modal";
import { NodePalette, ExecutionHistoryPanel } from "@/components/flow";
import { useFlowStore } from "@/store";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { RunModal } from "@/components/flow/run-modal";
import { NodeProviders } from "@/lib/workflow/node-schemas";
import { runWorkflow } from "@/lib/workflow/run-workflow";
import { trpc } from "@/lib/trpc/react";

export default function WorkflowEditorPage() {
  const params = useParams<{ id: string }>();
  const workflowId = params?.id ?? "unknown";
  const { loadFlow, setNodes, nodes, edges, setEdges, viewport, isWorkflowRunning, setWorkflowRunning, focusNode, focusNodeId } = useFlowStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [creditBalance] = useState(10_000);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [workflowName, setWorkflowName] = useState("My Workflow");
  const [dbWorkflowId, setDbWorkflowId] = useState<string | null>(null);

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

  // Save workflow to database (manual only)
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    
    const workflowData = {
      name: workflowName,
      nodesJson: nodes as unknown[],
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

        {/* Top Bar */}
        <div className="fixed top-3 left-3 right-3 z-50 flex items-center justify-between">
          {/* Left: Back + Name */}
          <div className="flex items-center gap-2 bg-zinc-950/90 border border-zinc-800 rounded-xl px-2 py-1.5">
            <Link
              href="/workflows"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div className="w-px h-5 bg-zinc-800" />
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="w-40 text-sm font-medium text-zinc-200 px-2 py-1 bg-transparent border-none focus:outline-none rounded hover:bg-zinc-800/30 transition-colors"
              placeholder="Workflow Name"
            />
          </div>

          {/* Center: Actions */}
          <div className="flex items-center gap-1 bg-zinc-950/90 border border-zinc-800 rounded-xl px-1.5 py-1.5">
            <button
              onClick={() => setPaletteOpen((v) => !v)}
              className={`p-2 rounded-lg transition-colors ${
                paletteOpen 
                  ? "bg-zinc-800 text-zinc-200" 
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
              title="Toggle Nodes"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
              title="Add Node"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              className={`p-2 rounded-lg transition-colors ${
                historyOpen 
                  ? "bg-zinc-800 text-zinc-200" 
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
              title="Run History"
            >
              <History className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-zinc-800 mx-0.5" />
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors disabled:opacity-50"
              title={saveStatus === "saved" ? "Saved!" : "Save"}
            >
              {saveStatus === "saving" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saveStatus === "saved" ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Save className="w-4 h-4" />
              )}
            </button>
            <div className="w-px h-5 bg-zinc-800 mx-0.5" />
            <button
              onClick={() => !isWorkflowRunning && setIsRunModalOpen(true)}
              disabled={isWorkflowRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isWorkflowRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{isWorkflowRunning ? "Running" : "Run"}</span>
            </button>
          </div>

          {/* Right: Spacer for balance */}
          <div className="w-[180px]" />
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

        {/* Hint when has nodes but few */}
        {nodes.length > 0 && nodes.length < 3 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
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
