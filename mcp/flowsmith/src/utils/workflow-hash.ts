import crypto from "crypto";

// =============================================================================
// WORKFLOW STRUCTURE HASHING
// Creates deterministic hashes for workflow structures to enable caching
// =============================================================================

/**
 * Input node type for hashing - more permissive than strict Node type
 */
interface HashableNode {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
}

/**
 * Input edge type for hashing
 */
interface HashableEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * Represents the canonical form of a node for hashing
 * Only includes structural properties, not user data like labels or positions
 */
interface CanonicalNode {
  type: string;
  mediaType?: string; // For input nodes
}

/**
 * Represents the canonical form of an edge for hashing
 */
interface CanonicalEdge {
  sourceType: string;
  targetType: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * Extract canonical node representation for hashing
 * Strips out user-specific data (positions, labels, IDs)
 */
function canonicalizeNode(node: HashableNode): CanonicalNode {
  const canonical: CanonicalNode = {
    type: node.type || "unknown",
  };

  // For input nodes, include the media type as it affects structure
  if (node.type === "input" && node.data?.mediaType) {
    canonical.mediaType = node.data.mediaType as string;
  }

  return canonical;
}

/**
 * Create a node ID to type mapping for edge canonicalization
 */
function createNodeTypeMap(nodes: HashableNode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of nodes) {
    // Store type with mediaType suffix for input nodes
    let typeKey = node.type || "unknown";
    if (node.type === "input" && node.data?.mediaType) {
      typeKey = `input:${node.data.mediaType}`;
    }
    map.set(node.id, typeKey);
  }
  return map;
}

/**
 * Extract canonical edge representation for hashing
 * Replaces node IDs with node types for position-independence
 */
function canonicalizeEdge(edge: HashableEdge, nodeTypeMap: Map<string, string>): CanonicalEdge {
  return {
    sourceType: nodeTypeMap.get(edge.source) || "unknown",
    targetType: nodeTypeMap.get(edge.target) || "unknown",
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  };
}

/**
 * Generate a deterministic hash for a workflow structure
 * 
 * The hash is based on:
 * 1. Node types (sorted for consistency)
 * 2. Edge connections (by type, not ID)
 * 
 * This allows workflows with the same structure but different
 * node IDs, positions, or labels to match.
 */
export function hashWorkflowStructure(nodes: HashableNode[], edges: HashableEdge[]): string {
  // Create node type mapping
  const nodeTypeMap = createNodeTypeMap(nodes);

  // Canonicalize nodes and sort by type
  const canonicalNodes = nodes
    .map(canonicalizeNode)
    .sort((a, b) => {
      const aKey = a.mediaType ? `${a.type}:${a.mediaType}` : a.type;
      const bKey = b.mediaType ? `${b.type}:${b.mediaType}` : b.type;
      return aKey.localeCompare(bKey);
    });

  // Canonicalize edges and sort for determinism
  const canonicalEdges = edges
    .map((e) => canonicalizeEdge(e, nodeTypeMap))
    .sort((a, b) => {
      const aKey = `${a.sourceType}->${a.targetType}:${a.sourceHandle || ""}->${a.targetHandle || ""}`;
      const bKey = `${b.sourceType}->${b.targetType}:${b.sourceHandle || ""}->${b.targetHandle || ""}`;
      return aKey.localeCompare(bKey);
    });

  // Build canonical string representation
  const nodesStr = canonicalNodes
    .map((n) => (n.mediaType ? `${n.type}:${n.mediaType}` : n.type))
    .join("|");

  const edgesStr = canonicalEdges
    .map((e) => `${e.sourceType}[${e.sourceHandle || "*"}]->${e.targetType}[${e.targetHandle || "*"}]`)
    .join("|");

  const canonical = `nodes:${nodesStr}||edges:${edgesStr}`;

  // Generate SHA-256 hash
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Generate a human-readable description of workflow structure
 */
export function describeWorkflowStructure(nodes: HashableNode[]): string {
  const nodeTypes = nodes
    .map((n) => {
      if (n.type === "input" && n.data?.mediaType) {
        return `${n.data.mediaType} input`;
      }
      return n.type || "unknown";
    })
    .filter((t): t is string => t !== "output" && t !== undefined); // Exclude output from description

  if (nodeTypes.length === 0) return "Empty workflow";
  if (nodeTypes.length === 1) return `${nodeTypes[0]} workflow`;

  // Create a flow description
  const inputs = nodeTypes.filter((t) => t.includes("input"));
  const processors = nodeTypes.filter((t) => !t.includes("input"));

  if (inputs.length > 1 && processors.length === 1) {
    return `${inputs.join(" + ")} → ${processors[0]}`;
  }

  return nodeTypes.slice(0, 3).join(" → ") + (nodeTypes.length > 3 ? " → ..." : "");
}

/**
 * Strip user-specific data from nodes for template storage
 * Keeps only structural data needed to recreate the workflow
 */
export function createTemplateNodes(nodes: HashableNode[]): HashableNode[] {
  return nodes.map((node, index) => ({
    id: `${node.type}-${index + 1}`, // Normalized IDs
    type: node.type,
    position: { x: index * 350, y: 100 }, // Normalized positions
    data: {
      nodeType: node.type,
      label: node.data?.label || node.type,
      ...(node.type === "input" && node.data?.mediaType
        ? { mediaType: node.data.mediaType }
        : {}),
    },
  }));
}

/**
 * Regenerate edges for template nodes
 * Uses the same edge structure but with normalized node IDs
 */
export function createTemplateEdges(originalEdges: HashableEdge[], originalNodes: HashableNode[], templateNodes: HashableNode[]): HashableEdge[] {
  // Map original node IDs to template node IDs
  const idMap = new Map<string, string>();
  originalNodes.forEach((orig, index) => {
    idMap.set(orig.id, templateNodes[index].id);
  });

  return originalEdges.map((edge, index) => ({
    id: `e${index + 1}`,
    source: idMap.get(edge.source) || edge.source,
    target: idMap.get(edge.target) || edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }));
}
