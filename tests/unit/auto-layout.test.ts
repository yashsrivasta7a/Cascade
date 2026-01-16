import { describe, expect, it } from "vitest";
import type { Node, Edge } from "reactflow";
import { autoLayoutNodes, type LayoutOptions } from "@/lib/workflow/auto-layout";

describe("Auto Layout Algorithm", () => {
  const defaultOptions: LayoutOptions = {
    horizontalSpacing: 450,
    verticalSpacing: 350,
    startX: 100,
    startY: 100,
  };

  describe("Basic Layout", () => {
    it("handles empty input", () => {
      const result = autoLayoutNodes([], []);
      expect(result).toEqual([]);
    });

    it("positions a single node at start coordinates", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
      ];

      const result = autoLayoutNodes(nodes, [], defaultOptions);

      expect(result).toHaveLength(1);
      expect(result[0].position.x).toBe(defaultOptions.startX);
      expect(result[0].position.y).toBe(defaultOptions.startY);
    });

    it("positions two connected nodes horizontally", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "b" },
      ];

      const result = autoLayoutNodes(nodes, edges, defaultOptions);

      const nodeA = result.find(n => n.id === "a")!;
      const nodeB = result.find(n => n.id === "b")!;

      // B should be to the right of A
      expect(nodeB.position.x).toBeGreaterThan(nodeA.position.x);
      expect(nodeB.position.x - nodeA.position.x).toBe(defaultOptions.horizontalSpacing);
    });

    it("positions linear chain left-to-right", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 0, y: 0 }, data: {} },
        { id: "c", type: "elevenlabs", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "c" },
      ];

      const result = autoLayoutNodes(nodes, edges, defaultOptions);

      const positions = result.map(n => ({ id: n.id, x: n.position.x }));
      const nodeA = positions.find(p => p.id === "a")!;
      const nodeB = positions.find(p => p.id === "b")!;
      const nodeC = positions.find(p => p.id === "c")!;

      expect(nodeA.x).toBeLessThan(nodeB.x);
      expect(nodeB.x).toBeLessThan(nodeC.x);
    });
  });

  describe("Branching and Merging", () => {
    it("vertically stacks nodes when parent has multiple children", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 0, y: 0 }, data: {} },
        { id: "c", type: "elevenlabs", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "a", target: "c" },
      ];

      const result = autoLayoutNodes(nodes, edges, defaultOptions);

      const nodeB = result.find(n => n.id === "b")!;
      const nodeC = result.find(n => n.id === "c")!;

      // B and C should be at same X (same level)
      expect(nodeB.position.x).toBe(nodeC.position.x);
      // B and C should have different Y positions (stacked)
      expect(nodeB.position.y).not.toBe(nodeC.position.y);
    });

    it("guarantees no overlapping between nodes at same level", () => {
      const nodes: Node[] = [
        { id: "root", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "child1", type: "openrouter", position: { x: 0, y: 0 }, data: {} },
        { id: "child2", type: "elevenlabs", position: { x: 0, y: 0 }, data: {} },
        { id: "child3", type: "lipsync", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "root", target: "child1" },
        { id: "e2", source: "root", target: "child2" },
        { id: "e3", source: "root", target: "child3" },
      ];

      const result = autoLayoutNodes(nodes, edges, defaultOptions);

      // Get children positions
      const childNodes = result.filter(n => n.id.startsWith("child"));
      const yPositions = childNodes.map(n => n.position.y).sort((a, b) => a - b);

      // Check minimum spacing between adjacent nodes
      for (let i = 1; i < yPositions.length; i++) {
        const gap = yPositions[i] - yPositions[i - 1];
        expect(gap).toBeGreaterThanOrEqual(defaultOptions.verticalSpacing);
      }
    });
  });

  describe("Disconnected Components", () => {
    it("lays out separate chains independently", () => {
      const nodes: Node[] = [
        // Chain 1
        { id: "a1", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "a2", type: "openrouter", position: { x: 0, y: 0 }, data: {} },
        // Chain 2 (disconnected)
        { id: "b1", type: "elevenlabs", position: { x: 0, y: 0 }, data: {} },
        { id: "b2", type: "lipsync", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a1", target: "a2" },
        { id: "e2", source: "b1", target: "b2" },
      ];

      const result = autoLayoutNodes(nodes, edges, defaultOptions);

      // Both chains should have proper left-to-right layout
      const a1 = result.find(n => n.id === "a1")!;
      const a2 = result.find(n => n.id === "a2")!;
      const b1 = result.find(n => n.id === "b1")!;
      const b2 = result.find(n => n.id === "b2")!;

      // Chain 1 flows left to right
      expect(a2.position.x).toBeGreaterThan(a1.position.x);
      // Chain 2 flows left to right
      expect(b2.position.x).toBeGreaterThan(b1.position.x);
    });

    it("places disconnected chains vertically separated", () => {
      const nodes: Node[] = [
        { id: "a1", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b1", type: "elevenlabs", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = []; // No connections

      const result = autoLayoutNodes(nodes, edges, defaultOptions);

      const a1 = result.find(n => n.id === "a1")!;
      const b1 = result.find(n => n.id === "b1")!;

      // Should have significant vertical separation
      expect(Math.abs(a1.position.y - b1.position.y)).toBeGreaterThanOrEqual(defaultOptions.verticalSpacing);
    });
  });

  describe("Comment Nodes", () => {
    it("preserves comment node positions", () => {
      const originalPosition = { x: 500, y: 500 };
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "comment1", type: "comment", position: originalPosition, data: { text: "Note" } },
      ];

      const result = autoLayoutNodes(nodes, [], defaultOptions);

      const comment = result.find(n => n.id === "comment1")!;
      expect(comment.position).toEqual(originalPosition);
    });

    it("does not include comment nodes in layout calculations", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 0, y: 0 }, data: {} },
        { id: "comment1", type: "comment", position: { x: 50, y: 50 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "b" },
      ];

      const result = autoLayoutNodes(nodes, edges, defaultOptions);

      // Layout should still work correctly
      const nodeA = result.find(n => n.id === "a")!;
      const nodeB = result.find(n => n.id === "b")!;

      expect(nodeB.position.x - nodeA.position.x).toBe(defaultOptions.horizontalSpacing);
    });
  });

  describe("Custom Options", () => {
    it("respects custom horizontal spacing", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "b" },
      ];

      const customSpacing = 600;
      const result = autoLayoutNodes(nodes, edges, { horizontalSpacing: customSpacing });

      const nodeA = result.find(n => n.id === "a")!;
      const nodeB = result.find(n => n.id === "b")!;

      expect(nodeB.position.x - nodeA.position.x).toBe(customSpacing);
    });

    it("respects custom start position", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
      ];

      const result = autoLayoutNodes(nodes, [], { startX: 200, startY: 300 });

      expect(result[0].position.x).toBe(200);
      expect(result[0].position.y).toBe(300);
    });
  });

  describe("Complex Workflows", () => {
    it("handles diamond pattern (branching then merging)", () => {
      const nodes: Node[] = [
        { id: "start", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "branch1", type: "openrouter", position: { x: 0, y: 0 }, data: {} },
        { id: "branch2", type: "elevenlabs", position: { x: 0, y: 0 }, data: {} },
        { id: "merge", type: "lipsync", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "start", target: "branch1" },
        { id: "e2", source: "start", target: "branch2" },
        { id: "e3", source: "branch1", target: "merge" },
        { id: "e4", source: "branch2", target: "merge" },
      ];

      const result = autoLayoutNodes(nodes, edges, defaultOptions);

      const start = result.find(n => n.id === "start")!;
      const branch1 = result.find(n => n.id === "branch1")!;
      const branch2 = result.find(n => n.id === "branch2")!;
      const merge = result.find(n => n.id === "merge")!;

      // Start should be leftmost
      expect(start.position.x).toBeLessThan(branch1.position.x);
      expect(start.position.x).toBeLessThan(branch2.position.x);

      // Branches should be at same level
      expect(branch1.position.x).toBe(branch2.position.x);

      // Merge should be rightmost
      expect(merge.position.x).toBeGreaterThan(branch1.position.x);
    });

    it("handles multiple root nodes", () => {
      const nodes: Node[] = [
        { id: "root1", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "root2", type: "openrouter", position: { x: 0, y: 0 }, data: {} },
        { id: "child", type: "lipsync", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "root1", target: "child" },
        { id: "e2", source: "root2", target: "child" },
      ];

      const result = autoLayoutNodes(nodes, edges, defaultOptions);

      const root1 = result.find(n => n.id === "root1")!;
      const root2 = result.find(n => n.id === "root2")!;
      const child = result.find(n => n.id === "child")!;

      // Both roots should be at first level
      expect(root1.position.x).toBe(root2.position.x);
      // Child should be to the right
      expect(child.position.x).toBeGreaterThan(root1.position.x);
    });
  });

  describe("Edge Cases", () => {
    it("handles self-referencing edges gracefully", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "a" }, // Self-reference
      ];

      // Should not throw
      const result = autoLayoutNodes(nodes, edges, defaultOptions);
      expect(result).toHaveLength(1);
    });

    it("handles edges referencing non-existent nodes", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "nonexistent" },
        { id: "e2", source: "missing", target: "a" },
      ];

      // Should not throw
      const result = autoLayoutNodes(nodes, edges, defaultOptions);
      expect(result).toHaveLength(1);
    });

    it("handles circular dependencies", () => {
      const nodes: Node[] = [
        { id: "a", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "openrouter", position: { x: 0, y: 0 }, data: {} },
        { id: "c", type: "elevenlabs", position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "c" },
        { id: "e3", source: "c", target: "a" }, // Creates cycle
      ];

      // Should not throw or hang
      const result = autoLayoutNodes(nodes, edges, defaultOptions);
      expect(result).toHaveLength(3);
    });
  });
});
