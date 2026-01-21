import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";
import { db } from "@/lib/db";
import { executeWorkflow } from "@/app/trigger/workflow-executor";
import type { Edge, Node } from "reactflow";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { estimateNodeCost } from "@/lib/credits";
import { uploadFromBase64, isTransloaditConfigured } from "@/lib/providers/transloadit";
import { authenticateWithApiKeyDirect } from "@/lib/user";

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
  nodes?: Node[];
  edges?: Edge[];
  inputs?: Record<string, unknown>; // Input values keyed by input node ID
}

// Pre-process nodes: upload base64 data to CDN
async function preprocessNodesForTrigger(nodes: Node[]): Promise<Node[]> {
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
      "result", "value", // For I/O input nodes
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
    
    await Promise.all(uploadPromises);
  }

  return processedNodes;
}

export async function POST(request: NextRequest) {
  try {
    // Try API key authentication first (for MCP/external clients)
    let userId: string | null = null;
    
    const authHeader = request.headers.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer sk_live_")) {
      // API key authentication
      const authResult = await authenticateWithApiKeyDirect(authHeader);
      if (authResult.user) {
        userId = authResult.user.id;
      }
    } else {
      // Fall back to Clerk authentication (for web UI)
      try {
        const { userId: clerkUserId } = await auth();
        if (clerkUserId) {
          userId = clerkUserId;
        }
      } catch {
        // Clerk auth failed - that's ok if we don't have API key either
      }
    }
    
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body: TriggerWorkflowRequest = await request.json();
    const { workflowId, inputs } = body;
    let { nodes, edges } = body;

    // If nodes/edges not provided, fetch from the saved workflow
    if (!nodes?.length || !edges) {
      const savedWorkflow = await db.workflow.findFirst({
        where: { id: workflowId, userId },
        select: { nodesJson: true, edgesJson: true },
      });
      
      if (!savedWorkflow) {
        return NextResponse.json({ success: false, error: "Workflow not found" }, { status: 404 });
      }
      
      nodes = savedWorkflow.nodesJson as Node[];
      edges = (savedWorkflow.edgesJson as Edge[]) || [];
    }

    if (!nodes?.length) {
      return NextResponse.json({ success: false, error: "No nodes to execute" }, { status: 400 });
    }

    // Apply inputs to nodes if provided
    if (inputs && typeof inputs === "object") {
      nodes = nodes.map(node => {
        const inputValue = inputs[node.id];
        if (inputValue === undefined) {
          return node;
        }
        
        const nodeData = { ...(node.data ?? {}) } as Record<string, unknown>;
        
        // Handle input nodes (type="input" or type includes "-input")
        if (node.type === "input" || node.type?.includes("-input")) {
          // Set the value/result on the input node
          if (typeof inputValue === "string") {
            // For text inputs, set as value
            if (nodeData.mediaType === "text" || node.type === "text-input") {
              nodeData.value = inputValue;
              nodeData.result = inputValue;
            } else {
              // For media inputs, set as URL
              nodeData.value = { url: inputValue };
              nodeData.result = { url: inputValue };
            }
          } else {
            nodeData.value = inputValue;
            nodeData.result = inputValue;
          }
        } else if (typeof inputValue === "object" && inputValue !== null) {
          // Handle configuration inputs for other node types (e.g., crop-image settings)
          // Merge the input config into node data
          for (const [key, value] of Object.entries(inputValue)) {
            nodeData[key] = value;
          }
          console.log(`[WorkflowTrigger] Applied config to ${node.id} (${node.type}):`, Object.keys(inputValue));
        }
        
        return { ...node, data: nodeData };
      });
    }

    // Debug: Log I/O node data
    for (const node of nodes) {
      if (node.type?.includes("input") || node.type === "output") {
        const nodeData = (node.data ?? {}) as Record<string, unknown>;
        console.log(`[WorkflowTrigger] I/O node ${node.id} (${node.type}) data:`, {
          result: nodeData.result ? `${String(nodeData.result).slice(0, 80)}...` : 'undefined',
          value: nodeData.value ? `${String(nodeData.value).slice(0, 80)}...` : 'undefined',
          keys: Object.keys(nodeData),
        });
      }
    }

    

    // Get or create user
    let user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          id: userId,
          email: `${userId}@temp.local`,
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
    
    const handle = await executeWorkflow.trigger({
      workflowExecutionId: workflowExecution.id,
      workflowId: workflow.id,
      userId: user.id,
      nodes: processedNodes,
      edges,
    });

    

    // Store the Trigger.dev run ID
    await db.workflowExecution.update({
      where: { id: workflowExecution.id },
      data: { triggerRunId: handle.id },
    });

    // Create a public access token for client-side realtime subscription
    // This allows the client to subscribe directly to Trigger.dev via WebSocket
    // The token grants read access to this run, which includes:
    // - Run status updates (EXECUTING, COMPLETED, FAILED, etc.)
    // - Streams v2 data (node-status, workflow-status streams)
    // - Run metadata (legacy, may not propagate)
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
