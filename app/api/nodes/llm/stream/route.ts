import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserIdForApi } from "@/lib/user";

// =============================================================================
// STREAMING LLM API ENDPOINT
// =============================================================================

const LLMRequestSchema = z.object({
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
  model: z.string().default("openai/gpt-4o-mini"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  context: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let executionId: string | null = null;

  try {
    // Get the current user (creates if not exists)
    const { userId } = await getUserIdForApi();

    const body = await request.json();
    const parsed = LLMRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { prompt, systemPrompt, model, temperature, maxTokens, context, imageUrl } = parsed.data;

    // Create execution record with userId
    try {
      const execution = await db.quickExecution.create({
        data: {
          userId, // Track the user
          nodeType: "openrouter",
          nodeLabel: "OpenRouter LLM",
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
    const execId = executionId; // Capture for closure
    const execStartTime = startTime;

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
                    // Send just the content as a simple SSE event
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }

          // Mark as completed - use await to ensure it completes
          if (execId) {
            try {
              await db.quickExecution.update({
                where: { id: execId },
                data: {
                  status: "COMPLETED",
                  completedAt: new Date(),
                  durationMs: Date.now() - execStartTime,
                  outputJson: { type: "text", text: fullResponse.slice(0, 1000) }, // Store preview
                  actualCost: 2, // Estimated
                },
              });
              console.log(`[LLM Stream] Execution ${execId} marked as COMPLETED`);
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

