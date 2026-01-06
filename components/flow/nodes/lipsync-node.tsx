"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { Mic2 } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";

export interface LipsyncNodeData extends BaseNodeData {
  model?: "sync-1.5" | "sync-1.6-beta";
}

const nodeDef = NODE_DEFINITIONS.lipsync;

function LipsyncNodeComponent(props: NodeProps<LipsyncNodeData>) {
  const { data } = props;

  return (
    <BaseNode
      {...props}
      color="violet"
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Mic2 className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        { id: "video", type: "video", label: "Video" },
        { id: "audio", type: "audio", label: "Audio" },
      ]}
      outputs={[{ id: "synced", type: "video", label: "Synced" }]}
      left={
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-500">Model:</span>
          <span className="text-zinc-200 font-mono uppercase text-[9px] bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
            {data.model || "sync-1.5"}
          </span>
        </div>
      }
      right={
        <div className="text-[11px] text-zinc-500">
          {(data as any).result ? (
            <video src={(data as any).result} controls className="w-full h-auto rounded-lg" />
          ) : (
            "—"
          )}
        </div>
      }
    />
  );
}

export const LipsyncNode = memo(LipsyncNodeComponent);


