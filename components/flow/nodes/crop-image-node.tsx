"use client";

import { memo, useState, useCallback } from "react";
import { NodeProps } from "reactflow";
import { Crop, Settings } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { NodeSettingsModal, SliderInput } from "../node-settings-modal";

export interface CropImageNodeData extends BaseNodeData {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

const nodeDef = NODE_DEFINITIONS["crop-image"];

function CropImageNodeComponent(props: NodeProps<CropImageNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleTopChange = useCallback((value: number) => {
    updateNode(id, { top: value });
  }, [id, updateNode]);

  const handleRightChange = useCallback((value: number) => {
    updateNode(id, { right: value });
  }, [id, updateNode]);

  const handleBottomChange = useCallback((value: number) => {
    updateNode(id, { bottom: value });
  }, [id, updateNode]);

  const handleLeftChange = useCallback((value: number) => {
    updateNode(id, { left: value });
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
          icon: <Crop className="w-5 h-5" />,
          provider: nodeDef.provider,
          estimatedCost: nodeDef.estimatedCost,
        }}
        inputs={[{ id: "image", type: "image", label: "Image" }]}
        outputs={[{ id: "cropped", type: "image", label: "Cropped" }]}
      >
        <div className="space-y-3">
          {/* Crop Preview */}
          <div className="relative w-full h-20 bg-zinc-900 rounded-lg border border-white/10 flex items-center justify-center">
            <div 
              className="absolute bg-blue-500/20 border border-blue-500/50 rounded"
              style={{
                top: `${data.top || 0}%`,
                right: `${data.right || 0}%`,
                bottom: `${data.bottom || 0}%`,
                left: `${data.left || 0}%`,
              }}
            />
            <span className="text-[9px] text-zinc-500">Crop Preview</span>
          </div>

          {/* Quick Stats */}
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

          {/* Settings Button */}
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
            Configure Crop
          </button>
        </div>
      </BaseNode>

      {/* Settings Modal */}
      <NodeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Crop Settings"
      >
        <div className="space-y-4">
          <SliderInput
            label="Top"
            value={data.top || 0}
            onChange={handleTopChange}
            min={0}
            max={50}
          />
          <SliderInput
            label="Right"
            value={data.right || 0}
            onChange={handleRightChange}
            min={0}
            max={50}
          />
          <SliderInput
            label="Bottom"
            value={data.bottom || 0}
            onChange={handleBottomChange}
            min={0}
            max={50}
          />
          <SliderInput
            label="Left"
            value={data.left || 0}
            onChange={handleLeftChange}
            min={0}
            max={50}
          />
          
          <div className="pt-2 text-[10px] text-zinc-500">
            Values represent percentage of the image to crop from each edge.
          </div>
        </div>
      </NodeSettingsModal>
    </>
  );
}

export const CropImageNode = memo(CropImageNodeComponent);
