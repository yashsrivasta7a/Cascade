"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { NodeProps } from "reactflow";
import { ImageIcon, Play, Loader2, Square, ChevronDown, Upload, X, Settings, Lock, Link2 } from "lucide-react";
import { BaseNode, type BaseNodeData, isSettingInherited } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";
import { MediaLoader, MediaSkeleton } from "@/components/ui";

export interface SeedreamNodeData extends BaseNodeData {
  prompt?: string;
  negativePrompt?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  seed?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  truncatePrompt?: boolean;
  promptEnhancer?: boolean;
  syncMode?: boolean;
  context?: string; // Text from connected text node
  inputImage?: string; // Legacy single image support
  referenceImages?: string[]; // Up to 14 reference images (fal.ai limit)
  result?: string; // URL of generated image
  useCache?: boolean;
}

const MAX_REFERENCE_IMAGES = 14;

const nodeDef = NODE_DEFINITIONS.seedream;
const aspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;

function SeedreamNodeComponent(props: NodeProps<SeedreamNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  const setWorkflowRunning = useFlowStore((s) => s.setWorkflowRunning);
  const isHandleConnected = useFlowStore((s) => s.isHandleConnected);
  
  // Check if prompt handle is connected (receiving from another node)
  const isPromptConnected = isHandleConnected(id, "prompt");

  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean((data as any)?.advancedOpen));
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Propagate output when result changes
  useEffect(() => {
    if (data.result) {
      propagateOutput(id, data.result);
    }
  }, [data.result, id, propagateOutput]);

  // Get current reference images (support legacy inputImage)
  const currentImages = data.referenceImages || (data.inputImage ? [data.inputImage] : []);
  const canAddMore = currentImages.length < MAX_REFERENCE_IMAGES;

  const handleImageUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArray.length === 0) return;
    
    // Check how many more we can add
    const remainingSlots = MAX_REFERENCE_IMAGES - currentImages.length;
    if (remainingSlots <= 0) {
      alert(`Maximum ${MAX_REFERENCE_IMAGES} reference images allowed.`);
      return;
    }
    
    const filesToUpload = fileArray.slice(0, remainingSlots);
    if (filesToUpload.length < fileArray.length) {
      alert(`Only adding ${filesToUpload.length} images. Maximum ${MAX_REFERENCE_IMAGES} total.`);
    }
    
    setIsUploadingImage(true);
    
    const uploadedUrls: string[] = [];
    
    for (const file of filesToUpload) {
      // Check file size - limit to 10MB each
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > 10) {
        console.warn(`[Seedream] Skipping ${file.name} - too large (${sizeMB.toFixed(1)}MB)`);
        continue;
      }
      
      try {
        // Read file as base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
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
            uploadedUrls.push(url);
            continue;
          }
        } catch (err) {
          console.warn("[Seedream] CDN upload failed, using base64:", err);
        }
        
        // Fallback to base64 if CDN upload fails
        uploadedUrls.push(base64);
      } catch (err) {
        console.error(`[Seedream] Failed to process ${file.name}:`, err);
      }
    }
    
    if (uploadedUrls.length > 0) {
      const newImages = [...currentImages, ...uploadedUrls];
      updateNode(id, { referenceImages: newImages, inputImage: undefined });
    }
    
    setIsUploadingImage(false);
  }, [id, updateNode, currentImages]);

  const removeImage = useCallback((index: number) => {
    const newImages = currentImages.filter((_, i) => i !== index);
    updateNode(id, { 
      referenceImages: newImages.length > 0 ? newImages : undefined,
      inputImage: undefined 
    });
  }, [id, updateNode, currentImages]);

  const clearAllImages = useCallback(() => {
    updateNode(id, { referenceImages: undefined, inputImage: undefined });
  }, [id, updateNode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files);
    }
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
    setWorkflowRunning(true); // Enable polling for status updates

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/nodes/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negativePrompt: data.negativePrompt,
          aspectRatio: data.aspectRatio || "1:1",
          // Send reference images array (or legacy single image)
          referenceImages: currentImages.length > 0 ? currentImages : undefined,
          image: undefined, // Deprecated - use referenceImages
          seed: data.seed,
          nodeId: id, // Pass the flow node ID for polling to match
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
        updateNode(id, { status: "running" });
        
        // Poll for status updates
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/nodes/status?nodeId=${encodeURIComponent(id)}`);
            if (!statusRes.ok) return;
            
            const statusData = await statusRes.json();
            console.log(`[Seedream] Poll status for ${id}:`, statusData.status);
            
            if (statusData.status === "completed") {
              clearInterval(pollInterval);
              setIsGenerating(false);
              const imageUrl = statusData.output?.image?.url;
              updateNode(id, {
                result: imageUrl || "",
                status: "completed",
              });
              setWorkflowRunning(false);
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              setIsGenerating(false);
              updateNode(id, {
                result: "",
                status: "failed",
                error: statusData.error || "Generation failed",
                // Store rich error details for the error inspector
                errorDetails: {
                  provider: statusData.providerUsed || "fal",
                  executionId: statusData.executionId,
                  triggerRunId: statusData.triggerRunId,
                  duration: statusData.duration,
                  inputs: statusData.inputs,
                },
              });
              setWorkflowRunning(false);
            }
            // If still running/waiting/queued, keep polling
          } catch (err) {
            console.error("[Seedream] Poll error:", err);
          }
        }, 2000);
        
        // Store interval for cleanup
        abortControllerRef.current = { abort: () => clearInterval(pollInterval) } as AbortController;
        return;
      } else {
        const imageUrl = result.output?.image?.url;
        if (imageUrl) {
          updateNode(id, {
            result: imageUrl,
            status: "completed",
          });
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
  }, [data.prompt, data.context, data.negativePrompt, data.aspectRatio, currentImages, data.seed, id, updateNode, isGenerating]);

  const hasPrompt = Boolean(data.prompt?.trim() || data.context?.trim());
  const isEditMode = currentImages.length > 0;

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
        // Always-visible ports - using unified color types
        { id: "prompt", type: "prompt", label: "Prompt", required: true },
        { id: "referenceImages", type: "image", label: `Images (${currentImages.length}/14)` },

        // Advanced ports (only show when settings panel is expanded)
        { id: "numInferenceSteps", type: "number", label: "Steps", hidden: !showSettings },
        { id: "guidanceScale", type: "number", label: "Guidance", hidden: !showSettings },
        { id: "seed", type: "seed", label: "Seed", hidden: !showSettings },
        { id: "aspectRatio", type: "aspectRatio", label: "Aspect", hidden: !showSettings },
        { id: "negativePrompt", type: "negative", label: "Negative", hidden: !showSettings },
        { id: "truncatePrompt", type: "boolean", label: "Truncate", hidden: !showSettings },
        { id: "promptEnhancer", type: "boolean", label: "Enhancer", hidden: !showSettings },
        { id: "syncMode", type: "boolean", label: "Sync", hidden: !showSettings },
      ]}
      outputs={[
        // Standard image output
        { id: "image", type: "image", label: "Image" },
      ]}
      left={
        <div className="space-y-3">
          {/* Hidden file input - supports multiple files */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleImageUpload(e.target.files);
                e.target.value = ""; // Reset so same files can be selected again
              }
            }}
            className="hidden"
          />

          {/* Prompt Input */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium text-zinc-400">Prompt</label>
              {isPromptConnected ? (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                  <Link2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-[8px] text-emerald-400 font-medium">LINKED</span>
                </div>
              ) : isSettingInherited(data, "prompt") && (
                <div className="flex items-center gap-1 text-[9px] text-violet-400">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Inherited</span>
                </div>
              )}
            </div>
            <textarea
              value={data.prompt || ""}
              onChange={(e) => !isPromptConnected && !isSettingInherited(data, "prompt") && updateNode(id, { prompt: e.target.value })}
              placeholder={isPromptConnected ? "Waiting for response from connected node..." : data.context ? "Override prompt..." : "Describe the image..."}
              rows={3}
              readOnly={isPromptConnected}
              disabled={isSettingInherited(data, "prompt")}
              className={`nodrag nowheel w-full px-3 py-2 rounded-xl border text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none ${
                isPromptConnected
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : isSettingInherited(data, "prompt") 
                    ? "opacity-60 cursor-not-allowed border-violet-500/30 bg-violet-500/5" 
                    : "bg-zinc-900/60 border-white/10 focus:border-white/20"
              }`}
            />
          </div>

          {/* Reference Images (up to 14) */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`nodrag nowheel relative rounded-xl border border-white/10 bg-white/[0.02] transition-all ${
              isDragOver ? "border-emerald-500/40 bg-emerald-500/10" : ""
            }`}
          >
            {isUploadingImage ? (
              <div className="flex items-center justify-center gap-2 px-3 py-4 text-emerald-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[10px]">Uploading images...</span>
              </div>
            ) : currentImages.length > 0 ? (
              <div className="p-2 space-y-2">
                {/* Image grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  {currentImages.map((img, index) => (
                    <div key={index} className="relative group aspect-square">
                      <img 
                        src={img} 
                        alt={`Reference ${index + 1}`} 
                        className="w-full h-full object-cover rounded-md" 
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                  {/* Add more button */}
                  {canAddMore && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="aspect-square rounded-md border border-dashed border-white/20 bg-white/[0.02] flex items-center justify-center hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                  )}
                </div>
                {/* Count and clear */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] text-zinc-500">
                    {currentImages.length}/{MAX_REFERENCE_IMAGES} images
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAllImages();
                    }}
                    className="text-[9px] text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-between px-3 py-2 text-zinc-500 cursor-pointer hover:border-white/20"
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="text-[10px]">Add reference images (max 14)</span>
                </div>
                <span className="text-[10px] text-zinc-600">Drag / click</span>
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <select
              value={data.aspectRatio || "1:1"}
              onChange={(e) => updateNode(id, { aspectRatio: e.target.value as typeof data.aspectRatio })}
              className="nodrag nowheel fs-select flex-1 h-7 px-2 rounded-lg text-[10px]"
            >
              {aspectRatios.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
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
                <div className="space-y-3 pt-2 border-t border-white/5">
                  {/* Negative Prompt */}
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">
                      Negative Prompt
                    </label>
                    <textarea
                      value={data.negativePrompt || ""}
                      onChange={(e) => updateNode(id, { negativePrompt: e.target.value })}
                      placeholder="What to avoid..."
                      rows={3}
                      className="nodrag nowheel w-full px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none"
                    />
                  </div>

                  {/* Num Inference Steps */}
                  {(() => {
                    const isInherited = isSettingInherited(data, "numInferenceSteps");
                    const value = Math.min(Math.max(1, data.numInferenceSteps ?? 30), 60);
                    return (
                      <div>
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          Num Inference Steps
                          {isInherited && <Lock className="w-2.5 h-2.5 text-violet-400" />}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={1}
                            max={60}
                            step={1}
                            value={value}
                            onChange={(e) => updateNode(id, { numInferenceSteps: parseInt(e.target.value, 10) })}
                            disabled={isInherited}
                            className={`nodrag nowheel flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none ${
                              isInherited ? "accent-violet-500 cursor-not-allowed opacity-60" : "cursor-pointer accent-zinc-200"
                            }`}
                          />
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={value}
                            onChange={(e) => updateNode(id, { numInferenceSteps: parseInt(e.target.value || "30", 10) })}
                            disabled={isInherited}
                            className={`nodrag nowheel w-14 h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100 focus:outline-none focus:border-white/20 font-mono ${
                              isInherited ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Seed */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] text-zinc-500 uppercase tracking-wider">
                        Seed (optional)
                      </label>
                      {isSettingInherited(data, "seed") && (
                        <div className="flex items-center gap-1 text-[8px] text-violet-400">
                          <Lock className="w-2 h-2" />
                          <span>Inherited</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      value={data.seed || ""}
                      onChange={(e) => !isSettingInherited(data, "seed") && updateNode(id, { seed: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Random"
                      disabled={isSettingInherited(data, "seed")}
                      className={`nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 ${
                        isSettingInherited(data, "seed") ? "opacity-60 cursor-not-allowed border-violet-500/30 bg-violet-500/5" : ""
                      }`}
                    />
                  </div>

                  {/* Guidance Scale */}
                  {(() => {
                    const isInherited = isSettingInherited(data, "guidanceScale");
                    const value = Math.min(Math.max(1, data.guidanceScale ?? 5), 12);
                    return (
                      <div>
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          Guidance Scale
                          {isInherited && <Lock className="w-2.5 h-2.5 text-violet-400" />}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={1}
                            max={12}
                            step={0.5}
                            value={value}
                            onChange={(e) => updateNode(id, { guidanceScale: parseFloat(e.target.value) })}
                            disabled={isInherited}
                            className={`nodrag nowheel flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none ${
                              isInherited ? "accent-violet-500 cursor-not-allowed opacity-60" : "cursor-pointer accent-zinc-200"
                            }`}
                          />
                          <input
                            type="number"
                            min={1}
                            max={12}
                            step={0.5}
                            value={value}
                            onChange={(e) => updateNode(id, { guidanceScale: parseFloat(e.target.value || "5") })}
                            disabled={isInherited}
                            className={`nodrag nowheel w-14 h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100 focus:outline-none focus:border-white/20 font-mono ${
                              isInherited ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Additional Settings */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
                        Additional Settings
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <div className="mt-2 space-y-2">
                      <label className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer">
                        <span className="text-[10px] text-zinc-300">Truncate Prompt</span>
                        <input
                          type="checkbox"
                          checked={data.truncatePrompt ?? false}
                          onChange={(e) => updateNode(id, { truncatePrompt: e.target.checked })}
                          className="nodrag nowheel w-4 h-4 rounded border-white/20 bg-zinc-900 text-zinc-200 focus:ring-white/20"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer">
                        <span className="text-[10px] text-zinc-300">Prompt Enhancer</span>
                        <input
                          type="checkbox"
                          checked={data.promptEnhancer ?? false}
                          onChange={(e) => updateNode(id, { promptEnhancer: e.target.checked })}
                          className="nodrag nowheel w-4 h-4 rounded border-white/20 bg-zinc-900 text-zinc-200 focus:ring-white/20"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer">
                        <span className="text-[10px] text-zinc-300">Sync Mode</span>
                        <input
                          type="checkbox"
                          checked={data.syncMode ?? false}
                          onChange={(e) => updateNode(id, { syncMode: e.target.checked })}
                          className="nodrag nowheel w-4 h-4 rounded border-white/20 bg-zinc-900 text-zinc-200 focus:ring-white/20"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer">
                        <div>
                          <span className="text-[10px] text-zinc-300">Use Cache</span>
                          <p className="text-[8px] text-zinc-500">Skip re-run if unchanged</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={data.useCache === true}
                          onChange={(e) => updateNode(id, { useCache: e.target.checked })}
                          className="nodrag nowheel w-4 h-4 rounded border-white/20 bg-zinc-900 text-zinc-200 focus:ring-white/20"
                        />
                      </label>
                    </div>
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
                Generating...
              </>
            ) : data.result ? (
              "Output"
            ) : (
              "—"
            )}
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden min-h-[120px]">
            {data.result ? (
              <MediaLoader
                src={data.result}
                type="image"
                alt="Generated"
                className="w-full h-auto max-h-[220px] object-contain"
                containerClassName="min-h-[120px] flex items-center justify-center"
              />
            ) : (
              <MediaSkeleton type="image" className="min-h-[120px]" />
            )}
          </div>
          <div className="text-[9px] text-zinc-600 leading-relaxed">
            Connect the <span className="text-zinc-400 font-medium">Image</span> handle to use the generated result.
          </div>
        </div>
      }
    />
  );
}

export const SeedreamNode = memo(SeedreamNodeComponent);
