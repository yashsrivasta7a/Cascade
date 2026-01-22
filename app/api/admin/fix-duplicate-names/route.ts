import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// =============================================================================
// FIX DUPLICATE WORKFLOW NAMES (Admin Only)
// Renames duplicate workflow names to ensure uniqueness before adding DB constraint
// =============================================================================

interface DuplicateGroup {
  userId: string;
  name: string;
  count: bigint;
}

// GET /api/admin/fix-duplicate-names - Check for duplicate names
export async function GET() {
  try {
    // Find all workflows with duplicate names per user
    const duplicates = await db.$queryRaw<DuplicateGroup[]>`
      SELECT "userId", name, COUNT(*) as count
      FROM workflows
      GROUP BY "userId", name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    const duplicateCount = duplicates.reduce((sum, d) => sum + Number(d.count) - 1, 0);

    return NextResponse.json({
      hasDuplicates: duplicates.length > 0,
      duplicateGroups: duplicates.length,
      totalDuplicatesToRename: duplicateCount,
      duplicates: duplicates.map((d) => ({
        userId: d.userId,
        name: d.name,
        count: Number(d.count),
      })),
      message: duplicates.length > 0
        ? `Found ${duplicateCount} workflows that need renaming. Use POST to fix them.`
        : "No duplicate workflow names found. Safe to add unique constraint.",
    });
  } catch (error) {
    console.error("[GET /api/admin/fix-duplicate-names] Error:", error);
    return NextResponse.json(
      { error: "Failed to check for duplicates", details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/admin/fix-duplicate-names - Rename duplicates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = false } = body;

    // Find all workflows with duplicate names per user
    const duplicates = await db.$queryRaw<DuplicateGroup[]>`
      SELECT "userId", name, COUNT(*) as count
      FROM workflows
      GROUP BY "userId", name
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No duplicate workflow names found. Nothing to fix.",
        renamed: 0,
      });
    }

    const renames: Array<{ id: string; oldName: string; newName: string }> = [];

    for (const dup of duplicates) {
      // Get all workflows with this duplicate name for this user
      const workflows = await db.workflow.findMany({
        where: {
          userId: dup.userId,
          name: dup.name,
        },
        orderBy: { createdAt: "asc" }, // Keep the oldest one with original name
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      // Skip the first one (oldest), rename the rest
      for (let i = 1; i < workflows.length; i++) {
        const workflow = workflows[i];
        const suffix = i + 1; // Start from (2), (3), etc.
        let newName = `${workflow.name} (${suffix})`;

        // Check if the new name also exists, if so increment until unique
        let nameExists = true;
        let attempt = suffix;
        while (nameExists) {
          const existing = await db.workflow.findFirst({
            where: {
              userId: dup.userId,
              name: newName,
              id: { not: workflow.id },
            },
          });
          if (!existing) {
            nameExists = false;
          } else {
            attempt++;
            newName = `${workflow.name} (${attempt})`;
          }
        }

        renames.push({
          id: workflow.id,
          oldName: workflow.name,
          newName,
        });

        if (!dryRun) {
          await db.workflow.update({
            where: { id: workflow.id },
            data: { name: newName },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `Dry run complete. Would rename ${renames.length} workflows.`
        : `Successfully renamed ${renames.length} workflows.`,
      renamed: renames.length,
      renames,
    });
  } catch (error) {
    console.error("[POST /api/admin/fix-duplicate-names] Error:", error);
    return NextResponse.json(
      { error: "Failed to fix duplicate names", details: String(error) },
      { status: 500 }
    );
  }
}
