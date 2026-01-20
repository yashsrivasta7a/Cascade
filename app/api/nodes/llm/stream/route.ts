import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getUserIdForApi } from "@/lib/user";
import { getNodeCost } from "@/lib/credits";
import { checkCache, cacheResult } from "@/lib/cache";
import { executeNode } from "@/app/trigger/node-executor";
import { runs } from "@trigger.dev/sdk";

// =============================================================================
// LLM API ENDPOINT - Runs on Trigger.dev
// =============================================================================

const LLMRequestSchema = z.object({
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
  model: z.string().default("openai/gpt-4o-mini"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().min(0).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  context: z.string().optional(),
  imageUrl: z.string().optional(),
  useCache: z.boolean().optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
  nodeLabel: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let executionId: string | null = null;

  try {
    // Get the current user
    const { userId } = await getUserIdForApi();

    // Check credits
    const creditCost = getNodeCost("openrouter");
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    if (!user || user.credits < creditCost) {
      return NextResponse.json({ 
        error: "Insufficient credits", 
        required: creditCost,
        available: user?.credits ?? 0,
      }, { status: 402 });
    }

    const body = await request.json();
    const parsed = LLMRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { 
      prompt, systemPrompt, model, temperature, maxTokens, 
      topP, frequencyPenalty, presencePenalty, context, imageUrl, 
      useCache, workflowId, nodeId, nodeLabel 
    } = parsed.data;

    // Check cache
    let cacheHash: string | undefined;
    if (useCache) {
      try {
        const cacheInputs: Record<string, unknown> = { prompt, model };
        if (systemPrompt) cacheInputs.systemPrompt = systemPrompt;
        if (temperature !== undefined) cacheInputs.temperature = temperature;
        if (maxTokens !== undefined) cacheInputs.maxTokens = maxTokens;
        if (context) cacheInputs.context = context;
        
        const cacheCheck = await checkCache("openrouter", cacheInputs);
        cacheHash = cacheCheck.hash;
        
        if (cacheCheck.hit && cacheCheck.result) {
          const cachedText = (cacheCheck.result as { text?: string }).text || "";
          return NextResponse.json({ 
            cached: true, 
            text: cachedText,
            type: "text",
          });
        }
      } catch (cacheError) {
        console.warn("[LLM] Cache check failed:", cacheError);
      }
    }

    // Create execution record
    try {
      const execution = await db.quickExecution.create({
        data: {
          userId,
          workflowId,
          nodeId,
          nodeType: "openrouter",
          nodeLabel: nodeLabel || "OpenRouter LLM",
          status: "RUNNING",
          provider: "openrouter",
          model,
          inputJson: { prompt: prompt.slice(0, 500), model },
          estimatedCost: creditCost,
        },
      });
      executionId = execution.id;
    } catch (dbError) {
      console.warn("[LLM] Failed to create execution record:", dbError);
    }

    console.log(`[LLM] Starting execution via Trigger.dev`);
    console.log(`[LLM] TRIGGER_SECRET_KEY present: ${!!process.env.TRIGGER_SECRET_KEY}`);

    // Build input for the node executor
    const input: Record<string, unknown> = {
      prompt,
      model,
      temperature,
      maxTokens,
    };
    if (systemPrompt) input.systemPrompt = systemPrompt;
    if (topP !== undefined) input.topP = topP;
    if (frequencyPenalty !== undefined) input.frequencyPenalty = frequencyPenalty;
    if (presencePenalty !== undefined) input.presencePenalty = presencePenalty;
    if (context) input.context = context;
    if (imageUrl) input.imageUrl = imageUrl;

    // Execute via Trigger.dev
    const payload = {
      nodeExecutionId: executionId || `llm-${Date.now()}`,
      workflowExecutionId: `llm-workflow-${Date.now()}`,
      nodeId: nodeId || `llm-node-${Date.now()}`,
      nodeType: "openrouter" as const,
      input,
    };

    try {
      const handle = await executeNode.trigger(payload);
      console.log(`[LLM] Trigger.dev task started: ${handle.id}`);

      // Poll for completion
      const maxWaitTime = 2 * 60 * 1000; // 2 minutes for LLM
      const pollInterval = 500; // 500ms
      const pollStartTime = Date.now();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let finalRun: any = null;
      
      while (Date.now() - pollStartTime < maxWaitTime) {
        try {
          const run = await runs.retrieve(handle.id);
          
          if (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELED") {
            finalRun = run;
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        } catch (pollError) {
          console.error(`[LLM] Poll error:`, pollError);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }

      const durationMs = Date.now() - startTime;

      if (finalRun?.status === "COMPLETED" && finalRun.output) {
        const output = finalRun.output as { output?: { text?: string; type?: string }; actualCost?: number };
        const text = output.output?.text || "";
        const actualCost = output.actualCost || creditCost;

        // Update execution record
        if (executionId) {
          await db.quickExecution.update({
            where: { id: executionId },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              durationMs,
              outputJson: { type: "text", text: text.slice(0, 1000) },
              actualCost,
            },
          }).catch(console.warn);

          // Deduct credits
          await db.$transaction(async (tx: Prisma.TransactionClient) => {
            const currentUser = await tx.user.findUnique({
              where: { id: userId },
              select: { credits: true },
            });
            
            if (currentUser) {
              const newBalance = Math.max(0, currentUser.credits - actualCost);
              
              await tx.user.update({
                where: { id: userId },
                data: { credits: newBalance },
              });
              
              await tx.creditTransaction.create({
                data: {
                  userId,
                  amount: -actualCost,
                  balanceAfter: newBalance,
                  type: "EXECUTION",
                  description: `OpenRouter LLM`,
                  metadata: { nodeType: "openrouter", model },
                },
              });
            }
          }).catch(console.warn);
        }

        // Cache result
        if (useCache && cacheHash && text) {
          await cacheResult(cacheHash, "openrouter", { type: "text", text }).catch(console.warn);
        }

        return NextResponse.json({
          type: "text",
          text,
          actualCost,
          durationMs,
        });
      } else {
        // Failed
        if (executionId) {
          await db.quickExecution.update({
            where: { id: executionId },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              durationMs,
              error: "Execution failed",
            },
          }).catch(console.warn);
        }

        return NextResponse.json(
          { error: finalRun ? "Task failed" : "Task timed out" },
          { status: 500 }
        );
      }
    } catch (triggerError) {
      console.error(`[LLM] Trigger.dev error:`, triggerError);
      
      if (executionId) {
        await db.quickExecution.update({
          where: { id: executionId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            error: triggerError instanceof Error ? triggerError.message : "Trigger error",
          },
        }).catch(console.warn);
      }

      return NextResponse.json(
        { error: triggerError instanceof Error ? triggerError.message : "Failed to execute" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[LLM] Error:", error);
    
    if (executionId) {
      await db.quickExecution.update({
        where: { id: executionId },
        data: { 
          status: "FAILED", 
          completedAt: new Date(), 
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Unknown error" 
        },
      }).catch(console.warn);
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
