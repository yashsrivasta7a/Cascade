import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getUserIdForApi } from "@/lib/user";
import { getNodeCost } from "@/lib/credits";
import { checkCache, cacheResult } from "@/lib/cache";

// =============================================================================
// REALTIME STREAMING LLM ENDPOINT
// =============================================================================
// 
// This endpoint streams LLM responses directly from OpenRouter to the client
// using Server-Sent Events (SSE) for real-time updates.
//

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const LLMRequestSchema = z.object({
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
  model: z.string().default("openai/gpt-4o-mini"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  context: z.string().optional(),
  imageUrl: z.string().optional(),
  useCache: z.boolean().optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
  nodeLabel: z.string().optional(),
});

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let executionId: string | null = null;
  let userId: string | null = null;

  try {
    // Get the current user
    const userResult = await getUserIdForApi();
    userId = userResult.userId;

    // Check API key
    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check credits
    const creditCost = getNodeCost("openrouter");
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    if (!user || user.credits < creditCost) {
      return new Response(
        JSON.stringify({ 
          error: "Insufficient credits", 
          required: creditCost,
          available: user?.credits ?? 0,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const parsed = LLMRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { 
      prompt, systemPrompt, model, temperature, maxTokens, 
      topP, frequencyPenalty, presencePenalty, context, imageUrl, 
      useCache, workflowId, nodeId, nodeLabel 
    } = parsed.data;

    // Check cache first
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
          // Return cached result as a single SSE event
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: cachedText })}\n\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", cached: true, text: cachedText })}\n\n`));
              controller.close();
            }
          });
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        }
      } catch (cacheError) {
        console.warn("[LLM Realtime] Cache check failed:", cacheError);
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
      console.warn("[LLM Realtime] Failed to create execution record:", dbError);
    }

    // Build messages for OpenRouter
    const messages: OpenRouterMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    
    if (context) {
      messages.push({ role: "user", content: `Context:\n${context}` });
    }
    
    // Handle image URL if provided
    if (imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    // Build OpenRouter request with streaming
    const openRouterRequest = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true, // Enable streaming
      ...(topP !== undefined && { top_p: topP }),
      ...(frequencyPenalty !== undefined && { frequency_penalty: frequencyPenalty }),
      ...(presencePenalty !== undefined && { presence_penalty: presencePenalty }),
    };

    // Call OpenRouter with streaming
    const openRouterResponse = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.WEBHOOK_BASE_URL ?? "http://localhost:3000",
        "X-Title": "Cascade",
      },
      body: JSON.stringify(openRouterRequest),
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      console.error("[LLM Realtime] OpenRouter error:", errorText);
      
      if (executionId) {
        await db.quickExecution.update({
          where: { id: executionId },
          data: { status: "FAILED", error: errorText, completedAt: new Date() },
        }).catch(console.warn);
      }
      
      return new Response(
        JSON.stringify({ error: `OpenRouter error: ${openRouterResponse.status}` }),
        { status: openRouterResponse.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response to the client
    const encoder = new TextEncoder();
    let fullText = "";
    const capturedExecutionId = executionId;
    const capturedUserId = userId;
    const capturedCacheHash = cacheHash;
    const capturedUseCache = useCache;
    const capturedCreditCost = creditCost;
    const capturedModel = model;
    const capturedStartTime = startTime;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = openRouterResponse.body?.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "No response body" })}\n\n`));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Send final message with complete text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", text: fullText })}\n\n`));
              
              // Update execution record asynchronously
              const durationMs = Date.now() - capturedStartTime;
              if (capturedExecutionId) {
                db.quickExecution.update({
                  where: { id: capturedExecutionId },
                  data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    durationMs,
                    outputJson: { type: "text", text: fullText.slice(0, 1000) },
                    actualCost: capturedCreditCost,
                  },
                }).catch(console.warn);

                // Deduct credits
                db.$transaction(async (tx: Prisma.TransactionClient) => {
                  const currentUser = await tx.user.findUnique({
                    where: { id: capturedUserId! },
                    select: { credits: true },
                  });
                  
                  if (currentUser) {
                    const newBalance = Math.max(0, currentUser.credits - capturedCreditCost);
                    
                    await tx.user.update({
                      where: { id: capturedUserId! },
                      data: { credits: newBalance },
                    });
                    
                    await tx.creditTransaction.create({
                      data: {
                        userId: capturedUserId!,
                        amount: -capturedCreditCost,
                        balanceAfter: newBalance,
                        type: "EXECUTION",
                        description: `OpenRouter LLM`,
                        metadata: { nodeType: "openrouter", model: capturedModel },
                      },
                    });
                  }
                }).catch(console.warn);
              }

              // Cache result
              if (capturedUseCache && capturedCacheHash && fullText) {
                cacheResult(capturedCacheHash, "openrouter", { type: "text", text: fullText }).catch(console.warn);
              }

              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            
            // Process SSE lines
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                
                if (data === "[DONE]") {
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  
                  if (content) {
                    fullText += content;
                    // Send chunk to client
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", content, partial: fullText })}\n\n`));
                  }
                } catch {
                  // Ignore parse errors for incomplete JSON
                }
              }
            }
          }
        } catch (error) {
          console.error("[LLM Realtime] Stream error:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`));
          
          if (capturedExecutionId) {
            db.quickExecution.update({
              where: { id: capturedExecutionId },
              data: { status: "FAILED", error: String(error), completedAt: new Date() },
            }).catch(console.warn);
          }
          
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[LLM Realtime] Error:", error);
    
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
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
