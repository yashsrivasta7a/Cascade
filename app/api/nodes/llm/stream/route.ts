import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getUserIdForApi } from "@/lib/user";
import { getNodeCost, calculateOpenrouterCost } from "@/lib/credits";
import { checkCache, cacheResult } from "@/lib/cache";

// =============================================================================
// STREAMING LLM API ENDPOINT
// =============================================================================

const LLMRequestSchema = z.object({
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
  model: z.string().default("openai/gpt-4o-mini"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  topP: z.number().min(0).max(1).optional(), // Nucleus sampling
  topK: z.number().min(0).optional(), // Top-K sampling (not all models support this)
  frequencyPenalty: z.number().min(-2).max(2).optional(), // Repetition penalty
  presencePenalty: z.number().min(-2).max(2).optional(), // Topic penalty
  context: z.string().optional(),
  imageUrl: z.string().optional(), // Can be URL or base64 data URL
  useCache: z.boolean().optional(), // Cache identical inputs
  // Workflow context for Activity tab
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
  nodeLabel: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let executionId: string | null = null;

  try {
    // Get the current user (creates if not exists)
    const { userId } = await getUserIdForApi();

    // Check if user has enough credits before execution
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
          message: `You need ${creditCost.toLocaleString()} credits but only have ${(user?.credits ?? 0).toLocaleString()}. Please add more credits.`
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

    const { prompt, systemPrompt, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, context, imageUrl, useCache, workflowId, nodeId, nodeLabel } = parsed.data;

    // CHECK CACHE - If useCache is enabled, check for identical inputs
    let cacheHash: string | undefined;
    if (useCache) {
      try {
        // Only include defined values for consistent hashing
        const cacheInputs: Record<string, unknown> = { prompt, model };
        if (systemPrompt) cacheInputs.systemPrompt = systemPrompt;
        if (temperature !== undefined) cacheInputs.temperature = temperature;
        if (maxTokens !== undefined) cacheInputs.maxTokens = maxTokens;
        if (topP !== undefined) cacheInputs.topP = topP;
        if (frequencyPenalty !== undefined) cacheInputs.frequencyPenalty = frequencyPenalty;
        if (presencePenalty !== undefined) cacheInputs.presencePenalty = presencePenalty;
        if (context) cacheInputs.context = context;
        if (imageUrl) cacheInputs.imageUrl = imageUrl;
        
        console.log(`[LLM Stream] Cache check with inputs:`, JSON.stringify(cacheInputs).slice(0, 200));
        const cacheCheck = await checkCache("openrouter", cacheInputs);
        cacheHash = cacheCheck.hash;
        
        if (cacheCheck.hit && cacheCheck.result) {
          console.log(`[LLM Stream] CACHE HIT for openrouter (hash: ${cacheHash.slice(0, 12)}...) - returning cached result`);
          
          // Return cached result as a simple JSON response (not streaming)
          const cachedText = (cacheCheck.result as { text?: string }).text || "";
          
          // Record the cached execution
          if (executionId) {
            await db.quickExecution.update({
              where: { id: executionId },
              data: {
                status: "COMPLETED",
                completedAt: new Date(),
                durationMs: Date.now() - startTime,
                outputJson: cacheCheck.result as Prisma.InputJsonValue,
                actualCost: 0, // No cost for cached results
                providerUsed: "cache",
              },
            }).catch(() => {});
          }
          
          return new Response(
            JSON.stringify({ 
              cached: true, 
              text: cachedText,
              hash: cacheHash.slice(0, 12),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        
        console.log(`[LLM Stream] Cache MISS for openrouter (hash: ${cacheHash.slice(0, 12)}...) - executing`);
      } catch (cacheError) {
        console.warn("[LLM Stream] Cache check failed, proceeding with execution:", cacheError);
      }
    }

    // Create execution record with userId and workflow context
    try {
      const execution = await db.quickExecution.create({
        data: {
          userId, // Track the user
          workflowId, // Link to workflow for Activity tab
          nodeId, // React Flow node ID
          nodeType: "openrouter",
          nodeLabel: nodeLabel || "OpenRouter LLM",
          status: "RUNNING",
          provider: "openrouter",
          model,
          inputJson: { prompt, systemPrompt, model, temperature, maxTokens, context: context?.slice(0, 200) },
          estimatedCost: 2,
        },
      });
      executionId = execution.id;
    } catch (dbError) {
      console.warn("Failed to create execution record:", dbError);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      // Mark as failed if we have an execution record
      if (executionId) {
        await db.quickExecution.update({
          where: { id: executionId },
          data: { status: "FAILED", error: "API key not configured", completedAt: new Date(), durationMs: Date.now() - startTime },
        }).catch(() => {});
      }
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build messages array
    type MessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
    interface Message {
      role: "system" | "user" | "assistant";
      content: MessageContent;
    }

    const messages: Message[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    // Build user message content
    let userContent: MessageContent;

    if (imageUrl) {
      // Vision request with image
      userContent = [{ type: "text", text: prompt }];
      if (context) {
        userContent.push({ type: "text", text: `\n\nContext: ${context}` });
      }
      userContent.push({ type: "image_url", image_url: { url: imageUrl } });
    } else {
      // Text-only request
      userContent = context ? `${prompt}\n\nContext: ${context}` : prompt;
    }

    messages.push({ role: "user", content: userContent });

    // Make streaming request to OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Flowsmith",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        // Optional advanced parameters
        ...(topP !== undefined && { top_p: topP }),
        ...(frequencyPenalty !== undefined && { frequency_penalty: frequencyPenalty }),
        ...(presencePenalty !== undefined && { presence_penalty: presencePenalty }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Mark as failed
      if (executionId) {
        await db.quickExecution.update({
          where: { id: executionId },
          data: { status: "FAILED", error: `API error: ${response.status}`, completedAt: new Date(), durationMs: Date.now() - startTime },
        }).catch(() => {});
      }
      return new Response(
        JSON.stringify({ error: `OpenRouter API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let outputTokenCount = 0; // Track output tokens
    const execId = executionId; // Capture for closure
    const execStartTime = startTime;
    const execUserId = userId; // Capture userId for closure
    const execModel = model; // Capture model for closure
    const execCacheHash = cacheHash; // Capture cache hash for closure
    const execUseCache = useCache; // Capture useCache flag for closure
    
    // Estimate input tokens (roughly 4 characters per token)
    const inputText = messages.map(m => 
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join(' ');
    const estimatedInputTokens = Math.ceil(inputText.length / 4);

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                    // Estimate tokens from content (roughly 4 chars per token)
                    outputTokenCount += Math.ceil(content.length / 4);
                    // Send just the content as a simple SSE event
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                  // Also check for usage data in the final message
                  if (parsed.usage) {
                    outputTokenCount = parsed.usage.completion_tokens || outputTokenCount;
                  }
                } catch {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }

          // Mark as completed and deduct credits
          if (execId) {
            try {
              // Calculate actual cost based on token usage
              const creditCost = calculateOpenrouterCost(
                estimatedInputTokens, 
                outputTokenCount, 
                execModel
              );
              
              await db.quickExecution.update({
                where: { id: execId },
                data: {
                  status: "COMPLETED",
                  completedAt: new Date(),
                  durationMs: Date.now() - execStartTime,
                  outputJson: { type: "text", text: fullResponse.slice(0, 1000) }, // Store preview
                  actualCost: creditCost,
                },
              });
              console.log(`[LLM Stream] Execution ${execId} marked as COMPLETED. Tokens: ${estimatedInputTokens} in, ${outputTokenCount} out. Cost: ${creditCost} credits`);
              
              // Cache result if caching enabled
              if (execUseCache && execCacheHash && fullResponse) {
                try {
                  await cacheResult(execCacheHash, "openrouter", { type: "text", text: fullResponse });
                  console.log(`[LLM Stream] Cached result for openrouter (hash: ${execCacheHash.slice(0, 12)}...)`);
                } catch (cacheWriteError) {
                  console.warn("[LLM Stream] Failed to cache result:", cacheWriteError);
                }
              }
              
              // Deduct credits from user
              if (execUserId && creditCost > 0) {
                try {
                  await db.$transaction(async (tx: Prisma.TransactionClient) => {
                    const user = await tx.user.findUnique({
                      where: { id: execUserId },
                      select: { credits: true },
                    });
                    
                    if (user) {
                      const newBalance = Math.max(0, user.credits - creditCost);
                      
                      await tx.user.update({
                        where: { id: execUserId },
                        data: { credits: newBalance },
                      });
                      
                      await tx.creditTransaction.create({
                        data: {
                          userId: execUserId,
                          amount: -creditCost,
                          balanceAfter: newBalance,
                          type: "EXECUTION",
                          description: `OpenRouter LLM (${outputTokenCount} tokens)`,
                          metadata: { 
                            nodeType: "openrouter", 
                            model: execModel,
                            inputTokens: estimatedInputTokens,
                            outputTokens: outputTokenCount,
                          },
                        },
                      });
                      
                      console.log(`[LLM Stream] Deducted ${creditCost} credits from user ${execUserId}, new balance: ${newBalance}`);
                    }
                  });
                } catch (creditErr) {
                  console.warn("Failed to deduct credits:", creditErr);
                }
              }
            } catch (dbErr) {
              console.warn("Failed to update execution as completed:", dbErr);
            }
          }
        } catch (error) {
          // Mark as failed - use await to ensure it completes
          if (execId) {
            try {
              await db.quickExecution.update({
                where: { id: execId },
                data: {
                  status: "FAILED",
                  completedAt: new Date(),
                  durationMs: Date.now() - execStartTime,
                  error: error instanceof Error ? error.message : "Stream error",
                },
              });
              console.log(`[LLM Stream] Execution ${execId} marked as FAILED`);
            } catch (dbErr) {
              console.warn("Failed to update execution as failed:", dbErr);
            }
          }
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    // Update execution as failed if we have one
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

