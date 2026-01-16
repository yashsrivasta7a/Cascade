"use client";

import { memo, useState, useCallback, useRef, useMemo } from "react";
import { NodeProps } from "reactflow";
import { Crop, Play, Loader2, Upload, X, Maximize2, Download, Lock, ChevronDown } from "lucide-react";
import { BaseNode, type BaseNodeData, isSettingInherited } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface CropImageNodeData extends BaseNodeData {
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  heightPercent?: number;
  inputImage?: string;
  result?: string;
  advancedOpen?: boolean;
  error?: string;
  useCache?: boolean;
}

const nodeDef = NODE_DEFINITIONS["crop-image"];

function CropImageNodeComponent(props: NodeProps<CropImageNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  const workflowId = useFlowStore((s) => s.workflowId);
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);
  
  // Check for incoming image connection
  const connectedImage = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === "inputImage");
    if (!edge) return null;
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) return null;
    const sourceData = sourceNode.data as Record<string, unknown>;
    if (sourceData.result && typeof sourceData.result === "string") return sourceData.result;
    return null;
  }, [edges, nodes, id]);
  
  // Check if handle has incoming connection (even if no output yet)
  const hasImageConnection = useMemo(() => edges.some(e => e.target === id && e.targetHandle === "inputImage"), [edges, id]);
  
  // Effective image: use connected if available, otherwise use direct data
  const effectiveImage = data.inputImage || connectedImage;
  
  // hasInput is true if we have the actual data OR if we have a connection (dependencies will run)
  const hasInput = Boolean(effectiveImage || hasImageConnection);
  // Check if we need to run dependencies (have connection but no data yet)
  const needsDependencies = hasImageConnection && !effectiveImage;
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean(data.advancedOpen));
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    
    // Check file size - limit to 10MB
    // Check file size - limit to 10MB (API body limit is ~4MB, base64 adds ~33%)
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 10) {
      updateNode(id, { error: `Image too large (${sizeMB.toFixed(1)}MB). Max 10MB.` });
      return;
    }
    
    setIsUploadingImage(true);
    updateNode(id, { error: undefined });
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      
      // Try to upload to CDN for persistence
      try {
        const response = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl: base64,
            type: "image",
            filename: file.name,
          }),
        });
        
        if (response.ok) {
          const { url } = await response.json();
          updateNode(id, { inputImage: url, result: undefined, error: undefined });
          setIsUploadingImage(false);
          return;
        }
      } catch (err) {
        console.warn("[CropImage] CDN upload failed, using base64:", err);
      }
      
      // Fallback to base64 if CDN upload fails
      updateNode(id, { inputImage: base64, result: undefined, error: undefined });
      setIsUploadingImage(false);
    };
    reader.onerror = () => {
      updateNode(id, { error: "Failed to read image file" });
      setIsUploadingImage(false);
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

  const runNode = useFlowStore((s) => s.runNode);
  
  const runCrop = useCallback(async () => {
    console.log(`[LEGACY CropImageNode] runCrop called with data:`, {
      xPercent: data.xPercent,
      yPercent: data.yPercent,
      widthPercent: data.widthPercent,
      heightPercent: data.heightPercent,
    });
    
    // If we need dependencies, use the flow store's runNode which handles them
    if (needsDependencies) {
      setIsProcessing(true);
      updateNode(id, { status: "queued", error: undefined });
      
      try {
        await runNode(id);
      } catch (error) {
        updateNode(id, { status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    
    // Direct execution when we have input ready
    const imageToUse = effectiveImage;
    if (!imageToUse) return;

    setIsProcessing(true);
    updateNode(id, { status: "running" });

    try {
      const inputPayload = {
        image: { url: imageToUse },
        xPercent: data.xPercent || 0,
        yPercent: data.yPercent || 0,
        widthPercent: data.widthPercent || 100,
        heightPercent: data.heightPercent || 100,
        useCache: data.useCache === true,
      };
      console.log("[CropImage] Sending request with useCache:", inputPayload.useCache);
      
      const response = await fetch("/api/nodes/execute-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "crop-image",
          nodeId: id,
          nodeLabel: data.label || nodeDef.label,
          workflowId: workflowId ?? undefined,
          input: inputPayload,
        }),
      });

      const result = await response.json();
      if (result.success && result.output?.image?.url) {
        updateNode(id, { result: result.output.image.url, status: "completed" });
        // Propagate to connected nodes
        propagateOutput(id, result.output.image.url);
      } else {
        updateNode(id, { status: "failed", error: result.error || "Unknown error" });
      }
    } catch (error) {
      updateNode(id, { status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setIsProcessing(false);
    }
  }, [needsDependencies, effectiveImage, data.xPercent, data.yPercent, data.widthPercent, data.heightPercent, data.label, data.useCache, id, updateNode, propagateOutput, workflowId, runNode]);

  // Memoize inputs to avoid recreating on every render
  const inputs = useMemo(() => [
    { id: "inputImage", type: "image" as const, label: "Image", required: true },
    { id: "xPercent", type: "number" as const, label: "X %", hidden: !showSettings },
    { id: "yPercent", type: "number" as const, label: "Y %", hidden: !showSettings },
    { id: "widthPercent", type: "number" as const, label: "Width %", hidden: !showSettings },
    { id: "heightPercent", type: "number" as const, label: "Height %", hidden: !showSettings },
  ], [showSettings]);

  const handleDownload = useCallback(() => {
    if (!data.result) return;
    const link = document.createElement("a");
    link.href = data.result;
    link.download = `cropped-${Date.now()}.png`;
    link.click();
  }, [data.result]);

  return (
    <>
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
        inputs={inputs}
        outputs={[{ id: "cropped", type: "image", label: "Cropped" }]}
        left={
          <div className="space-y-3">
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

            {/* INPUT Section */}
            <div>
              <label className="text-[10px] font-medium text-zinc-400 mb-1.5 block">Input</label>
              <div
                onDrop={isProcessing ? undefined : handleDrop}
                onDragOver={isProcessing ? undefined : (e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={isProcessing ? undefined : () => setIsDragOver(false)}
                onClick={() => !data.inputImage && !isProcessing && fileInputRef.current?.click()}
                className={`nodrag nowheel relative rounded-xl overflow-hidden transition-all ${
                  isProcessing
                    ? "ring-1 ring-white/10 cursor-not-allowed"
                    : isDragOver
                    ? "ring-2 ring-zinc-500 cursor-pointer"
                    : data.inputImage
                    ? "ring-1 ring-white/10 cursor-pointer"
                    : "border-2 border-dashed border-white/10 hover:border-white/20 cursor-pointer"
                }`}
              >
                {isUploadingImage ? (
                  <div className="flex flex-col items-center justify-center py-6 text-emerald-400">
                    <Loader2 className="w-5 h-5 mb-2 animate-spin" />
                    <span className="text-[10px]">Uploading image...</span>
                  </div>
                ) : data.inputImage ? (
                  <div className="relative">
                    {/* Image with crop overlay */}
                    <div className="relative">
                      <img 
                        src={data.inputImage} 
                        alt="Input" 
                        className="w-full h-auto max-h-[120px] object-contain bg-black/20" 
                      />
                      {/* Crop overlay - darkens non-cropped areas */}
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `linear-gradient(to right, 
                            rgba(0,0,0,0.6) ${data.xPercent || 0}%, 
                            transparent ${data.xPercent || 0}%, 
                            transparent ${(data.xPercent || 0) + (data.widthPercent || 100)}%, 
                            rgba(0,0,0,0.6) ${(data.xPercent || 0) + (data.widthPercent || 100)}%
                          )`,
                        }}
                      />
                      {/* Crop area indicator */}
                      <div 
                        className="absolute border-2 border-emerald-400/80 bg-emerald-400/5 pointer-events-none"
                        style={{
                          left: `${data.xPercent || 0}%`,
                          top: `${data.yPercent || 0}%`,
                          width: `${data.widthPercent || 100}%`,
                          height: `${data.heightPercent || 100}%`,
                        }}
                      />
                    </div>
                    {!isProcessing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); updateNode(id, { inputImage: undefined, result: undefined }); }}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-lg hover:bg-black/90 transition-colors"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-zinc-500">
                    <Upload className="w-5 h-5 mb-2" />
                    <span className="text-[10px]">Drop image or click to upload</span>
                  </div>
                )}
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center gap-2">
              <button
                onClick={runCrop}
                disabled={!hasInput || isProcessing || isUploadingImage}
                className={`nodrag nowheel flex-1 h-8 px-4 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-2 transition-all ${
                  isProcessing || isUploadingImage
                    ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
                    : hasInput
                    ? "bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] border-[#3a5a7f]/60 text-blue-100 hover:from-[#2a4a6f] hover:to-[#3a5a7f] shadow-[0_0_15px_rgba(30,58,95,0.4)]"
                    : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
                }`}
              >
                {isProcessing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Cropping...</>
                ) : needsDependencies ? (
                  <><Play className="w-3.5 h-3.5" />Run</>
                ) : (
                  <><Crop className="w-3.5 h-3.5" />Crop Image</>
                )}
              </button>
            </div>

            {/* Additional Settings Toggle */}
            <button
              onClick={() => {
                const next = !showSettings;
                setShowSettings(next);
                updateNode(id, { advancedOpen: next });
              }}
              disabled={isProcessing}
              className="nodrag nowheel w-full mt-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full">
                <div className="text-left">
                  <div className="text-[11px] font-medium text-zinc-300">Additional Settings</div>
                  <div className="text-[9px] text-zinc-500">Adjust crop dimensions.</div>
                </div>
                <div className="flex items-center gap-1 text-zinc-400">
                  <span className="text-[10px]">{showSettings ? "Less" : "More"}</span>
                  <motion.div
                    animate={{ rotate: showSettings ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </motion.div>
                </div>
              </div>
            </button>

            {/* Collapsible Settings */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "xPercent", label: "X Position", defaultVal: 0, max: 99 },
                        { key: "yPercent", label: "Y Position", defaultVal: 0, max: 99 },
                        { key: "widthPercent", label: "Width", defaultVal: 100, max: 100 },
                        { key: "heightPercent", label: "Height", defaultVal: 100, max: 100 },
                      ].map(({ key, label, defaultVal, max }) => {
                        const isInherited = isSettingInherited(data, key);
                        const currentValue = Math.min(Math.max(0, (data as any)[key] ?? defaultVal), max);
                        return (
                          <div key={key} className={isProcessing ? "opacity-50" : ""}>
                            <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                              <span className="flex items-center gap-1">
                                {label}
                                {isInherited && <Lock className="w-2.5 h-2.5 text-violet-400" />}
                              </span>
                              <span className="text-zinc-300 font-mono">{currentValue}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={max}
                              value={currentValue}
                              onChange={(e) => updateNode(id, { [key]: parseInt(e.target.value) })}
                              disabled={isProcessing || isInherited}
                              className={`nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none ${
                                isInherited ? "accent-violet-500 cursor-not-allowed opacity-60" : "accent-emerald-500"
                              } ${isProcessing ? "cursor-not-allowed" : isInherited ? "" : "cursor-pointer"}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Use Cache Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-white/5">
                      <input
                        type="checkbox"
                        checked={data.useCache === true}
                        onChange={(e) => updateNode(id, { useCache: e.target.checked })}
                        disabled={isProcessing}
                        className="nodrag nowheel w-4 h-4 rounded bg-zinc-900 border-white/20"
                      />
                      <div>
                        <span className="text-[10px] text-zinc-300">Use Cache</span>
                        <p className="text-[8px] text-zinc-500">Skip re-execution if inputs unchanged</p>
                      </div>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Display */}
            {data.error && (
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] text-red-300">
                {data.error}
              </div>
            )}

            {/* OUTPUT Section */}
            <div>
              <label className="text-[10px] font-medium text-zinc-400 mb-1.5 block">
                {isProcessing ? "Processing..." : data.result ? "Output" : "Result"}
              </label>
              <div className={`relative rounded-xl overflow-hidden transition-all ${
                data.result 
                  ? "ring-1 ring-emerald-500/30 bg-emerald-500/5" 
                  : "bg-white/[0.02] border border-white/5"
              }`}>
                {data.result ? (
                  <div className="relative group">
                    <img 
                      src={data.result} 
                      alt="Cropped result" 
                      className="w-full h-auto max-h-[150px] object-contain bg-black/20"
                    />
                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => setShowFullPreview(true)}
                        className="nodrag nowheel p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                        title="View full size"
                      >
                        <Maximize2 className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={handleDownload}
                        className="nodrag nowheel p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <span className="text-zinc-600 text-[10px]">
                      {data.inputImage ? "Click 'Crop Image' to process" : "Upload an image first"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        }
      />

      {/* Full Preview Modal */}
      <AnimatePresence>
        {showFullPreview && data.result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8"
            onClick={() => setShowFullPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={data.result} 
                alt="Cropped result full size" 
                className="max-w-full max-h-[80vh] object-contain rounded-xl"
              />
              <button
                onClick={() => setShowFullPreview(false)}
                className="absolute -top-3 -right-3 p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export const CropImageNode = memo(CropImageNodeComponent);
