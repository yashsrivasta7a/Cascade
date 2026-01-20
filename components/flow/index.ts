// Base Node
export { BaseNode } from "./base-node";
export type { BaseNodeData } from "./base-node";

// ============================================================================
// GENERIC NODE (Config-Driven)
// ============================================================================

export { GenericNode, createNodeComponent, createAllNodeComponents } from "./generic-node";
import { createAllNodeComponents } from "./generic-node";
export type { GenericNodeData } from "./generic-node";

// ============================================================================
// FIELD RENDERERS (for custom node implementations)
// ============================================================================

export {
  TextField,
  SelectField,
  FileField,
  NumberField,
  SliderField,
  ToggleField,
  OutputDisplay,
  MediaSkeleton,
} from "./field-renderers";

// ============================================================================
// LEGACY AI PIPELINE NODES (10 Total)
// These are kept for backward compatibility - new nodes should use GenericNode
// ============================================================================

// Image Nodes
import { SeedreamNode } from "./nodes-legacy/seedream-node";
import { SeedVRNode } from "./nodes-legacy/seedvr-node";
export { SeedreamNode };
export { SeedVRNode };
export type { SeedreamNodeData } from "./nodes-legacy/seedream-node";
export type { SeedVRNodeData } from "./nodes-legacy/seedvr-node";

// Video Nodes
import { SeedanceNode } from "./nodes-legacy/seedance-node";
import { LipsyncNode } from "./nodes-legacy/lipsync-node";
export { SeedanceNode };
export { LipsyncNode };
export type { SeedanceNodeData } from "./nodes-legacy/seedance-node";
export type { LipsyncNodeData } from "./nodes-legacy/lipsync-node";

// Audio Nodes
import { ElevenLabsNode } from "./nodes-legacy/elevenlabs-node";
export { ElevenLabsNode };
export type { ElevenLabsNodeData } from "./nodes-legacy/elevenlabs-node";

// LLM / Vision Nodes
import { OpenRouterNode } from "./nodes-legacy/openrouter-node";
export { OpenRouterNode };
export type { OpenRouterNodeData } from "./nodes-legacy/openrouter-node";

// Utility Nodes
import { CropImageNode } from "./nodes-legacy/crop-image-node";
import { MergeAudioVideoNode } from "./nodes-legacy/merge-audio-video-node";
import { MergeVideosNode } from "./nodes-legacy/merge-videos-node";
import { ExtractAudioNode } from "./nodes-legacy/extract-audio-node";
export { CropImageNode };
export { MergeAudioVideoNode };
export { MergeVideosNode };
export { ExtractAudioNode };
export type { CropImageNodeData } from "./nodes-legacy/crop-image-node";
export type { MergeAudioVideoNodeData } from "./nodes-legacy/merge-audio-video-node";
export type { MergeVideosNodeData } from "./nodes-legacy/merge-videos-node";
export type { ExtractAudioNodeData } from "./nodes-legacy/extract-audio-node";

// ============================================================================
// FLOW COMPONENTS
// ============================================================================

export { NodePalette } from "./node-palette";
export { FlowCanvas } from "./flow-canvas";
export { NodeInspector } from "./node-inspector";
export { NodeContextMenu } from "./node-context-menu";
export { ExecutionPanel } from "./execution-panel";
export { ActivityPanel } from "./activity-panel";
export type { ActivityPanelError, WorkflowError, ErrorSeverity } from "./activity-panel";
export { AssetManagerPanel } from "./asset-manager-panel";
export { CreditsPanel } from "./credits-panel";
export { WorkflowSidebar } from "./workflow-sidebar";
export { RunModal, demoNodes } from "./run-modal";
export { NodeTypeModal } from "./node-type-modal";
export { NodeSettingsModal, SliderInput, SelectInput, ToggleInput } from "./node-settings-modal";
export { KeyboardShortcutsModal } from "./keyboard-shortcuts-modal";

// ============================================================================
// SPECIAL NODES (Non-AI annotation nodes)
// ============================================================================

import { CommentNode } from "./nodes/comment-node";
export { CommentNode };
export type { CommentNodeData } from "./nodes/comment-node";

// ============================================================================
// I/O NODES (Input and Output nodes for workflow connections)
// ============================================================================

import { ImageInputNode } from "./nodes/image-input-node";
import { VideoInputNode } from "./nodes/video-input-node";
import { AudioInputNode } from "./nodes/audio-input-node";
import { OutputNode } from "./nodes/output-node";
export { ImageInputNode, VideoInputNode, AudioInputNode, OutputNode };
export type { ImageInputNodeData } from "./nodes/image-input-node";
export type { VideoInputNodeData } from "./nodes/video-input-node";
export type { AudioInputNodeData } from "./nodes/audio-input-node";
export type { OutputNodeData } from "./nodes/output-node";

// ============================================================================
// NODE TYPE REGISTRY FOR REACTFLOW
// ============================================================================

export const nodeTypes = {
  ...createAllNodeComponents(),
  // Special annotation nodes (not config-driven)
  comment: CommentNode,
  // I/O nodes (custom components, not config-driven)
  "image-input": ImageInputNode,
  "video-input": VideoInputNode,
  "audio-input": AudioInputNode,
  "output": OutputNode,
} as const;
