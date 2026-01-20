"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { BaseInputNode, BaseInputNodeData } from "./base-input-node";

export interface ImageInputNodeData extends BaseInputNodeData {}

function ImageInputNodeComponent(props: NodeProps<ImageInputNodeData>) {
  return (
    <BaseInputNode
      {...props}
      mediaType="image"
      accept="image/*"
      color="emerald"
      data={{
        ...props.data,
        label: props.data.label || "IMAGE INPUT",
      }}
    />
  );
}

export const ImageInputNode = memo(ImageInputNodeComponent);
export default ImageInputNode;
