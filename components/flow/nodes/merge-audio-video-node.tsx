"use client";

import { memo, useState, useCallback } from "react";
import { NodeProps } from "reactflow";
import { Combine, Settings } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { NodeSettingsModal, ToggleInput } from "../node-settings-modal";

export interface MergeAudioVideoNodeData extends BaseNodeData {
  replaceAudio?: boolean;
}

const nodeDef = NODE_DEFINITIONS["merge-audio-video"];

function MergeAudioVideoNodeComponent(props: NodeProps<MergeAudioVideoNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleReplaceToggle = useCallback((value: boolean) => {
    updateNode(id, { replaceAudio: value });
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
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-zinc-500">Mode:</span>
            <span className="text-zinc-300">
              {data.replaceAudio !== false ? "Replace audio" : "Mix audio"}
            </span>
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
        title="Merge Audio + Video Settings"
      >
        <div className="space-y-4">
          <ToggleInput
            label="Replace Original Audio"
            description="When enabled, replaces video's audio track. When disabled, mixes both audio tracks."
            value={data.replaceAudio !== false}
            onChange={handleReplaceToggle}
          />
          
          <div className="pt-2 text-[10px] text-zinc-500">
            Combine audio and video tracks into a single output video file.
          </div>
        </div>
      </NodeSettingsModal>
    </>
  );
}

export const MergeAudioVideoNode = memo(MergeAudioVideoNodeComponent);
