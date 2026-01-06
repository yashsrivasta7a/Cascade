// Base Node
export { BaseNode } from "./base-node";
export type { BaseNodeData } from "./base-node";

// ============================================================================
// INPUT NODES
// ============================================================================
import { TextInputNode } from "./nodes/text-input-node";
import { ImageInputNode } from "./nodes/image-input-node";
import { VideoInputNode } from "./nodes/video-input-node";
import { AudioInputNode } from "./nodes/audio-input-node";
export { TextInputNode };
export { ImageInputNode };
export { VideoInputNode };
export { AudioInputNode };
export type { TextInputNodeData } from "./nodes/text-input-node";
export type { ImageInputNodeData } from "./nodes/image-input-node";
export type { VideoInputNodeData } from "./nodes/video-input-node";
export type { AudioInputNodeData } from "./nodes/audio-input-node";

// ============================================================================
// AI PIPELINE NODES (10 Total)
// ============================================================================

// Image Nodes
import { SeedreamNode } from "./nodes/seedream-node";
import { SeedVRNode } from "./nodes/seedvr-node";
export { SeedreamNode };
export { SeedVRNode };
export type { SeedreamNodeData } from "./nodes/seedream-node";
export type { SeedVRNodeData } from "./nodes/seedvr-node";

// Video Nodes
import { SeedanceNode } from "./nodes/seedance-node";
import { LipsyncNode } from "./nodes/lipsync-node";
export { SeedanceNode };
export { LipsyncNode };
export type { SeedanceNodeData } from "./nodes/seedance-node";
export type { LipsyncNodeData } from "./nodes/lipsync-node";

// Audio Nodes
import { ElevenLabsNode } from "./nodes/elevenlabs-node";
export { ElevenLabsNode };
export type { ElevenLabsNodeData } from "./nodes/elevenlabs-node";

// LLM / Vision Nodes
import { OpenRouterNode } from "./nodes/openrouter-node";
export { OpenRouterNode };
export type { OpenRouterNodeData } from "./nodes/openrouter-node";

// Utility Nodes
import { CropImageNode } from "./nodes/crop-image-node";
import { MergeAudioVideoNode } from "./nodes/merge-audio-video-node";
import { MergeVideosNode } from "./nodes/merge-videos-node";
import { ExtractAudioNode } from "./nodes/extract-audio-node";
export { CropImageNode };
export { MergeAudioVideoNode };
export { MergeVideosNode };
export { ExtractAudioNode };
export type { CropImageNodeData } from "./nodes/crop-image-node";
export type { MergeAudioVideoNodeData } from "./nodes/merge-audio-video-node";
export type { MergeVideosNodeData } from "./nodes/merge-videos-node";
export type { ExtractAudioNodeData } from "./nodes/extract-audio-node";

// ============================================================================
// FLOW COMPONENTS
// ============================================================================

export { DemoFlow } from "./demo-flow";
export { HeroFlow } from "./hero-flow";
export { NodePalette } from "./node-palette";
export { FlowCanvas } from "./flow-canvas";
export { NodeInspector } from "./node-inspector";
export { NodeContextMenu } from "./node-context-menu";
export { ExecutionPanel } from "./execution-panel";
export { ExecutionHistoryPanel } from "./execution-history-panel";
export { RunModal, demoNodes } from "./run-modal";
export { NodeTypeModal } from "./node-type-modal";
export { NodeSettingsModal, SliderInput, SelectInput, ToggleInput } from "./node-settings-modal";

// ============================================================================
// NODE TYPE REGISTRY FOR REACTFLOW
// ============================================================================

export const nodeTypes = {
  // Input
  "text-input": TextInputNode,
  "image-input": ImageInputNode,
  "video-input": VideoInputNode,
  "audio-input": AudioInputNode,
  // Image
  seedream: SeedreamNode,
  seedvr: SeedVRNode,
  // Video
  seedance: SeedanceNode,
  lipsync: LipsyncNode,
  // Audio
  elevenlabs: ElevenLabsNode,
  // LLM / Vision
  openrouter: OpenRouterNode,
  // Utility
  "crop-image": CropImageNode,
  "merge-audio-video": MergeAudioVideoNode,
  "merge-videos": MergeVideosNode,
  "extract-audio": ExtractAudioNode,
} as const;
