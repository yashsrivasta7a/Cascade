/**
 * Auto-Layout Algorithm for Workflow Nodes
 * 
 * Arranges nodes in a left-to-right tree layout:
 * - Each separate chain is laid out independently
 * - Horizontal flow based on dependency chain
 * - Vertical stacking when a node has multiple children
 * - NO OVERLAPPING - guaranteed minimum spacing between nodes
 */

import type { Node, Edge } from "reactflow";

export interface LayoutOptions {
  /** Horizontal gap between levels (columns) */
  horizontalSpacing: number;
  /** Vertical gap between nodes - this is the MINIMUM distance */
  verticalSpacing: number;
  /** Starting X position for the layout */
  startX: number;
  /** Starting Y position for the layout */
  startY: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  horizontalSpacing: 450,
  verticalSpacing: 350, // Increased to prevent overlaps
  startX: 100,
  startY: 100,
};

/**
 * Auto-layout nodes in a left-to-right tree structure
 * Each disconnected chain is arranged separately
 */
export function autoLayoutNodes(
  nodes: Node[],
  edges: Edge[],
  options?: Partial<LayoutOptions>
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Separate comment nodes (they won't be auto-arranged)
  const commentNodes = nodes.filter((n) => n.type === "comment");
  const workflowNodes = nodes.filter((n) => n.type !== "comment");
  
  if (workflowNodes.length === 0) {
    return nodes;
  }
  
  // Build adjacency maps
  const childrenMap = new Map<string, string[]>();
  const parentsMap = new Map<string, string[]>();
  const workflowNodeIds = new Set(workflowNodes.map((n) => n.id));
  
  for (const node of workflowNodes) {
    childrenMap.set(node.id, []);
    parentsMap.set(node.id, []);
  }
  
  for (const edge of edges) {
    if (workflowNodeIds.has(edge.source) && workflowNodeIds.has(edge.target)) {
      const children = childrenMap.get(edge.source)!;
      if (!children.includes(edge.target)) {
        children.push(edge.target);
      }
      const parents = parentsMap.get(edge.target)!;
      if (!parents.includes(edge.source)) {
        parents.push(edge.source);
      }
    }
  }
  
  // Find connected components (separate chains)
  const components = findConnectedComponents(workflowNodes, childrenMap, parentsMap);
  
  console.log(`[AutoLayout] Found ${components.length} separate chain(s)`);
  
  // Layout each component separately
  const positions = new Map<string, { x: number; y: number }>();
  let chainStartY = opts.startY;
  
  for (let chainIndex = 0; chainIndex < components.length; chainIndex++) {
    const component = components[chainIndex];
    console.log(`[AutoLayout] Chain ${chainIndex + 1}: ${component.length} nodes`);
    
    // Layout this chain
    const { positions: chainPositions, maxY } = layoutChainSimple(
      component,
      childrenMap,
      parentsMap,
      opts.startX,
      chainStartY,
      opts.horizontalSpacing,
      opts.verticalSpacing
    );
    
    // Merge positions
    for (const [nodeId, pos] of chainPositions) {
      positions.set(nodeId, pos);
    }
    
    // Next chain starts below this one with extra spacing
    chainStartY = maxY + opts.verticalSpacing * 2;
  }
  
  // Apply positions to nodes
  const layoutedNodes = workflowNodes.map((node) => {
    const pos = positions.get(node.id);
    if (pos) {
      return { ...node, position: { x: pos.x, y: pos.y } };
    }
    return node;
  });
  
  return [...layoutedNodes, ...commentNodes];
}

/**
 * Find connected components (separate chains)
 */
function findConnectedComponents(
  nodes: Node[],
  childrenMap: Map<string, string[]>,
  parentsMap: Map<string, string[]>
): Node[][] {
  const visited = new Set<string>();
  const components: Node[][] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    
    const component: Node[] = [];
    const queue = [node.id];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId) || !nodeMap.has(nodeId)) continue;
      
      visited.add(nodeId);
      component.push(nodeMap.get(nodeId)!);
      
      const children = childrenMap.get(nodeId) || [];
      const parents = parentsMap.get(nodeId) || [];
      
      for (const connectedId of [...children, ...parents]) {
        if (!visited.has(connectedId) && nodeMap.has(connectedId)) {
          queue.push(connectedId);
        }
      }
    }
    
    if (component.length > 0) {
      components.push(component);
    }
  }
  
  components.sort((a, b) => b.length - a.length);
  return components;
}

/**
 * Simple layout algorithm that GUARANTEES no overlaps
 */
function layoutChainSimple(
  nodes: Node[],
  childrenMap: Map<string, string[]>,
  parentsMap: Map<string, string[]>,
  startX: number,
  startY: number,
  horizontalSpacing: number,
  verticalSpacing: number
): { positions: Map<string, { x: number; y: number }>; maxY: number } {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeIds = new Set(nodes.map((n) => n.id));
  
  if (nodes.length === 0) {
    return { positions, maxY: startY };
  }
  
  // Step 1: Assign levels using BFS from roots
  const levels = assignLevels(nodes, childrenMap, parentsMap, nodeIds);
  
  // Step 2: Group by level
  const levelGroups = new Map<number, Node[]>();
  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(node);
  }
  
  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
  
  // Step 3: Simple positioning - assign Y slots sequentially at each level
  // Track which Y slots are used globally to prevent ANY overlap
  const usedYSlots = new Map<number, number[]>(); // level -> array of used Y values
  
  for (const level of sortedLevels) {
    usedYSlots.set(level, []);
  }
  
  // Process level by level
  for (const level of sortedLevels) {
    const nodesAtLevel = levelGroups.get(level) || [];
    const x = startX + level * horizontalSpacing;
    
    // Sort nodes by parent Y to keep related nodes close
    const sortedNodes = sortByParentY(nodesAtLevel, parentsMap, positions, nodeIds);
    
    for (const node of sortedNodes) {
      // Find the next available Y position
      const usedY = usedYSlots.get(level)!;
      
      // Get preferred Y (parent's Y if available)
      const parentY = getFirstParentY(node.id, parentsMap, positions, nodeIds);
      let targetY = parentY ?? startY;
      
      // Find nearest available slot that doesn't overlap
      targetY = findNonOverlappingY(targetY, usedY, verticalSpacing, startY);
      
      positions.set(node.id, { x, y: targetY });
      usedY.push(targetY);
    }
  }
  
  // Step 4: Center parents among their children (but maintain no-overlap guarantee)
  centerParentsWithoutOverlap(positions, childrenMap, levelGroups, sortedLevels, nodeIds, verticalSpacing);
  
  // Calculate maxY
  let maxY = startY;
  for (const pos of positions.values()) {
    maxY = Math.max(maxY, pos.y);
  }
  
  return { positions, maxY };
}

/**
 * Assign levels (columns) using BFS
 */
function assignLevels(
  nodes: Node[],
  childrenMap: Map<string, string[]>,
  parentsMap: Map<string, string[]>,
  nodeIds: Set<string>
): Map<string, number> {
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  
  // Find roots
  const roots = nodes.filter((n) => {
    const parents = (parentsMap.get(n.id) || []).filter((p) => nodeIds.has(p));
    return parents.length === 0;
  });
  
  if (roots.length === 0 && nodes.length > 0) {
    roots.push(nodes[0]);
  }
  
  // BFS
  const queue = roots.map((r) => ({ id: r.id, level: 0 }));
  
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (!nodeIds.has(id)) continue;
    
    if (visited.has(id)) {
      // Update to max level
      if (level > (levels.get(id) ?? 0)) {
        levels.set(id, level);
      }
      continue;
    }
    
    visited.add(id);
    levels.set(id, level);
    
    const children = (childrenMap.get(id) || []).filter((c) => nodeIds.has(c));
    for (const childId of children) {
      queue.push({ id: childId, level: level + 1 });
    }
  }
  
  // Handle unvisited nodes
  const maxLevel = Math.max(0, ...Array.from(levels.values()));
  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, maxLevel + 1);
    }
  }
  
  return levels;
}

/**
 * Sort nodes by their parent's Y position
 */
function sortByParentY(
  nodes: Node[],
  parentsMap: Map<string, string[]>,
  positions: Map<string, { x: number; y: number }>,
  nodeIds: Set<string>
): Node[] {
  return [...nodes].sort((a, b) => {
    const aY = getFirstParentY(a.id, parentsMap, positions, nodeIds) ?? Infinity;
    const bY = getFirstParentY(b.id, parentsMap, positions, nodeIds) ?? Infinity;
    return aY - bY;
  });
}

/**
 * Get Y position of first parent that has been positioned
 */
function getFirstParentY(
  nodeId: string,
  parentsMap: Map<string, string[]>,
  positions: Map<string, { x: number; y: number }>,
  nodeIds: Set<string>
): number | null {
  const parents = (parentsMap.get(nodeId) || []).filter((p) => nodeIds.has(p));
  for (const parentId of parents) {
    const pos = positions.get(parentId);
    if (pos) return pos.y;
  }
  return null;
}

/**
 * Find a Y position that doesn't overlap with any used positions
 */
function findNonOverlappingY(
  preferredY: number,
  usedYPositions: number[],
  minSpacing: number,
  minY: number
): number {
  if (usedYPositions.length === 0) {
    return Math.max(preferredY, minY);
  }
  
  // Sort used positions
  const sorted = [...usedYPositions].sort((a, b) => a - b);
  
  // Check if preferred position works
  let canUsePreferred = true;
  for (const usedY of sorted) {
    if (Math.abs(preferredY - usedY) < minSpacing) {
      canUsePreferred = false;
      break;
    }
  }
  
  if (canUsePreferred && preferredY >= minY) {
    return preferredY;
  }
  
  // Find the first available slot
  let candidateY = minY;
  for (const usedY of sorted) {
    if (candidateY + minSpacing <= usedY) {
      // There's a gap before this used position
      return Math.max(candidateY, minY);
    }
    // Move candidate past this used position
    candidateY = usedY + minSpacing;
  }
  
  return Math.max(candidateY, minY);
}

/**
 * Center parents among children without creating overlaps
 */
function centerParentsWithoutOverlap(
  positions: Map<string, { x: number; y: number }>,
  childrenMap: Map<string, string[]>,
  levelGroups: Map<number, Node[]>,
  sortedLevels: number[],
  nodeIds: Set<string>,
  minSpacing: number
): void {
  // Process from right to left (children first)
  for (const level of [...sortedLevels].reverse()) {
    const nodesAtLevel = levelGroups.get(level) || [];
    
    for (const node of nodesAtLevel) {
      const children = (childrenMap.get(node.id) || []).filter((c) => nodeIds.has(c));
      if (children.length < 2) continue;
      
      // Get children Y positions
      const childYs = children
        .map((c) => positions.get(c)?.y)
        .filter((y): y is number => y !== undefined);
      
      if (childYs.length < 2) continue;
      
      // Calculate center
      const centerY = (Math.min(...childYs) + Math.max(...childYs)) / 2;
      const currentPos = positions.get(node.id);
      if (!currentPos) continue;
      
      // Check if centering would cause overlap with siblings at same level
      const siblingsYs = nodesAtLevel
        .filter((n) => n.id !== node.id)
        .map((n) => positions.get(n.id)?.y)
        .filter((y): y is number => y !== undefined);
      
      let canCenter = true;
      for (const sibY of siblingsYs) {
        if (Math.abs(centerY - sibY) < minSpacing) {
          canCenter = false;
          break;
        }
      }
      
      if (canCenter) {
        positions.set(node.id, { x: currentPos.x, y: centerY });
      }
    }
  }
}
