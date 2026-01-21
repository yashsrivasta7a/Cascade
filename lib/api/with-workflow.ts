import { db } from "@/lib/db";
import { notFound, forbidden } from "./responses";
import type { NextResponse } from "next/server";
import type { Workflow } from "@prisma/client";

// =============================================================================
// WORKFLOW OWNERSHIP HELPERS
// Provides consistent workflow access verification across API routes
// =============================================================================

export type WorkflowResult = 
  | { ok: true; workflow: Workflow }
  | { ok: false; response: NextResponse };

/**
 * Get a workflow by ID and verify ownership.
 * Returns { ok: true, workflow } if found and owned by user.
 * Returns { ok: false, response } with appropriate error response otherwise.
 * 
 * @example
 * ```ts
 * const result = await getWorkflowForUser(workflowId, userId);
 * if (!result.ok) {
 *   return result.response; // Returns 404 or 403
 * }
 * const workflow = result.workflow;
 * ```
 */
export async function getWorkflowForUser(
  workflowId: string,
  userId: string
): Promise<WorkflowResult> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    return { ok: false, response: notFound("Workflow") };
  }

  if (workflow.userId !== userId) {
    return { ok: false, response: forbidden("You don't have access to this workflow") };
  }

  return { ok: true, workflow };
}

/**
 * Get a workflow owned by user or return null (non-throwing version).
 * Useful when you want to handle missing workflows differently.
 */
export async function findWorkflowForUser(
  workflowId: string,
  userId: string
): Promise<Workflow | null> {
  const workflow = await db.workflow.findFirst({
    where: { 
      id: workflowId,
      userId: userId,
    },
  });

  return workflow;
}

/**
 * Verify workflow ownership only (for routes that already have the workflow).
 * Returns true if the workflow belongs to the user.
 */
export function verifyWorkflowOwnership(
  workflow: { userId: string },
  userId: string
): boolean {
  return workflow.userId === userId;
}

/**
 * Get workflow with select fields for performance.
 */
export async function getWorkflowForUserWithSelect<T extends object>(
  workflowId: string,
  userId: string,
  select: { [K in keyof Workflow]?: boolean }
): Promise<{ ok: true; workflow: T } | { ok: false; response: NextResponse }> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { ...select, userId: true },
  }) as (T & { userId: string }) | null;

  if (!workflow) {
    return { ok: false, response: notFound("Workflow") };
  }

  if (workflow.userId !== userId) {
    return { ok: false, response: forbidden("You don't have access to this workflow") };
  }

  return { ok: true, workflow };
}
