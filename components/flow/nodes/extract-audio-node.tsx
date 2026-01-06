"use client";

import { memo, useState, useCallback } from "react";
import { NodeProps } from "reactflow";
import { AudioLines, Settings } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { NodeSettingsModal, SelectInput } from "../node-settings-modal";

export interface ExtractAudioNodeData extends BaseNodeData {
  format?: "mp3" | "wav" | "aac";
}

const nodeDef = NODE_DEFINITIONS["extract-audio"];

const formatOptions = [
  { value: "mp3", label: "MP3 (Compressed)" },
  { value: "wav", label: "WAV (Lossless)" },
  { value: "aac", label: "AAC (Advanced)" },
];

function ExtractAudioNodeComponent(props: NodeProps<ExtractAudioNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleFormatChange = useCallback((value: string) => {
    updateNode(id, { format: value as "mp3" | "wav" | "aac" });
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
          icon: <AudioLines className="w-5 h-5" />,
          provider: nodeDef.provider,
          estimatedCost: nodeDef.estimatedCost,
        }}
        inputs={[{ id: "video", type: "video", label: "Video" }]}
        outputs={[{ id: "audio", type: "audio", label: "Audio" }]}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-zinc-500">Format:</span>
            <span className="text-zinc-300 uppercase font-mono bg-zinc-800 px-1.5 py-0.5 rounded">
              {data.format || "mp3"}
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
            Configure Extract
          </button>
        </div>
      </BaseNode>

      <NodeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Extract Audio Settings"
      >
        <div className="space-y-4">
          <SelectInput
            label="Output Format"
            value={data.format || "mp3"}
            onChange={handleFormatChange}
            options={formatOptions}
          />
          
          <div className="pt-2 text-[10px] text-zinc-500">
            Extract the audio track from a video file. MP3 is recommended for most use cases.
          </div>
        </div>
      </NodeSettingsModal>
    </>
  );
}

export const ExtractAudioNode = memo(ExtractAudioNodeComponent);
