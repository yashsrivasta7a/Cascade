import { ReactNode } from "react";
import { NodeProps } from "reactflow";
import type { DataType, NodeStatus, InheritedSettings } from "@/types/nodes";

export interface BaseNodeData {
  label: string;
  description?: string;
  icon?: ReactNode;
  status?: NodeStatus;
  provider?: string;
  estimatedCost?: number;
  actualCost?: number;
  progress?: number;
  /** Settings inherited from another node */
  _inheritedFrom?: InheritedSettings;
  [key: string]: unknown;
}

export interface HandleConfig {
  id: string;
  type: DataType;
  label: string;
  position?: "top" | "center" | "bottom";
  required?: boolean;
  hidden?: boolean;
}

export interface BaseNodeProps extends NodeProps<BaseNodeData> {
  color: "cyan" | "violet" | "emerald" | "amber" | "rose" | "blue" | "zinc" | "teal";
  nodeType?: string; // Explicit node type for settings lookup
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  inputs?: HandleConfig[];
  outputs?: HandleConfig[];
  isUtility?: boolean;
  layout?: "horizontal" | "vertical";
  /** Whether this node should skip execution and use existing output */
  skip?: boolean;
  /** Whether this node has existing output that can be used when skipped */
  hasOutput?: boolean;
  /** Callback when skip toggle is clicked */
  onSkipToggle?: (skip: boolean) => void;
}
