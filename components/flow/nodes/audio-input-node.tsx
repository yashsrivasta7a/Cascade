"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { BaseInputNode, BaseInputNodeData } from "./base-input-node";

export interface AudioInputNodeData extends BaseInputNodeData {}

function AudioInputNodeComponent(props: NodeProps<AudioInputNodeData>) {
  return (
    <BaseInputNode
      {...props}
      mediaType="audio"
      accept="audio/*"
      color="teal"
      data={{
        ...props.data,
        label: props.data.label || "AUDIO INPUT",
      }}
    />
  );
}

export const AudioInputNode = memo(AudioInputNodeComponent);
export default AudioInputNode;
