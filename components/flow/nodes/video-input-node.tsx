"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { BaseInputNode, BaseInputNodeData } from "./base-input-node";

export interface VideoInputNodeData extends BaseInputNodeData {}

function VideoInputNodeComponent(props: NodeProps<VideoInputNodeData>) {
  return (
    <BaseInputNode
      {...props}
      mediaType="video"
      accept="video/*"
      color="violet"
      data={{
        ...props.data,
        label: props.data.label || "VIDEO INPUT",
      }}
    />
  );
}

export const VideoInputNode = memo(VideoInputNodeComponent);
export default VideoInputNode;
