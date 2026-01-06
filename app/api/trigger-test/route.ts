import { NextRequest, NextResponse } from "next/server";
import dotenv from "dotenv";
import { tasks } from "@trigger.dev/sdk";
import { executeNode } from "@/app/trigger/node-executor";

dotenv.config({ path: ".env.local" });

// Simple test to trigger a node execution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const prompt = body.prompt || "Write a haiku about coding";
    
    // Trigger the node executor task
    const handle = await tasks.trigger("execute-node", {
      nodeExecutionId: `test-${Date.now()}`,
      workflowExecutionId: `workflow-test-${Date.now()}`,
      nodeId: "test-node-1",
      nodeType: "openrouter",
      input: {
        prompt,
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 500,
      },
    });

    return NextResponse.json({
      status: "triggered",
      message: "Task triggered successfully!",
      runId: handle.id,
      dashboardUrl: `https://cloud.trigger.dev/projects/v3/${process.env.TRIGGER_PROJECT_ID}/runs/${handle.id}`,
    });
  } catch (error) {
    console.error("Trigger test error:", error);
    return NextResponse.json(
      { 
        status: "error", 
        error: error instanceof Error ? error.message : String(error),
        hint: "Make sure TRIGGER_SECRET_KEY is set in .env.local"
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Trigger.dev Test Endpoint",
    usage: "POST with { prompt: 'your prompt' } to trigger a test task",
    example: "curl -X POST http://localhost:3000/api/trigger-test -H 'Content-Type: application/json' -d '{\"prompt\": \"Hello world\"}'",
  });
}

