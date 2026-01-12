"use client";

import { memo, useState, useCallback, useRef } from "react";
import { NodeProps } from "reactflow";
import { Mic2, Play, Loader2, Settings, Upload, X, Film, Volume2, Lock } from "lucide-react";
import { BaseNode, type BaseNodeData, isSettingInherited } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";
import { MediaLoader, MediaSkeleton } from "@/components/ui";

export interface LipsyncNodeData extends BaseNodeData {
  model?: "sync-1.5" | "sync-1.6-beta";
  inputVideo?: string;
  inputAudio?: string;
  result?: string;
  error?: string;
  useCache?: boolean;
}

const nodeDef = NODE_DEFINITIONS.lipsync;

function LipsyncNodeComponent(props: NodeProps<LipsyncNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const setWorkflowRunning = useFlowStore((s) => s.setWorkflowRunning);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean((data as any)?.advancedOpen));
  const [isDragOverVideo, setIsDragOverVideo] = useState(false);
  const [isDragOverAudio, setIsDragOverAudio] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) return;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 25) {
      updateNode(id, { error: `Video too large (${sizeMB.toFixed(1)}MB). Max 25MB.` });
      return;
    }
    
    setIsUploadingVideo(true);
    
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
            type: "video",
            filename: file.name,
          }),
        });
        
        if (response.ok) {
          const { url } = await response.json();
          updateNode(id, { inputVideo: url, error: undefined });
          setIsUploadingVideo(false);
          return;
        }
      } catch (err) {
        console.warn("[Lipsync] CDN video upload failed, using base64:", err);
      }
      
      updateNode(id, { inputVideo: base64, error: undefined });
      setIsUploadingVideo(false);
    };
    reader.readAsDataURL(file);
  }, [id, updateNode]);

  const handleAudioUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio/")) return;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 25) {
      updateNode(id, { error: `Audio too large (${sizeMB.toFixed(1)}MB). Max 25MB.` });
      return;
    }
    
    setIsUploadingAudio(true);
    
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
            type: "audio",
            filename: file.name,
          }),
        });
        
        if (response.ok) {
          const { url } = await response.json();
          updateNode(id, { inputAudio: url, error: undefined });
          setIsUploadingAudio(false);
          return;
        }
      } catch (err) {
        console.warn("[Lipsync] CDN audio upload failed, using base64:", err);
      }
      
      updateNode(id, { inputAudio: base64, error: undefined });
      setIsUploadingAudio(false);
    };
    reader.readAsDataURL(file);
  }, [id, updateNode]);

  const handleVideoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverVideo(false);
    const file = e.dataTransfer.files[0];
    if (file) handleVideoUpload(file);
  }, [handleVideoUpload]);

  const handleAudioDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverAudio(false);
    const file = e.dataTransfer.files[0];
    if (file) handleAudioUpload(file);
  }, [handleAudioUpload]);

  const runLipsync = useCallback(async () => {
    if (!data.inputVideo || !data.inputAudio) return;
    
    setIsProcessing(true);
    updateNode(id, { status: "running" });
    setWorkflowRunning(true); // Enable polling for status updates

    try {
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "lipsync",
          input: {
            video: { url: data.inputVideo },
            audio: { url: data.inputAudio },
            model: data.model || "sync-1.5",
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
            console.log(`[Lipsync] Poll status for ${id}:`, statusData.status);
            
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
                error: statusData.error || "Lipsync failed",
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
            console.error("[Lipsync] Poll error:", err);
          }
        }, 2000);
      }
    } catch (error) {
      updateNode(id, { status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      setWorkflowRunning(false);
    } finally {
      setIsProcessing(false);
    }
  }, [data.inputVideo, data.inputAudio, data.model, id, updateNode, setWorkflowRunning]);

  const hasInputs = Boolean(data.inputVideo && data.inputAudio);

  return (
    <BaseNode
      {...props}
      color="violet"
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Mic2 className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        // Align port ids with node.data fields used by UI so edges override correctly
        { id: "inputVideo", type: "video", label: "Video", required: true },
        { id: "inputAudio", type: "audio", label: "Audio", required: true },
        { id: "model", type: "model", label: "Model", hidden: !showSettings },
      ]}
      outputs={[{ id: "synced", type: "video", label: "Synced" }]}
      left={
        <div className="space-y-2">
          {/* Hidden inputs */}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVideoUpload(file);
            }}
            className="hidden"
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAudioUpload(file);
            }}
            className="hidden"
          />

          {/* Video Upload */}
          <div
            onDrop={handleVideoDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOverVideo(true); }}
            onDragLeave={() => setIsDragOverVideo(false)}
            onClick={() => !data.inputVideo && videoInputRef.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer ${
              isDragOverVideo
                ? "border-violet-500 bg-violet-500/10"
                : data.inputVideo
                ? "border-violet-500/30 bg-violet-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {isUploadingVideo ? (
              <div className="flex flex-col items-center justify-center py-3 text-violet-400">
                <Loader2 className="w-4 h-4 mb-1 animate-spin" />
                <span className="text-[9px]">Uploading video...</span>
              </div>
            ) : data.inputVideo ? (
              <div className="relative p-1">
                <video src={data.inputVideo} className="w-full aspect-video object-cover rounded" muted />
                <button
                  onClick={(e) => { e.stopPropagation(); updateNode(id, { inputVideo: undefined }); }}
                  className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <div className="absolute bottom-2 left-2 text-[9px] text-violet-400 bg-black/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Film className="w-2.5 h-2.5" />Video
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 text-zinc-500">
                <Film className="w-4 h-4 mb-1" />
                <span className="text-[9px]">Drop video or click</span>
              </div>
            )}
          </div>

          {/* Audio Upload */}
          <div
            onDrop={handleAudioDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOverAudio(true); }}
            onDragLeave={() => setIsDragOverAudio(false)}
            onClick={() => !data.inputAudio && audioInputRef.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer ${
              isDragOverAudio
                ? "border-amber-500 bg-amber-500/10"
                : data.inputAudio
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {isUploadingAudio ? (
              <div className="flex flex-col items-center justify-center py-3 text-amber-400">
                <Loader2 className="w-4 h-4 mb-1 animate-spin" />
                <span className="text-[9px]">Uploading audio...</span>
              </div>
            ) : data.inputAudio ? (
              <div className="relative p-2">
                <audio src={data.inputAudio} controls className="w-full h-6" />
                <button
                  onClick={(e) => { e.stopPropagation(); updateNode(id, { inputAudio: undefined }); }}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full hover:bg-black/80"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 text-zinc-500">
                <Volume2 className="w-4 h-4 mb-1" />
                <span className="text-[9px]">Drop audio or click</span>
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
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
              onClick={runLipsync}
              disabled={!hasInputs}
              className={`nodrag nowheel flex-1 h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1.5 ${
                isProcessing
                  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  : hasInputs
                  ? "bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3" />Sync</>}
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
                    <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">Model</label>
                    <select
                      value={data.model || "sync-1.5"}
                      onChange={(e) => updateNode(id, { model: e.target.value as "sync-1.5" | "sync-1.6-beta" })}
                      className="nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-300"
                    >
                      <option value="sync-1.5">Sync 1.5 (Stable)</option>
                      <option value="sync-1.6-beta">Sync 1.6 Beta</option>
                    </select>
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

          {/* Error Display */}
          {data.error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] text-red-300">
              {data.error}
            </div>
          )}
        </div>
      }
      right={
        <div className="space-y-2">
          <div className="text-[10px] text-zinc-500">
            {isProcessing ? "Syncing..." : data.result ? "Synced Output" : "No output"}
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

export const LipsyncNode = memo(LipsyncNodeComponent);
