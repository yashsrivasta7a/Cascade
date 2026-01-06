"use client";

import { memo, useState, useCallback } from "react";
import { NodeProps } from "reactflow";
import { LayoutList, Settings } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { NodeSettingsModal, SelectInput, SliderInput } from "../node-settings-modal";

export interface MergeVideosNodeData extends BaseNodeData {
  transition?: "none" | "fade" | "dissolve";
  transitionDuration?: number;
}

const nodeDef = NODE_DEFINITIONS["merge-videos"];

const transitionOptions = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "dissolve", label: "Dissolve" },
];

function MergeVideosNodeComponent(props: NodeProps<MergeVideosNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleTransitionChange = useCallback((value: string) => {
    updateNode(id, { transition: value as "none" | "fade" | "dissolve" });
  }, [id, updateNode]);

  const handleDurationChange = useCallback((value: number) => {
    updateNode(id, { transitionDuration: value });
  }, [id, updateNode]);

  return (
    <>
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
        <div className="space-y-3">
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

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsSettingsOpen(true);
            }}
            className="nodrag nowheel w-full h-7 rounded-lg border border-white/10 bg-white/[0.02] text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-all flex items-center justify-center gap-1.5"
          >
            <Settings className="w-3 h-3" />
            Configure Merge
          </button>
        </div>
      </BaseNode>

      <NodeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Merge Videos Settings"
      >
        <div className="space-y-4">
          <SelectInput
            label="Transition"
            value={data.transition || "none"}
            onChange={handleTransitionChange}
            options={transitionOptions}
          />
          
          {data.transition && data.transition !== "none" && (
            <SliderInput
              label="Duration"
              value={data.transitionDuration || 0.5}
              onChange={handleDurationChange}
              min={0.1}
              max={2}
              step={0.1}
              unit="s"
            />
          )}
          
          <div className="pt-2 text-[10px] text-zinc-500">
            Videos will be concatenated in order. Transition effects apply between clips.
          </div>
        </div>
      </NodeSettingsModal>
    </>
  );
}

export const MergeVideosNode = memo(MergeVideosNodeComponent);
