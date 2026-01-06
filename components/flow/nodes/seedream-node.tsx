"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { NodeProps } from "reactflow";
import { ImageIcon, Play, Loader2, Square } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";

export interface SeedreamNodeData extends BaseNodeData {
  prompt?: string;
  negativePrompt?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  seed?: number;
  context?: string; // Text from connected text node
  inputImage?: string; // Image from connected image node
  result?: string; // URL of generated image
}

const nodeDef = NODE_DEFINITIONS.seedream;
const aspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;

function SeedreamNodeComponent(props: NodeProps<SeedreamNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);

  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Propagate output when result changes
  useEffect(() => {
    if (data.result) {
      propagateOutput(id, data.result);
    }
  }, [data.result, id, propagateOutput]);

  const generateImage = useCallback(async () => {
    const prompt = data.prompt?.trim() || data.context?.trim();
    if (!prompt) return;

    if (isGenerating) {
      abortControllerRef.current?.abort();
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    updateNode(id, { result: "", status: "running" });

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/nodes/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negativePrompt: data.negativePrompt,
          aspectRatio: data.aspectRatio || "1:1",
          image: data.inputImage, // If connected to an image node
          seed: data.seed,
        }),
        signal: abortControllerRef.current.signal,
      });

      const result = await response.json();

      if (!response.ok) {
        updateNode(id, {
          result: "",
          status: "failed",
          error: result.error || "Failed to generate image",
        });
        return;
      }

      const imageUrl = result.output?.image?.url;
      if (imageUrl) {
        updateNode(id, { result: imageUrl, status: "completed" });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        updateNode(id, { status: "idle" });
      } else {
        updateNode(id, {
          result: "",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [data.prompt, data.context, data.negativePrompt, data.aspectRatio, data.inputImage, data.seed, id, updateNode, isGenerating]);

  const hasPrompt = Boolean(data.prompt?.trim() || data.context?.trim());
  const isEditMode = Boolean(data.inputImage);

  return (
    <BaseNode
      {...props}
      color="emerald"
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: isEditMode ? "Image editing mode" : nodeDef.description,
        icon: <ImageIcon className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        { id: "prompt", type: "text", label: "Prompt" },
        { id: "image", type: "image", label: "Image" },
      ]}
      outputs={[{ id: "image", type: "image", label: "Image" }]}
      left={
        <div className="space-y-2">
          {/* Controls */}
          <div className="flex items-center gap-2">
            <select
              value={data.aspectRatio || "1:1"}
              onChange={(e) => updateNode(id, { aspectRatio: e.target.value as typeof data.aspectRatio })}
              className="nodrag nowheel flex-1 h-7 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-[10px] text-zinc-300 focus:outline-none"
            >
              {aspectRatios.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                generateImage();
              }}
              disabled={!hasPrompt}
              className={`nodrag nowheel h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all ${
                isGenerating
                  ? "bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
                  : hasPrompt
                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isGenerating ? (
                <>
                  <Square className="w-3 h-3" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  {isEditMode ? "Edit" : "Generate"}
                </>
              )}
            </button>
          </div>

          {/* Connected Image Indicator */}
          {data.inputImage && (
            <div className="flex items-center gap-2 text-[10px] bg-emerald-500/10 rounded-lg px-2 py-1.5 border border-emerald-500/20">
              <img src={data.inputImage} alt="" className="w-8 h-8 object-cover rounded" />
              <span className="text-emerald-400 font-medium">Edit mode</span>
            </div>
          )}

          {/* Connected Text Indicator */}
          {data.context && !data.prompt && (
            <div className="text-[10px] text-blue-400 bg-blue-500/10 rounded-lg px-2 py-1.5 border border-blue-500/20 line-clamp-2">
              <span className="font-medium">Prompt:</span> {data.context.slice(0, 80)}{data.context.length > 80 ? "..." : ""}
            </div>
          )}

          {/* Prompt Input */}
          <textarea
            value={data.prompt || ""}
            onChange={(e) => updateNode(id, { prompt: e.target.value })}
            placeholder={data.context ? "Override prompt..." : "Describe the image..."}
            rows={3}
            className="nodrag nowheel w-full px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/10 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none"
          />
        </div>
      }
      right={
        <div className="space-y-2 min-w-0">
          <div className="text-[10px] text-zinc-500 flex items-center gap-2">
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                {isEditMode ? "Editing..." : "Generating..."}
              </>
            ) : data.result ? (
              "Generated"
            ) : (
              "No output"
            )}
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden min-h-[100px] flex items-center justify-center">
            {data.result ? (
              <img
                src={data.result}
                alt="Generated"
                className="w-full h-auto max-h-[180px] object-contain"
              />
            ) : (
              <div className="text-zinc-600 text-[10px]">—</div>
            )}
          </div>
        </div>
      }
    />
  );
}

export const SeedreamNode = memo(SeedreamNodeComponent);
