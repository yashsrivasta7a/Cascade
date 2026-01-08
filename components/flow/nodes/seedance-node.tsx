"use client";

import { memo, useState, useCallback, useRef } from "react";
import { NodeProps } from "reactflow";
import { Film, Play, Loader2, Settings, Upload, X } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface SeedanceNodeData extends BaseNodeData {
  prompt?: string;
  duration?: "4s" | "8s" | "16s";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  seed?: number;
  context?: string;
  inputFrame?: string;
  result?: string;
}

const nodeDef = NODE_DEFINITIONS.seedance;

function SeedanceNodeComponent(props: NodeProps<SeedanceNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean((data as any)?.advancedOpen));
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateNode(id, { inputFrame: base64 });
    };
    reader.readAsDataURL(file);
  }, [id, updateNode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const runGenerate = useCallback(async () => {
    const prompt = data.prompt?.trim() || data.context?.trim();
    if (!prompt) return;
    
    setIsProcessing(true);
    updateNode(id, { status: "running" });

    try {
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "seedance",
          input: {
            prompt,
            duration: data.duration || "4s",
            aspectRatio: data.aspectRatio || "16:9",
            frame: data.inputFrame ? { url: data.inputFrame } : undefined,
            seed: data.seed,
          },
        }),
      });

      const result = await response.json();
      if (result.status === "triggered") {
        updateNode(id, { status: "running" });
      }
    } catch (error) {
      updateNode(id, { status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setIsProcessing(false);
    }
  }, [data.prompt, data.context, data.duration, data.aspectRatio, data.inputFrame, data.seed, id, updateNode]);

  const hasPrompt = Boolean(data.prompt?.trim() || data.context?.trim());

  return (
    <BaseNode
      {...props}
      color="violet"
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Film className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        { id: "prompt", type: "text", label: "Prompt", required: true },
        // Align port id with node.data field used by UI so edges override correctly
        { id: "inputFrame", type: "image", label: "Start Frame" },
        { id: "duration", type: "text", label: "Duration", hidden: !showSettings },
        { id: "aspectRatio", type: "text", label: "Aspect", hidden: !showSettings },
        { id: "seed", type: "number", label: "Seed", hidden: !showSettings },
      ]}
      outputs={[{ id: "video", type: "video", label: "Video" }]}
      left={
        <div className="space-y-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
            className="hidden"
          />

          {/* Prompt Input */}
          <textarea
            value={data.prompt || ""}
            onChange={(e) => updateNode(id, { prompt: e.target.value })}
            placeholder={data.context ? "Override prompt..." : "Describe the video..."}
            rows={2}
            className="nodrag nowheel w-full px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/10 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none"
          />

          {/* Start Frame Upload */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => !data.inputFrame && fileInputRef.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer ${
              isDragOver
                ? "border-violet-500 bg-violet-500/10"
                : data.inputFrame
                ? "border-violet-500/30 bg-violet-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {data.inputFrame ? (
              <div className="relative p-1">
                <img src={data.inputFrame} alt="Start Frame" className="w-full h-14 object-cover rounded" />
                <button
                  onClick={(e) => { e.stopPropagation(); updateNode(id, { inputFrame: undefined }); }}
                  className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <div className="absolute bottom-2 left-2 text-[9px] text-violet-400 bg-black/60 px-1.5 py-0.5 rounded">
                  Start Frame
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 text-zinc-500">
                <Upload className="w-4 h-4 mb-1" />
                <span className="text-[9px]">Start frame (optional)</span>
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <select
              value={data.duration || "4s"}
              onChange={(e) => updateNode(id, { duration: e.target.value as "4s" | "8s" | "16s" })}
              className="nodrag nowheel flex-1 h-7 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-[10px] text-zinc-300"
            >
              <option value="4s">4 sec</option>
              <option value="8s">8 sec</option>
              <option value="16s">16 sec</option>
            </select>
            <select
              value={data.aspectRatio || "16:9"}
              onChange={(e) => updateNode(id, { aspectRatio: e.target.value as "16:9" | "9:16" | "1:1" })}
              className="nodrag nowheel flex-1 h-7 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-[10px] text-zinc-300"
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </select>
            <button
              onClick={() => {
                const next = !showSettings;
                setShowSettings(next);
                updateNode(id, { advancedOpen: next });
              }}
              className={`nodrag nowheel h-7 w-7 rounded-lg border flex items-center justify-center ${
                showSettings ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.03] border-white/10 text-zinc-400"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={runGenerate}
              disabled={!hasPrompt}
              className={`nodrag nowheel h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 ${
                isProcessing
                  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  : hasPrompt
                  ? "bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3" />Run</>}
            </button>
          </div>

          {/* Collapsible Settings */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 border-t border-white/5">
                  <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">Seed</label>
                  <input
                    type="number"
                    value={data.seed || ""}
                    onChange={(e) => updateNode(id, { seed: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="Random"
                    className="nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      right={
        <div className="space-y-2">
          <div className="text-[10px] text-zinc-500">
            {isProcessing ? "Generating..." : data.result ? "Output" : "No output"}
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden min-h-[80px] flex items-center justify-center">
            {data.result ? (
              <video src={data.result} controls className="w-full h-auto max-h-[150px]" />
            ) : (
              <span className="text-zinc-600 text-[10px]">—</span>
            )}
          </div>
        </div>
      }
    />
  );
}

export const SeedanceNode = memo(SeedanceNodeComponent);
