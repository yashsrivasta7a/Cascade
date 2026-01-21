import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import crypto from "crypto";

// =============================================================================
// WORKFLOW TEMPLATES API ROUTES
// Handles caching and retrieval of workflow structure templates
// =============================================================================

// Schema for checking/creating a template
const TemplateCheckSchema = z.object({
  structureHash: z.string().length(64), // SHA-256 hex
});

const TemplateCreateSchema = z.object({
  structureHash: z.string().length(64),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  nodesJson: z.array(z.unknown()),
  edgesJson: z.array(z.unknown()),
});

// GET /api/workflow-templates - List all templates (or check by hash)
// Note: Templates are global (not user-specific) so no auth required
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get("hash");

    // If hash provided, check if template exists
    if (hash) {
      const template = await db.workflowTemplate.findUnique({
        where: { structureHash: hash },
      });

      if (template) {
        return NextResponse.json({
          found: true,
          template: {
            id: template.id,
            structureHash: template.structureHash,
            name: template.name,
            description: template.description,
            nodes: template.nodesJson,
            edges: template.edgesJson,
            usageCount: template.usageCount,
            createdAt: template.createdAt,
          },
        });
      }

      return NextResponse.json({ found: false });
    }

    // List all templates (sorted by usage)
    const templates = await db.workflowTemplate.findMany({
      orderBy: { usageCount: "desc" },
      take: 50,
      select: {
        id: true,
        structureHash: true,
        name: true,
        description: true,
        usageCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("[GET /api/workflow-templates] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/workflow-templates - Create or increment usage of a template
// Note: Templates are global (not user-specific) so no auth required
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = TemplateCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid template data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { structureHash, name, description, nodesJson, edgesJson } = parsed.data;

    // Try to find existing template
    const existing = await db.workflowTemplate.findUnique({
      where: { structureHash },
    });

    if (existing) {
      // Increment usage count
      const updated = await db.workflowTemplate.update({
        where: { id: existing.id },
        data: { usageCount: { increment: 1 } },
      });

      return NextResponse.json({
        created: false,
        cached: true,
        template: {
          id: updated.id,
          structureHash: updated.structureHash,
          name: updated.name,
          description: updated.description,
          nodes: updated.nodesJson,
          edges: updated.edgesJson,
          usageCount: updated.usageCount,
        },
      });
    }

    // Create new template
    const template = await db.workflowTemplate.create({
      data: {
        structureHash,
        name,
        description,
        nodesJson,
        edgesJson,
      },
    });

    return NextResponse.json(
      {
        created: true,
        cached: false,
        template: {
          id: template.id,
          structureHash: template.structureHash,
          name: template.name,
          description: template.description,
          nodes: template.nodesJson,
          edges: template.edgesJson,
          usageCount: template.usageCount,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/workflow-templates] Error:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}

// =============================================================================
// HASH UTILITY (also exported for use in MCP)
// =============================================================================

interface NodeData {
  id: string;
  type?: string;
  data?: { mediaType?: string; label?: string };
}

interface EdgeData {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * Generate a deterministic hash for a workflow structure
 */
export function computeStructureHash(nodes: NodeData[], edges: EdgeData[]): string {
  // Create node type mapping (id -> type:mediaType)
  const nodeTypeMap = new Map<string, string>();
  for (const node of nodes) {
    let typeKey = node.type || "unknown";
    if (node.type === "input" && node.data?.mediaType) {
      typeKey = `input:${node.data.mediaType}`;
    }
    nodeTypeMap.set(node.id, typeKey);
  }

  // Canonicalize nodes (sorted by type)
  const canonicalNodes = nodes
    .map((n) => {
      const type = n.type || "unknown";
      const mediaType = n.type === "input" ? n.data?.mediaType : undefined;
      return mediaType ? `${type}:${mediaType}` : type;
    })
    .sort()
    .join("|");

  // Canonicalize edges (sorted by connection string)
  const canonicalEdges = edges
    .map((e) => {
      const srcType = nodeTypeMap.get(e.source) || "unknown";
      const tgtType = nodeTypeMap.get(e.target) || "unknown";
      return `${srcType}[${e.sourceHandle || "*"}]->${tgtType}[${e.targetHandle || "*"}]`;
    })
    .sort()
    .join("|");

  const canonical = `nodes:${canonicalNodes}||edges:${canonicalEdges}`;
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
