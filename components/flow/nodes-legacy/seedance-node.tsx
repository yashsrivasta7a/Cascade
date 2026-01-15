"use client";

import { memo, useState, useCallback, useRef } from "react";
import { NodeProps } from "reactflow";
import { Film, Play, Loader2, Settings, Upload, X, Lock, Link2 } from "lucide-react";
import { BaseNode, type BaseNodeData, isSettingInherited } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";
import { MediaLoader, MediaSkeleton } from "@/components/ui";

export interface SeedanceNodeData extends BaseNodeData {
  prompt?: string;
  duration?: "4s" | "8s" | "16s";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  seed?: number;
  context?: string;
  inputFrame?: string;
  result?: string;
  useCache?: boolean;
}

const nodeDef = NODE_DEFINITIONS.seedance;

function SeedanceNodeComponent(props: NodeProps<SeedanceNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const setWorkflowRunning = useFlowStore((s) => s.setWorkflowRunning);
  const isHandleConnected = useFlowStore((s) => s.isHandleConnected);
  
  // Check if prompt handle is connected (receiving from another node)
  const isPromptConnected = isHandleConnected(id, "prompt");

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean((data as any)?.advancedOpen));
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploadingFrame, setIsUploadingFrame] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    
    // Check file size - limit to 10MB (API body limit is ~4MB, base64 adds ~33%)
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 10) {
      updateNode(id, { status: "failed" });
      alert(`Image too large (${sizeMB.toFixed(1)}MB). Max 10MB.`);
      return;
    }
    
    setIsUploadingFrame(true);
    
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
          updateNode(id, { inputFrame: url });
          setIsUploadingFrame(false);
          return;
        }
      } catch (err) {
        console.warn("[Seedance] CDN upload failed, using base64:", err);
      }
      
      // Fallback to base64 if CDN upload fails
      updateNode(id, { inputFrame: base64 });
      setIsUploadingFrame(false);
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
    setWorkflowRunning(true); // Enable polling for status updates

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
            nodeId: id, // Pass flow node ID for polling
          },
        }),
      });

      const result = await response.json();
      if (result.status === "triggered") {
        updateNode(id, { status: "running" });
        
        // Poll for status updates
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/nodes/status?nodeId=${encodeURIComponent(id)}`);
            if (!statusRes.ok) return;
            
            const statusData = await statusRes.json();
            console.log(`[Seedance] Poll status for ${id}:`, statusData.status);
            
            if (statusData.status === "completed") {
              clearInterval(pollInterval);
              setIsProcessing(false);
              const videoUrl = statusData.output?.video?.url;
              updateNode(id, {
                result: videoUrl || "",
                status: "completed",
              });
              setWorkflowRunning(false);
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              setIsProcessing(false);
              updateNode(id, {
                result: "",
                status: "failed",
                error: statusData.error || "Generation failed",
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
          } catch (err) {
            console.error("[Seedance] Poll error:", err);
          }
        }, 2000);
      }
    } catch (error) {
      updateNode(id, { status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      setWorkflowRunning(false);
    } finally {
      setIsProcessing(false);
    }
  }, [data.prompt, data.context, data.duration, data.aspectRatio, data.inputFrame, data.seed, id, updateNode, setWorkflowRunning]);

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
        { id: "prompt", type: "prompt", label: "Prompt", required: true },
        // Align port id with node.data field used by UI so edges override correctly
        { id: "inputFrame", type: "image", label: "Start Frame" },
        { id: "duration", type: "duration", label: "Duration", hidden: !showSettings },
        { id: "aspectRatio", type: "aspectRatio", label: "Aspect", hidden: !showSettings },
        { id: "seed", type: "seed", label: "Seed", hidden: !showSettings },
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
          <div className="relative">
            {isPromptConnected && (
              <div className="absolute top-1 right-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-500/30">
                <Link2 className="w-2.5 h-2.5 text-violet-400" />
                <span className="text-[8px] text-violet-400 font-medium">LINKED</span>
              </div>
            )}
            <textarea
              value={data.prompt || ""}
              onChange={(e) => !isPromptConnected && updateNode(id, { prompt: e.target.value })}
              placeholder={isPromptConnected ? "Waiting for response from connected node..." : data.context ? "Override prompt..." : "Describe the video..."}
              rows={2}
              readOnly={isPromptConnected}
              className={`nodrag nowheel w-full px-3 py-2 rounded-lg border text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none ${
                isPromptConnected
                  ? "bg-violet-500/5 border-violet-500/20"
                  : "bg-zinc-900/60 border-white/10 focus:border-white/20"
              }`}
            />
          </div>

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
            {isUploadingFrame ? (
              <div className="flex flex-col items-center justify-center py-3 text-violet-400">
                <Loader2 className="w-4 h-4 mb-1 animate-spin" />
                <span className="text-[9px]">Uploading frame...</span>
              </div>
            ) : data.inputFrame ? (
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
              className="nodrag nowheel fs-select flex-1 h-7 px-2 rounded-lg text-[10px]"
            >
              <option value="4s">4 sec</option>
              <option value="8s">8 sec</option>
              <option value="16s">16 sec</option>
            </select>
            <select
              value={data.aspectRatio || "16:9"}
              onChange={(e) => updateNode(id, { aspectRatio: e.target.value as "16:9" | "9:16" | "1:1" })}
              className="nodrag nowheel fs-select flex-1 h-7 px-2 rounded-lg text-[10px]"
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
                <div className="pt-2 border-t border-white/5 space-y-2">
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">Seed</label>
                    <input
                      type="number"
                      value={data.seed || ""}
                      onChange={(e) => updateNode(id, { seed: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Random"
                      className="nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100"
                    />
                  </div>
                  
                  {/* Use Cache Toggle */}
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
          <div className="bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden">
            {data.result ? (
              <MediaLoader
                src={data.result}
                type="video"
                className="w-full aspect-video"
                containerClassName="aspect-video"
              />
            ) : (
              <MediaSkeleton type="video" className="aspect-video" />
            )}
          </div>
        </div>
      }
    />
  );
}

export const SeedanceNode = memo(SeedanceNodeComponent);
