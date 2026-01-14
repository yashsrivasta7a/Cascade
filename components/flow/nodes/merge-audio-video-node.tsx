"use client";

import { memo, useState, useCallback, useRef, useMemo } from "react";
import { NodeProps } from "reactflow";
import { Combine, Play, Loader2, Upload, X, Film, Volume2, Lock, ChevronDown, Link2 } from "lucide-react";
import { BaseNode, type BaseNodeData, isSettingInherited } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";
import { MediaLoader, MediaSkeleton } from "@/components/ui";

export interface MergeAudioVideoNodeData extends BaseNodeData {
  replaceAudio?: boolean;
  inputVideo?: string;
  inputAudio?: string;
  result?: string;
  advancedOpen?: boolean;
  error?: string;
  useCache?: boolean;
}

const nodeDef = NODE_DEFINITIONS["merge-audio-video"];

function MergeAudioVideoNodeComponent(props: NodeProps<MergeAudioVideoNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  const workflowId = useFlowStore((s) => s.workflowId);
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean(data.advancedOpen));
  const [isDragOverVideo, setIsDragOverVideo] = useState(false);
  const [isDragOverAudio, setIsDragOverAudio] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Check for incoming video connection
  const connectedVideo = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === "inputVideo");
    if (!edge) return null;
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) return null;
    const sourceData = sourceNode.data as Record<string, unknown>;
    if (sourceData.result && typeof sourceData.result === "string") return sourceData.result;
    if (sourceData.outputVideo && typeof sourceData.outputVideo === "string") return sourceData.outputVideo;
    return null;
  }, [edges, nodes, id]);

  // Check for incoming audio connection
  const connectedAudio = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === "inputAudio");
    if (!edge) return null;
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) return null;
    const sourceData = sourceNode.data as Record<string, unknown>;
    if (sourceData.result && typeof sourceData.result === "string") return sourceData.result;
    if (sourceData.outputAudio && typeof sourceData.outputAudio === "string") return sourceData.outputAudio;
    return null;
  }, [edges, nodes, id]);

  // Check if handles have incoming connections (even if no output yet)
  const hasVideoConnection = useMemo(() => edges.some(e => e.target === id && e.targetHandle === "inputVideo"), [edges, id]);
  const hasAudioConnection = useMemo(() => edges.some(e => e.target === id && e.targetHandle === "inputAudio"), [edges, id]);
  
  // Effective inputs: use connected if available, otherwise use direct data
  const effectiveVideo = data.inputVideo || connectedVideo;
  const effectiveAudio = data.inputAudio || connectedAudio;
  
  // hasInputs is true if we have the actual data OR if we have a connection (dependencies will run)
  const hasInputs = Boolean((effectiveVideo || hasVideoConnection) && (effectiveAudio || hasAudioConnection));
  // Check if we need to run dependencies (have connections but no data yet)
  const needsDependencies = (hasVideoConnection && !effectiveVideo) || (hasAudioConnection && !effectiveAudio);
  
  // Check if replaceAudio setting is being controlled by an incoming connection
  const isReplaceAudioInherited = isSettingInherited(data, "replaceAudio");

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
        console.warn("[MergeAudioVideo] CDN video upload failed, using base64:", err);
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
        console.warn("[MergeAudioVideo] CDN audio upload failed, using base64:", err);
      }
      
      updateNode(id, { inputAudio: base64, error: undefined });
      setIsUploadingAudio(false);
    };
    reader.readAsDataURL(file);
  }, [id, updateNode]);

  const runNode = useFlowStore((s) => s.runNode);
  
  const runMerge = useCallback(async () => {
    // If we need dependencies, use the flow store's runNode which handles them
    if (needsDependencies) {
      setIsProcessing(true);
      updateNode(id, { status: "queued", error: undefined });
      
      try {
        // This will automatically run parent nodes first, then this node
        await runNode(id);
      } catch (error) {
        updateNode(id, { status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    
    // Direct execution when we have all inputs ready
    if (!effectiveVideo || !effectiveAudio) return;
    
    // Check combined size before sending (rough estimate from base64 length)
    const videoSize = effectiveVideo.length;
    const audioSize = effectiveAudio.length;
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
          workflowId: workflowId ?? undefined,
          input: {
            video: { url: effectiveVideo },
            audio: { url: effectiveAudio },
            replaceAudio: data.replaceAudio !== false,
            useCache: data.useCache === true,
          },
        }),
      });

      // Handle non-JSON responses gracefully (e.g. Vercel 413 "Request Entity Too Large")
      const rawText = await response.text();
      let result: any = null;
      try {
        result = rawText ? JSON.parse(rawText) : null;
      } catch {
        // Not JSON
      }

      if (!response.ok) {
        updateNode(id, {
          status: "failed",
          error: (result?.error as string) || rawText || `Request failed (${response.status})`,
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
  }, [needsDependencies, effectiveVideo, effectiveAudio, data.replaceAudio, data.label, data.useCache, id, updateNode, propagateOutput, workflowId, runNode]);

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
            onClick={() => !effectiveVideo && videoInputRef.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all ${
              isDragOverVideo
                ? "border-violet-500 bg-violet-500/10 cursor-pointer"
                : effectiveVideo
                ? "border-violet-500/30 bg-violet-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20 cursor-pointer"
            }`}
          >
            {isUploadingVideo ? (
              <div className="flex items-center justify-center gap-1.5 py-2 text-violet-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[9px]">Uploading...</span>
              </div>
            ) : effectiveVideo ? (
              <div className="relative p-1">
                <video src={effectiveVideo} className="w-full aspect-video object-cover rounded" muted />
                {data.inputVideo && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateNode(id, { inputVideo: undefined }); }}
                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                )}
                <div className="absolute bottom-2 left-2 text-[8px] text-violet-400 bg-black/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Film className="w-2 h-2" />{connectedVideo ? "← Connected" : "Video"}
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
            onClick={() => !effectiveAudio && audioInputRef.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all ${
              isDragOverAudio
                ? "border-amber-500 bg-amber-500/10 cursor-pointer"
                : effectiveAudio
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20 cursor-pointer"
            }`}
          >
            {isUploadingAudio ? (
              <div className="flex items-center justify-center gap-1.5 py-2 text-amber-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[9px]">Uploading...</span>
              </div>
            ) : effectiveAudio ? (
              <div className="relative p-1.5">
                <audio src={effectiveAudio} controls className="w-full h-5" />
                {data.inputAudio && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateNode(id, { inputAudio: undefined }); }}
                    className="absolute top-0 right-0 p-1 bg-black/60 rounded-full hover:bg-black/80"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                )}
                {connectedAudio && (
                  <div className="text-[8px] text-amber-400 mt-1">← Connected</div>
                )}
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
              onClick={runMerge}
              disabled={!hasInputs || isProcessing}
              className={`nodrag nowheel flex-1 h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1.5 ${
                isProcessing
                  ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
                  : hasInputs
                  ? "bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] border-[#3a5a7f]/60 text-blue-100 hover:from-[#2a4a6f] hover:to-[#3a5a7f] shadow-[0_0_15px_rgba(30,58,95,0.4)]"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : needsDependencies ? (
                <><Play className="w-3 h-3" />Run </>
              ) : (
                <><Play className="w-3 h-3" />Merge</>
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
                <div className="text-[9px] text-zinc-500">Audio replacement options.</div>
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
                <div className="pt-2 space-y-3">
                  <label className={`flex items-center gap-2 ${isReplaceAudioInherited ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={data.replaceAudio !== false}
                        onChange={(e) => !isReplaceAudioInherited && updateNode(id, { replaceAudio: e.target.checked })}
                        disabled={isReplaceAudioInherited}
                        className="nodrag nowheel w-4 h-4 rounded bg-zinc-900 border-white/20 disabled:opacity-50"
                      />
                      {isReplaceAudioInherited && (
                        <Link2 className="absolute -top-1 -right-1 w-2.5 h-2.5 text-violet-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-300 flex items-center gap-1">
                        Replace Original Audio
                        {isReplaceAudioInherited && (
                          <span className="text-[8px] text-violet-400 font-medium">(connected)</span>
                        )}
                      </span>
                      <p className="text-[8px] text-zinc-500">
                        {isReplaceAudioInherited
                          ? "Controlled by connected node"
                          : "When off, mixes both audio tracks"}
                      </p>
                    </div>
                  </label>
                  
                  {/* Use Cache Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-white/5">
                    <input
                      type="checkbox"
                      checked={data.useCache === true}
                      onChange={(e) => updateNode(id, { useCache: e.target.checked })}
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
        </div>
      }
      right={
        <div className="space-y-2">
          <div className="text-[10px] text-zinc-500">
            {isProcessing ? "Merging..." : data.result ? "Combined" : "No output"}
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

export const MergeAudioVideoNode = memo(MergeAudioVideoNodeComponent);
