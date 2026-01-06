"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { Crop } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";

export interface CropImageNodeData extends BaseNodeData {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

const nodeDef = NODE_DEFINITIONS["crop-image"];

function CropImageNodeComponent(props: NodeProps<CropImageNodeData>) {
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
        icon: <Crop className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[{ id: "image", type: "image", label: "Image" }]}
      outputs={[{ id: "cropped", type: "image", label: "Cropped" }]}
    >
      <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
        <div className="text-center">
          <span className="text-zinc-500">T</span>
          <div className="text-zinc-300">{data.top || 0}%</div>
        </div>
        <div className="text-center">
          <span className="text-zinc-500">R</span>
          <div className="text-zinc-300">{data.right || 0}%</div>
        </div>
        <div className="text-center">
          <span className="text-zinc-500">B</span>
          <div className="text-zinc-300">{data.bottom || 0}%</div>
        </div>
        <div className="text-center">
          <span className="text-zinc-500">L</span>
          <div className="text-zinc-300">{data.left || 0}%</div>
        </div>
      </div>
    </BaseNode>
  );
}

export const CropImageNode = memo(CropImageNodeComponent);


