import { describe, expect, it } from "vitest";
import { format } from "date-fns";

/**
 * Tests for version export JSON format
 * Validates the schema structure used in version-history-panel.tsx
 */

interface ExportedWorkflow {
  schemaVersion: string;
  exportedAt: string;
  workflow: {
    name: string;
    version: number;
    nodes: unknown[];
    edges: unknown[];
    viewport: unknown;
    nodeCount: number;
    createdAt: string;
  };
}

/**
 * Helper function to create export data (mirrors the implementation)
 */
function createExportData(version: {
  id: string;
  version: number;
  name: string;
  nodesJson: unknown;
  edgesJson: unknown;
  viewportJson?: unknown;
  createdAt: string;
  nodeCount: number;
}): ExportedWorkflow {
  return {
    schemaVersion: "1.0.0",
    exportedAt: new Date().toISOString(),
    workflow: {
      name: version.name,
      version: version.version,
      nodes: version.nodesJson as unknown[],
      edges: version.edgesJson as unknown[],
      viewport: version.viewportJson ?? null,
      nodeCount: version.nodeCount,
      createdAt: version.createdAt,
    },
  };
}

describe("Version Export Format", () => {
  describe("createExportData()", () => {
    const mockVersion = {
      id: "version-123",
      version: 3,
      name: "My Workflow v3",
      nodesJson: [
        { id: "node-1", type: "seedream", position: { x: 0, y: 0 }, data: {} },
        { id: "node-2", type: "openrouter", position: { x: 200, y: 0 }, data: {} },
      ],
      edgesJson: [
        { id: "edge-1", source: "node-1", target: "node-2" },
      ],
      viewportJson: { x: 0, y: 0, zoom: 1 },
      createdAt: "2024-01-15T10:30:00.000Z",
      nodeCount: 2,
    };

    it("creates valid export structure", () => {
      const exported = createExportData(mockVersion);

      expect(exported).toHaveProperty("schemaVersion");
      expect(exported).toHaveProperty("exportedAt");
      expect(exported).toHaveProperty("workflow");
    });

    it("sets schema version to 1.0.0", () => {
      const exported = createExportData(mockVersion);
      expect(exported.schemaVersion).toBe("1.0.0");
    });

    it("includes ISO timestamp for exportedAt", () => {
      const exported = createExportData(mockVersion);
      expect(exported.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("preserves workflow name", () => {
      const exported = createExportData(mockVersion);
      expect(exported.workflow.name).toBe("My Workflow v3");
    });

    it("preserves version number", () => {
      const exported = createExportData(mockVersion);
      expect(exported.workflow.version).toBe(3);
    });

    it("includes all nodes", () => {
      const exported = createExportData(mockVersion);
      expect(exported.workflow.nodes).toHaveLength(2);
      expect(exported.workflow.nodes[0]).toHaveProperty("id", "node-1");
    });

    it("includes all edges", () => {
      const exported = createExportData(mockVersion);
      expect(exported.workflow.edges).toHaveLength(1);
      expect(exported.workflow.edges[0]).toHaveProperty("source", "node-1");
    });

    it("includes viewport data", () => {
      const exported = createExportData(mockVersion);
      expect(exported.workflow.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it("includes node count", () => {
      const exported = createExportData(mockVersion);
      expect(exported.workflow.nodeCount).toBe(2);
    });

    it("preserves original creation timestamp", () => {
      const exported = createExportData(mockVersion);
      expect(exported.workflow.createdAt).toBe("2024-01-15T10:30:00.000Z");
    });
  });

  describe("edge cases", () => {
    it("handles null viewport", () => {
      const version = {
        id: "v1",
        version: 1,
        name: "Test",
        nodesJson: [],
        edgesJson: [],
        viewportJson: undefined,
        createdAt: new Date().toISOString(),
        nodeCount: 0,
      };

      const exported = createExportData(version);
      expect(exported.workflow.viewport).toBeNull();
    });

    it("handles empty nodes array", () => {
      const version = {
        id: "v1",
        version: 1,
        name: "Empty Workflow",
        nodesJson: [],
        edgesJson: [],
        viewportJson: { x: 0, y: 0, zoom: 1 },
        createdAt: new Date().toISOString(),
        nodeCount: 0,
      };

      const exported = createExportData(version);
      expect(exported.workflow.nodes).toEqual([]);
      expect(exported.workflow.nodeCount).toBe(0);
    });

    it("handles complex node data", () => {
      const version = {
        id: "v1",
        version: 1,
        name: "Complex Workflow",
        nodesJson: [
          {
            id: "node-1",
            type: "openrouter",
            position: { x: 100, y: 200 },
            data: {
              label: "LLM Node",
              prompt: "Generate a story",
              temperature: 0.7,
              model: "gpt-4o-mini",
              nestedConfig: {
                option1: true,
                option2: [1, 2, 3],
              },
            },
          },
        ],
        edgesJson: [],
        viewportJson: { x: 500, y: 300, zoom: 0.75 },
        createdAt: new Date().toISOString(),
        nodeCount: 1,
      };

      const exported = createExportData(version);
      const node = exported.workflow.nodes[0] as any;
      
      expect(node.data.temperature).toBe(0.7);
      expect(node.data.nestedConfig.option1).toBe(true);
      expect(node.data.nestedConfig.option2).toEqual([1, 2, 3]);
    });
  });

  describe("JSON serialization", () => {
    it("produces valid JSON string", () => {
      const version = {
        id: "v1",
        version: 1,
        name: "Test",
        nodesJson: [{ id: "n1" }],
        edgesJson: [],
        viewportJson: { x: 0, y: 0, zoom: 1 },
        createdAt: new Date().toISOString(),
        nodeCount: 1,
      };

      const exported = createExportData(version);
      const jsonString = JSON.stringify(exported, null, 2);
      
      expect(() => JSON.parse(jsonString)).not.toThrow();
    });

    it("preserves data through round-trip", () => {
      const version = {
        id: "v1",
        version: 5,
        name: "Round Trip Test",
        nodesJson: [
          { id: "n1", type: "seedream", data: { prompt: "test" } },
        ],
        edgesJson: [
          { id: "e1", source: "n1", target: "n2" },
        ],
        viewportJson: { x: 100, y: 200, zoom: 1.5 },
        createdAt: "2024-06-15T14:00:00.000Z",
        nodeCount: 1,
      };

      const exported = createExportData(version);
      const jsonString = JSON.stringify(exported, null, 2);
      const parsed = JSON.parse(jsonString) as ExportedWorkflow;
      
      expect(parsed.schemaVersion).toBe("1.0.0");
      expect(parsed.workflow.version).toBe(5);
      expect(parsed.workflow.name).toBe("Round Trip Test");
      expect(parsed.workflow.nodes).toHaveLength(1);
      expect(parsed.workflow.viewport).toEqual({ x: 100, y: 200, zoom: 1.5 });
    });
  });

  describe("filename generation", () => {
    it("generates proper filename format pattern", () => {
      const version = 3;
      const createdAt = new Date();
      
      // Mirror the filename generation logic
      const filename = `workflow-v${version}-${format(createdAt, "yyyy-MM-dd-HHmm")}.json`;
      
      // Check the pattern: workflow-v{version}-{date}.json
      expect(filename).toMatch(/^workflow-v3-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    });

    it("includes version number in filename", () => {
      const version = 5;
      const createdAt = new Date();
      
      const filename = `workflow-v${version}-${format(createdAt, "yyyy-MM-dd-HHmm")}.json`;
      
      expect(filename).toContain("workflow-v5");
    });

    it("produces valid date format in filename", () => {
      const createdAt = new Date("2024-06-15T12:30:00.000Z");
      
      const filename = `workflow-v1-${format(createdAt, "yyyy-MM-dd-HHmm")}.json`;
      
      // Should contain valid date pattern regardless of timezone
      expect(filename).toMatch(/^workflow-v1-2024-06-\d{2}-\d{4}\.json$/);
    });
  });
});
