"use client";

import { memo, useCallback, useRef, useEffect, DragEvent, useState } from "react";
import { NodeProps } from "reactflow";
import { ImageIcon, Upload, X } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { useFlowStore } from "@/store";

export interface ImageInputNodeData extends BaseNodeData {
  image?: string; // Base64
}

function ImageInputNodeComponent(props: NodeProps<ImageInputNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastImageRef = useRef<string>("");

  // Propagate image to connected nodes when it changes
  useEffect(() => {
    if (data.image && data.image !== lastImageRef.current) {
      lastImageRef.current = data.image;
      propagateOutput(id, data.image);
    }
  }, [data.image, id, propagateOutput]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateNode(id, { image: base64 });
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
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateNode(id, { image: base64 });
      };
      reader.readAsDataURL(file);
    }
  }, [id, updateNode]);

  const clearImage = useCallback(() => {
    updateNode(id, { image: undefined });
    lastImageRef.current = "";
  }, [id, updateNode]);

  return (
    <BaseNode
      {...props}
      color="emerald"
      isUtility
      data={{
        ...data,
        label: data.label || "Image Input",
        description: "Drop an image to use",
        icon: <ImageIcon className="w-5 h-5" />,
        provider: "Input",
        estimatedCost: 0,
      }}
      inputs={[]}
      outputs={[{ id: "image", type: "image", label: "Image" }]}
      left={
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !data.image && fileInputRef.current?.click()}
          className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer flex items-center justify-center ${
            data.image ? "h-36" : "h-28"
          } ${
            isDragOver
              ? "border-emerald-500/50 bg-emerald-500/10"
              : data.image
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-white/10 bg-white/[0.02] hover:border-white/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {data.image ? (
            <>
              <img
                src={data.image}
                alt="Input"
                className="h-full w-full object-contain rounded-lg"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearImage();
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
                Drop image here
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

export const ImageInputNode = memo(ImageInputNodeComponent);
