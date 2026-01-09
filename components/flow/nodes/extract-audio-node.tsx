"use client";

import { memo, useState, useCallback, useRef, useMemo } from "react";
import { NodeProps } from "reactflow";
import { AudioLines, Play, Loader2, Upload, X, Film, Download, Volume2, Lock, ChevronDown } from "lucide-react";
import { BaseNode, type BaseNodeData, isSettingInherited } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface ExtractAudioNodeData extends BaseNodeData {
  format?: "mp3" | "wav" | "aac" | "ogg";
  bitrate?: "128k" | "192k" | "256k" | "320k";
  sampleRate?: "22050" | "44100" | "48000";
  channels?: "1" | "2";
  normalize?: boolean;
  inputVideo?: string;
  result?: string;
  advancedOpen?: boolean;
  error?: string;
}

const nodeDef = NODE_DEFINITIONS["extract-audio"];

const FORMAT_INFO = {
  mp3: { name: "MP3", desc: "Most compatible, good compression" },
  wav: { name: "WAV", desc: "Lossless, large files" },
  aac: { name: "AAC", desc: "High quality, Apple preferred" },
  ogg: { name: "OGG", desc: "Open format, good quality" },
};

const BITRATE_INFO = {
  "128k": { name: "128 kbps", desc: "Good for speech" },
  "192k": { name: "192 kbps", desc: "Balanced quality" },
  "256k": { name: "256 kbps", desc: "High quality" },
  "320k": { name: "320 kbps", desc: "Maximum quality" },
};

function ExtractAudioNodeComponent(props: NodeProps<ExtractAudioNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  const workflowId = useFlowStore((s) => s.workflowId);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean(data.advancedOpen));
  const [isDragOver, setIsDragOver] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) return;
    
    // Check file size - limit to 10MB for base64 JSON transport
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 10) {
      updateNode(id, { error: `File too large (${sizeMB.toFixed(1)}MB). Max 10MB for video processing. Try a shorter or lower resolution video.` });
      return;
    }

    updateNode(id, { error: undefined, status: "idle" });

    // Convert to base64 data URL so it can be sent to the server
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateNode(id, { inputVideo: base64, result: undefined, error: undefined });
    };
    reader.onerror = () => {
      updateNode(id, { error: "Failed to read file" });
    };
    reader.readAsDataURL(file);
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
    updateNode(id, { status: "running", error: undefined });

    try {
      const response = await fetch("/api/nodes/execute-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "extract-audio",
          nodeId: id,
          nodeLabel: data.label || nodeDef.label,
          workflowId: workflowId ?? undefined,
          input: {
            video: { url: data.inputVideo },
            format: data.format || "mp3",
            bitrate: data.bitrate || "192k",
            sampleRate: data.sampleRate || "44100",
            channels: data.channels || "2",
            normalize: data.normalize || false,
          },
        }),
      });

      const result = await response.json();
      if (result.success && result.output?.audio?.url) {
        updateNode(id, { result: result.output.audio.url, status: "completed" });
        // Propagate to connected nodes
        propagateOutput(id, result.output.audio.url);
      } else {
        updateNode(id, { status: "failed", error: result.error || "Unknown error" });
      }
    } catch (error) {
      updateNode(id, { status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setIsProcessing(false);
    }
  }, [data.inputVideo, data.format, data.bitrate, data.sampleRate, data.channels, data.normalize, id, updateNode, propagateOutput]);

  // Memoize inputs
  const inputs = useMemo(() => [
    { id: "inputVideo", type: "video" as const, label: "Video", required: true },
    { id: "format", type: "text" as const, label: "Format", hidden: !showSettings },
    { id: "bitrate", type: "text" as const, label: "Bitrate", hidden: !showSettings },
    { id: "sampleRate", type: "text" as const, label: "Sample Rate", hidden: !showSettings },
    { id: "channels", type: "text" as const, label: "Channels", hidden: !showSettings },
  ], [showSettings]);

  const handleDownload = useCallback(() => {
    if (!data.result) return;
    const link = document.createElement("a");
    link.href = data.result;
    link.download = `audio-${Date.now()}.${data.format || "mp3"}`;
    link.click();
  }, [data.result, data.format]);

  const formatInfo = FORMAT_INFO[data.format || "mp3"];
  const bitrateInfo = BITRATE_INFO[data.bitrate || "192k"];

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
      inputs={inputs}
      outputs={[{ id: "audio", type: "audio", label: "Audio" }]}
      left={
        <div className="space-y-3">
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

          {/* INPUT Section */}
          <div>
            <label className="text-[10px] font-medium text-zinc-400 mb-1.5 block">Video Input</label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => !data.inputVideo && videoInputRef.current?.click()}
              className={`nodrag nowheel relative rounded-xl overflow-hidden transition-all cursor-pointer ${
                isDragOver
                  ? "ring-2 ring-violet-500"
                  : data.inputVideo
                  ? "ring-1 ring-white/10"
                  : "border-2 border-dashed border-white/10 hover:border-white/20"
              }`}
            >
              {data.inputVideo ? (
                <div className="relative">
                  <video 
                    src={data.inputVideo} 
                    className="w-full h-auto max-h-[100px] object-contain bg-black/20" 
                    muted 
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); updateNode(id, { inputVideo: undefined, result: undefined }); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-lg hover:bg-black/90 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <div className="absolute bottom-2 left-2 text-[9px] text-violet-400 bg-black/70 px-2 py-1 rounded-lg flex items-center gap-1">
                    <Film className="w-3 h-3" />Video loaded
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-zinc-500">
                  <Film className="w-5 h-5 mb-2" />
                  <span className="text-[10px]">Drop video or click to upload</span>
                  <span className="text-[9px] text-zinc-600 mt-1">Max 10MB</span>
                </div>
              )}
            </div>
          </div>

          {/* Format Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-zinc-500 mb-1 block">Format</label>
              <select
                value={data.format || "mp3"}
                onChange={(e) => updateNode(id, { format: e.target.value as any })}
                className="nodrag nowheel w-full h-8 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-[10px] text-zinc-300"
              >
                {Object.entries(FORMAT_INFO).map(([key, { name }]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 mb-1 block">Bitrate</label>
              <select
                value={data.bitrate || "192k"}
                onChange={(e) => updateNode(id, { bitrate: e.target.value as any })}
                className="nodrag nowheel w-full h-8 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-[10px] text-zinc-300"
              >
                {Object.entries(BITRATE_INFO).map(([key, { name }]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Info badges */}
          <div className="flex gap-2 text-[8px]">
            <span className="px-2 py-1 bg-white/5 rounded-md text-zinc-400">{formatInfo.desc}</span>
            <span className="px-2 py-1 bg-white/5 rounded-md text-zinc-400">{bitrateInfo.desc}</span>
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <button
              onClick={runExtract}
              disabled={!data.inputVideo || isProcessing}
              className={`nodrag nowheel flex-1 h-8 px-4 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-2 transition-all ${
                isProcessing
                  ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
                  : data.inputVideo
                  ? "bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Extracting...</>
              ) : (
                <><AudioLines className="w-3.5 h-3.5" />Extract Audio</>
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
                <div className="text-[9px] text-zinc-500">Format, bitrate, and more.</div>
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

          {/* Collapsible Advanced Settings */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-zinc-500 mb-1 block">Sample Rate</label>
                      <select
                        value={data.sampleRate || "44100"}
                        onChange={(e) => updateNode(id, { sampleRate: e.target.value as any })}
                        className="nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-300"
                      >
                        <option value="22050">22.05 kHz</option>
                        <option value="44100">44.1 kHz (CD)</option>
                        <option value="48000">48 kHz (Video)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 mb-1 block">Channels</label>
                      <select
                        value={data.channels || "2"}
                        onChange={(e) => updateNode(id, { channels: e.target.value as any })}
                        className="nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-300"
                      >
                        <option value="1">Mono</option>
                        <option value="2">Stereo</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.normalize || false}
                      onChange={(e) => updateNode(id, { normalize: e.target.checked })}
                      className="nodrag nowheel w-4 h-4 rounded bg-zinc-900 border-white/20 accent-violet-500"
                    />
                    <div>
                      <span className="text-[10px] text-zinc-300">Normalize Audio</span>
                      <p className="text-[8px] text-zinc-500">Adjusts volume to optimal level</p>
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
              {isProcessing ? "Processing..." : data.result ? "Audio Output" : "Result"}
            </label>
            <div className={`relative rounded-xl overflow-hidden transition-all ${
              data.result 
                ? "ring-1 ring-violet-500/30 bg-violet-500/5" 
                : "bg-white/[0.02] border border-white/5"
            }`}>
              {data.result ? (
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2 text-violet-400">
                    <Volume2 className="w-4 h-4" />
                    <span className="text-[10px]">Audio extracted successfully</span>
                  </div>
                  <audio 
                    src={data.result} 
                    controls 
                    className="w-full h-8" 
                  />
                  <button
                    onClick={handleDownload}
                    className="nodrag nowheel w-full h-7 px-3 rounded-lg bg-violet-500/20 border border-violet-500/30 text-[10px] font-medium text-violet-300 flex items-center justify-center gap-2 hover:bg-violet-500/30 transition-all"
                  >
                    <Download className="w-3 h-3" />
                    Download {(data.format || "mp3").toUpperCase()}
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <span className="text-zinc-600 text-[10px]">
                    {data.inputVideo ? "Click 'Extract Audio' to process" : "Upload a video first"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      }
    />
  );
}

export const ExtractAudioNode = memo(ExtractAudioNodeComponent);
