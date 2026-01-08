"use client";

import { memo, useState, useCallback } from "react";
import { NodeProps } from "reactflow";
import { Volume2, Play, Loader2, Settings, Lock } from "lucide-react";
import { BaseNode, type BaseNodeData, isSettingInherited } from "../base-node";
import { NODE_DEFINITIONS } from "@/types/nodes";
import { useFlowStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

export interface ElevenLabsNodeData extends BaseNodeData {
  text?: string;
  voiceId?: string;
  voiceName?: string;
  stability?: number;
  clarity?: number;
  context?: string;
  result?: string;
}

const nodeDef = NODE_DEFINITIONS.elevenlabs;

const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam" },
];

function ElevenLabsNodeComponent(props: NodeProps<ElevenLabsNodeData>) {
  const { data, id } = props;
  const updateNode = useFlowStore((s) => s.updateNode);
  const setWorkflowRunning = useFlowStore((s) => s.setWorkflowRunning);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(Boolean((data as any)?.advancedOpen));

  const runGenerate = useCallback(async () => {
    const text = data.text?.trim() || data.context?.trim();
    if (!text || !data.voiceId) return;
    
    setIsProcessing(true);
    updateNode(id, { status: "running" });
    setWorkflowRunning(true); // Enable polling for status updates

    try {
      const response = await fetch("/api/nodes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "elevenlabs",
          input: {
            text,
            voiceId: data.voiceId,
            stability: data.stability || 0.5,
            clarity: data.clarity || 0.75,
            nodeId: id, // Pass flow node ID for polling
          },
        }),
      });

      const result = await response.json();
      if (result.status === "triggered") {
        updateNode(id, { status: "running" });
        
        // Poll for status updates
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/nodes/status?nodeId=${encodeURIComponent(id)}`);
            if (!statusRes.ok) return;
            
            const statusData = await statusRes.json();
            console.log(`[ElevenLabs] Poll status for ${id}:`, statusData.status);
            
            if (statusData.status === "completed") {
              clearInterval(pollInterval);
              setIsProcessing(false);
              const audioUrl = statusData.output?.audio?.url;
              updateNode(id, {
                result: audioUrl || "",
                status: "completed",
              });
              setWorkflowRunning(false);
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              setIsProcessing(false);
              updateNode(id, {
                result: "",
                status: "failed",
                error: statusData.error || "TTS failed",
                errorDetails: {
                  provider: statusData.providerUsed || "fal",
                  executionId: statusData.executionId,
                  triggerRunId: statusData.triggerRunId,
                  duration: statusData.duration,
                  inputs: statusData.inputs,
                },
              });
              setWorkflowRunning(false);
            }
          } catch (err) {
            console.error("[ElevenLabs] Poll error:", err);
          }
        }, 2000);
      }
    } catch (error) {
      updateNode(id, { status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      setWorkflowRunning(false);
    } finally {
      setIsProcessing(false);
    }
  }, [data.text, data.context, data.voiceId, data.stability, data.clarity, id, updateNode, setWorkflowRunning]);

  const hasInput = Boolean((data.text?.trim() || data.context?.trim()) && data.voiceId);

  return (
    <BaseNode
      {...props}
      color="amber"
      layout="vertical"
      data={{
        ...data,
        label: data.label || nodeDef.label,
        description: data.description || nodeDef.description,
        icon: <Volume2 className="w-5 h-5" />,
        provider: nodeDef.provider,
        estimatedCost: nodeDef.estimatedCost,
      }}
      inputs={[
        { id: "text", type: "text", label: "Script", required: true },
        { id: "voiceId", type: "text", label: "Voice", hidden: !showSettings },
        { id: "stability", type: "number", label: "Stability", hidden: !showSettings },
        { id: "clarity", type: "number", label: "Clarity", hidden: !showSettings },
      ]}
      outputs={[{ id: "audio", type: "audio", label: "Audio" }]}
      left={
        <div className="space-y-2">
          {/* Text Input */}
          <textarea
            value={data.text || ""}
            onChange={(e) => updateNode(id, { text: e.target.value })}
            placeholder={data.context ? "Override text..." : "Enter text to speak..."}
            rows={3}
            className="nodrag nowheel w-full px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/10 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 resize-none"
          />

          {/* Voice Selection */}
          <select
            value={data.voiceId || ""}
            onChange={(e) => {
              const voice = VOICES.find(v => v.id === e.target.value);
              updateNode(id, { voiceId: e.target.value, voiceName: voice?.name });
            }}
            className="nodrag nowheel w-full h-8 px-2 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-zinc-300"
          >
            <option value="">Select voice...</option>
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
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
              onClick={runGenerate}
              disabled={!hasInput}
              className={`nodrag nowheel flex-1 h-7 px-3 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1.5 ${
                isProcessing
                  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  : hasInput
                  ? "bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
                  : "bg-white/[0.03] border-white/10 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3" />Generate</>}
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
                  <div>
                    <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                      <span>Stability</span>
                      <span className="text-zinc-300">{(data.stability || 0.5).toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={data.stability || 0.5}
                      onChange={(e) => updateNode(id, { stability: parseFloat(e.target.value) })}
                      className="nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] text-zinc-500 mb-1">
                      <span>Clarity</span>
                      <span className="text-zinc-300">{(data.clarity || 0.75).toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={data.clarity || 0.75}
                      onChange={(e) => updateNode(id, { clarity: parseFloat(e.target.value) })}
                      className="nodrag nowheel w-full h-1.5 rounded-full bg-zinc-800 appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      right={
        <div className="space-y-2">
          <div className="text-[10px] text-zinc-500">
            {isProcessing ? "Generating..." : data.result ? "Audio Ready" : "No output"}
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-2 min-h-[50px] flex items-center justify-center">
            {data.result ? (
              <audio src={data.result} controls className="w-full h-8" />
            ) : (
              <span className="text-zinc-600 text-[10px]">—</span>
            )}
          </div>
        </div>
      }
    />
  );
}

export const ElevenLabsNode = memo(ElevenLabsNodeComponent);
