import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workflowId, batchSize = 10 } = body;

    // Single workflow migration
    if (workflowId) {
      // Verify ownership
      const workflow = await db.workflow.findFirst({
        where: { id: workflowId, userId },
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

    // Batch migration - migrate user's workflows
    const pendingWorkflows = await db.workflow.findMany({
      where: {
        userId,
        isNormalized: false,
      },
      take: batchSize,
      select: { id: true },
    });

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
