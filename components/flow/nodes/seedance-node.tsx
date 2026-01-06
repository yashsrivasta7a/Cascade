"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { Film } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";

export interface SeedanceNodeData extends BaseNodeData {
  prompt?: string;
  duration?: "4s" | "8s" | "16s";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  seed?: number;
  context?: string;
  result?: string;
}

const nodeDef = NODE_DEFINITIONS.seedance;

function SeedanceNodeComponent(props: NodeProps<SeedanceNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);

  return (
    <BaseNode
      {...props}
      color="violet"
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Film className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        { id: "prompt", type: "text", label: "Prompt" },
        { id: "frame", type: "image", label: "Start Frame" },
      ]}
      outputs={[{ id: "video", type: "video", label: "Video" }]}
      left={
        <div className="space-y-2">
          {data.context && (
            <div className="text-[10px] text-zinc-400 bg-white/[0.03] rounded-lg px-2 py-1.5 border border-white/10 line-clamp-3">
              <span className="text-zinc-500">From previous:</span> {data.context}
            </div>
          )}

          <textarea
            value={data.prompt || ""}
            onChange={(e) => updateNode(id, { prompt: e.target.value })}
            placeholder="Describe the video..."
            rows={5}
            className="nodrag nowheel w-full px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/10 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none"
          />

          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            <span className="text-zinc-500">Duration</span>
            <span className="text-zinc-200 font-mono">{data.duration || "4s"}</span>
            <span className="text-zinc-500">Ratio</span>
            <span className="text-zinc-200 font-mono">{data.aspectRatio || "16:9"}</span>
          </div>
        </div>
      }
      right={
        <div className="space-y-2">
          <div className="text-[10px] text-zinc-500">
            {data.result && typeof data.result === "string" ? "Output" : "No output yet"}
          </div>
          <div className="text-xs text-zinc-200 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 whitespace-pre-wrap break-words min-h-[96px]">
            {data.result && typeof data.result === "string" ? data.result : "—"}
          </div>
        </div>
      }
    />
  );
}

export const SeedanceNode = memo(SeedanceNodeComponent);

