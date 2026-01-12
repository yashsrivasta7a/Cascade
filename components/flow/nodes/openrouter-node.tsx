"use client";

import { memo, useState, useCallback, useRef, useEffect, KeyboardEvent } from "react";
import { NodeProps } from "reactflow";
import { Brain, Play, Loader2, Square, Plus, X, ExternalLink, Settings, Upload, Image as ImageIcon, Lock, Link2, ChevronDown, Check } from "lucide-react";
import { BaseNode, type BaseNodeData, isSettingInherited } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface OpenRouterNodeData extends BaseNodeData {
  prompt?: string;
  context?: string;
  negativePrompt?: string;
  result?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  inputImage?: string;
  useCache?: boolean;
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

// Grouped by provider for better organization
// Available models - curated list of best value models
const MODELS = [
  // OpenAI - Best value
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  // Google - Latest and fastest
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google" },
  // Anthropic - Latest Claude
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4.5", provider: "Anthropic" },
];

function OpenRouterNodeComponent(props: NodeProps<OpenRouterNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  const isHandleConnected = useFlowStore((s) => s.isHandleConnected);
  const getHandleSource = useFlowStore((s) => s.getHandleSource);
  const nodes = useFlowStore((s) => s.nodes);
  const runNode = useFlowStore((s) => s.runNode);
  const workflowId = useFlowStore((s) => s.workflowId);
  
  // Check which handles are connected
  const isPromptConnected = isHandleConnected(id, "prompt");
  const isContextConnected = isHandleConnected(id, "context");
  const isImageConnected = isHandleConnected(id, "inputImage");

  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean((data as any)?.advancedOpen));
  const [showNegative, setShowNegative] = useState(Boolean(data.negativePrompt));
  const [isDragOver, setIsDragOver] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastResultRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log(`[OpenRouterNode useEffect] data.result changed: hasResult=${!!data.result}, isNew=${data.result !== lastResultRef.current}`);
    if (data.result && data.result !== lastResultRef.current) {
      console.log(`[OpenRouterNode useEffect] Propagating result: "${data.result.slice(0, 100)}..."`);
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
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      return;
    }

    // Check if we need to run parent nodes first
    const isPromptConnected = isHandleConnected(id, "prompt");
    const isContextConnected = isHandleConnected(id, "context");
    const isSystemPromptConnected = isHandleConnected(id, "systemPrompt");
    const isImageInputConnected = isHandleConnected(id, "inputImage");
    
    // Get current values - either from data or from connected nodes
    let currentPrompt = data.prompt?.trim() || "";
    let currentContext = data.context || "";
    let currentSystemPrompt = data.systemPrompt || "";
    let currentImageUrl = data.inputImage || "";
    
    // If prompt is connected, check if parent node has a result
    if (isPromptConnected) {
      const promptSource = getHandleSource(id, "prompt");
      if (promptSource) {
        const parentNode = nodes.find(n => n.id === promptSource.sourceNodeId);
        const parentResult = parentNode?.data?.result || parentNode?.data?.response;
        
        if (!parentResult) {
          // Parent node hasn't run yet - run it first
          updateNode(id, { status: "queued" });
          try {
            await runNode(promptSource.sourceNodeId);
            // Get the updated result after parent ran
            const updatedNodes = useFlowStore.getState().nodes;
            const updatedParent = updatedNodes.find(n => n.id === promptSource.sourceNodeId);
            currentPrompt = updatedParent?.data?.result || updatedParent?.data?.response || "";
          } catch (err) {
            updateNode(id, { 
              result: `Error: Failed to run parent node - ${err instanceof Error ? err.message : "Unknown error"}`,
              status: "failed" 
            });
            return;
          }
        } else {
          currentPrompt = parentResult;
        }
      }
    }
    
    // If context is connected, check if parent node has a result
    if (isContextConnected) {
      const contextSource = getHandleSource(id, "context");
      if (contextSource) {
        const parentNode = nodes.find(n => n.id === contextSource.sourceNodeId);
        const parentResult = parentNode?.data?.result || parentNode?.data?.response;
        
        if (!parentResult) {
          // Parent node hasn't run yet - run it first
          updateNode(id, { status: "queued" });
          try {
            await runNode(contextSource.sourceNodeId);
            // Get the updated result after parent ran
            const updatedNodes = useFlowStore.getState().nodes;
            const updatedParent = updatedNodes.find(n => n.id === contextSource.sourceNodeId);
            currentContext = updatedParent?.data?.result || updatedParent?.data?.response || "";
          } catch (err) {
            updateNode(id, { 
              result: `Error: Failed to run parent node - ${err instanceof Error ? err.message : "Unknown error"}`,
              status: "failed" 
            });
            return;
          }
        } else {
          currentContext = parentResult;
        }
      }
    }
    
    // If systemPrompt is connected, check if parent node has a result
    if (isSystemPromptConnected) {
      const systemSource = getHandleSource(id, "systemPrompt");
      if (systemSource) {
        const parentNode = nodes.find(n => n.id === systemSource.sourceNodeId);
        const parentResult = parentNode?.data?.result || parentNode?.data?.response;
        
        if (!parentResult) {
          // Parent node hasn't run yet - run it first
          updateNode(id, { status: "queued" });
          try {
            await runNode(systemSource.sourceNodeId);
            // Get the updated result after parent ran
            const updatedNodes = useFlowStore.getState().nodes;
            const updatedParent = updatedNodes.find(n => n.id === systemSource.sourceNodeId);
            currentSystemPrompt = updatedParent?.data?.result || updatedParent?.data?.response || "";
          } catch (err) {
            updateNode(id, { 
              result: `Error: Failed to run parent node - ${err instanceof Error ? err.message : "Unknown error"}`,
              status: "failed" 
            });
            return;
          }
        } else {
          currentSystemPrompt = parentResult;
        }
      }
    }
    
    // If inputImage is connected, check if parent node has a result (image URL)
    if (isImageInputConnected) {
      const imageSource = getHandleSource(id, "inputImage");
      if (imageSource) {
        const parentNode = nodes.find(n => n.id === imageSource.sourceNodeId);
        // For image nodes, the result is the image URL
        const parentResult = parentNode?.data?.result;
        
        if (!parentResult) {
          // Parent node hasn't run yet - run it first
          updateNode(id, { status: "queued", result: "Waiting for image from parent node..." });
          try {
            await runNode(imageSource.sourceNodeId);
            // Get the updated result after parent ran
            const updatedNodes = useFlowStore.getState().nodes;
            const updatedParent = updatedNodes.find(n => n.id === imageSource.sourceNodeId);
            currentImageUrl = updatedParent?.data?.result || "";
            // Update the node with the received image
            if (currentImageUrl) {
              updateNode(id, { inputImage: currentImageUrl });
            }
          } catch (err) {
            updateNode(id, { 
              result: `Error: Failed to get image from parent node - ${err instanceof Error ? err.message : "Unknown error"}`,
              status: "failed" 
            });
            return;
          }
        } else {
          currentImageUrl = parentResult;
          // Update the node with the received image
          updateNode(id, { inputImage: currentImageUrl });
        }
      }
    }

    // Now check if we have a prompt
    if (!currentPrompt) {
      updateNode(id, { 
        result: "Error: No prompt provided. Enter a prompt or connect to a node with output.",
        status: "failed" 
      });
      return;
    }

    setIsStreaming(true);
    updateNode(id, { result: "", status: "running" });
    lastResultRef.current = "";

    abortControllerRef.current = new AbortController();

    try {
      let finalPrompt = currentPrompt;
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
          systemPrompt: currentSystemPrompt || data.systemPrompt,
          model: data.model || "openai/gpt-4o-mini",
          temperature: data.temperature ?? 0.7,
          maxTokens: data.maxTokens ?? 4096,
          topP: data.topP,
          frequencyPenalty: data.frequencyPenalty,
          presencePenalty: data.presencePenalty,
          context: currentContext || data.context,
          imageUrl: currentImageUrl || data.inputImage, // Use connected image or direct upload
          useCache: data.useCache, // Cache identical inputs
          // For Activity tracking
          workflowId: workflowId ?? undefined,
          nodeId: id,
          nodeLabel: data.label || "OpenRouter LLM",
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

      // Check if response is cached (JSON) or streaming
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        // Cached response - parse JSON directly
        const cachedResult = await response.json();
        if (cachedResult.cached && cachedResult.text) {
          updateNode(id, { result: cachedResult.text, status: "completed" });
          setIsStreaming(false);
          return;
        }
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
  }, [data.prompt, data.negativePrompt, data.systemPrompt, data.model, data.temperature, data.maxTokens, data.topP, data.frequencyPenalty, data.presencePenalty, data.context, data.inputImage, data.useCache, id, updateNode, isStreaming, workflowId, isHandleConnected, getHandleSource, nodes, runNode]);

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
        { id: "prompt", type: "prompt", label: "Prompt", required: true },
        { id: "context", type: "text", label: "Context" },
        // Show Image handle if connected OR if settings is open
        { id: "inputImage", type: "image", label: "Image", hidden: !showSettings && !isImageConnected },
        { id: "systemPrompt", type: "prompt", label: "System", hidden: !showSettings },
        { id: "model", type: "model", label: "Model", hidden: !showSettings },
        { id: "temperature", type: "temperature", label: "Temp", hidden: !showSettings },
        { id: "maxTokens", type: "number", label: "MaxTok", hidden: !showSettings },
        { id: "topP", type: "number", label: "Top P", hidden: !showSettings },
        { id: "frequencyPenalty", type: "number", label: "FreqPen", hidden: !showSettings },
        { id: "presencePenalty", type: "number", label: "PresPen", hidden: !showSettings },
        { id: "negativePrompt", type: "negative", label: "Negative", hidden: !showSettings },
      ]}
      outputs={[
        { id: "response", type: "text", label: "Response" },
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
          <div className="relative">
            {isPromptConnected && (
              <div className="absolute top-1 right-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/30">
                <Link2 className="w-2.5 h-2.5 text-blue-400" />
                <span className="text-[8px] text-blue-400 font-medium">LINKED</span>
              </div>
            )}
            <textarea
              value={data.prompt || ""}
              onChange={(e) => !isPromptConnected && updateNode(id, { prompt: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder={isPromptConnected ? "Receiving from connected node..." : "Write your prompt... (Ctrl+Enter to run)"}
              rows={3}
              readOnly={isPromptConnected}
              className={`nodrag nowheel w-full px-3 py-2 rounded-lg border text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none ${
                isPromptConnected 
                  ? "bg-blue-500/5 border-blue-500/20 cursor-not-allowed" 
                  : "bg-zinc-900/60 border-white/10 focus:border-white/20"
              }`}
            />
          </div>

          {/* Incoming Context Indicator - Only show when context handle is connected */}
          {isContextConnected && data.context && (
            <div className="px-2 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Link2 className="w-3 h-3 text-cyan-400" />
                <span className="text-[9px] text-cyan-400 font-medium uppercase tracking-wider">Context from connected node</span>
              </div>
              <p className="text-[10px] text-cyan-300/80 line-clamp-2 italic">
                {data.context.length > 150 ? data.context.slice(0, 150) + "..." : data.context}
              </p>
            </div>
          )}

          {/* Image Upload for Vision */}
          <div
            onDrop={isImageConnected ? undefined : handleDrop}
            onDragOver={isImageConnected ? undefined : (e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={isImageConnected ? undefined : () => setIsDragOver(false)}
            onClick={() => !isImageConnected && !data.inputImage && fileInputRef.current?.click()}
            className={`nodrag nowheel relative rounded-lg border-2 border-dashed transition-all ${
              isImageConnected
                ? "border-emerald-500/30 bg-emerald-500/5 cursor-default"
                : isDragOver
                ? "border-blue-500 bg-blue-500/10 cursor-pointer"
                : data.inputImage
                ? "border-blue-500/30 bg-blue-500/5 cursor-pointer"
                : "border-white/10 bg-white/[0.02] hover:border-white/20 cursor-pointer"
            }`}
          >
            {isImageConnected && (
              <div className="absolute top-1 right-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                <Link2 className="w-2.5 h-2.5 text-emerald-400" />
                <span className="text-[8px] text-emerald-400 font-medium">LINKED</span>
              </div>
            )}
            {data.inputImage ? (
              <div className="relative p-1">
                <img src={data.inputImage} alt="Vision input" className="w-full h-12 object-cover rounded" />
                {!isImageConnected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateNode(id, { inputImage: undefined }); }}
                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
                <div className={`absolute bottom-2 left-2 text-[9px] bg-black/60 px-1.5 py-0.5 rounded ${isImageConnected ? "text-emerald-400" : "text-blue-400"}`}>
                  {isImageConnected ? "From connected node" : "Vision"}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 text-zinc-500">
                <ImageIcon className="w-3 h-3" />
                <span className="text-[9px]">{isImageConnected ? "Waiting for image..." : "Add image for vision (optional)"}</span>
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            {/* Custom Model Dropdown */}
            <div ref={modelDropdownRef} className="relative flex-1">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900 border border-white/10 text-[10px] text-zinc-300 flex items-center justify-between hover:border-white/20 transition-colors"
              >
                <span className="truncate">
                  {MODELS.find(m => m.id === (data.model || "openai/gpt-4o-mini"))?.name || "GPT-4o Mini"}
                </span>
                <ChevronDown className={cn("w-3 h-3 text-zinc-500 transition-transform", showModelDropdown && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {showModelDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="nodrag nowheel absolute z-50 top-full left-0 right-0 mt-1 py-1 bg-zinc-900 border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                  >
                    {/* Simple list of models */}
                    {MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          updateNode(id, { model: m.id });
                          setShowModelDropdown(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-[11px] flex items-center justify-between hover:bg-white/5 transition-colors",
                          (data.model || "openai/gpt-4o-mini") === m.id ? "text-blue-400 bg-blue-500/10" : "text-zinc-300"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-[9px] text-zinc-500">{m.provider}</span>
                        </div>
                        {(data.model || "openai/gpt-4o-mini") === m.id && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={runLLM}
              disabled={!data.prompt?.trim() && !isPromptConnected}
              className={`nodrag nowheel h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 ${
                isStreaming
                  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  : (data.prompt?.trim() || isPromptConnected)
                  ? "bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isStreaming ? <><Square className="w-3 h-3" />Stop</> : <><Play className="w-3 h-3" />Run</>}
            </button>
          </div>

          {/* Additional Settings Toggle */}
          <button
            onClick={() => {
              const next = !showSettings;
              setShowSettings(next);
              updateNode(id, { advancedOpen: next });
            }}
            className="nodrag nowheel w-full mt-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center justify-between w-full">
              <div className="text-left">
                <div className="text-[11px] font-medium text-zinc-300">Additional Settings</div>
                <div className="text-[9px] text-zinc-500">Customize your input with more control.</div>
              </div>
              <div className="flex items-center gap-1 text-zinc-400">
                <span className="text-[10px]">{showSettings ? "Less" : "More"}</span>
                <motion.div
                  animate={{ rotate: showSettings ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </motion.div>
              </div>
            </div>
          </button>

          {/* Collapsible Settings Content */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-2">
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
                  {(() => {
                    const isInherited = isSettingInherited(data, "temperature");
                    const value = Math.min(Math.max(0, data.temperature ?? 0.7), 2);
                    return (
                      <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                          <span className="flex items-center gap-1">
                            Temperature
                            {isInherited && <Lock className="w-2.5 h-2.5 text-violet-400" />}
                          </span>
                          <span className="text-zinc-300">{value.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={value}
                          onChange={(e) => updateNode(id, { temperature: parseFloat(e.target.value) })}
                          disabled={isInherited}
                          className={`nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none ${
                            isInherited ? "accent-violet-500 cursor-not-allowed opacity-60" : "cursor-pointer"
                          }`}
                        />
                      </div>
                    );
                  })()}

                  {/* Max Tokens */}
                  {(() => {
                    const isInherited = isSettingInherited(data, "maxTokens");
                    return (
                      <div>
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          Max Tokens
                          {isInherited && <Lock className="w-2.5 h-2.5 text-violet-400" />}
                        </label>
                        <input
                          type="number"
                          value={data.maxTokens ?? 4096}
                          onChange={(e) => updateNode(id, { maxTokens: parseInt(e.target.value) || 4096 })}
                          disabled={isInherited}
                          className={`nodrag nowheel w-full h-7 px-2 rounded-lg bg-zinc-900/60 border border-white/10 text-[10px] text-zinc-100 ${
                            isInherited ? "cursor-not-allowed opacity-60" : ""
                          }`}
                        />
                      </div>
                    );
                  })()}

                  {/* Top P (Nucleus Sampling) */}
                  {(() => {
                    const isInherited = isSettingInherited(data, "topP");
                    const value = Math.min(Math.max(0, data.topP ?? 1), 1);
                    return (
                      <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                          <span className="flex items-center gap-1">
                            Top P (Nucleus)
                            {isInherited && <Lock className="w-2.5 h-2.5 text-violet-400" />}
                          </span>
                          <span className="text-zinc-300">{value.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={value}
                          onChange={(e) => updateNode(id, { topP: parseFloat(e.target.value) })}
                          disabled={isInherited}
                          className={`nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none ${
                            isInherited ? "accent-violet-500 cursor-not-allowed opacity-60" : "cursor-pointer"
                          }`}
                        />
                      </div>
                    );
                  })()}

                  {/* Frequency Penalty */}
                  {(() => {
                    const isInherited = isSettingInherited(data, "frequencyPenalty");
                    const value = Math.min(Math.max(-2, data.frequencyPenalty ?? 0), 2);
                    return (
                      <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                          <span className="flex items-center gap-1">
                            Frequency Penalty
                            {isInherited && <Lock className="w-2.5 h-2.5 text-violet-400" />}
                          </span>
                          <span className="text-zinc-300">{value.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="-2"
                          max="2"
                          step="0.1"
                          value={value}
                          onChange={(e) => updateNode(id, { frequencyPenalty: parseFloat(e.target.value) })}
                          disabled={isInherited}
                          className={`nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none ${
                            isInherited ? "accent-violet-500 cursor-not-allowed opacity-60" : "cursor-pointer"
                          }`}
                        />
                      </div>
                    );
                  })()}

                  {/* Presence Penalty */}
                  {(() => {
                    const isInherited = isSettingInherited(data, "presencePenalty");
                    const value = Math.min(Math.max(-2, data.presencePenalty ?? 0), 2);
                    return (
                      <div>
                        <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                          <span className="flex items-center gap-1">
                            Presence Penalty
                            {isInherited && <Lock className="w-2.5 h-2.5 text-violet-400" />}
                          </span>
                          <span className="text-zinc-300">{value.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="-2"
                          max="2"
                          step="0.1"
                          value={value}
                          onChange={(e) => updateNode(id, { presencePenalty: parseFloat(e.target.value) })}
                          disabled={isInherited}
                          className={`nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none ${
                            isInherited ? "accent-violet-500 cursor-not-allowed opacity-60" : "cursor-pointer"
                          }`}
                        />
                      </div>
                    );
                  })()}

                  {/* Use Cache Toggle */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Use Cache</span>
                      <p className="text-[8px] text-zinc-600 mt-0.5">Skip re-execution for identical inputs</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={data.useCache === true}
                        onChange={(e) => updateNode(id, { useCache: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="nodrag nowheel w-8 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>

                  {/* Negative Prompt - always visible, optional */}
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">Negative Prompt (optional)</label>
                    <textarea
                      value={data.negativePrompt || ""}
                      onChange={(e) => updateNode(id, { negativePrompt: e.target.value })}
                      placeholder="Things to avoid... (leave empty if not needed)"
                      rows={2}
                      className="nodrag nowheel w-full px-2 py-1.5 rounded-lg bg-red-500/5 border border-red-500/20 text-[10px] text-zinc-100 placeholder-zinc-600 resize-none"
                    />
                  </div>
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
