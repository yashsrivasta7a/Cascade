import { NextRequest, NextResponse } from "next/server";
import type { AINodeType } from "@/types/nodes";
import { db } from "@/lib/db";
import { executeNode } from "@/app/trigger/node-executor";
import { getUserIdForApi } from "@/lib/user";

// =============================================================================
// SEEDREAM 4.5 IMAGE GENERATION - VIA TRIGGER.DEV
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get the current user (creates if not exists)
    const { userId } = await getUserIdForApi();

    const body = await request.json() as {
      prompt?: string;
      negativePrompt?: string;
      aspectRatio?: string;
      image?: string;
      seed?: number;
      nodeId?: string; // Flow node ID for polling
    };

    const { prompt, negativePrompt, aspectRatio, image, seed, nodeId } = body;

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Create a workflow for tracking this image generation
    const trackingWorkflow = await db.workflow.upsert({
      where: { id: `seedream-workflow-${userId}` },
      create: {
        id: `seedream-workflow-${userId}`,
        userId,
        name: "Image Generation",
        description: "Auto-created for tracking image generations",
        nodesJson: [],
        edgesJson: [],
      },
      update: {},
    });

    const workflowExecution = await db.workflowExecution.create({
      data: {
        workflowId: trackingWorkflow.id,
        userId,
        status: "RUNNING",
        workflowSnapshot: { prompt, aspectRatio, hasImage: !!image },
        estimatedCost: 5,
        startedAt: new Date(),
      },
    });

    // Create node execution record
    const isEditing = Boolean(image);
    // Use the flow nodeId if provided, otherwise generate one
    const actualNodeId = nodeId || `seedream-${Date.now()}`;
    console.log(`[Seedream] Using nodeId: ${actualNodeId} (from input: ${nodeId || "none"})`);
    
    const nodeExecution = await db.nodeExecution.create({
      data: {
        workflowExecutionId: workflowExecution.id,
        nodeId: actualNodeId,
        nodeType: "seedream",
        nodeLabel: isEditing ? "Seedream Edit" : "Seedream Generate",
        status: "QUEUED",
        inputJson: { prompt, negativePrompt, aspectRatio, hasImage: !!image, seed },
      },
    });

    console.log(`[Seedream] Starting execution ${nodeExecution.id} via Trigger.dev`);

    // Trigger the node execution via Trigger.dev
    const handle = await executeNode.trigger({
      nodeExecutionId: nodeExecution.id,
      workflowExecutionId: workflowExecution.id,
      nodeId: nodeExecution.nodeId,
      nodeType: "seedream" as AINodeType,
      input: {
        prompt,
        negativePrompt,
        aspectRatio: aspectRatio || "1:1",
        image,
        seed,
      },
    });

    // Save the trigger run ID for tracking in Activity panel
    await db.workflowExecution.update({
      where: { id: workflowExecution.id },
      data: { triggerRunId: handle.id },
    });

    console.log(`[Seedream] Triggered with handle ${handle.id}`);

    return NextResponse.json({
      status: "triggered",
      message: "Image generation started via Trigger.dev!",
      mode: isEditing ? "edit" : "generate",
      nodeExecutionId: nodeExecution.id,
      workflowExecutionId: workflowExecution.id,
      triggerRunId: handle.id,
      dashboardUrl: `https://cloud.trigger.dev/projects/v3/${process.env.TRIGGER_PROJECT_REF}/runs/${handle.id}`,
    });
  } catch (error) {
    console.error("[Seedream] Error:", error);
    return NextResponse.json(
      { 
        status: "error",
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

function aspectRatioToSize(ratio: string): { width: number; height: number } {
  const sizes: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1344, height: 768 },
    "9:16": { width: 768, height: 1344 },
    "4:3": { width: 1152, height: 896 },
    "3:4": { width: 896, height: 1152 },
  };
  return sizes[ratio] || sizes["1:1"];
}

export async function GET() {
  return NextResponse.json({
    message: "Seedream 4.5 Image Generation API (via Trigger.dev)",
    usage: {
      method: "POST",
      body: {
        prompt: "string (required) - Description of the image",
        negativePrompt: "string (optional) - What to avoid",
        aspectRatio: "1:1 | 16:9 | 9:16 | 4:3 | 3:4",
        image: "string (optional) - Base64 or URL for image editing",
        seed: "number (optional) - For reproducibility",
      }
    },
    note: "Responses are async - use the triggerRunId to track progress",
    configured: Boolean(process.env.FAL_KEY),
  });
}
