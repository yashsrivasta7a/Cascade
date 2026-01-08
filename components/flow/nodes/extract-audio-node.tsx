"use client";

import { memo, useState, useCallback, useRef } from "react";
import { NodeProps } from "reactflow";
import { AudioLines, Settings, Play, Loader2, Upload, X, Film } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface ExtractAudioNodeData extends BaseNodeData {
  format?: "mp3" | "wav" | "aac";
  inputVideo?: string;
  result?: string;
}

const nodeDef = NODE_DEFINITIONS["extract-audio"];

function ExtractAudioNodeComponent(props: NodeProps<ExtractAudioNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) return;
    const url = URL.createObjectURL(file);
    updateNode(id, { inputVideo: url });
  }, [id, updateNode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleVideoUpload(file);
  }, [handleVideoUpload]);

  const runExtract = useCallback(async () => {
    if (!data.inputVideo) return;
    
    setIsProcessing(true);
    updateNode(id, { status: "running" });

    try {
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "extract-audio",
          input: {
            video: { url: data.inputVideo },
            format: data.format || "mp3",
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
  }, [data.inputVideo, data.format, id, updateNode]);

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
        icon: <AudioLines className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[{ id: "video", type: "video", label: "Video" }]}
      outputs={[{ id: "audio", type: "audio", label: "Audio" }]}
      left={
        <div className="space-y-2">
          {/* Hidden input */}
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

          {/* Video Upload */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => !data.inputVideo && videoInputRef.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer ${
              isDragOver
                ? "border-violet-500 bg-violet-500/10"
                : data.inputVideo
                ? "border-violet-500/30 bg-violet-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {data.inputVideo ? (
              <div className="relative p-1">
                <video src={data.inputVideo} className="w-full h-14 object-cover rounded" muted />
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
              <div className="flex flex-col items-center justify-center py-4 text-zinc-500">
                <Film className="w-4 h-4 mb-1" />
                <span className="text-[9px]">Drop video or click</span>
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <select
              value={data.format || "mp3"}
              onChange={(e) => updateNode(id, { format: e.target.value as "mp3" | "wav" | "aac" })}
              className="nodrag nowheel flex-1 h-7 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-[10px] text-zinc-300"
            >
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="aac">AAC</option>
            </select>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`nodrag nowheel h-7 w-7 rounded-lg border flex items-center justify-center ${
                showSettings ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.03] border-white/10 text-zinc-400"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={runExtract}
              disabled={!data.inputVideo}
              className={`nodrag nowheel h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 ${
                isProcessing
                  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  : data.inputVideo
                  ? "bg-zinc-500/20 border-zinc-500/30 text-zinc-300 hover:bg-zinc-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3" />Extract</>}
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
                  <div className="text-[9px] text-zinc-500 space-y-1">
                    <div className="flex justify-between">
                      <span>MP3</span>
                      <span className="text-zinc-400">Compressed, most compatible</span>
                    </div>
                    <div className="flex justify-between">
                      <span>WAV</span>
                      <span className="text-zinc-400">Lossless, large files</span>
                    </div>
                    <div className="flex justify-between">
                      <span>AAC</span>
                      <span className="text-zinc-400">Advanced, Apple preferred</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      right={
        <div className="space-y-2">
          <div className="text-[10px] text-zinc-500">
            {isProcessing ? "Extracting..." : data.result ? "Audio Ready" : "No output"}
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-2 min-h-[50px] flex items-center justify-center">
            {data.result ? (
              <audio src={data.result} controls className="w-full h-8" />
            ) : (
              <span className="text-zinc-600 text-[10px]">—</span>
            )}
          </div>
        </div>
      }
    />
  );
}

export const ExtractAudioNode = memo(ExtractAudioNodeComponent);
