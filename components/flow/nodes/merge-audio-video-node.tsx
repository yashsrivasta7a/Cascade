"use client";

import { memo, useState, useCallback, useRef, useMemo } from "react";
import { NodeProps } from "reactflow";
import { Combine, Settings, Play, Loader2, Upload, X, Film, Volume2 } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface MergeAudioVideoNodeData extends BaseNodeData {
  replaceAudio?: boolean;
  inputVideo?: string;
  inputAudio?: string;
  result?: string;
  advancedOpen?: boolean;
  error?: string;
}

const nodeDef = NODE_DEFINITIONS["merge-audio-video"];

function MergeAudioVideoNodeComponent(props: NodeProps<MergeAudioVideoNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean(data.advancedOpen));
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

  const runMerge = useCallback(async () => {
    if (!data.inputVideo || !data.inputAudio) return;
    
    // Check combined size before sending (rough estimate from base64 length)
    const videoSize = data.inputVideo.length;
    const audioSize = data.inputAudio.length;
    const combinedSizeMB = (videoSize + audioSize) / (1024 * 1024);
    
    if (combinedSizeMB > 45) {
      updateNode(id, { 
        status: "failed", 
        error: `Combined input too large (${combinedSizeMB.toFixed(1)}MB). Try using smaller video/audio files (max ~15MB each).` 
      });
      return;
    }
    
    setIsProcessing(true);
    updateNode(id, { status: "running", error: undefined });

    try {
      const response = await fetch("/api/nodes/execute-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "merge-audio-video",
          nodeId: id,
          nodeLabel: data.label || nodeDef.label,
          input: {
            video: { url: data.inputVideo },
            audio: { url: data.inputAudio },
            replaceAudio: data.replaceAudio !== false,
          },
        }),
      });

      // Handle response parsing errors (can happen with very large payloads)
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        updateNode(id, { 
          status: "failed", 
          error: "Response too large or malformed. Try with smaller files." 
        });
        return;
      }

      if (result.success && result.output?.video?.url) {
        updateNode(id, { result: result.output.video.url, status: "completed" });
        // Propagate to connected nodes
        propagateOutput(id, result.output.video.url);
      } else {
        updateNode(id, { status: "failed", error: result.error || "Unknown error" });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      // Check for common size-related errors
      if (errorMsg.includes("JSON") || errorMsg.includes("body")) {
        updateNode(id, { status: "failed", error: "Request too large. Try using smaller video/audio files." });
      } else {
        updateNode(id, { status: "failed", error: errorMsg });
      }
    } finally {
      setIsProcessing(false);
    }
  }, [data.inputVideo, data.inputAudio, data.replaceAudio, id, updateNode, propagateOutput]);

  const hasInputs = Boolean(data.inputVideo && data.inputAudio);

  // Memoize inputs
  const inputs = useMemo(() => [
    { id: "inputVideo", type: "video" as const, label: "Video", required: true },
    { id: "inputAudio", type: "audio" as const, label: "Audio", required: true },
    { id: "replaceAudio", type: "boolean" as const, label: "Replace", hidden: !showSettings },
  ], [showSettings]);

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
        icon: <Combine className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={inputs}
      outputs={[{ id: "combined", type: "video", label: "Combined" }]}
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
            onDrop={(e) => { e.preventDefault(); setIsDragOverVideo(false); const file = e.dataTransfer.files[0]; if (file) handleVideoUpload(file); }}
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
                <video src={data.inputVideo} className="w-full h-10 object-cover rounded" muted />
                <button
                  onClick={(e) => { e.stopPropagation(); updateNode(id, { inputVideo: undefined }); }}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full hover:bg-black/80"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
                <div className="absolute bottom-1 left-1 text-[8px] text-violet-400 bg-black/60 px-1 py-0.5 rounded flex items-center gap-0.5">
                  <Film className="w-2 h-2" />Video
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 py-2 text-zinc-500">
                <Film className="w-3 h-3" />
                <span className="text-[9px]">Drop video</span>
              </div>
            )}
          </div>

          {/* Audio Upload */}
          <div
            onDrop={(e) => { e.preventDefault(); setIsDragOverAudio(false); const file = e.dataTransfer.files[0]; if (file) handleAudioUpload(file); }}
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
              <div className="relative p-1.5">
                <audio src={data.inputAudio} controls className="w-full h-5" />
                <button
                  onClick={(e) => { e.stopPropagation(); updateNode(id, { inputAudio: undefined }); }}
                  className="absolute top-0 right-0 p-1 bg-black/60 rounded-full hover:bg-black/80"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 py-2 text-zinc-500">
                <Volume2 className="w-3 h-3" />
                <span className="text-[9px]">Drop audio</span>
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
              onClick={runMerge}
              disabled={!hasInputs}
              className={`nodrag nowheel flex-1 h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1.5 ${
                isProcessing
                  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  : hasInputs
                  ? "bg-zinc-500/20 border-zinc-500/30 text-zinc-300 hover:bg-zinc-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3" />Merge</>}
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.replaceAudio !== false}
                      onChange={(e) => updateNode(id, { replaceAudio: e.target.checked })}
                      className="nodrag nowheel w-4 h-4 rounded bg-zinc-900 border-white/20"
                    />
                    <div>
                      <span className="text-[10px] text-zinc-300">Replace Original Audio</span>
                      <p className="text-[8px] text-zinc-500">When off, mixes both audio tracks</p>
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
        </div>
      }
      right={
        <div className="space-y-2">
          <div className="text-[10px] text-zinc-500">
            {isProcessing ? "Merging..." : data.result ? "Combined" : "No output"}
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden min-h-[60px] flex items-center justify-center">
            {data.result ? (
              <video src={data.result} controls className="w-full h-auto max-h-[100px]" />
            ) : (
              <span className="text-zinc-600 text-[10px]">—</span>
            )}
          </div>
        </div>
      }
    />
  );
}

export const MergeAudioVideoNode = memo(MergeAudioVideoNodeComponent);
