import { NextRequest, NextResponse } from "next/server";
import dotenv from "dotenv";
import type { NodeExecutionContext } from "@/lib/engine";
import type { AINodeType } from "@/types/nodes";

// Import executors directly to avoid module loading issues
import { openrouterExecutor } from "@/lib/engine/nodes/openrouter";
import { seedreamExecutor } from "@/lib/engine/nodes/seedream";
import { seedvrExecutor } from "@/lib/engine/nodes/seedvr";
import { seedanceExecutor } from "@/lib/engine/nodes/seedance";
import { elevenlabsExecutor } from "@/lib/engine/nodes/elevenlabs";
import { lipsyncExecutor } from "@/lib/engine/nodes/lipsync";
import { cropImageExecutor } from "@/lib/engine/nodes/crop-image";
import { mergeAudioVideoExecutor } from "@/lib/engine/nodes/merge-audio-video";
import { mergeVideosExecutor } from "@/lib/engine/nodes/merge-videos";
import { extractAudioExecutor } from "@/lib/engine/nodes/extract-audio";

dotenv.config({ path: ".env.local" });

// Direct executor map
const executors: Record<string, typeof openrouterExecutor> = {
  openrouter: openrouterExecutor,
  seedream: seedreamExecutor,
  seedvr: seedvrExecutor,
  seedance: seedanceExecutor,
  elevenlabs: elevenlabsExecutor,
  lipsync: lipsyncExecutor,
  "crop-image": cropImageExecutor,
  "merge-audio-video": mergeAudioVideoExecutor,
  "merge-videos": mergeVideosExecutor,
  "extract-audio": extractAudioExecutor,
};

// =============================================================================
// GENERIC NODE EXECUTION ENDPOINT
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { nodeType?: string; input?: Record<string, unknown> };
    
    const nodeType = body?.nodeType;
    const input = body?.input ?? {};

    if (!nodeType || typeof nodeType !== "string") {
      return NextResponse.json(
        { 
          error: "Missing or invalid nodeType",
          usage: {
            nodeType: "openrouter | seedream | seedvr | etc.",
            input: "{ ...node-specific input }"
          }
        },
        { status: 400 }
      );
    }

    // Step 1: Get the executor directly
    const executor = executors[nodeType];
    if (!executor) {
      return NextResponse.json(
        { 
          error: `Unknown node type: ${nodeType}`,
          registeredTypes: Object.keys(executors)
        },
        { status: 400 }
      );
    }

    // Step 2: Validate input against the node's schema
    const inputValidation = executor.inputSchema.safeParse(input);
    if (!inputValidation.success) {
      return NextResponse.json(
        { 
          error: "Invalid input for node type",
          nodeType,
          validationError: inputValidation.error.issues.map(i => i.message).join("; "),
        },
        { status: 400 }
      );
    }

    // Step 3: Build execution context
    const context: NodeExecutionContext = {
      nodeExecutionId: `direct-${Date.now()}`,
      workflowExecutionId: `direct-workflow-${Date.now()}`,
      nodeId: "direct-node",
      nodeType: nodeType as AINodeType,
      webhookBaseUrl: process.env.WEBHOOK_BASE_URL ?? "http://localhost:3000",
      attempt: 1,
    };

    // Step 4: Execute the node
    console.log(`[Node Executor] Running ${nodeType} with input:`, input);
    const startTime = Date.now();
    
    const result = await executor.execute(inputValidation.data, context);
    
    const duration = Date.now() - startTime;
    console.log(`[Node Executor] ${nodeType} completed in ${duration}ms:`, result.success ? "SUCCESS" : "FAILED");

    // Step 5: Return result
    if (result.success) {
      return NextResponse.json({
        status: "success",
        nodeType,
        output: result.output,
        providerUsed: result.providerUsed,
        actualCost: result.actualCost,
        durationMs: duration,
      });
    } else {
      return NextResponse.json(
        {
          status: "failed",
          nodeType,
          error: result.error,
          providerUsed: result.providerUsed,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Node Executor] Unexpected error:", error);
    return NextResponse.json(
      { 
        status: "error", 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Phase 2: Generic Node Execution System",
    description: "This endpoint can execute ANY registered node type",
    usage: {
      method: "POST",
      body: {
        nodeType: "string (one of the registered types)",
        input: "object (node-specific input)"
      }
    },
    registeredNodes: Object.keys(executors),
    examples: {
      openrouter: { nodeType: "openrouter", input: { prompt: "Write a haiku", model: "openai/gpt-4o-mini" } },
      seedream: { nodeType: "seedream", input: { prompt: "A sunset over mountains" } },
    }
  });
}
