import { db } from "@/lib/db";
import type { Node, Edge } from "reactflow";

// =============================================================================
// WORKFLOW NODE SERVICE
// Handles normalized node/edge storage with backward compatibility
// =============================================================================

export interface WorkflowNodeData {
  nodeId: string;
  type: string;
  positionX: number;
  positionY: number;
  dataJson: Record<string, unknown>;
  width?: number;
  height?: number;
  sortOrder: number;
}

export interface WorkflowEdgeData {
  edgeId: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// -----------------------------------------------------------------------------
// CONVERSION UTILITIES
// -----------------------------------------------------------------------------

/**
 * Convert React Flow Node to normalized storage format
 */
export function nodeToNormalized(node: Node, index: number): WorkflowNodeData {
  return {
    nodeId: node.id,
    type: node.type || "unknown",
    positionX: node.position?.x ?? 0,
    positionY: node.position?.y ?? 0,
    dataJson: (node.data ?? {}) as Record<string, unknown>,
    width: node.measured?.width ?? node.width,
    height: node.measured?.height ?? node.height,
    sortOrder: index,
  };
}

/**
 * Convert normalized storage format back to React Flow Node
 */
export function normalizedToNode(data: WorkflowNodeData): Node {
  return {
    id: data.nodeId,
    type: data.type,
    position: { x: data.positionX, y: data.positionY },
    data: data.dataJson,
    ...(data.width && data.height ? { measured: { width: data.width, height: data.height } } : {}),
  };
}

/**
 * Convert React Flow Edge to normalized storage format
 */
export function edgeToNormalized(edge: Edge): WorkflowEdgeData {
  return {
    edgeId: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
  };
}

/**
 * Convert normalized storage format back to React Flow Edge
 */
export function normalizedToEdge(data: WorkflowEdgeData): Edge {
  return {
    id: data.edgeId,
    source: data.source,
    target: data.target,
    ...(data.sourceHandle ? { sourceHandle: data.sourceHandle } : {}),
    ...(data.targetHandle ? { targetHandle: data.targetHandle } : {}),
  };
}

// -----------------------------------------------------------------------------
// READ OPERATIONS
// -----------------------------------------------------------------------------

/**
 * Get all nodes for a workflow (with pagination support)
 */
export async function getWorkflowNodes(
  workflowId: string,
  options?: {
    cursor?: string;
    limit?: number;
    type?: string;
  }
): Promise<{ nodes: Node[]; nextCursor?: string; total: number }> {
  const { cursor, limit = 100, type } = options ?? {};

  // First check if workflow is normalized
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { isNormalized: true, nodesJson: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // If not normalized, fall back to JSON
  if (!workflow.isNormalized) {
    const allNodes = (workflow.nodesJson as Node[]) || [];
    const filteredNodes = type ? allNodes.filter((n) => n.type === type) : allNodes;
    return {
      nodes: filteredNodes,
      total: filteredNodes.length,
    };
  }

  // Use normalized tables with pagination
  const [dbNodes, total] = await Promise.all([
    db.workflowNode.findMany({
      where: {
        workflowId,
        ...(type ? { type } : {}),
      },
      orderBy: { sortOrder: "asc" },
      take: limit + 1, // Take one extra to check if there's more
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
    }),
    db.workflowNode.count({
      where: {
        workflowId,
        ...(type ? { type } : {}),
      },
    }),
  ]);

  const hasMore = dbNodes.length > limit;
  const nodes = dbNodes.slice(0, limit);
  const nextCursor = hasMore ? nodes[nodes.length - 1]?.id : undefined;

  return {
    nodes: nodes.map((n) =>
      normalizedToNode({
        nodeId: n.nodeId,
        type: n.type,
        positionX: n.positionX,
        positionY: n.positionY,
        dataJson: n.dataJson as Record<string, unknown>,
        width: n.width ?? undefined,
        height: n.height ?? undefined,
        sortOrder: n.sortOrder,
      })
    ),
    nextCursor,
    total,
  };
}

/**
 * Get all edges for a workflow
 */
export async function getWorkflowEdges(
  workflowId: string
): Promise<{ edges: Edge[]; total: number }> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { isNormalized: true, edgesJson: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // If not normalized, fall back to JSON
  if (!workflow.isNormalized) {
    const edges = (workflow.edgesJson as Edge[]) || [];
    return { edges, total: edges.length };
  }

  // Use normalized tables
  const dbEdges = await db.workflowEdge.findMany({
    where: { workflowId },
  });

  return {
    edges: dbEdges.map((e) =>
      normalizedToEdge({
        edgeId: e.edgeId,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      })
    ),
    total: dbEdges.length,
  };
}

/**
 * Get complete workflow data (nodes + edges)
 * Automatically uses normalized tables if available, else falls back to JSON
 */
export async function getWorkflowData(workflowId: string): Promise<{
  nodes: Node[];
  edges: Edge[];
  isNormalized: boolean;
}> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { isNormalized: true, nodesJson: true, edgesJson: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (!workflow.isNormalized) {
    return {
      nodes: (workflow.nodesJson as Node[]) || [],
      edges: (workflow.edgesJson as Edge[]) || [],
      isNormalized: false,
    };
  }

  const [{ nodes }, { edges }] = await Promise.all([
    getWorkflowNodes(workflowId, { limit: 10000 }), // High limit for full load
    getWorkflowEdges(workflowId),
  ]);

  return { nodes, edges, isNormalized: true };
}

// -----------------------------------------------------------------------------
// WRITE OPERATIONS
// -----------------------------------------------------------------------------

/**
 * Save nodes and edges to normalized tables (with dual-write to JSON for compatibility)
 */
export async function saveWorkflowData(
  workflowId: string,
  nodes: Node[],
  edges: Edge[],
  options?: { skipJsonWrite?: boolean }
): Promise<void> {
  const { skipJsonWrite = false } = options ?? {};

  await db.$transaction(async (tx) => {
    // Delete existing normalized data
    await tx.workflowNode.deleteMany({ where: { workflowId } });
    await tx.workflowEdge.deleteMany({ where: { workflowId } });

    // Insert new nodes
    if (nodes.length > 0) {
      await tx.workflowNode.createMany({
        data: nodes.map((node, index) => ({
          workflowId,
          nodeId: node.id,
          type: node.type || "unknown",
          positionX: node.position?.x ?? 0,
          positionY: node.position?.y ?? 0,
          dataJson: (node.data ?? {}) as object,
          width: node.measured?.width ?? node.width,
          height: node.measured?.height ?? node.height,
          sortOrder: index,
        })),
      });
    }

    // Insert new edges
    if (edges.length > 0) {
      await tx.workflowEdge.createMany({
        data: edges.map((edge) => ({
          workflowId,
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        })),
      });
    }

    // Update workflow - dual-write to JSON for backward compatibility
    await tx.workflow.update({
      where: { id: workflowId },
      data: {
        isNormalized: true,
        ...(skipJsonWrite
          ? {}
          : {
              nodesJson: nodes,
              edgesJson: edges,
            }),
      },
    });
  });
}

/**
 * Update a single node's position (efficient partial update)
 */
export async function updateNodePosition(
  workflowId: string,
  nodeId: string,
  position: { x: number; y: number }
): Promise<void> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { isNormalized: true, nodesJson: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (workflow.isNormalized) {
    // Update normalized table only - O(1) operation
    await db.workflowNode.update({
      where: {
        workflowId_nodeId: { workflowId, nodeId },
      },
      data: {
        positionX: position.x,
        positionY: position.y,
      },
    });
  } else {
    // Fall back to JSON update (legacy)
    const nodes = (workflow.nodesJson as Node[]) || [];
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex !== -1) {
      nodes[nodeIndex].position = position;
      await db.workflow.update({
        where: { id: workflowId },
        data: { nodesJson: nodes },
      });
    }
  }
}

/**
 * Update a single node's data (efficient partial update)
 */
export async function updateNodeData(
  workflowId: string,
  nodeId: string,
  data: Record<string, unknown>
): Promise<void> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { isNormalized: true, nodesJson: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (workflow.isNormalized) {
    // Update normalized table only
    await db.workflowNode.update({
      where: {
        workflowId_nodeId: { workflowId, nodeId },
      },
      data: {
        dataJson: data,
      },
    });
  } else {
    // Fall back to JSON update (legacy)
    const nodes = (workflow.nodesJson as Node[]) || [];
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex !== -1) {
      nodes[nodeIndex].data = data;
      await db.workflow.update({
        where: { id: workflowId },
        data: { nodesJson: nodes },
      });
    }
  }
}

/**
 * Add a single node (efficient append)
 */
export async function addNode(workflowId: string, node: Node): Promise<void> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { isNormalized: true, nodesJson: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (workflow.isNormalized) {
    // Get max sortOrder
    const maxOrder = await db.workflowNode.aggregate({
      where: { workflowId },
      _max: { sortOrder: true },
    });

    await db.workflowNode.create({
      data: {
        workflowId,
        nodeId: node.id,
        type: node.type || "unknown",
        positionX: node.position?.x ?? 0,
        positionY: node.position?.y ?? 0,
        dataJson: (node.data ?? {}) as object,
        width: node.measured?.width ?? node.width,
        height: node.measured?.height ?? node.height,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  } else {
    // Fall back to JSON update
    const nodes = (workflow.nodesJson as Node[]) || [];
    nodes.push(node);
    await db.workflow.update({
      where: { id: workflowId },
      data: { nodesJson: nodes },
    });
  }
}

/**
 * Delete a single node and its connected edges
 */
export async function deleteNode(
  workflowId: string,
  nodeId: string
): Promise<void> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { isNormalized: true, nodesJson: true, edgesJson: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (workflow.isNormalized) {
    await db.$transaction([
      // Delete the node
      db.workflowNode.delete({
        where: { workflowId_nodeId: { workflowId, nodeId } },
      }),
      // Delete connected edges
      db.workflowEdge.deleteMany({
        where: {
          workflowId,
          OR: [{ source: nodeId }, { target: nodeId }],
        },
      }),
    ]);
  } else {
    // Fall back to JSON update
    const nodes = (workflow.nodesJson as Node[]) || [];
    const edges = (workflow.edgesJson as Edge[]) || [];
    
    const filteredNodes = nodes.filter((n) => n.id !== nodeId);
    const filteredEdges = edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId
    );

    await db.workflow.update({
      where: { id: workflowId },
      data: {
        nodesJson: filteredNodes,
        edgesJson: filteredEdges,
      },
    });
  }
}

// -----------------------------------------------------------------------------
// MIGRATION UTILITIES
// -----------------------------------------------------------------------------

/**
 * Migrate a single workflow from JSON to normalized tables
 */
export async function migrateWorkflowToNormalized(
  workflowId: string
): Promise<{ nodesCount: number; edgesCount: number }> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { isNormalized: true, nodesJson: true, edgesJson: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (workflow.isNormalized) {
    // Already normalized
    return { nodesCount: 0, edgesCount: 0 };
  }

  const nodes = (workflow.nodesJson as Node[]) || [];
  const edges = (workflow.edgesJson as Edge[]) || [];

  await saveWorkflowData(workflowId, nodes, edges, { skipJsonWrite: true });

  return {
    nodesCount: nodes.length,
    edgesCount: edges.length,
  };
}

/**
 * Batch migrate multiple workflows
 */
export async function migrateWorkflowsBatch(
  workflowIds: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ migrated: number; failed: string[] }> {
  let migrated = 0;
  const failed: string[] = [];

  for (let i = 0; i < workflowIds.length; i++) {
    try {
      await migrateWorkflowToNormalized(workflowIds[i]);
      migrated++;
    } catch (error) {
      console.error(`Failed to migrate workflow ${workflowIds[i]}:`, error);
      failed.push(workflowIds[i]);
    }
    onProgress?.(i + 1, workflowIds.length);
  }

  return { migrated, failed };
}

/**
 * Get migration status for all workflows
 */
export async function getMigrationStatus(): Promise<{
  total: number;
  normalized: number;
  pending: number;
}> {
  try {
    // Try using the isNormalized field (may not exist in Prisma types yet)
    const [total, normalized] = await Promise.all([
      db.workflow.count(),
      db.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM workflows WHERE "isNormalized" = true`,
    ]);

    const normalizedCount = Number(normalized[0]?.count ?? 0);

    return {
      total,
      normalized: normalizedCount,
      pending: total - normalizedCount,
    };
  } catch {
    // Fallback: just return total count
    const total = await db.workflow.count();
    return {
      total,
      normalized: 0,
      pending: total,
    };
  }
}
