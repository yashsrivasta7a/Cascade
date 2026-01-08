"use client";

import { memo, useState, useCallback, useRef } from "react";
import { NodeProps } from "reactflow";
import { Maximize2, Play, Loader2, Square, Settings, Upload, X } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface SeedVRNodeData extends BaseNodeData {
  scale?: "2x" | "4x";
  enhanceFaces?: boolean;
  inputImage?: string;
  result?: string;
}

const nodeDef = NODE_DEFINITIONS.seedvr;

function SeedVRNodeComponent(props: NodeProps<SeedVRNodeData>) {
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

  const runUpscale = useCallback(async () => {
    if (!data.inputImage) return;
    setIsProcessing(true);
    updateNode(id, { status: "running" });

    try {
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "seedvr",
          input: {
            image: { url: data.inputImage },
            scale: data.scale || "2x",
            enhanceFaces: data.enhanceFaces || false,
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
  }, [data.inputImage, data.scale, data.enhanceFaces, id, updateNode]);

  return (
    <BaseNode
      {...props}
      color="emerald"
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Maximize2 className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        // Align port id with node.data field used by UI so edges override correctly
        { id: "inputImage", type: "image", label: "Image", required: true },
        { id: "scale", type: "text", label: "Scale", hidden: !showSettings },
        { id: "enhanceFaces", type: "boolean", label: "Faces", hidden: !showSettings },
      ]}
      outputs={[{ id: "upscaled", type: "image", label: "Upscaled" }]}
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
                  alt="Input" 
                  className="w-full h-20 object-cover rounded"
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
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-zinc-500">
                <Upload className="w-4 h-4 mb-1" />
                <span className="text-[9px]">Drop image or click</span>
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <select
              value={data.scale || "2x"}
              onChange={(e) => updateNode(id, { scale: e.target.value as "2x" | "4x" })}
              className="nodrag nowheel flex-1 h-7 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-[10px] text-zinc-300 focus:outline-none"
            >
              <option value="2x">2x Upscale</option>
              <option value="4x">4x Upscale</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const next = !showSettings;
                setShowSettings(next);
                updateNode(id, { advancedOpen: next });
              }}
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
              onClick={runUpscale}
              disabled={!data.inputImage}
              className={`nodrag nowheel h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all ${
                isProcessing
                  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  : data.inputImage
                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
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
                <div className="pt-2 border-t border-white/5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.enhanceFaces || false}
                      onChange={(e) => updateNode(id, { enhanceFaces: e.target.checked })}
                      className="nodrag nowheel w-4 h-4 rounded bg-zinc-900 border-white/20"
                    />
                    <span className="text-[10px] text-zinc-300">Enhance Faces</span>
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      right={
        <div className="text-[11px] text-zinc-500 space-y-2">
          <div className="text-[10px] text-zinc-500">
            {isProcessing ? "Processing..." : data.result ? "Upscaled" : "No output"}
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden min-h-[80px] flex items-center justify-center">
            {data.result ? (
              <img src={data.result} alt="Upscaled" className="w-full h-auto max-h-[150px] object-contain" />
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </div>
        </div>
      }
    />
  );
}

export const SeedVRNode = memo(SeedVRNodeComponent);
