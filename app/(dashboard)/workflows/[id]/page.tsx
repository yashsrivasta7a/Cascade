"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Save,
  Plus,
  MousePointer2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui";
import { FlowCanvas } from "@/components/flow/flow-canvas";
import { NodeInspector } from "@/components/flow/node-inspector";
import { NodeTypeModal } from "@/components/flow/node-type-modal";
import { NodePalette, ExecutionHistoryPanel } from "@/components/flow";
import { useFlowStore } from "@/store";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { RunModal } from "@/components/flow/run-modal";
import { NodeProviders } from "@/lib/workflow/node-schemas";
import { runWorkflow } from "@/lib/workflow/run-workflow";

export default function WorkflowEditorPage() {
  const params = useParams<{ id: string }>();
  const workflowId = params?.id ?? "unknown";
  const { loadFlow, setNodes, nodes, edges, setEdges } = useFlowStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [creditBalance] = useState(10_000);

  // Start with empty canvas
  useEffect(() => {
    loadFlow([], []);
  }, [loadFlow]);

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
        label: (n.data as any)?.label ?? def?.label ?? n.type,
        type: n.type as string,
        estimatedCost: def?.estimatedCost ?? 0,
        provider: primary,
        fallbackProviders: fallbacks.length ? fallbacks : undefined,
      };
    });
  }, [nodes]);

  const handleRunWorkflow = useCallback(async () => {
    // Reset statuses
    setNodes(
      nodes.map((n) => ({
        ...n,
        data: {
          ...(n.data as any),
          status: "queued",
          progress: 0,
          error: undefined,
        },
      }))
    );

    await runWorkflow(nodes as any, edges as any, {
      onNodeStatus: (nodeId, status, patch) => {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...(n.data as any), status, ...(patch ?? {}) } }
              : n
          )
        );
      },
      onNodeResult: (nodeId, resultText) => {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...(n.data as any), result: resultText } }
              : n
          )
        );
      },
    });
  }, [edges, nodes, setNodes]);

  return (
    <div className="h-full bg-zinc-950">
      <div className="relative h-full overflow-hidden">
        {/* Canvas */}
        <FlowCanvas className="h-full w-full" storageKey={`workflow:${workflowId}`} />

        {/* Node palette sidebar (draggable node types) */}
        {paletteOpen && (
          <div className="fixed left-4 top-20 bottom-4 z-40 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <NodePalette />
          </div>
        )}

        {/* Floating navbar */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="glass-dark rounded-2xl px-3 py-2 flex items-center gap-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]">
            <Link
              href="/workflows"
              className="text-xs font-medium text-zinc-300 hover:text-zinc-100 px-2 py-1 rounded-xl hover:bg-white/5 transition-colors"
            >
              Workflows
            </Link>
            <div className="w-px h-5 bg-white/10" />
            <span className="text-xs font-semibold text-zinc-100 px-2">My Workflow</span>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPaletteOpen((v) => !v)}
                className="h-8 rounded-xl text-zinc-200 hover:bg-white/5"
              >
                Nodes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsAddModalOpen(true)}
                className="h-8 rounded-xl text-zinc-200 hover:bg-white/5"
              >
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Save className="w-4 h-4" />}
                className="h-8 rounded-xl text-zinc-200 hover:bg-white/5"
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Play className="w-4 h-4" />}
                onClick={() => setIsRunModalOpen(true)}
                className="h-8 rounded-xl text-zinc-200 hover:bg-white/5"
              >
                Run
              </Button>
            </div>
          </div>
        </div>

        {/* Floating inspector (only when a node is selected) */}
        <NodeInspector />

        {/* Execution History Panel (right side) */}
        <ExecutionHistoryPanel workflowId={workflowId} />

        {/* Hint when has nodes but few */}
        {nodes.length > 0 && nodes.length < 3 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            <div className="glass-dark px-4 py-2 rounded-2xl flex items-center gap-3">
              <MousePointer2 className="w-4 h-4 text-zinc-300" />
              <p className="text-xs text-zinc-400">
                Drag from a handle to empty space to add connected nodes
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
        workflowName="My Workflow"
        nodes={runNodesEstimate()}
        creditBalance={creditBalance}
      />
    </div>
  );
}
