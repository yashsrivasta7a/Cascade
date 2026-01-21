import { Node, Edge } from "reactflow";

// History state for undo/redo
export interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

// Clipboard state for copy/paste
export interface ClipboardData {
  nodes: Node[];
  edges: Edge[];
}

// Maximum history entries to keep
export const MAX_HISTORY_LENGTH = 50;
