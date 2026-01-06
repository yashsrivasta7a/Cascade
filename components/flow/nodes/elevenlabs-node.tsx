"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { Volume2 } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";

export interface ElevenLabsNodeData extends BaseNodeData {
  voiceId?: string;
  voiceName?: string;
  stability?: number;
  clarity?: number;
}

const nodeDef = NODE_DEFINITIONS.elevenlabs;

function ElevenLabsNodeComponent(props: NodeProps<ElevenLabsNodeData>) {
  const { data } = props;

  return (
    <BaseNode
      {...props}
      color="amber"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Volume2 className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[{ id: "text", type: "text", label: "Script" }]}
      outputs={[{ id: "audio", type: "audio", label: "Audio" }]}
    >
      {data.voiceName && (
        <div className="flex items-center gap-2 text-[10px] bg-zinc-900/50 rounded-lg px-2 py-1.5 border border-white/5">
          <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <Volume2 className="w-3 h-3 text-zinc-200" />
          </div>
          <span className="text-zinc-300">{data.voiceName}</span>
        </div>
      )}
      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Stability:</span>
          <span className="text-zinc-200 font-mono">{(data.stability || 0.5).toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Clarity:</span>
          <span className="text-zinc-200 font-mono">{(data.clarity || 0.75).toFixed(2)}</span>
        </div>
      </div>
    </BaseNode>
  );
}

export const ElevenLabsNode = memo(ElevenLabsNodeComponent);


