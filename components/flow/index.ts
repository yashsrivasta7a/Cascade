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
// MEDIA INPUT NODES (upload entry points for image / video / audio)
// ============================================================================

import { ImageInputNode } from "./nodes/image-input-node";
import { VideoInputNode } from "./nodes/video-input-node";
import { AudioInputNode } from "./nodes/audio-input-node";
export { ImageInputNode, VideoInputNode, AudioInputNode };
export type { ImageInputNodeData } from "./nodes/image-input-node";
export type { VideoInputNodeData } from "./nodes/video-input-node";
export type { AudioInputNodeData } from "./nodes/audio-input-node";

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
} as const;
