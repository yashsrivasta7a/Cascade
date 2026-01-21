import { z } from "zod";
import type { NodeConfig } from "../types";
import { TextOutSchema } from "../schemas";

// =============================================================================
// LLM NODES
// Nodes for language model interactions
// =============================================================================

export const openrouterConfig: NodeConfig = {
  type: "openrouter",
  version: "1.0.0",
  category: "llm",
  label: "OpenRouter LLM",
  description: "Access GPT-4, Claude, Gemini and more through a unified API",
  color: "blue",
  
  providers: [
    {
      id: "openrouter",
      model: "openai/gpt-4o-mini",
      inputMapping: {
        prompt: "prompt",
        systemPrompt: "systemPrompt",
        model: "model",
        temperature: "temperature",
        maxTokens: "maxTokens",
        context: "context",
        imageUrl: "imageUrl",
      },
      outputMapping: {
        text: "text",
      },
      syncMode: true,
    },
  ],
  
  inputSchema: z.object({
    prompt: z.string().min(1).max(128000),
    systemPrompt: z.string().optional(),
    model: z.string().default("openai/gpt-4o-mini"),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(128000).default(4096),
    context: z.string().optional(),
    imageUrl: z.union([
      z.string(),
      z.object({ url: z.string(), mimeType: z.string().optional() }),
    ]).optional(),
  }),
  
  outputSchema: TextOutSchema,
  
  execution: {
    timeout: "2m",
    retryPerProvider: 2,
    maxRetries: 3,
  },
  
  ui: {
    inputs: [
      { id: "prompt", type: "textarea", label: "Prompt", required: true, rows: 3, placeholder: "Enter your prompt..." },
      { id: "systemPrompt", type: "textarea", label: "System Prompt", rows: 2, placeholder: "Set the AI's behavior...", advanced: true },
      { id: "model", type: "select", label: "Model", options: [
        { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
        { value: "openai/gpt-4o", label: "GPT-4o" },
        { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
        { value: "anthropic/claude-3-opus", label: "Claude 3 Opus" },
        { value: "google/gemini-pro-1.5", label: "Gemini Pro 1.5" },
        { value: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
      ], defaultValue: "openai/gpt-4o-mini" },
      { id: "imageUrl", type: "file", label: "Image (Vision)", accept: "image/*", preview: true },
      { id: "temperature", type: "slider", label: "Temperature", min: 0, max: 2, step: 0.1, defaultValue: 0.7, showValue: true, advanced: true },
      { id: "maxTokens", type: "number", label: "Max Tokens", min: 1, max: 128000, defaultValue: 4096, advanced: true },
    ],
    outputs: [
      { id: "text", type: "text", label: "Response" },
    ],
    layout: "vertical",
  },
  
  estimatedCost: 50_000,
  estimatedTime: "~2s",
  features: ["Vision Input", "Streaming", "System Prompts"],
  
  mockResponse: (input: unknown) => {
    const inp = input as { prompt: string; context?: string };
    return {
      type: "text",
      text: `Mock LLM response for prompt: "${inp.prompt.slice(0, 100)}..."${
        inp.context ? `\n\nUsing context: "${inp.context.slice(0, 50)}..."` : ""
      }`,
    };
  },
};

// Export all LLM node configs
export const llmNodes = {
  openrouter: openrouterConfig,
};
