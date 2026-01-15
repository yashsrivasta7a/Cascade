import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { openRouterProvider, type OpenRouterMessage } from "@/lib/providers";
import { TextOutSchema } from "@/lib/workflow/node-schemas";

// =============================================================================
// OPENROUTER - LLM / Vision Node
// =============================================================================

export const OpenRouterInputSchema = z.object({
  prompt: z.string().min(1).max(128000),
  systemPrompt: z.string().optional(),
  model: z.string().default("openai/gpt-4o-mini"), // Accept any model string
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  // Context from previous nodes (could be text or image URL)
  context: z.string().optional(),
  imageUrl: z.string().optional(), // Can be URL or base64 data URL
});

export type OpenRouterInput = z.infer<typeof OpenRouterInputSchema>;

export const OpenRouterOutputSchema = TextOutSchema;
export type OpenRouterOutput = z.infer<typeof OpenRouterOutputSchema>;

export const openrouterExecutor: NodeExecutor<OpenRouterInput, OpenRouterOutput> = {
  type: "openrouter",
  version: "1.0.0",
  inputSchema: OpenRouterInputSchema,
  outputSchema: OpenRouterOutputSchema,
  providers: ["openrouter"],  // Future: ["openrouter", "anthropic", "openai"]
  config: {
    timeout: "2m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: OpenRouterInput,
    _context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    if (!openRouterProvider.isConfigured()) {
      return executeMock(input);
    }

    try {
      // Build messages array
      const messages: OpenRouterMessage[] = [];

      if (input.systemPrompt) {
        messages.push({
          role: "system",
          content: input.systemPrompt,
        });
      }

      // Build user message content
      let userContent: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

      if (input.imageUrl) {
        // Vision request with image
        userContent = [
          { type: "text", text: input.prompt },
        ];
        if (input.context) {
          userContent.push({ type: "text", text: `\n\nContext: ${input.context}` });
        }
        userContent.push({
          type: "image_url",
          image_url: { url: input.imageUrl },
        });
      } else {
        // Text-only request
        userContent = input.context
          ? `${input.prompt}\n\nContext: ${input.context}`
          : input.prompt;
      }

      messages.push({
        role: "user",
        content: userContent,
      });

      const response = await openRouterProvider.executeSync({
        model: input.model,
        messages,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
      });

      const text = response.choices[0]?.message?.content ?? "";

      // Calculate cost based on token usage (simplified)
      const usage = response.usage;
      const estimatedCost = usage
        ? Math.ceil((usage.prompt_tokens + usage.completion_tokens) / 1000)
        : 1;

      return {
        success: true,
        output: {
          type: "text",
          text,
        },
        providerUsed: "openrouter",
        actualCost: estimatedCost,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerUsed: "openrouter",
      };
    }
  },
};

function executeMock(input: OpenRouterInput): NodeExecutionResult {
  const mockResponse = `Mock LLM response for prompt: "${input.prompt.slice(0, 100)}..."${
    input.context ? `\n\nUsing context: "${input.context.slice(0, 50)}..."` : ""
  }`;

  return {
    success: true,
    output: {
      type: "text",
      text: mockResponse,
    },
    providerUsed: "mock",
    actualCost: 0,
  };
}

// Parse function for consistency with other nodes (even though OpenRouter is sync)
export function parseOpenrouterResult(result: unknown): OpenRouterOutput {
  // OpenRouter returns result directly, no parsing needed
  const data = result as { type: string; text: string };
  return {
    type: "text",
    text: data.text ?? String(result),
  };
}

export default openrouterExecutor;

