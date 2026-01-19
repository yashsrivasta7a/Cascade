import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db";
import { estimateNodeCost } from "@/lib/credits";
import { uploadFromBase64, isTransloaditConfigured } from "@/lib/providers/transloadit";
import type { Node, Edge } from "reactflow";

// =============================================================================
// WORKFLOW PREPARE ENDPOINT
// =============================================================================
// Prepares a workflow for execution:
// 1. Validates user and credits
// 2. Creates workflow execution record
// 3. Preprocesses nodes (uploads base64 to CDN)
// 4. Creates a TRIGGER token (not just read token)
// 5. Returns everything needed for frontend to trigger directly
// =============================================================================

export const maxDuration = 60;

interface PrepareWorkflowRequest {
  workflowId: string;
  nodes: Node[];
  edges: Edge[];
}

// Pre-process nodes: upload base64 data to CDN
async function preprocessNodes(nodes: Node[]): Promise<Node[]> {
  const transloaditConfigured = isTransloaditConfigured();
  if (!transloaditConfigured) {
    return nodes;
  }

  const processedNodes: Node[] = [];
  const uploadPromises: Promise<void>[] = [];

  for (const node of nodes) {
    const nodeData = { ...(node.data ?? {}) } as Record<string, unknown>;
    const fieldsToCheck = [
      "video", "audio", "image", "frame",
      "video1", "video2",
      "inputVideo", "inputAudio", "inputImage",
    ];

    for (const field of fieldsToCheck) {
      const value = nodeData[field];
      
      if (typeof value === "string" && value.startsWith("data:") && value.length > 1000) {
        const fieldCopy = field;
        uploadPromises.push(
          uploadFromBase64(value).then(result => {
            if (result.url !== value) {
              nodeData[fieldCopy] = { url: result.url, mimeType: result.mimeType };
            }
          }).catch(() => {})
        );
      }
      
      if (typeof value === "object" && value !== null) {
        const obj = value as { url?: string; mimeType?: string };
        if (typeof obj.url === "string" && obj.url.startsWith("data:") && obj.url.length > 1000) {
          const fieldCopy = field;
          uploadPromises.push(
            uploadFromBase64(obj.url).then(result => {
              if (result.url !== obj.url) {
                nodeData[fieldCopy] = { url: result.url, mimeType: result.mimeType || obj.mimeType };
              }
            }).catch(() => {})
          );
        }
      }
    }

    processedNodes.push({ ...node, data: nodeData });
  }

  if (uploadPromises.length > 0) {
    await Promise.all(uploadPromises);
  }

  return processedNodes;
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: PrepareWorkflowRequest = await request.json();
    const { workflowId, nodes, edges } = body;

    if (!nodes?.length) {
      return NextResponse.json({ error: "No nodes to execute" }, { status: 400 });
    }

    // Get or create user
    let user = await db.user.findUnique({
      where: { id: clerkUserId },
      select: { id: true, credits: true },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          id: clerkUserId,
          email: `${clerkUserId}@temp.local`,
          credits: 1_000_000,
        },
        select: { id: true, credits: true },
      });
    }

    // Estimate total cost
    let totalEstimatedCost = 0;
    for (const node of nodes) {
      const nodeData = (node.data ?? {}) as Record<string, unknown>;
      totalEstimatedCost += estimateNodeCost(node.type as string, nodeData);
    }

    if (user.credits < totalEstimatedCost) {
      return NextResponse.json({
        error: `Insufficient credits. Required: ${totalEstimatedCost.toLocaleString()}, Available: ${user.credits.toLocaleString()}`,
      }, { status: 400 });
    }

    // Get or create workflow
    let workflow = await db.workflow.findFirst({
      where: { id: workflowId, userId: user.id },
    });

    if (!workflow) {
      workflow = await db.workflow.upsert({
        where: { id: workflowId },
        create: {
          id: workflowId,
          name: "Workflow",
          userId: user.id,
          nodesJson: [],
          edgesJson: [],
        },
        update: {},
      });
    }

    // Create workflow execution record
    const workflowExecution = await db.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        userId: user.id,
        status: "PENDING",
        workflowSnapshot: {
          nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
          edges: edges.map(e => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
        },
        estimatedCost: totalEstimatedCost,
      },
    });

    // Pre-process nodes (upload base64 to CDN)
    const processedNodes = await preprocessNodes(nodes);

    // Create a TRIGGER token - this allows the frontend to trigger the task directly
    // This is different from a read-only public token
    const triggerToken = await triggerAuth.createTriggerPublicToken("execute-workflow");

    console.log(`[WorkflowPrepare] Created trigger token for workflow ${workflowExecution.id}`);

    return NextResponse.json({
      success: true,
      triggerToken,
      workflowExecutionId: workflowExecution.id,
      workflowId: workflow.id,
      userId: user.id,
      processedNodes,
      edges,
      estimatedCost: totalEstimatedCost,
    });

  } catch (error) {
    console.error("[WorkflowPrepare] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
