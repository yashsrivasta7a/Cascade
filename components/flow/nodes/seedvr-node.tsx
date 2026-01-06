"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { Maximize2 } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";

export interface SeedVRNodeData extends BaseNodeData {
  scale?: "2x" | "4x";
  enhanceFaces?: boolean;
}

const nodeDef = NODE_DEFINITIONS.seedvr;

function SeedVRNodeComponent(props: NodeProps<SeedVRNodeData>) {
  const { data } = props;

  return (
    <BaseNode
      {...props}
      color="emerald"
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Maximize2 className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[{ id: "image", type: "image", label: "Image" }]}
      outputs={[{ id: "upscaled", type: "image", label: "Upscaled" }]}
      left={
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-500">Upscale:</span>
            <span className="text-zinc-200 font-semibold">{data.scale || "2x"}</span>
          </div>
          {data.enhanceFaces && (
            <div className="text-[10px] text-zinc-300 bg-white/5 px-2 py-1 rounded border border-white/10">
              Face Enhancement ON
            </div>
          )}
        </div>
      }
      right={
        <div className="text-[11px] text-zinc-500">
          {(data as any).result ? (
            <img src={(data as any).result} alt="Upscaled" className="w-full h-auto rounded-lg" />
          ) : (
            "—"
          )}
        </div>
      }
    />
  );
}

export const SeedVRNode = memo(SeedVRNodeComponent);


