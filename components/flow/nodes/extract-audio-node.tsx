"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { AudioLines } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";

export interface ExtractAudioNodeData extends BaseNodeData {
  format?: "mp3" | "wav" | "aac";
}

const nodeDef = NODE_DEFINITIONS["extract-audio"];

function ExtractAudioNodeComponent(props: NodeProps<ExtractAudioNodeData>) {
  const { data } = props;

  return (
    <BaseNode
      {...props}
      color="zinc"
      isUtility
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <AudioLines className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[{ id: "video", type: "video", label: "Video" }]}
      outputs={[{ id: "audio", type: "audio", label: "Audio" }]}
    >
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-zinc-500">Format:</span>
        <span className="text-zinc-300 uppercase font-mono bg-zinc-800 px-1.5 py-0.5 rounded">
          {data.format || "mp3"}
        </span>
      </div>
    </BaseNode>
  );
}

export const ExtractAudioNode = memo(ExtractAudioNodeComponent);


