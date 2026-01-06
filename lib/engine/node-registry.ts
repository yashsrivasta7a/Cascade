import type { AINodeType } from "@/types/nodes";
import type { NodeExecutor } from "./types";

// =============================================================================
// NODE REGISTRY
// =============================================================================

// Registry of all node executors
const nodeExecutors = new Map<AINodeType, NodeExecutor>();

// Register a node executor
export function registerNodeExecutor<TInput, TOutput>(
  executor: NodeExecutor<TInput, TOutput>
): void {
  if (nodeExecutors.has(executor.type)) {
    console.warn(`Node executor for "${executor.type}" is being overwritten`);
  }
  nodeExecutors.set(executor.type, executor as NodeExecutor);
}

// Get a node executor by type
export function getNodeExecutor(type: AINodeType): NodeExecutor | undefined {
  return nodeExecutors.get(type);
}

// Get all registered node types
export function getRegisteredNodeTypes(): AINodeType[] {
  return Array.from(nodeExecutors.keys());
}

// Check if a node type is registered
export function isNodeTypeRegistered(type: AINodeType): boolean {
  return nodeExecutors.has(type);
}

// Validate input for a node
export function validateNodeInput(
  type: AINodeType,
  input: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  const executor = getNodeExecutor(type);
  if (!executor) {
    return { success: false, error: `Unknown node type: ${type}` };
  }

  const result = executor.inputSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join("; "),
    };
  }

  return { success: true, data: result.data };
}

// Validate output from a node
export function validateNodeOutput(
  type: AINodeType,
  output: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  const executor = getNodeExecutor(type);
  if (!executor) {
    return { success: false, error: `Unknown node type: ${type}` };
  }

  const result = executor.outputSchema.safeParse(output);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join("; "),
    };
  }

  return { success: true, data: result.data };
}

