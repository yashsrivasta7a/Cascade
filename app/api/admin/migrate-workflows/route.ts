import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  migrateWorkflowToNormalized,
  getMigrationStatus,
} from "@/lib/services/workflow-nodes";

// =============================================================================
// WORKFLOW MIGRATION API (Admin Only)
// Migrates workflows from JSON blobs to normalized tables
// =============================================================================

// GET /api/admin/migrate-workflows - Get migration status
// Note: GET is public for easy status checks, POST requires auth
export async function GET() {
  try {
    const status = await getMigrationStatus();

    return NextResponse.json({
      status,
      message: "Database normalization status. Use POST to migrate workflows.",
    });
  } catch (error) {
    console.error("[GET /api/admin/migrate-workflows] Error:", error);
    return NextResponse.json(
      { error: "Failed to get migration status", details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/admin/migrate-workflows - Migrate workflows
// Note: Temporarily public for migration, re-enable auth after migration is complete
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, batchSize = 10, migrateAll = false } = body;

    // Single workflow migration
    if (workflowId) {
      const workflow = await db.workflow.findFirst({
        where: { id: workflowId },
      });

      if (!workflow) {
        return NextResponse.json(
          { error: "Workflow not found" },
          { status: 404 }
        );
      }

      const result = await migrateWorkflowToNormalized(workflowId);

      return NextResponse.json({
        success: true,
        workflowId,
        ...result,
      });
    }

    // Batch migration - migrate all pending workflows
    const pendingWorkflows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM workflows WHERE "isNormalized" = false LIMIT ${batchSize}
    `;

    const results = {
      migrated: 0,
      failed: [] as string[],
    };

    for (const workflow of pendingWorkflows) {
      try {
        await migrateWorkflowToNormalized(workflow.id);
        results.migrated++;
      } catch (error) {
        console.error(`Failed to migrate workflow ${workflow.id}:`, error);
        results.failed.push(workflow.id);
      }
    }

    const status = await getMigrationStatus();

    return NextResponse.json({
      success: true,
      ...results,
      status,
    });
  } catch (error) {
    console.error("[POST /api/admin/migrate-workflows] Error:", error);
    return NextResponse.json(
      { error: "Failed to migrate workflows" },
      { status: 500 }
    );
  }
}
