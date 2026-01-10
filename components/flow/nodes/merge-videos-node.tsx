"use client";

import { memo, useState, useCallback, useRef, useMemo } from "react";
import { NodeProps } from "reactflow";
import { LayoutList, Play, Loader2, X, Film, Download, ArrowDown, ArrowRightLeft, ChevronRight, ChevronDown, Lock } from "lucide-react";
import { BaseNode, type BaseNodeData, isSettingInherited } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";
import { MediaLoader, MediaSkeleton } from "@/components/ui";

export interface MergeVideosNodeData extends BaseNodeData {
  transition?: "none" | "fade" | "dissolve";
  transitionDuration?: number;
  inputVideo1?: string;
  inputVideo2?: string;
  result?: string;
  advancedOpen?: boolean;
  error?: string;
}

const nodeDef = NODE_DEFINITIONS["merge-videos"];

const TRANSITION_INFO = {
  none: { name: "Cut", desc: "Direct cut between clips" },
  fade: { name: "Fade", desc: "Fade through black" },
  dissolve: { name: "Dissolve", desc: "Cross-dissolve blend" },
};

function MergeVideosNodeComponent(props: NodeProps<MergeVideosNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  const workflowId = useFlowStore((s) => s.workflowId);
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean(data.advancedOpen));
  const [isDragOver1, setIsDragOver1] = useState(false);
  const [isDragOver2, setIsDragOver2] = useState(false);
  const [isUploadingVideo1, setIsUploadingVideo1] = useState(false);
  const [isUploadingVideo2, setIsUploadingVideo2] = useState(false);
  const video1Ref = useRef<HTMLInputElement>(null);
  const video2Ref = useRef<HTMLInputElement>(null);

  // Check for incoming connections and get their source data
  const getConnectedVideo = useCallback((handleId: string): string | null => {
    const edge = edges.find(e => e.target === id && e.targetHandle === handleId);
    if (!edge) return null;
    
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) return null;
    
    const sourceData = sourceNode.data as Record<string, unknown>;
    // Check for result (output) or direct video fields
    if (sourceData.result && typeof sourceData.result === "string") {
      return sourceData.result;
    }
    if (sourceData.outputVideo && typeof sourceData.outputVideo === "string") {
      return sourceData.outputVideo;
    }
    return null;
  }, [edges, nodes, id]);

  // Get connected videos (from edges) or use direct data
  const connectedVideo1 = useMemo(() => getConnectedVideo("inputVideo1"), [getConnectedVideo]);
  const connectedVideo2 = useMemo(() => getConnectedVideo("inputVideo2"), [getConnectedVideo]);
  
  // Effective videos: use connected if available, otherwise use direct data
  const effectiveVideo1 = data.inputVideo1 || connectedVideo1;
  const effectiveVideo2 = data.inputVideo2 || connectedVideo2;

  const handleVideoUpload = useCallback(async (file: File, which: 1 | 2) => {
    if (!file.type.startsWith("video/")) return;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 25) {
      updateNode(id, { error: `Video ${which} too large (${sizeMB.toFixed(1)}MB). Max 25MB.` });
      return;
    }
    
    // Show loading state
    if (which === 1) setIsUploadingVideo1(true);
    else setIsUploadingVideo2(true);
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
            type: "video",
            filename: file.name,
          }),
        });
        
        if (response.ok) {
          const { url } = await response.json();
          updateNode(id, { 
            [which === 1 ? "inputVideo1" : "inputVideo2"]: url, 
            error: undefined,
            result: undefined 
          });
          if (which === 1) setIsUploadingVideo1(false);
          else setIsUploadingVideo2(false);
          return;
        }
      } catch (err) {
        console.warn("[MergeVideos] CDN upload failed, using base64:", err);
      }
      
      // Fallback to base64 if CDN upload fails
      updateNode(id, { 
        [which === 1 ? "inputVideo1" : "inputVideo2"]: base64, 
        error: undefined,
        result: undefined 
      });
      if (which === 1) setIsUploadingVideo1(false);
      else setIsUploadingVideo2(false);
    };
    reader.readAsDataURL(file);
  }, [id, updateNode]);

  const swapVideos = useCallback(() => {
    // Only swap if both videos are direct data (not connected)
    if (!data.inputVideo1 || !data.inputVideo2) return;
    updateNode(id, { 
      inputVideo1: data.inputVideo2, 
      inputVideo2: data.inputVideo1,
      result: undefined 
    });
  }, [id, data.inputVideo1, data.inputVideo2, updateNode]);
  
  // Only show swap button if both videos are directly uploaded (not connected)
  const canSwap = Boolean(data.inputVideo1 && data.inputVideo2);

  const runMerge = useCallback(async () => {
    if (!effectiveVideo1 || !effectiveVideo2) return;
    
    setIsProcessing(true);
    updateNode(id, { status: "running", error: undefined });

    try {
      const response = await fetch("/api/nodes/execute-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "merge-videos",
          nodeId: id,
          nodeLabel: data.label || nodeDef.label,
          workflowId: workflowId ?? undefined,
          input: {
            video1: { url: effectiveVideo1 },
            video2: { url: effectiveVideo2 },
            transition: data.transition || "none",
            transitionDuration: data.transitionDuration || 0.5,
          },
        }),
      });

      const result = await response.json();
      if (result.success && result.output?.video?.url) {
        updateNode(id, { result: result.output.video.url, status: "completed" });
        propagateOutput(id, result.output.video.url);
      } else {
        updateNode(id, { status: "failed", error: result.error || "Unknown error" });
      }
    } catch (error) {
      updateNode(id, { status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setIsProcessing(false);
    }
  }, [effectiveVideo1, effectiveVideo2, data.transition, data.transitionDuration, data.label, id, updateNode, propagateOutput, workflowId]);

  const handleDownload = useCallback(() => {
    if (!data.result) return;
    const link = document.createElement("a");
    link.href = data.result;
    link.download = `merged-${Date.now()}.mp4`;
    link.click();
  }, [data.result]);

  const hasInputs = Boolean(effectiveVideo1 && effectiveVideo2);
  const hasBothVideos = Boolean(effectiveVideo1 && effectiveVideo2);

  const inputs = useMemo(() => [
    { id: "inputVideo1", type: "video" as const, label: "Video 1", required: true },
    { id: "inputVideo2", type: "video" as const, label: "Video 2", required: true },
    { id: "transition", type: "text" as const, label: "Transition", hidden: !showSettings },
  ], [showSettings]);

  const transitionInfo = TRANSITION_INFO[data.transition || "none"];

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
        icon: <LayoutList className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={inputs}
      outputs={[{ id: "merged", type: "video", label: "Merged" }]}
      left={
        <div className="space-y-3">
          {/* Hidden inputs */}
          <input
            ref={video1Ref}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVideoUpload(file, 1);
            }}
            className="hidden"
          />
          <input
            ref={video2Ref}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVideoUpload(file, 2);
            }}
            className="hidden"
          />

          {/* Video Inputs Section */}
          <div>
            <label className="text-[10px] font-medium text-zinc-400 mb-2 block">Video Sequence</label>
            
            <div className="relative">
              {/* Video 1 */}
              <div
                onDrop={isProcessing ? undefined : (e) => { e.preventDefault(); setIsDragOver1(false); const file = e.dataTransfer.files[0]; if (file) handleVideoUpload(file, 1); }}
                onDragOver={isProcessing ? undefined : (e) => { e.preventDefault(); setIsDragOver1(true); }}
                onDragLeave={isProcessing ? undefined : () => setIsDragOver1(false)}
                onClick={() => !effectiveVideo1 && !isProcessing && video1Ref.current?.click()}
                className={`nodrag nowheel relative rounded-xl overflow-hidden transition-all ${
                  isProcessing
                    ? "ring-1 ring-white/10 cursor-not-allowed opacity-70"
                    : isDragOver1
                    ? "ring-2 ring-violet-500 bg-violet-500/10 cursor-pointer"
                    : effectiveVideo1
                    ? "ring-1 ring-violet-500/30 bg-violet-500/5"
                    : "border-2 border-dashed border-white/10 hover:border-violet-500/50 cursor-pointer"
                }`}
              >
                {isUploadingVideo1 ? (
                  <div className="flex flex-col items-center justify-center py-4 text-violet-400">
                    <Loader2 className="w-4 h-4 mb-1.5 animate-spin" />
                    <span className="text-[10px] font-medium">Uploading...</span>
                  </div>
                ) : effectiveVideo1 ? (
                  <div className="relative">
                    <video src={effectiveVideo1} className="w-full aspect-video object-cover" muted />
                    {!isProcessing && data.inputVideo1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); updateNode(id, { inputVideo1: undefined, result: undefined }); }}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 rounded-lg hover:bg-black/90 transition-colors"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    )}
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[9px] text-violet-300 bg-black/70 px-2 py-0.5 rounded-md">
                      <span className="font-semibold">1</span>
                      <span className="text-violet-400/70">{connectedVideo1 ? "← Connected" : "First clip"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-zinc-500">
                    <Film className="w-4 h-4 mb-1.5 text-violet-400/50" />
                    <span className="text-[10px] font-medium">First Video</span>
                    <span className="text-[8px] text-zinc-600">Drop or click to upload</span>
                  </div>
                )}
              </div>

              {/* Connector with Swap Button */}
              <div className="flex items-center justify-center py-1.5">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="flex items-center gap-1.5 px-2">
                  <motion.div
                    animate={{ y: [0, 2, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ArrowDown className="w-3 h-3 text-zinc-500" />
                  </motion.div>
                  {canSwap && !isProcessing && (
                    <button
                      onClick={swapVideos}
                      className="nodrag nowheel p-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
                      title="Swap video order"
                    >
                      <ArrowRightLeft className="w-3 h-3 text-zinc-400 group-hover:text-white transition-colors" />
                    </button>
                  )}
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>

              {/* Video 2 */}
              <div
                onDrop={isProcessing ? undefined : (e) => { e.preventDefault(); setIsDragOver2(false); const file = e.dataTransfer.files[0]; if (file) handleVideoUpload(file, 2); }}
                onDragOver={isProcessing ? undefined : (e) => { e.preventDefault(); setIsDragOver2(true); }}
                onDragLeave={isProcessing ? undefined : () => setIsDragOver2(false)}
                onClick={() => !effectiveVideo2 && !isProcessing && video2Ref.current?.click()}
                className={`nodrag nowheel relative rounded-xl overflow-hidden transition-all ${
                  isProcessing
                    ? "ring-1 ring-white/10 cursor-not-allowed opacity-70"
                    : isDragOver2
                    ? "ring-2 ring-amber-500 bg-amber-500/10 cursor-pointer"
                    : effectiveVideo2
                    ? "ring-1 ring-amber-500/30 bg-amber-500/5"
                    : "border-2 border-dashed border-white/10 hover:border-amber-500/50 cursor-pointer"
                }`}
              >
                {isUploadingVideo2 ? (
                  <div className="flex flex-col items-center justify-center py-4 text-amber-400">
                    <Loader2 className="w-4 h-4 mb-1.5 animate-spin" />
                    <span className="text-[10px] font-medium">Uploading...</span>
                  </div>
                ) : effectiveVideo2 ? (
                  <div className="relative">
                    <video src={effectiveVideo2} className="w-full aspect-video object-cover" muted />
                    {!isProcessing && data.inputVideo2 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); updateNode(id, { inputVideo2: undefined, result: undefined }); }}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 rounded-lg hover:bg-black/90 transition-colors"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    )}
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[9px] text-amber-300 bg-black/70 px-2 py-0.5 rounded-md">
                      <span className="font-semibold">2</span>
                      <span className="text-amber-400/70">{connectedVideo2 ? "← Connected" : "Second clip"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-zinc-500">
                    <Film className="w-4 h-4 mb-1.5 text-amber-400/50" />
                    <span className="text-[10px] font-medium">Second Video</span>
                    <span className="text-[8px] text-zinc-600">Drop or click to upload</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transition Badge */}
          {showSettings && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-white/[0.03] rounded-lg border border-white/5">
              <ChevronRight className="w-3 h-3 text-zinc-500" />
              <span className="text-[9px] text-zinc-400">{transitionInfo.desc}</span>
            </div>
          )}

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <button
              onClick={runMerge}
              disabled={!hasInputs || isProcessing}
              className={`nodrag nowheel flex-1 h-8 px-4 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-2 transition-all ${
                isProcessing
                  ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
                  : hasInputs
                  ? "bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Merging...</>
              ) : (
                <><Play className="w-3.5 h-3.5" />Merge Videos</>
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
                <div className="text-[9px] text-zinc-500">Customize transition effects.</div>
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

          {/* Collapsible Settings Content */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-3">
                  <div className={isSettingInherited(data, "transition") ? "opacity-60" : ""}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[9px] text-zinc-500">Transition Style</label>
                      {isSettingInherited(data, "transition") && (
                        <div className="flex items-center gap-1 text-[8px] text-violet-400">
                          <Lock className="w-2 h-2" />
                          <span>Inherited</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {Object.entries(TRANSITION_INFO).map(([key, { name }]) => (
                        <button
                          key={key}
                          onClick={() => !isSettingInherited(data, "transition") && updateNode(id, { transition: key as "none" | "fade" | "dissolve" })}
                          disabled={isProcessing || isSettingInherited(data, "transition")}
                          className={`nodrag nowheel h-7 px-2 rounded-lg text-[10px] font-medium transition-all ${
                            (data.transition || "none") === key
                              ? "bg-violet-500/20 border border-violet-500/40 text-violet-300"
                              : isProcessing || isSettingInherited(data, "transition")
                              ? "bg-white/[0.02] border border-white/5 text-zinc-600 cursor-not-allowed"
                              : "bg-white/[0.03] border border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {data.transition && data.transition !== "none" && (
                    <div className={isProcessing || isSettingInherited(data, "transitionDuration") ? "opacity-50" : ""}>
                      <div className="flex justify-between text-[9px] text-zinc-500 mb-1.5">
                        <div className="flex items-center gap-1">
                          <span>Transition Duration</span>
                          {isSettingInherited(data, "transitionDuration") && (
                            <Lock className="w-2 h-2 text-violet-400" />
                          )}
                        </div>
                        <span className="text-zinc-300 font-mono">{data.transitionDuration || 0.5}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.1"
                        value={data.transitionDuration || 0.5}
                        onChange={(e) => !isSettingInherited(data, "transitionDuration") && updateNode(id, { transitionDuration: parseFloat(e.target.value) })}
                        disabled={isProcessing || isSettingInherited(data, "transitionDuration")}
                        className={`nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none accent-violet-500 ${
                          isProcessing || isSettingInherited(data, "transitionDuration") ? "cursor-not-allowed" : "cursor-pointer"
                        }`}
                      />
                    </div>
                  )}
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
              {isProcessing ? "Processing..." : data.result ? "Merged Output" : "Result"}
            </label>
            <div className={`relative rounded-xl overflow-hidden transition-all ${
              data.result 
                ? "ring-1 ring-violet-500/30 bg-violet-500/5" 
                : "bg-white/[0.02] border border-white/5"
            }`}>
              {data.result ? (
                <div className="relative group">
                  <MediaLoader
                    src={data.result}
                    type="video"
                    className="w-full aspect-video"
                    containerClassName="aspect-video"
                  />
                  {/* Hover download button */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button
                      onClick={handleDownload}
                      className="nodrag nowheel p-1.5 bg-black/70 rounded-lg hover:bg-black/90 transition-colors"
                      title="Download merged video"
                    >
                      <Download className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  {/* Success indicator */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[9px] text-violet-300 bg-black/70 px-2 py-1 rounded-md z-20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Merged successfully
                  </div>
                </div>
              ) : (
                <MediaSkeleton 
                  type="video" 
                  className="aspect-video" 
                  message={hasInputs ? "Click 'Merge Videos' to combine" : "Add both videos to merge"} 
                />
              )}
            </div>
          </div>
        </div>
      }
    />
  );
}

export const MergeVideosNode = memo(MergeVideosNodeComponent);
