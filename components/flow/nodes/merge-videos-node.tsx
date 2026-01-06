"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { LayoutList } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";

export interface MergeVideosNodeData extends BaseNodeData {
  transition?: "none" | "fade" | "dissolve";
  transitionDuration?: number;
}

const nodeDef = NODE_DEFINITIONS["merge-videos"];

function MergeVideosNodeComponent(props: NodeProps<MergeVideosNodeData>) {
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
        icon: <LayoutList className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        { id: "video1", type: "video", label: "Video 1" },
        { id: "video2", type: "video", label: "Video 2" },
      ]}
      outputs={[{ id: "merged", type: "video", label: "Merged" }]}
    >
      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Transition:</span>
          <span className="text-zinc-300 capitalize">{data.transition || "none"}</span>
        </div>
        {data.transition && data.transition !== "none" && (
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Duration:</span>
            <span className="text-zinc-300">{data.transitionDuration || 0.5}s</span>
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export const MergeVideosNode = memo(MergeVideosNodeComponent);


