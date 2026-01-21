import type { Edge, Node } from "reactflow";

/**
 * GraphIndex - O(1) lookups for nodes and edges
 * 
 * Instead of calling nodes.find() or edges.filter() repeatedly (O(n) each),
 * build this index once and get O(1) lookups.
 * 
 * Performance with 1000 nodes:
 * - nodes.find() called 50 times = 50,000 operations
 * - GraphIndex lookups = 1000 (build) + 50 (lookups) = 1,050 operations
 */
export class GraphIndex {
  // Node lookups
  private nodeById: Map<string, Node>;
  
  // Edge lookups
  private edgesBySource: Map<string, Edge[]>;
  private edgesByTarget: Map<string, Edge[]>;
  private edgeBySourceTarget: Map<string, Edge>; // "source->target" -> Edge
  
  // Dependency graph (cached)
  private _dependencies: Map<string, Set<string>> | null = null;
  private _dependents: Map<string, Set<string>> | null = null;
  
  // Root nodes (no incoming edges)
  private _rootNodeIds: string[] | null = null;
  
  constructor(
    public readonly nodes: Node[],
    public readonly edges: Edge[]
  ) {
    // Build node index - O(n)
    this.nodeById = new Map(nodes.map(n => [n.id, n]));
    
    // Build edge indexes - O(e)
    this.edgesBySource = new Map();
    this.edgesByTarget = new Map();
    this.edgeBySourceTarget = new Map();
    
    for (const edge of edges) {
      // By source
      if (!this.edgesBySource.has(edge.source)) {
        this.edgesBySource.set(edge.source, []);
      }
      this.edgesBySource.get(edge.source)!.push(edge);
      
      // By target
      if (!this.edgesByTarget.has(edge.target)) {
        this.edgesByTarget.set(edge.target, []);
      }
      this.edgesByTarget.get(edge.target)!.push(edge);
      
      // By source+target (for direct lookup)
      this.edgeBySourceTarget.set(`${edge.source}->${edge.target}`, edge);
    }
  }
  
  // ==========================================================================
  // NODE LOOKUPS - O(1)
  // ==========================================================================
  
  /** Get node by ID - O(1) instead of O(n) */
  getNode(id: string): Node | undefined {
    return this.nodeById.get(id);
  }
  
  /** Check if node exists - O(1) */
  hasNode(id: string): boolean {
    return this.nodeById.has(id);
  }
  
  /** Get all node IDs - O(1) */
  get nodeIds(): string[] {
    return Array.from(this.nodeById.keys());
  }
  
  // ==========================================================================
  // EDGE LOOKUPS - O(1) or O(k) where k is edges for that node
  // ==========================================================================
  
  /** Get all edges FROM a node - O(1) */
  getOutgoingEdges(nodeId: string): Edge[] {
    return this.edgesBySource.get(nodeId) ?? [];
  }
  
  /** Get all edges TO a node - O(1) */
  getIncomingEdges(nodeId: string): Edge[] {
    return this.edgesByTarget.get(nodeId) ?? [];
  }
  
  /** Get edge between two nodes - O(1) */
  getEdge(sourceId: string, targetId: string): Edge | undefined {
    return this.edgeBySourceTarget.get(`${sourceId}->${targetId}`);
  }
  
  /** Check if edge exists - O(1) */
  hasEdge(sourceId: string, targetId: string): boolean {
    return this.edgeBySourceTarget.has(`${sourceId}->${targetId}`);
  }
  
  /** Get incoming edge by target handle - O(k) where k is incoming edges */
  getIncomingEdgeByHandle(nodeId: string, handleId: string): Edge | undefined {
    const incoming = this.getIncomingEdges(nodeId);
    return incoming.find(e => e.targetHandle === handleId);
  }
  
  // ==========================================================================
  // DEPENDENCY GRAPH - Cached, built on first access
  // ==========================================================================
  
  /** Get nodes that this node depends on (parents) - O(1) after first call */
  getDependencies(nodeId: string): Set<string> {
    this.ensureDependencyGraph();
    return this._dependencies!.get(nodeId) ?? new Set();
  }
  
  /** Get nodes that depend on this node (children) - O(1) after first call */
  getDependents(nodeId: string): Set<string> {
    this.ensureDependencyGraph();
    return this._dependents!.get(nodeId) ?? new Set();
  }
  
  /** Get the full dependency map - O(1) after first call */
  get dependencies(): Map<string, Set<string>> {
    this.ensureDependencyGraph();
    return this._dependencies!;
  }
  
  /** Get the full dependents map - O(1) after first call */
  get dependents(): Map<string, Set<string>> {
    this.ensureDependencyGraph();
    return this._dependents!;
  }
  
  /** Get root nodes (no dependencies) - O(1) after first call */
  get rootNodeIds(): string[] {
    if (this._rootNodeIds === null) {
      this.ensureDependencyGraph();
      this._rootNodeIds = [];
      for (const [nodeId, deps] of this._dependencies!) {
        if (deps.size === 0) {
          this._rootNodeIds.push(nodeId);
        }
      }
    }
    return this._rootNodeIds;
  }
  
  /** Build dependency graph lazily - O(n + e) */
  private ensureDependencyGraph(): void {
    if (this._dependencies !== null) return;
    
    this._dependencies = new Map();
    this._dependents = new Map();
    
    // Initialize all nodes
    for (const node of this.nodes) {
      this._dependencies.set(node.id, new Set());
      this._dependents.set(node.id, new Set());
    }
    
    // Populate from edges
    for (const edge of this.edges) {
      if (this.nodeById.has(edge.source) && this.nodeById.has(edge.target)) {
        this._dependencies.get(edge.target)!.add(edge.source);
        this._dependents.get(edge.source)!.add(edge.target);
      }
    }
  }
  
  // ==========================================================================
  // GRAPH TRAVERSAL
  // ==========================================================================
  
  /** Get all upstream nodes (ancestors) - O(n) worst case */
  getUpstreamNodes(nodeId: string): Node[] {
    const visited = new Set<string>();
    const upstream: string[] = [];
    
    const dfs = (id: string) => {
      for (const parentId of this.getDependencies(id)) {
        if (!visited.has(parentId)) {
          visited.add(parentId);
          upstream.push(parentId);
          dfs(parentId);
        }
      }
    };
    
    dfs(nodeId);
    
    // Return as nodes
    return upstream
      .map(id => this.nodeById.get(id))
      .filter((n): n is Node => n !== undefined);
  }
  
  /** Get all downstream nodes (descendants) - O(n) worst case */
  getDownstreamNodes(nodeId: string): Node[] {
    const visited = new Set<string>();
    const downstream: string[] = [];
    
    const dfs = (id: string) => {
      for (const childId of this.getDependents(id)) {
        if (!visited.has(childId)) {
          visited.add(childId);
          downstream.push(childId);
          dfs(childId);
        }
      }
    };
    
    dfs(nodeId);
    
    return downstream
      .map(id => this.nodeById.get(id))
      .filter((n): n is Node => n !== undefined);
  }
  
  /** Get source node for an incoming connection - O(1) */
  getSourceNode(nodeId: string, handleId?: string): Node | undefined {
    const incoming = this.getIncomingEdges(nodeId);
    const edge = handleId 
      ? incoming.find(e => e.targetHandle === handleId)
      : incoming[0];
    return edge ? this.nodeById.get(edge.source) : undefined;
  }
}

// =============================================================================
// GLOBAL INDEX CACHE
// =============================================================================

let _cachedIndex: GraphIndex | null = null;
let _cacheHash: string | null = null;

function getGraphHash(nodes: Node[], edges: Edge[]): string {
  const nodeIds = nodes.map(n => n.id).sort().join(",");
  const edgeKeys = edges.map(e => `${e.source}->${e.target}`).sort().join(",");
  return `${nodeIds}|${edgeKeys}`;
}

/**
 * Get or create a GraphIndex for the given nodes/edges.
 * Cached and reused if graph structure unchanged.
 */
export function getGraphIndex(nodes: Node[], edges: Edge[]): GraphIndex {
  const hash = getGraphHash(nodes, edges);
  
  if (_cachedIndex && _cacheHash === hash) {
    return _cachedIndex;
  }
  
  _cachedIndex = new GraphIndex(nodes, edges);
  _cacheHash = hash;
  return _cachedIndex;
}

/**
 * Clear the graph index cache.
 */
export function clearGraphIndexCache(): void {
  _cachedIndex = null;
  _cacheHash = null;
}
