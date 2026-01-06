"use client";

import { memo, useState, useCallback, useRef, useEffect, KeyboardEvent } from "react";
import { NodeProps } from "reactflow";
import { Brain, Play, Loader2, Square, Plus, X } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";

export interface OpenRouterNodeData extends BaseNodeData {
  prompt?: string;
  context?: string;
  negativePrompt?: string;
  result?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

const nodeDef = NODE_DEFINITIONS.openrouter;

const modelLabels: Record<string, string> = {
  "openai/gpt-4o": "GPT-4o",
  "openai/gpt-4o-mini": "GPT-4o Mini",
  "anthropic/claude-3.5-sonnet": "Claude 3.5 Sonnet",
  "anthropic/claude-3-opus": "Claude 3 Opus",
  "google/gemini-1.5-pro": "Gemini 1.5 Pro",
  "google/gemini-1.5-flash": "Gemini 1.5 Flash",
};

function OpenRouterNodeComponent(props: NodeProps<OpenRouterNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  const modelKey = data.model || "openai/gpt-4o-mini";
  const modelLabel = modelLabels[modelKey] || modelKey;

  const [isStreaming, setIsStreaming] = useState(false);
  const [showNegative, setShowNegative] = useState(Boolean(data.negativePrompt));
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastResultRef = useRef<string>("");

  // Propagate output to connected nodes when result changes
  useEffect(() => {
    if (data.result && data.result !== lastResultRef.current) {
      lastResultRef.current = data.result;
      propagateOutput(id, data.result);
    }
  }, [data.result, id, propagateOutput]);

  const runLLM = useCallback(async () => {
    if (!data.prompt?.trim()) return;
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      return;
    }

    setIsStreaming(true);
    updateNode(id, { result: "", status: "running" });
    lastResultRef.current = "";

    abortControllerRef.current = new AbortController();

    try {
      // Build the prompt - if there's a negative prompt, instruct the LLM to avoid it
      let finalPrompt = data.prompt;
      if (data.negativePrompt?.trim()) {
        finalPrompt = `${data.prompt}\n\n[IMPORTANT: You must NOT include or reference any of the following in your response: ${data.negativePrompt}]`;
      }

      const response = await fetch("/api/nodes/llm/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          systemPrompt: data.systemPrompt,
          model: data.model || "openai/gpt-4o-mini",
          temperature: data.temperature ?? 0.7,
          maxTokens: data.maxTokens ?? 4096,
          context: data.context, // Context from connected nodes (hidden from UI)
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        updateNode(id, { 
          result: `Error: ${error.error || "Failed to get response"}`,
          status: "failed",
          error: error.error || "Failed to get response"
        });
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        updateNode(id, { result: "Error: No response stream", status: "failed" });
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonData = line.slice(6);
            if (jsonData === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonData);
              if (parsed.content) {
                fullText += parsed.content;
                updateNode(id, { result: fullText });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      updateNode(id, { result: fullText, status: "completed" });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        updateNode(id, { status: "idle" });
      } else {
        updateNode(id, { 
          result: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: "failed"
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [data.prompt, data.negativePrompt, data.systemPrompt, data.model, data.temperature, data.maxTokens, data.context, id, updateNode, isStreaming]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runLLM();
    }
  }, [runLLM]);

  const toggleNegative = useCallback(() => {
    if (showNegative) {
      // Clear negative prompt when hiding
      updateNode(id, { negativePrompt: "" });
    }
    setShowNegative(!showNegative);
  }, [showNegative, id, updateNode]);

  return (
    <BaseNode
      {...props}
      color="blue"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Brain className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        { id: "context", type: "text", label: "Context" },
      ]}
      outputs={[{ id: "response", type: "text", label: "Response" }]}
      left={
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 text-[10px] bg-white/[0.03] rounded-lg px-2 py-1.5 border border-white/10">
              <Brain className="w-3 h-3 text-zinc-300" />
              <span className="text-zinc-300 font-medium">{modelLabel}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                runLLM();
              }}
              disabled={!data.prompt?.trim()}
              className={`nodrag nowheel h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all ${
                isStreaming
                  ? "bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
                  : data.prompt?.trim()
                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
              title={isStreaming ? "Stop" : "Run (Ctrl+Enter)"}
            >
              {isStreaming ? (
                <>
                  <Square className="w-3 h-3" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Run
                </>
              )}
            </button>
          </div>

          <textarea
            value={data.prompt || ""}
            onChange={(e) => updateNode(id, { prompt: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Write your prompt... (Ctrl+Enter to run)"
            rows={4}
            className="nodrag nowheel w-full px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/10 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none"
          />

          {/* Negative Prompt Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleNegative();
            }}
            className="nodrag nowheel w-full h-6 rounded-lg border border-white/10 bg-white/[0.02] text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all flex items-center justify-center gap-1"
          >
            {showNegative ? (
              <>
                <X className="w-3 h-3" />
                Remove Negative
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                Add Negative Prompt
              </>
            )}
          </button>

          {showNegative && (
            <textarea
              value={data.negativePrompt || ""}
              onChange={(e) => updateNode(id, { negativePrompt: e.target.value })}
              placeholder="Things to avoid in the response..."
              rows={2}
              className="nodrag nowheel w-full px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500/30 resize-none"
            />
          )}
        </div>
      }
      right={
        <div className="space-y-2 min-w-0">
          <div className="text-[10px] text-zinc-500 flex items-center gap-2">
            {isStreaming ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </>
            ) : data.result ? (
              "Response"
            ) : (
              "No output yet"
            )}
          </div>
          <div className="text-xs text-zinc-200 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 whitespace-pre-wrap break-words min-h-[96px] max-h-[200px] overflow-y-auto">
            {data.result || "—"}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
      }
    />
  );
}

export const OpenRouterNode = memo(OpenRouterNodeComponent);
