import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db";
import { executeWorkflow } from "@/app/trigger/workflow-executor";
import type { Edge, Node } from "reactflow";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { estimateNodeCost } from "@/lib/credits";
import { uploadFromBase64, isTransloaditConfigured } from "@/lib/providers/transloadit";

// =============================================================================
// WORKFLOW TRIGGER ENDPOINT - For client-side realtime subscriptions
// =============================================================================
// This endpoint triggers a workflow and returns:
// - workflowExecutionId: Our database ID for tracking
// - triggerRunId: Trigger.dev run ID for subscription
// - publicToken: Short-lived token for client-side realtime subscription
//
// The client then uses @trigger.dev/react-hooks to subscribe directly to
// Trigger.dev, bypassing Vercel's SSE buffering issues.
// =============================================================================

export const maxDuration = 60; // 60 seconds - just for triggering, not waiting

interface TriggerWorkflowRequest {
  workflowId: string;
  nodes: Node[];
  edges: Edge[];
}

// Pre-process nodes: upload base64 data to CDN
async function preprocessNodesForTrigger(nodes: Node[]): Promise<Node[]> {
  const transloaditConfigured = isTransloaditConfigured();
  if (!transloaditConfigured) {
    console.log("[WorkflowTrigger] Transloadit not configured - skipping CDN upload");
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
      
      // Check string URLs
      if (typeof value === "string" && value.startsWith("data:") && value.length > 1000) {
        const fieldCopy = field;
        const nodeCopy = node;
        uploadPromises.push(
          uploadFromBase64(value).then(result => {
            if (result.url !== value) {
              nodeData[fieldCopy] = { url: result.url, mimeType: result.mimeType };
              console.log(`[WorkflowTrigger] Uploaded ${nodeCopy.id}.${fieldCopy}`);
            }
          }).catch(err => {
            console.error(`[WorkflowTrigger] Failed to upload ${nodeCopy.id}.${fieldCopy}:`, err);
          })
        );
      }
      
      // Check object with url property
      if (typeof value === "object" && value !== null) {
        const obj = value as { url?: string; mimeType?: string };
        if (typeof obj.url === "string" && obj.url.startsWith("data:") && obj.url.length > 1000) {
          const fieldCopy = field;
          const nodeCopy = node;
          uploadPromises.push(
            uploadFromBase64(obj.url).then(result => {
              if (result.url !== obj.url) {
                nodeData[fieldCopy] = { url: result.url, mimeType: result.mimeType || obj.mimeType };
                console.log(`[WorkflowTrigger] Uploaded ${nodeCopy.id}.${fieldCopy}.url`);
              }
            }).catch(err => {
              console.error(`[WorkflowTrigger] Failed to upload ${nodeCopy.id}.${fieldCopy}.url:`, err);
            })
          );
        }
      }
    }

    processedNodes.push({ ...node, data: nodeData });
  }

  if (uploadPromises.length > 0) {
    console.log(`[WorkflowTrigger] Waiting for ${uploadPromises.length} uploads...`);
    await Promise.all(uploadPromises);
  }

  return processedNodes;
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body: TriggerWorkflowRequest = await request.json();
    const { workflowId, nodes, edges } = body;

    if (!nodes?.length) {
      return NextResponse.json({ success: false, error: "No nodes to execute" }, { status: 400 });
    }

    console.log(`[WorkflowTrigger] Starting workflow with ${nodes.length} nodes`);

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
        success: false,
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
    const processedNodes = await preprocessNodesForTrigger(nodes);

    // Trigger the workflow executor task
    console.log(`[WorkflowTrigger] Triggering executeWorkflow task...`);
    const handle = await executeWorkflow.trigger({
      workflowExecutionId: workflowExecution.id,
      workflowId: workflow.id,
      userId: user.id,
      nodes: processedNodes,
      edges,
    });

    console.log(`[WorkflowTrigger] Workflow task started with run ID: ${handle.id}`);

    // Store the Trigger.dev run ID
    await db.workflowExecution.update({
      where: { id: workflowExecution.id },
      data: { triggerRunId: handle.id },
    });

    // Create a public access token for client-side realtime subscription
    // This allows the client to subscribe directly to Trigger.dev
    let publicToken: string | null = null;
    try {
      publicToken = await triggerAuth.createPublicToken({
        scopes: {
          read: {
            runs: [handle.id],
          },
        },
        expirationTime: "30m", // 30 minutes
      });
      console.log(`[WorkflowTrigger] Created public token for client subscription`);
    } catch (tokenError) {
      console.warn(`[WorkflowTrigger] Failed to create public token:`, tokenError);
      // Continue without token - client will fall back to polling
    }

    return NextResponse.json({
      success: true,
      workflowExecutionId: workflowExecution.id,
      triggerRunId: handle.id,
      publicToken,
      estimatedCost: totalEstimatedCost,
    });

  } catch (error) {
    console.error("[WorkflowTrigger] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
