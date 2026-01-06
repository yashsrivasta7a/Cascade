"use client";

import { memo, useCallback, useRef, useEffect, DragEvent, useState } from "react";
import { NodeProps } from "reactflow";
import { Video, Upload, X, Play } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { useFlowStore } from "@/store";

export interface VideoInputNodeData extends BaseNodeData {
  video?: string; // Base64 or URL
  videoName?: string;
}

function VideoInputNodeComponent(props: NodeProps<VideoInputNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastVideoRef = useRef<string>("");

  // Propagate video to connected nodes when it changes
  useEffect(() => {
    if (data.video && data.video !== lastVideoRef.current) {
      lastVideoRef.current = data.video;
      propagateOutput(id, data.video);
    }
  }, [data.video, id, propagateOutput]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateNode(id, { video: base64, videoName: file.name });
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
    if (file && file.type.startsWith("video/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateNode(id, { video: base64, videoName: file.name });
      };
      reader.readAsDataURL(file);
    }
  }, [id, updateNode]);

  const clearVideo = useCallback(() => {
    updateNode(id, { video: undefined, videoName: undefined });
    lastVideoRef.current = "";
  }, [id, updateNode]);

  return (
    <BaseNode
      {...props}
      color="violet"
      isUtility
      data={{
        ...data,
        label: data.label || "Video Input",
        description: "Drop a video to use",
        icon: <Video className="w-5 h-5" />,
        provider: "Input",
        estimatedCost: 0,
      }}
      inputs={[]}
      outputs={[{ id: "video", type: "video", label: "Video" }]}
      left={
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !data.video && fileInputRef.current?.click()}
          className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer flex items-center justify-center ${
            data.video ? "h-36" : "h-28"
          } ${
            isDragOver
              ? "border-violet-500/50 bg-violet-500/10"
              : data.video
              ? "border-violet-500/30 bg-violet-500/5"
              : "border-white/10 bg-white/[0.02] hover:border-white/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {data.video ? (
            <>
              <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-2">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Play className="w-5 h-5 text-violet-400" />
                </div>
                <span className="text-[10px] text-zinc-400 truncate max-w-full px-2">
                  {data.videoName || "Video loaded"}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearVideo();
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
                Drop video here
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

export const VideoInputNode = memo(VideoInputNodeComponent);

