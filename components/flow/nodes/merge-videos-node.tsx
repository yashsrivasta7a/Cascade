"use client";

import { memo, useState, useCallback, useRef, useMemo } from "react";
import { NodeProps } from "reactflow";
import { LayoutList, Settings, Play, Loader2, X, Film, Download, ArrowDown, ArrowRightLeft, ChevronRight, Lock } from "lucide-react";
import { BaseNode, type BaseNodeData, isSettingInherited } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

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
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean(data.advancedOpen));
  const [isDragOver1, setIsDragOver1] = useState(false);
  const [isDragOver2, setIsDragOver2] = useState(false);
  const video1Ref = useRef<HTMLInputElement>(null);
  const video2Ref = useRef<HTMLInputElement>(null);

  const handleVideoUpload = useCallback((file: File, which: 1 | 2) => {
    if (!file.type.startsWith("video/")) return;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 10) {
      updateNode(id, { error: `Video ${which} too large (${sizeMB.toFixed(1)}MB). Max 10MB.` });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateNode(id, { 
        [which === 1 ? "inputVideo1" : "inputVideo2"]: base64, 
        error: undefined,
        result: undefined 
      });
    };
    reader.readAsDataURL(file);
  }, [id, updateNode]);

  const swapVideos = useCallback(() => {
    updateNode(id, { 
      inputVideo1: data.inputVideo2, 
      inputVideo2: data.inputVideo1,
      result: undefined 
    });
  }, [id, data.inputVideo1, data.inputVideo2, updateNode]);

  const runMerge = useCallback(async () => {
    if (!data.inputVideo1 || !data.inputVideo2) return;
    
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
          input: {
            video1: { url: data.inputVideo1 },
            video2: { url: data.inputVideo2 },
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
  }, [data.inputVideo1, data.inputVideo2, data.transition, data.transitionDuration, id, updateNode, propagateOutput]);

  const handleDownload = useCallback(() => {
    if (!data.result) return;
    const link = document.createElement("a");
    link.href = data.result;
    link.download = `merged-${Date.now()}.mp4`;
    link.click();
  }, [data.result]);

  const hasInputs = Boolean(data.inputVideo1 && data.inputVideo2);
  const hasBothVideos = Boolean(data.inputVideo1 && data.inputVideo2);

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
                onClick={() => !data.inputVideo1 && !isProcessing && video1Ref.current?.click()}
                className={`nodrag nowheel relative rounded-xl overflow-hidden transition-all ${
                  isProcessing
                    ? "ring-1 ring-white/10 cursor-not-allowed opacity-70"
                    : isDragOver1
                    ? "ring-2 ring-violet-500 bg-violet-500/10 cursor-pointer"
                    : data.inputVideo1
                    ? "ring-1 ring-violet-500/30 bg-violet-500/5 cursor-pointer"
                    : "border-2 border-dashed border-white/10 hover:border-violet-500/50 cursor-pointer"
                }`}
              >
                {data.inputVideo1 ? (
                  <div className="relative">
                    <video src={data.inputVideo1} className="w-full h-16 object-cover" muted />
                    {!isProcessing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); updateNode(id, { inputVideo1: undefined, result: undefined }); }}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 rounded-lg hover:bg-black/90 transition-colors"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    )}
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[9px] text-violet-300 bg-black/70 px-2 py-0.5 rounded-md">
                      <span className="font-semibold">1</span>
                      <span className="text-violet-400/70">First clip</span>
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
                  {hasBothVideos && !isProcessing && (
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
                onClick={() => !data.inputVideo2 && !isProcessing && video2Ref.current?.click()}
                className={`nodrag nowheel relative rounded-xl overflow-hidden transition-all ${
                  isProcessing
                    ? "ring-1 ring-white/10 cursor-not-allowed opacity-70"
                    : isDragOver2
                    ? "ring-2 ring-amber-500 bg-amber-500/10 cursor-pointer"
                    : data.inputVideo2
                    ? "ring-1 ring-amber-500/30 bg-amber-500/5 cursor-pointer"
                    : "border-2 border-dashed border-white/10 hover:border-amber-500/50 cursor-pointer"
                }`}
              >
                {data.inputVideo2 ? (
                  <div className="relative">
                    <video src={data.inputVideo2} className="w-full h-16 object-cover" muted />
                    {!isProcessing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); updateNode(id, { inputVideo2: undefined, result: undefined }); }}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 rounded-lg hover:bg-black/90 transition-colors"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    )}
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[9px] text-amber-300 bg-black/70 px-2 py-0.5 rounded-md">
                      <span className="font-semibold">2</span>
                      <span className="text-amber-400/70">Second clip</span>
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
              onClick={() => {
                const next = !showSettings;
                setShowSettings(next);
                updateNode(id, { advancedOpen: next });
              }}
              disabled={isProcessing}
              className={`nodrag nowheel h-8 w-8 rounded-lg border flex items-center justify-center transition-all ${
                isProcessing
                  ? "bg-white/[0.02] border-white/5 text-zinc-600 cursor-not-allowed"
                  : showSettings 
                  ? "bg-white/10 border-white/20 text-white" 
                  : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
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

          {/* Collapsible Settings */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-3 border-t border-white/5">
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
                  <video 
                    src={data.result} 
                    controls 
                    className="w-full h-auto max-h-[100px]" 
                  />
                  {/* Hover download button */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={handleDownload}
                      className="nodrag nowheel p-1.5 bg-black/70 rounded-lg hover:bg-black/90 transition-colors"
                      title="Download merged video"
                    >
                      <Download className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  {/* Success indicator */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[9px] text-violet-300 bg-black/70 px-2 py-1 rounded-md">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Merged successfully
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <span className="text-zinc-600 text-[10px]">
                    {hasInputs ? "Click 'Merge Videos' to combine" : "Add both videos to merge"}
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

export const MergeVideosNode = memo(MergeVideosNodeComponent);
