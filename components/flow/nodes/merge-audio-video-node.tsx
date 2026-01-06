"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { Combine } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";

export interface MergeAudioVideoNodeData extends BaseNodeData {
  replaceAudio?: boolean;
}

const nodeDef = NODE_DEFINITIONS["merge-audio-video"];

function MergeAudioVideoNodeComponent(props: NodeProps<MergeAudioVideoNodeData>) {
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
        icon: <Combine className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        { id: "video", type: "video", label: "Video" },
        { id: "audio", type: "audio", label: "Audio" },
      ]}
      outputs={[{ id: "combined", type: "video", label: "Combined" }]}
    >
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-zinc-500">Mode:</span>
        <span className="text-zinc-300">
          {data.replaceAudio !== false ? "Replace audio" : "Mix audio"}
        </span>
      </div>
    </BaseNode>
  );
}

export const MergeAudioVideoNode = memo(MergeAudioVideoNodeComponent);


