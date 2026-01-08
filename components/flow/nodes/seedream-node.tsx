"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { NodeProps } from "reactflow";
import { ImageIcon, Play, Loader2, Square, ChevronDown, Upload, X, Settings } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface SeedreamNodeData extends BaseNodeData {
  prompt?: string;
  negativePrompt?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  seed?: number;
  context?: string; // Text from connected text node
  inputImage?: string; // Image from connected image node OR uploaded
  result?: string; // URL of generated image
}

const nodeDef = NODE_DEFINITIONS.seedream;
const aspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;

function SeedreamNodeComponent(props: NodeProps<SeedreamNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);

  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Propagate output when result changes
  useEffect(() => {
    if (data.result) {
      propagateOutput(id, data.result);
    }
  }, [data.result, id, propagateOutput]);

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateNode(id, { inputImage: base64 });
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const generateImage = useCallback(async () => {
    const prompt = data.prompt?.trim() || data.context?.trim();
    if (!prompt) return;

    if (isGenerating) {
      abortControllerRef.current?.abort();
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    updateNode(id, { result: "", status: "running" });

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/nodes/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negativePrompt: data.negativePrompt,
          aspectRatio: data.aspectRatio || "1:1",
          image: data.inputImage,
          seed: data.seed,
        }),
        signal: abortControllerRef.current.signal,
      });

      const result = await response.json();

      if (!response.ok) {
        updateNode(id, {
          result: "",
          status: "failed",
          error: result.error || "Failed to generate image",
        });
        return;
      }

      // Handle async trigger.dev response - poll for result
      if (result.status === "triggered") {
        updateNode(id, { status: "running", error: "Processing via Trigger.dev..." });
        // For now, show that it's processing - real implementation would poll
      } else {
        const imageUrl = result.output?.image?.url;
        if (imageUrl) {
          updateNode(id, { result: imageUrl, status: "completed" });
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        updateNode(id, { status: "idle" });
      } else {
        updateNode(id, {
          result: "",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [data.prompt, data.context, data.negativePrompt, data.aspectRatio, data.inputImage, data.seed, id, updateNode, isGenerating]);

  const hasPrompt = Boolean(data.prompt?.trim() || data.context?.trim());
  const isEditMode = Boolean(data.inputImage);

  return (
    <BaseNode
      {...props}
      color="emerald"
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: isEditMode ? "Image editing mode" : nodeDef.description,
        icon: <ImageIcon className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        { id: "prompt", type: "text", label: "Prompt" },
        { id: "image", type: "image", label: "Image" },
      ]}
      outputs={[{ id: "image", type: "image", label: "Image" }]}
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
            placeholder={data.context ? "Override prompt..." : "Describe the image..."}
            rows={2}
            className="nodrag nowheel w-full px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/10 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none"
          />

          {/* Image Upload / Preview */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !data.inputImage && fileInputRef.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer ${
              isDragOver
                ? "border-emerald-500 bg-emerald-500/10"
                : data.inputImage
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {data.inputImage ? (
              <div className="relative p-1">
                <img 
                  src={data.inputImage} 
                  alt="Reference" 
                  className="w-full h-16 object-cover rounded"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNode(id, { inputImage: undefined });
                  }}
                  className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <div className="absolute bottom-2 left-2 text-[9px] text-emerald-400 bg-black/60 px-1.5 py-0.5 rounded">
                  Edit Mode
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 text-zinc-500">
                <Upload className="w-4 h-4 mb-1" />
                <span className="text-[9px]">Drop image or click</span>
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <select
              value={data.aspectRatio || "1:1"}
              onChange={(e) => updateNode(id, { aspectRatio: e.target.value as typeof data.aspectRatio })}
              className="nodrag nowheel flex-1 h-7 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-[10px] text-zinc-300 focus:outline-none"
            >
              {aspectRatios.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`nodrag nowheel h-7 w-7 rounded-lg border flex items-center justify-center transition-all ${
                showSettings
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                generateImage();
              }}
              disabled={!hasPrompt}
              className={`nodrag nowheel h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all ${
                isGenerating
                  ? "bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
                  : hasPrompt
                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isGenerating ? (
                <>
                  <Square className="w-3 h-3" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Run
                </>
              )}
            </button>
          </div>

          {/* Collapsible Settings */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {/* Negative Prompt */}
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">
                      Negative Prompt
                    </label>
                    <textarea
                      value={data.negativePrompt || ""}
                      onChange={(e) => updateNode(id, { negativePrompt: e.target.value })}
                      placeholder="What to avoid..."
                      rows={2}
                      className="nodrag nowheel w-full px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none"
                    />
                  </div>

                  {/* Seed */}
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">
                      Seed (optional)
                    </label>
                    <input
                      type="number"
                      value={data.seed || ""}
                      onChange={(e) => updateNode(id, { seed: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Random"
                      className="nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      right={
        <div className="space-y-2 min-w-0">
          <div className="text-[10px] text-zinc-500 flex items-center gap-2">
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                {isEditMode ? "Editing..." : "Generating..."}
              </>
            ) : data.result ? (
              "Generated"
            ) : (
              "No output"
            )}
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden min-h-[100px] flex items-center justify-center">
            {data.result ? (
              <img
                src={data.result}
                alt="Generated"
                className="w-full h-auto max-h-[180px] object-contain"
              />
            ) : (
              <div className="text-zinc-600 text-[10px]">—</div>
            )}
          </div>
        </div>
      }
    />
  );
}

export const SeedreamNode = memo(SeedreamNodeComponent);
