import type { Node, Edge } from "reactflow";
import { NODE_DEFINITIONS, type AINodeType, type DataType, isTypeCompatible } from "@/types/nodes";

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationError {
  type: "missing_input" | "missing_output" | "type_mismatch" | "disconnected_node" | "cycle_detected";
  nodeId: string;
  message: string;
  details?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

// I/O node types
const INPUT_NODE_TYPES = ["image-input", "video-input", "audio-input"] as const;
const OUTPUT_NODE_TYPES = ["output"] as const;

// Map input node types to their output data types
const INPUT_NODE_OUTPUT_TYPES: Record<string, DataType> = {
  "image-input": "image",
  "video-input": "video",
  "audio-input": "audio",
};

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate a workflow before execution
 * Checks for:
 * 1. Required inputs are connected
 * 2. At least one OUTPUT node exists and is connected
 * 3. Type compatibility between connected nodes
 */
export function validateWorkflow(
  nodes: Node[],
  edges: Edge[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Get all node IDs for quick lookup
  const nodeMap = new Map<string, Node>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Check 1: At least one OUTPUT node must exist
  const outputNodes = nodes.filter((n) =>
    OUTPUT_NODE_TYPES.includes(n.type as any)
  );
  
  if (outputNodes.length === 0) {
    errors.push({
      type: "missing_output",
      nodeId: "",
      message: "Workflow requires at least one OUTPUT node",
      details: "Add an OUTPUT node to display the workflow result",
    });
  }

  // Check 2: Each OUTPUT node must be connected to something
  for (const outputNode of outputNodes) {
    const incomingEdge = edges.find(
      (e) => e.target === outputNode.id && e.targetHandle === "input"
    );
    
    if (!incomingEdge) {
      errors.push({
        type: "disconnected_node",
        nodeId: outputNode.id,
        message: `OUTPUT node "${outputNode.data?.label || "Output"}" is not connected`,
        details: "Connect a system node to the OUTPUT node",
      });
    }
  }

  // Check 3: Validate each system node's required inputs
  for (const node of nodes) {
    const nodeType = node.type as AINodeType;
    
    // Skip I/O nodes and annotation nodes
    if (
      INPUT_NODE_TYPES.includes(nodeType as any) ||
      OUTPUT_NODE_TYPES.includes(nodeType as any) ||
      nodeType === "comment"
    ) {
      continue;
    }

    const definition = NODE_DEFINITIONS[nodeType];
    if (!definition) continue;

    // Check each input - in the simplified NodeDefinition, inputs are { type, label }
    // Media inputs (image, video, audio) should be connected or have a value
    for (const input of definition.inputs) {
      const isMediaInput = ["image", "video", "audio"].includes(input.type);
      
      if (isMediaInput) {
        // Check if any edge connects to this node for this media type
        const isConnected = edges.some((e) => e.target === node.id);
        // Check if node data has a value for this input type
        const hasValue = node.data?.[input.type] || node.data?.[`input${input.type.charAt(0).toUpperCase() + input.type.slice(1)}`];
        
        if (!hasValue && !isConnected) {
          errors.push({
            type: "missing_input",
            nodeId: node.id,
            message: `"${definition.label}" is missing required ${input.type} input`,
            details: `Connect a ${input.type.toUpperCase()} INPUT node to provide the "${input.label}" input`,
          });
        }
      }
    }
  }

  // Check 4: Validate type compatibility for all edges
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) continue;

    // Get source output type
    let sourceType: DataType | undefined;
    const sourceNodeType = sourceNode.type as AINodeType;
    
    if (INPUT_NODE_TYPES.includes(sourceNodeType as any)) {
      sourceType = INPUT_NODE_OUTPUT_TYPES[sourceNodeType];
    } else {
      const sourceDef = NODE_DEFINITIONS[sourceNodeType];
      if (sourceDef && sourceDef.outputs.length > 0) {
        // Use the first output's type (most nodes have a single primary output)
        sourceType = sourceDef.outputs[0].type;
      }
    }

    // Get target input type
    let targetType: DataType | undefined;
    const targetNodeType = targetNode.type as AINodeType;
    
    if (OUTPUT_NODE_TYPES.includes(targetNodeType as any)) {
      targetType = "any"; // OUTPUT accepts any type
    } else {
      const targetDef = NODE_DEFINITIONS[targetNodeType];
      if (targetDef && targetDef.inputs.length > 0) {
        // Try to match by target handle or use first input
        const handleType = edge.targetHandle?.toLowerCase();
        const targetInput = targetDef.inputs.find(
          (i) => i.type === handleType || i.label.toLowerCase().includes(handleType || "")
        ) || targetDef.inputs[0];
        targetType = targetInput?.type;
      }
    }

    // Check compatibility
    if (sourceType && targetType && !isTypeCompatible(sourceType, targetType)) {
      const sourceDef = NODE_DEFINITIONS[sourceNodeType];
      const targetDef = NODE_DEFINITIONS[targetNodeType];
      
      errors.push({
        type: "type_mismatch",
        nodeId: targetNode.id,
        message: `Type mismatch: ${sourceType} → ${targetType}`,
        details: `"${sourceDef?.label || sourceNodeType}" outputs ${sourceType}, but "${targetDef?.label || targetNodeType}" expects ${targetType}`,
      });
    }
  }

  // Check 5: Warn about unused input nodes
  for (const node of nodes) {
    if (INPUT_NODE_TYPES.includes(node.type as any)) {
      const hasOutgoingEdge = edges.some((e) => e.source === node.id);
      if (!hasOutgoingEdge) {
        warnings.push(
          `${node.data?.label || node.type} is not connected to any node`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick validation to check if workflow can be run
 * Returns true if there are no blocking errors
 */
export function canRunWorkflow(nodes: Node[], edges: Edge[]): boolean {
  const result = validateWorkflow(nodes, edges);
  return result.valid;
}

/**
 * Get a human-readable summary of validation errors
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.valid) {
    return "Workflow is valid and ready to run";
  }

  const errorCount = result.errors.length;
  const warningCount = result.warnings.length;

  let summary = `Found ${errorCount} error${errorCount !== 1 ? "s" : ""}`;
  if (warningCount > 0) {
    summary += ` and ${warningCount} warning${warningCount !== 1 ? "s" : ""}`;
  }

  return summary;
}
