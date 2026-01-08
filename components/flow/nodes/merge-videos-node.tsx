"use client";

import { memo, useState, useCallback, useRef } from "react";
import { NodeProps } from "reactflow";
import { LayoutList, Settings, Play, Loader2, Upload, X, Film } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface MergeVideosNodeData extends BaseNodeData {
  transition?: "none" | "fade" | "dissolve";
  transitionDuration?: number;
  inputVideo1?: string;
  inputVideo2?: string;
  result?: string;
}

const nodeDef = NODE_DEFINITIONS["merge-videos"];

function MergeVideosNodeComponent(props: NodeProps<MergeVideosNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragOver1, setIsDragOver1] = useState(false);
  const [isDragOver2, setIsDragOver2] = useState(false);
  const video1Ref = useRef<HTMLInputElement>(null);
  const video2Ref = useRef<HTMLInputElement>(null);

  const handleVideo1Upload = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) return;
    const url = URL.createObjectURL(file);
    updateNode(id, { inputVideo1: url });
  }, [id, updateNode]);

  const handleVideo2Upload = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) return;
    const url = URL.createObjectURL(file);
    updateNode(id, { inputVideo2: url });
  }, [id, updateNode]);

  const runMerge = useCallback(async () => {
    if (!data.inputVideo1 || !data.inputVideo2) return;
    
    setIsProcessing(true);
    updateNode(id, { status: "running" });

    try {
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "merge-videos",
          input: {
            video1: { url: data.inputVideo1 },
            video2: { url: data.inputVideo2 },
            transition: data.transition || "none",
            transitionDuration: data.transitionDuration || 0.5,
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
  }, [data.inputVideo1, data.inputVideo2, data.transition, data.transitionDuration, id, updateNode]);

  const hasInputs = Boolean(data.inputVideo1 && data.inputVideo2);

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
      inputs={[
        { id: "video1", type: "video", label: "Video 1" },
        { id: "video2", type: "video", label: "Video 2" },
      ]}
      outputs={[{ id: "merged", type: "video", label: "Merged" }]}
      left={
        <div className="space-y-2">
          {/* Hidden inputs */}
          <input
            ref={video1Ref}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVideo1Upload(file);
            }}
            className="hidden"
          />
          <input
            ref={video2Ref}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVideo2Upload(file);
            }}
            className="hidden"
          />

          {/* Video 1 Upload */}
          <div
            onDrop={(e) => { e.preventDefault(); setIsDragOver1(false); const file = e.dataTransfer.files[0]; if (file) handleVideo1Upload(file); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver1(true); }}
            onDragLeave={() => setIsDragOver1(false)}
            onClick={() => !data.inputVideo1 && video1Ref.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer ${
              isDragOver1
                ? "border-violet-500 bg-violet-500/10"
                : data.inputVideo1
                ? "border-violet-500/30 bg-violet-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {data.inputVideo1 ? (
              <div className="relative p-1">
                <video src={data.inputVideo1} className="w-full h-10 object-cover rounded" muted />
                <button
                  onClick={(e) => { e.stopPropagation(); updateNode(id, { inputVideo1: undefined }); }}
                  className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full hover:bg-black/80"
                >
                  <X className="w-2 h-2 text-white" />
                </button>
                <div className="absolute bottom-1 left-1 text-[7px] text-violet-400 bg-black/60 px-1 py-0.5 rounded">1st</div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 py-2 text-zinc-500">
                <Film className="w-3 h-3" />
                <span className="text-[8px]">Video 1</span>
              </div>
            )}
          </div>

          {/* Video 2 Upload */}
          <div
            onDrop={(e) => { e.preventDefault(); setIsDragOver2(false); const file = e.dataTransfer.files[0]; if (file) handleVideo2Upload(file); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver2(true); }}
            onDragLeave={() => setIsDragOver2(false)}
            onClick={() => !data.inputVideo2 && video2Ref.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer ${
              isDragOver2
                ? "border-violet-500 bg-violet-500/10"
                : data.inputVideo2
                ? "border-violet-500/30 bg-violet-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {data.inputVideo2 ? (
              <div className="relative p-1">
                <video src={data.inputVideo2} className="w-full h-10 object-cover rounded" muted />
                <button
                  onClick={(e) => { e.stopPropagation(); updateNode(id, { inputVideo2: undefined }); }}
                  className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full hover:bg-black/80"
                >
                  <X className="w-2 h-2 text-white" />
                </button>
                <div className="absolute bottom-1 left-1 text-[7px] text-violet-400 bg-black/60 px-1 py-0.5 rounded">2nd</div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 py-2 text-zinc-500">
                <Film className="w-3 h-3" />
                <span className="text-[8px]">Video 2</span>
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
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
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div>
                    <label className="text-[9px] text-zinc-500 mb-1 block">Transition</label>
                    <select
                      value={data.transition || "none"}
                      onChange={(e) => updateNode(id, { transition: e.target.value as "none" | "fade" | "dissolve" })}
                      className="nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-300"
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade</option>
                      <option value="dissolve">Dissolve</option>
                    </select>
                  </div>
                  {data.transition && data.transition !== "none" && (
                    <div>
                      <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                        <span>Duration</span>
                        <span className="text-zinc-300">{data.transitionDuration || 0.5}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.1"
                        value={data.transitionDuration || 0.5}
                        onChange={(e) => updateNode(id, { transitionDuration: parseFloat(e.target.value) })}
                        className="nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      right={
        <div className="space-y-2">
          <div className="text-[10px] text-zinc-500">
            {isProcessing ? "Merging..." : data.result ? "Merged" : "No output"}
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

export const MergeVideosNode = memo(MergeVideosNodeComponent);
