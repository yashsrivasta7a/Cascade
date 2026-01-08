"use client";

import { memo, useState, useCallback, useRef } from "react";
import { NodeProps } from "reactflow";
import { Mic2, Play, Loader2, Settings, Upload, X, Film, Volume2 } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface LipsyncNodeData extends BaseNodeData {
  model?: "sync-1.5" | "sync-1.6-beta";
  inputVideo?: string;
  inputAudio?: string;
  result?: string;
  error?: string;
}

const nodeDef = NODE_DEFINITIONS.lipsync;

function LipsyncNodeComponent(props: NodeProps<LipsyncNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean((data as any)?.advancedOpen));
  const [isDragOverVideo, setIsDragOverVideo] = useState(false);
  const [isDragOverAudio, setIsDragOverAudio] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) return;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 10) {
      updateNode(id, { error: `Video too large (${sizeMB.toFixed(1)}MB). Max 10MB.` });
      return;
    }
    // Convert to base64 data URL so it can be sent to the server
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateNode(id, { inputVideo: base64, error: undefined });
    };
    reader.readAsDataURL(file);
  }, [id, updateNode]);

  const handleAudioUpload = useCallback((file: File) => {
    if (!file.type.startsWith("audio/")) return;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 10) {
      updateNode(id, { error: `Audio too large (${sizeMB.toFixed(1)}MB). Max 10MB.` });
      return;
    }
    // Convert to base64 data URL so it can be sent to the server
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateNode(id, { inputAudio: base64, error: undefined });
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
  }, [data.inputVideo, data.inputAudio, data.model, id, updateNode]);

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
        { id: "model", type: "text", label: "Model", hidden: !showSettings },
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
            {data.inputVideo ? (
              <div className="relative p-1">
                <video src={data.inputVideo} className="w-full h-12 object-cover rounded" muted />
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
            {data.inputAudio ? (
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
                <div className="pt-2 border-t border-white/5">
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

export const LipsyncNode = memo(LipsyncNodeComponent);
