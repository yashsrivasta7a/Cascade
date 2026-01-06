"use client";

import { memo, useCallback, useRef, useEffect, DragEvent, useState } from "react";
import { NodeProps } from "reactflow";
import { Volume2, Upload, X, Music } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { useFlowStore } from "@/store";

export interface AudioInputNodeData extends BaseNodeData {
  audio?: string; // Base64 or URL
  audioName?: string;
}

function AudioInputNodeComponent(props: NodeProps<AudioInputNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAudioRef = useRef<string>("");

  // Propagate audio to connected nodes when it changes
  useEffect(() => {
    if (data.audio && data.audio !== lastAudioRef.current) {
      lastAudioRef.current = data.audio;
      propagateOutput(id, data.audio);
    }
  }, [data.audio, id, propagateOutput]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateNode(id, { audio: base64, audioName: file.name });
      };
      reader.readAsDataURL(file);
    }
  }, [id, updateNode]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateNode(id, { audio: base64, audioName: file.name });
      };
      reader.readAsDataURL(file);
    }
  }, [id, updateNode]);

  const clearAudio = useCallback(() => {
    updateNode(id, { audio: undefined, audioName: undefined });
    lastAudioRef.current = "";
  }, [id, updateNode]);

  return (
    <BaseNode
      {...props}
      color="amber"
      isUtility
      data={{
        ...data,
        label: data.label || "Audio Input",
        description: "Drop an audio file to use",
        icon: <Volume2 className="w-5 h-5" />,
        provider: "Input",
        estimatedCost: 0,
      }}
      inputs={[]}
      outputs={[{ id: "audio", type: "audio", label: "Audio" }]}
      left={
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !data.audio && fileInputRef.current?.click()}
          className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer flex items-center justify-center h-28 ${
            isDragOver
              ? "border-amber-500/50 bg-amber-500/10"
              : data.audio
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-white/10 bg-white/[0.02] hover:border-white/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {data.audio ? (
            <>
              <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-2">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Music className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-[10px] text-zinc-400 truncate max-w-full px-2">
                  {data.audioName || "Audio loaded"}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearAudio();
                }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <div className="text-center p-4">
              <Upload className="w-6 h-6 mx-auto text-zinc-500 mb-2" />
              <div className="text-[10px] text-zinc-400 font-medium">
                Drop audio here
              </div>
              <div className="text-[9px] text-zinc-600 mt-1">
                or click to browse
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}

export const AudioInputNode = memo(AudioInputNodeComponent);

