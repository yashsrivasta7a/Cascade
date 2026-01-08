"use client";

import { memo, useState, useCallback, useRef } from "react";
import { NodeProps } from "reactflow";
import { Crop, Settings, Play, Loader2, Upload, X } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface CropImageNodeData extends BaseNodeData {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  inputImage?: string;
  result?: string;
}

const nodeDef = NODE_DEFINITIONS["crop-image"];

function CropImageNodeComponent(props: NodeProps<CropImageNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

  const runCrop = useCallback(async () => {
    if (!data.inputImage) return;
    
    setIsProcessing(true);
    updateNode(id, { status: "running" });

    try {
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "crop-image",
          input: {
            image: { url: data.inputImage },
            top: data.top || 0,
            right: data.right || 0,
            bottom: data.bottom || 0,
            left: data.left || 0,
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
  }, [data.inputImage, data.top, data.right, data.bottom, data.left, id, updateNode]);

  return (
    <BaseNode
      {...props}
      color="zinc"
      isUtility
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Crop className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[{ id: "image", type: "image", label: "Image" }]}
      outputs={[{ id: "cropped", type: "image", label: "Cropped" }]}
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

          {/* Image Upload */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => !data.inputImage && fileInputRef.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer ${
              isDragOver
                ? "border-zinc-500 bg-zinc-500/10"
                : data.inputImage
                ? "border-zinc-500/30 bg-zinc-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {data.inputImage ? (
              <div className="relative p-1">
                <img src={data.inputImage} alt="Input" className="w-full h-16 object-cover rounded" />
                <button
                  onClick={(e) => { e.stopPropagation(); updateNode(id, { inputImage: undefined }); }}
                  className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 text-zinc-500">
                <Upload className="w-4 h-4 mb-1" />
                <span className="text-[9px]">Drop image or click</span>
              </div>
            )}
          </div>

          {/* Crop Preview */}
          <div className="relative w-full h-12 bg-zinc-900 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden">
            <div 
              className="absolute bg-zinc-400/20 border border-zinc-400/50 rounded-sm"
              style={{
                top: `${data.top || 0}%`,
                right: `${data.right || 0}%`,
                bottom: `${data.bottom || 0}%`,
                left: `${data.left || 0}%`,
              }}
            />
            <span className="text-[8px] text-zinc-600">Preview</span>
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 grid grid-cols-4 gap-1 text-[8px] font-mono">
              <div className="text-center">
                <span className="text-zinc-600">T</span>
                <div className="text-zinc-400">{data.top || 0}%</div>
              </div>
              <div className="text-center">
                <span className="text-zinc-600">R</span>
                <div className="text-zinc-400">{data.right || 0}%</div>
              </div>
              <div className="text-center">
                <span className="text-zinc-600">B</span>
                <div className="text-zinc-400">{data.bottom || 0}%</div>
              </div>
              <div className="text-center">
                <span className="text-zinc-600">L</span>
                <div className="text-zinc-400">{data.left || 0}%</div>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`nodrag nowheel h-7 w-7 rounded-lg border flex items-center justify-center ${
                showSettings ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.03] border-white/10 text-zinc-400"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={runCrop}
              disabled={!data.inputImage}
              className={`nodrag nowheel h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 ${
                isProcessing
                  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  : data.inputImage
                  ? "bg-zinc-500/20 border-zinc-500/30 text-zinc-300 hover:bg-zinc-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3" />Crop</>}
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
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {[
                    { key: "top", label: "Top" },
                    { key: "right", label: "Right" },
                    { key: "bottom", label: "Bottom" },
                    { key: "left", label: "Left" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                        <span>{label}</span>
                        <span className="text-zinc-300">{(data as any)[key] || 0}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={(data as any)[key] || 0}
                        onChange={(e) => updateNode(id, { [key]: parseInt(e.target.value) })}
                        className="nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      right={
        <div className="space-y-2">
          <div className="text-[10px] text-zinc-500">
            {isProcessing ? "Cropping..." : data.result ? "Cropped" : "No output"}
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden min-h-[60px] flex items-center justify-center">
            {data.result ? (
              <img src={data.result} alt="Cropped" className="w-full h-auto max-h-[100px] object-contain" />
            ) : (
              <span className="text-zinc-600 text-[10px]">—</span>
            )}
          </div>
        </div>
      }
    />
  );
}

export const CropImageNode = memo(CropImageNodeComponent);
