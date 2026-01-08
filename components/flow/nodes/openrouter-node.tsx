"use client";

import { memo, useState, useCallback, useRef, useEffect, KeyboardEvent } from "react";
import { NodeProps } from "reactflow";
import { Brain, Play, Loader2, Square, Plus, X, ExternalLink, Settings, Upload, Image as ImageIcon } from "lucide-react";
import { BaseNode, type BaseNodeData } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface OpenRouterNodeData extends BaseNodeData {
  prompt?: string;
  context?: string;
  negativePrompt?: string;
  result?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  inputImage?: string;
}

const nodeDef = NODE_DEFINITIONS.openrouter;

// Component to render text with clickable links
function RenderWithLinks({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  
  const parts = text.split(urlRegex);
  
  return (
    <>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          urlRegex.lastIndex = 0;
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="nodrag text-cyan-400 hover:text-cyan-300 underline underline-offset-2 inline-flex items-center gap-0.5"
            >
              {part.length > 40 ? part.slice(0, 40) + "..." : part}
              <ExternalLink className="w-2.5 h-2.5 inline-block" />
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const MODELS = [
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
  { id: "google/gemini-1.5-pro", name: "Gemini 1.5 Pro" },
  { id: "google/gemini-1.5-flash", name: "Gemini 1.5 Flash" },
];

function OpenRouterNodeComponent(props: NodeProps<OpenRouterNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);

  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean((data as any)?.advancedOpen));
  const [showNegative, setShowNegative] = useState(Boolean(data.negativePrompt));
  const [isDragOver, setIsDragOver] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastResultRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data.result && data.result !== lastResultRef.current) {
      lastResultRef.current = data.result;
      propagateOutput(id, data.result);
    }
  }, [data.result, id, propagateOutput]);

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateNode(id, { inputImage: base64 });
    };
    reader.readAsDataURL(file);
  }, [id, updateNode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

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
      let finalPrompt = data.prompt;
      if (data.negativePrompt?.trim()) {
        finalPrompt = `<CRITICAL_CONSTRAINT>
ABSOLUTE RESTRICTIONS - DO NOT INCLUDE ANY OF THE FOLLOWING UNDER ANY CIRCUMSTANCES:
${data.negativePrompt}

These restrictions are NON-NEGOTIABLE.
</CRITICAL_CONSTRAINT>

USER REQUEST:
${data.prompt}`;
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
          context: data.context,
          image: data.inputImage,
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
  }, [data.prompt, data.negativePrompt, data.systemPrompt, data.model, data.temperature, data.maxTokens, data.context, data.inputImage, id, updateNode, isStreaming]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runLLM();
    }
  }, [runLLM]);

  const toggleNegative = useCallback(() => {
    if (showNegative) {
      updateNode(id, { negativePrompt: "" });
    }
    setShowNegative(!showNegative);
  }, [showNegative, id, updateNode]);

  const currentModel = MODELS.find(m => m.id === (data.model || "openai/gpt-4o-mini"))?.name || "GPT-4o Mini";

  return (
    <BaseNode
      {...props}
      color="blue"
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Brain className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        { id: "prompt", type: "text", label: "Prompt", required: true },
        { id: "context", type: "text", label: "Context" },
        // Use actual node.data fields so edges can override behavior.
        { id: "inputImage", type: "image", label: "Image", hidden: !showSettings },
        { id: "systemPrompt", type: "text", label: "System", hidden: !showSettings },
        { id: "model", type: "text", label: "Model", hidden: !showSettings },
        { id: "temperature", type: "number", label: "Temp", hidden: !showSettings },
        { id: "maxTokens", type: "number", label: "MaxTok", hidden: !showSettings },
        { id: "negativePrompt", type: "negative", label: "Negative", hidden: !showSettings },
      ]}
      outputs={[
        { id: "response", type: "text", label: "Response" },
        { id: "out", type: "any", label: "Out" },
      ]}
      left={
        <div className="space-y-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
            className="hidden"
          />

          {/* Prompt Input */}
          <textarea
            value={data.prompt || ""}
            onChange={(e) => updateNode(id, { prompt: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Write your prompt... (Ctrl+Enter to run)"
            rows={3}
            className="nodrag nowheel w-full px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/10 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none"
          />

          {/* Image Upload for Vision */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => !data.inputImage && fileInputRef.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all cursor-pointer ${
              isDragOver
                ? "border-blue-500 bg-blue-500/10"
                : data.inputImage
                ? "border-blue-500/30 bg-blue-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            {data.inputImage ? (
              <div className="relative p-1">
                <img src={data.inputImage} alt="Vision input" className="w-full h-12 object-cover rounded" />
                <button
                  onClick={(e) => { e.stopPropagation(); updateNode(id, { inputImage: undefined }); }}
                  className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <div className="absolute bottom-2 left-2 text-[9px] text-blue-400 bg-black/60 px-1.5 py-0.5 rounded">
                  Vision
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 text-zinc-500">
                <ImageIcon className="w-3 h-3" />
                <span className="text-[9px]">Add image for vision (optional)</span>
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <select
              value={data.model || "openai/gpt-4o-mini"}
              onChange={(e) => updateNode(id, { model: e.target.value })}
              className="nodrag nowheel flex-1 h-7 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-[10px] text-zinc-300"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const next = !showSettings;
                setShowSettings(next);
                updateNode(id, { advancedOpen: next });
              }}
              className={`nodrag nowheel h-7 w-7 rounded-lg border flex items-center justify-center ${
                showSettings ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.03] border-white/10 text-zinc-400"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={runLLM}
              disabled={!data.prompt?.trim()}
              className={`nodrag nowheel h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 ${
                isStreaming
                  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  : data.prompt?.trim()
                  ? "bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isStreaming ? <><Square className="w-3 h-3" />Stop</> : <><Play className="w-3 h-3" />Run</>}
            </button>
          </div>

          {/* Collapsible Settings */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {/* System Prompt */}
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">System Prompt</label>
                    <textarea
                      value={data.systemPrompt || ""}
                      onChange={(e) => updateNode(id, { systemPrompt: e.target.value })}
                      placeholder="Optional system instructions..."
                      rows={2}
                      className="nodrag nowheel w-full px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100 placeholder-zinc-600 resize-none"
                    />
                  </div>

                  {/* Temperature */}
                  <div>
                    <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                      <span>Temperature</span>
                      <span className="text-zinc-300">{(data.temperature ?? 0.7).toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={data.temperature ?? 0.7}
                      onChange={(e) => updateNode(id, { temperature: parseFloat(e.target.value) })}
                      className="nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">Max Tokens</label>
                    <input
                      type="number"
                      value={data.maxTokens ?? 4096}
                      onChange={(e) => updateNode(id, { maxTokens: parseInt(e.target.value) || 4096 })}
                      className="nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100"
                    />
                  </div>

                  {/* Negative Prompt Toggle */}
                  <button
                    onClick={toggleNegative}
                    className="nodrag nowheel w-full h-6 rounded-lg border border-white/10 bg-white/[0.02] text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1"
                  >
                    {showNegative ? <><X className="w-3 h-3" />Remove Negative</> : <><Plus className="w-3 h-3" />Add Negative Prompt</>}
                  </button>

                  {showNegative && (
                    <textarea
                      value={data.negativePrompt || ""}
                      onChange={(e) => updateNode(id, { negativePrompt: e.target.value })}
                      placeholder="Things to avoid..."
                      rows={2}
                      className="nodrag nowheel w-full px-2 py-1.5 rounded-lg bg-red-500/5 border border-red-500/20 text-[10px] text-zinc-100 placeholder-zinc-600 resize-none"
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      right={
        <div className="space-y-2 min-w-0">
          <div className="text-[10px] text-zinc-500 flex items-center gap-2">
            {isStreaming ? (
              <><Loader2 className="w-3 h-3 animate-spin" />Generating...</>
            ) : data.result ? (
              "Response"
            ) : (
              "Awaiting prompt"
            )}
          </div>
          <div className="text-xs text-zinc-200 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 whitespace-pre-wrap break-words min-h-[80px] max-h-[180px] overflow-y-auto">
            {data.result ? (
              <RenderWithLinks text={data.result} />
            ) : (
              <span className="text-zinc-500 italic text-[10px]">Write a prompt and press Run...</span>
            )}
            {isStreaming && <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-pulse" />}
          </div>
        </div>
      }
    />
  );
}

export const OpenRouterNode = memo(OpenRouterNodeComponent);
