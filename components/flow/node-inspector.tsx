"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
 X,
 Trash2,
 Copy,
 Settings,
 Image,
 Film,
 Volume2,
 Brain,
 Wrench,
 ExternalLink,
 Zap,
 Clock,
 Layers,
} from "lucide-react";
import { useFlowStore } from "@/store";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";

const categoryIcons: Record<string, React.ReactNode> = {
 image: <Image className="w-4 h-4" />,
 video: <Film className="w-4 h-4" />,
 audio: <Volume2 className="w-4 h-4" />,
 llm: <Brain className="w-4 h-4" />,
 utility: <Wrench className="w-4 h-4" />,
};

const categoryColors: Record<string, string> = {
 image: "text-slate-700 dark:text-zinc-200 bg-white dark:bg-white/5 border-blue-100 dark:border-white/10",
 video: "text-slate-700 dark:text-zinc-200 bg-white dark:bg-white/5 border-blue-100 dark:border-white/10",
 audio: "text-slate-700 dark:text-zinc-200 bg-white dark:bg-white/5 border-blue-100 dark:border-white/10",
 llm: "text-slate-700 dark:text-zinc-200 bg-white dark:bg-white/5 border-blue-100 dark:border-white/10",
 utility: "text-slate-700 dark:text-zinc-200 bg-white dark:bg-white/5 border-blue-100 dark:border-white/10",
};

function formatCredits(credits: number): string {
 if (credits === 0) return "~0";
 if (credits >= 1_000_000) return `${(credits / 1_000_000).toFixed(2)}M`;
 if (credits >= 1_000) return `${(credits / 1_000).toFixed(1)}K`;
 return credits.toString();
}

export function NodeInspector() {
 // Individually selected: a bare useFlowStore() re-rendered the inspector on
 // every node-drag frame even while it renders nothing.
 const selectedNode = useFlowStore((s) => s.selectedNode);
 const updateNode = useFlowStore((s) => s.updateNode);
 const deleteNode = useFlowStore((s) => s.deleteNode);
 const selectNode = useFlowStore((s) => s.selectNode);
 const duplicateNode = useFlowStore((s) => s.duplicateNode);

 if (!selectedNode) {
 // Keep the workflow editor clean (Krea-like): only show the inspector when a node is selected.
 return null;
 }

 const nodeType = selectedNode.type as AINodeType;
 const nodeDef = NODE_DEFINITIONS[nodeType];

 if (!nodeDef) {
 return (
 <div className="text-sm fixed right-4 top-20 bottom-4 w-[360px] max-w-[90vw] bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 shadow-xl dark:shadow-2xl z-40">
 <p className="text-slate-700 dark:text-zinc-500">Unknown node type</p>
 </div>
 );
 }

 return (
 <AnimatePresence mode="wait">
 <motion.div
 key={selectedNode.id}
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 20 }}
 className="fixed right-4 top-20 bottom-4 w-[360px] max-w-[90vw] bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col shadow-xl dark:shadow-2xl z-40 overflow-hidden"
 >
 {/* Header */}
 <div className="px-4 py-3 border-gray-100 dark:border-white/10 bg-white dark:bg-white/[0.03]">
 <div className="flex items-center justify-between mb-3">
 <div className={cn("flex items-center gap-2 px-2 py-1 rounded-lg border", categoryColors[nodeDef.category])}>
 {categoryIcons[nodeDef.category]}
 <span className="text-[10px] font-bold uppercase tracking-wider">
 {nodeDef.category}
 </span>
 </div>
 <button
 onClick={() => selectNode(null)}
 className="p-1.5 rounded-lg text-slate-800 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <div className="flex items-center gap-3">
 <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", categoryColors[nodeDef.category])}>
 {categoryIcons[nodeDef.category]}
 </div>
 <div className="text-sm flex-1 min-w-0">
 <h2 className="text-[10px] font-bold text-slate-900 dark:text-white truncate">{nodeDef.label}</h2>
 <p className="text-[10px] text-slate-700 dark:text-zinc-500 truncate">{nodeDef.description}</p>
 </div>
 </div>

        {/* Node Info Metadata */}
        <div className="text-[10px] flex items-center justify-between mt-3 pt-3 border-gray-100 dark:border-white/5">
          <div className="text-[10px] flex items-center gap-1.5 text-slate-700 dark:text-zinc-500">
            <Layers className="w-3 h-3" />
            <span>{nodeDef.provider}</span>
          </div>
          <div className="text-[10px] flex items-center gap-1.5">
            {nodeDef.estimatedTime && (
              <div className="text-[10px] flex items-center gap-1 text-slate-700 dark:text-zinc-300 bg-white dark:bg-white/5 px-2 py-0.5 rounded-full border border-blue-100 dark:border-white/10">
                <Clock className="w-3 h-3" />
                <span>{nodeDef.estimatedTime}</span>
              </div>
            )}
            {nodeDef.estimatedCost > 0 && (
              <div className="text-[10px] flex items-center gap-1 text-slate-700 dark:text-zinc-300 bg-white dark:bg-white/5 px-2 py-0.5 rounded-full border border-blue-100 dark:border-white/10">
                <Zap className="w-3 h-3" />
                <span>{formatCredits(nodeDef.estimatedCost)} credits</span>
              </div>
            )}
          </div>
        </div>
      </div>

 {/* Properties Container */}
 <div className="text-[10px] flex-1 overflow-y-auto custom-scrollbar">
 <div className="p-4 space-y-5">
 {/* General Section */}
 <section className="space-y-3">
 <h3 className="text-[10px] font-bold text-slate-700 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-2">
 <Settings className="w-3 h-3" />
 General
 </h3>
 <div className="space-y-1.5">
 <label className="text-[10px] font-medium text-slate-700 dark:text-zinc-400 ml-1">Display Name</label>
 <Input
 value={selectedNode.data?.label || nodeDef.label}
 onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
 className="bg-white dark:bg-white/[0.03] border-blue-100 dark:border-white/10 focus:border-gray-300 dark:focus:border-white/20 h-9 text-sm"
 />
 </div>
 </section>

 <div className="h-px bg-white dark:bg-white/5" />

 {/* Node-Specific Configuration */}
 <section className="space-y-4">
 <h3 className="text-[10px] font-bold text-slate-700 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-2">
 {categoryIcons[nodeDef.category]}
 Configuration
 </h3>

 {/* SEEDREAM CONFIG */}
 {nodeType === "seedream" && (
 <>
 <div className="space-y-1.5">
 <label className="text-[10px] font-medium text-slate-700 dark:text-zinc-400 ml-1">Prompt</label>
 <textarea
 value={selectedNode.data?.prompt || ""}
 onChange={(e) => updateNode(selectedNode.id, { prompt: e.target.value })}
 rows={4}
 className="text-sm w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.03] border border-blue-100 dark:border-white/10 text-slate-700 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-300 dark:focus:border-white/20 resize-none"
 placeholder="Describe the image you want to generate..."
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-[10px] font-medium text-slate-700 dark:text-zinc-400 ml-1">Negative Prompt</label>
 <Input
 value={selectedNode.data?.negativePrompt || ""}
 onChange={(e) => updateNode(selectedNode.id, { negativePrompt: e.target.value })}
 className="bg-zinc-900/50 border-white/5 h-9 text-sm"
 placeholder="What to avoid..."
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-[10px] font-medium text-slate-700 dark:text-zinc-400 ml-1">Aspect Ratio</label>
 <select
 value={selectedNode.data?.aspectRatio || "1:1"}
 onChange={(e) => updateNode(selectedNode.id, { aspectRatio: e.target.value })}
 className="fs-select w-full h-9 px-3 rounded-lg text-sm cursor-pointer"
 >
 <option value="1:1">1:1 (Square)</option>
 <option value="16:9">16:9 (Landscape)</option>
 <option value="9:16">9:16 (Portrait)</option>
 <option value="4:3">4:3 (Classic)</option>
 <option value="3:4">3:4 (Portrait Classic)</option>
 </select>
 </div>
 </>
 )}

 {/* SEEDVR CONFIG */}
 {nodeType === "seedvr" && (
 <>
 <div className="space-y-1.5">
 <label className="text-[10px] font-medium text-slate-700 dark:text-zinc-400 ml-1">Upscale Factor</label>
 <div className="grid grid-cols-2 gap-2">
 {["2x", "4x"].map((scale) => (
 <button
 key={scale}
 onClick={() => updateNode(selectedNode.id, { scale })}
 className={cn(
 "h-10 rounded-lg border text-sm font-medium transition-all",
 selectedNode.data?.scale === scale
 ? "bg-white border-white/20 text-zinc-100"
 : "bg-zinc-900/50 border-white/10 text-slate-600 hover:border-white/20"
 )}
 >
 {scale}
 </button>
 ))}
 </div>
 </div>
 <label className="text-[10px] flex items-center gap-3 p-3 rounded-lg bg-zinc-900/30 border border-white/5 cursor-pointer hover:bg-zinc-900/50 transition-colors">
 <input
 type="checkbox"
 checked={selectedNode.data?.enhanceFaces || false}
 onChange={(e) => updateNode(selectedNode.id, { enhanceFaces: e.target.checked })}
 className="w-4 h-4 rounded border-white/20 bg-zinc-900 text-zinc-200 focus:ring-white/20"
 />
 <div>
 <p className="text-zinc-200">Enhance Faces</p>
 <p className="text-[10px] text-slate-700">Improve facial details</p>
 </div>
 </label>
 </>
 )}

 {/* SEEDANCE CONFIG */}
 {nodeType === "seedance" && (
 <>
 <div className="space-y-1.5">
 <label className="text-[10px] font-medium text-slate-700 dark:text-zinc-400 ml-1">Prompt</label>
 <textarea
 value={selectedNode.data?.prompt || "text-[10px]"}
 onChange={(e) => updateNode(selectedNode.id, { prompt: e.target.value })}
 rows={4}
 className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.03] border border-blue-100 dark:border-white/10 text-slate-700 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-300 dark:focus:border-white/20 resize-none"
 placeholder="Describe the video you want to generate..."
 />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <label className="text-[10px] font-medium text-slate-700 dark:text-zinc-400 ml-1">Duration</label>
 <select
 value={selectedNode.data?.duration || "4s"}
 onChange={(e) => updateNode(selectedNode.id, { duration: e.target.value })}
 className="fs-select w-full h-9 px-3 rounded-lg text-sm cursor-pointer"
 >
 <option value="4s">4 seconds</option>
 <option value="8s">8 seconds</option>
 <option value="16s">16 seconds</option>
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="font-medium text-slate-700 dark:text-zinc-400 ml-1">Aspect Ratio</label>
 <select
 value={selectedNode.data?.aspectRatio || "16:9"}
 onChange={(e) => updateNode(selectedNode.id, { aspectRatio: e.target.value })}
 className="fs-select w-full h-9 px-3 rounded-lg text-sm cursor-pointer"
 >
 <option value="16:9">16:9</option>
 <option value="9:16">9:16</option>
 <option value="1:1">1:1</option>
 </select>
 </div>
 </div>
 </>
 )}

 {/* ELEVENLABS CONFIG */}
 {nodeType === "elevenlabs" && (
 <>
 <div className="space-y-1.5">
 <label className="font-medium text-slate-700 dark:text-zinc-400 ml-1">Voice</label>
 <select
 value={selectedNode.data?.voiceId || ""}
 onChange={(e) => updateNode(selectedNode.id, { voiceId: e.target.value })}
 className="fs-select w-full h-9 px-3 rounded-lg text-sm cursor-pointer"
 >
 <option value="">Select a voice...</option>
 <option value="rachel">Rachel (Female, Calm)</option>
 <option value="drew">Drew (Male, Neutral)</option>
 <option value="clyde">Clyde (Male, Warm)</option>
 <option value="domi">Domi (Female, Assertive)</option>
 <option value="dave">Dave (Male, British)</option>
 <option value="fin">Fin (Male, Irish)</option>
 </select>
 </div>
 <div className="space-y-3 p-3 rounded-xl bg-zinc-900/30 border border-white/5">
 <div>
 <div className="flex items-center justify-between mb-2">
 <label className="font-medium text-slate-600">Stability</label>
 <span className="font-mono text-slate-600">
 {(selectedNode.data?.stability || 0.5).toFixed(1)}
 </span>
 </div>
 <input
 type="range"
 min="0"
 max="1"
 step="0.1"
 value={selectedNode.data?.stability || 0.5}
 onChange={(e) => updateNode(selectedNode.id, { stability: parseFloat(e.target.value) })}
 className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-200"
 />
 </div>
 <div>
 <div className="flex items-center justify-between mb-2">
 <label className="font-medium text-slate-600">Clarity + Similarity</label>
 <span className="font-mono text-slate-600">
 {(selectedNode.data?.clarity || 0.75).toFixed(2)}
 </span>
 </div>
 <input
 type="range"
 min="0"
 max="1"
 step="0.05"
 value={selectedNode.data?.clarity || 0.75}
 onChange={(e) => updateNode(selectedNode.id, { clarity: parseFloat(e.target.value) })}
 className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-200"
 />
 </div>
 </div>
 </>
 )}

 {/* OPENROUTER CONFIG */}
 {nodeType === "openrouter" && (
 <>
 <div className="space-y-1.5">
 <label className="font-medium text-slate-700 dark:text-zinc-400 ml-1">Model</label>
 <select
 value={selectedNode.data?.model || "openai/gpt-4o-mini"}
 onChange={(e) => updateNode(selectedNode.id, { model: e.target.value })}
 className="fs-select w-full h-9 px-3 rounded-lg text-sm cursor-pointer"
 >
 <optgroup label="OpenAI">
 <option value="openai/gpt-4o">GPT-4o</option>
 <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
 </optgroup>
 <optgroup label="Anthropic">
 <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
 <option value="anthropic/claude-3-opus">Claude 3 Opus</option>
 </optgroup>
 <optgroup label="Google">
 <option value="google/gemini-1.5-pro">Gemini 1.5 Pro</option>
 <option value="google/gemini-1.5-flash">Gemini 1.5 Flash</option>
 </optgroup>
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="font-medium text-slate-700 dark:text-zinc-400 ml-1">System Prompt</label>
 <textarea
 value={selectedNode.data?.systemPrompt || ""}
 onChange={(e) => updateNode(selectedNode.id, { systemPrompt: e.target.value })}
 rows={4}
 className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.03] border border-blue-100 dark:border-white/10 text-slate-700 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-300 dark:focus:border-white/20 resize-none"
 placeholder="You are a helpful assistant..."
 />
 </div>
 <div className="space-y-3 p-3 rounded-xl bg-zinc-900/30 border border-white/5">
 <div>
 <div className="flex items-center justify-between mb-2">
 <label className="font-medium text-slate-600">Temperature</label>
 <span className="font-mono text-slate-600">
 {selectedNode.data?.temperature || 0.7}
 </span>
 </div>
 <input
 type="range"
 min="0"
 max="2"
 step="0.1"
 value={selectedNode.data?.temperature || 0.7}
 onChange={(e) => updateNode(selectedNode.id, { temperature: parseFloat(e.target.value) })}
 className="text-[10px] w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-200"
 />
 <div className="text-[8px] flex justify-between text-slate-700 mt-1">
 <span>Precise</span>
 <span>Creative</span>
 </div>
 </div>
 </div>
 <div className="space-y-1.5">
 <label className="font-medium text-slate-700 dark:text-zinc-400 ml-1">Max Tokens</label>
 <Input
 type="number"
 value={selectedNode.data?.maxTokens || 4096}
 onChange={(e) => updateNode(selectedNode.id, { maxTokens: parseInt(e.target.value) })}
 className="bg-zinc-900/50 border-white/5 h-9 text-sm font-mono"
 />
 </div>
 </>
 )}

 {/* LIPSYNC CONFIG */}
 {nodeType === "lipsync" && (
 <div className="space-y-1.5">
 <label className="font-medium text-slate-700 dark:text-zinc-400 ml-1">Sync Model</label>
 <div className="grid grid-cols-2 gap-2">
 {[
 { value: "sync-1.5", label: "Sync 1.5" },
 { value: "sync-1.6-beta", label: "Sync 1.6 Beta" },
 ].map((model) => (
 <button
 key={model.value}
 onClick={() => updateNode(selectedNode.id, { model: model.value })}
 className={cn(
 "h-10 rounded-lg border text-xs font-medium transition-all",
 selectedNode.data?.model === model.value
 ? "bg-white border-white/20 text-zinc-100"
 : "bg-zinc-900/50 border-white/10 text-slate-600 hover:border-white/20"
 )}
 >
 {model.label}
 </button>
 ))}
 </div>
 </div>
 )}

 {/* CROP IMAGE CONFIG */}
 {nodeType === "crop-image" && (
 <div className="space-y-3">
 <p className="text-slate-700">Crop percentages from each edge</p>
 <div className="grid grid-cols-2 gap-3">
 {["top", "right", "bottom", "left"].map((edge) => (
 <div key={edge} className="text-sm space-y-1">
 <label className="font-medium text-slate-600 capitalize">{edge}</label>
 <div className="text-[10px] flex items-center gap-2">
 <Input
 type="number"
 min={0}
 max={100}
 value={selectedNode.data?.[edge] || 0}
 onChange={(e) => updateNode(selectedNode.id, { [edge]: parseInt(e.target.value) })}
 className="bg-zinc-900/50 border-white/5 h-8 text-sm font-mono flex-1"
 />
 <span className="text-slate-700">%</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* MERGE AUDIO VIDEO CONFIG */}
 {nodeType === "merge-audio-video" && (
 <label className="text-[10px] flex items-center gap-3 p-3 rounded-lg bg-zinc-900/30 border border-white/5 cursor-pointer hover:bg-zinc-900/50 transition-colors">
 <input
 type="checkbox"
 checked={selectedNode.data?.replaceAudio !== false}
 onChange={(e) => updateNode(selectedNode.id, { replaceAudio: e.target.checked })}
 className="w-4 h-4 rounded border-white/20 bg-zinc-900 text-slate-700 focus:ring-zinc-500/50"
 />
 <div>
 <p className="text-zinc-200">Replace Original Audio</p>
 <p className="text-[10px] text-slate-700">Uncheck to mix both audio tracks</p>
 </div>
 </label>
 )}

 {/* MERGE VIDEOS CONFIG */}
 {nodeType === "merge-videos" && (
 <>
 <div className="space-y-1.5">
 <label className="font-medium text-slate-700 dark:text-zinc-400 ml-1">Transition</label>
 <select
 value={selectedNode.data?.transition || "none"}
 onChange={(e) => updateNode(selectedNode.id, { transition: e.target.value })}
 className="fs-select w-full h-9 px-3 rounded-lg text-sm cursor-pointer"
 >
 <option value="none">None (Cut)</option>
 <option value="fade">Fade</option>
 <option value="dissolve">Dissolve</option>
 </select>
 </div>
 {selectedNode.data?.transition && selectedNode.data?.transition !== "none" && (
 <div className="space-y-1.5">
 <label className="font-medium text-slate-700 dark:text-zinc-400 ml-1">
 Transition Duration (seconds)
 </label>
 <Input
 type="number"
 min={0}
 max={2}
 step={0.1}
 value={selectedNode.data?.transitionDuration || 0.5}
 onChange={(e) => updateNode(selectedNode.id, { transitionDuration: parseFloat(e.target.value) })}
 className="bg-zinc-900/50 border-white/5 h-9 text-sm font-mono"
 />
 </div>
 )}
 </>
 )}

 {/* EXTRACT AUDIO CONFIG */}
 {nodeType === "extract-audio" && (
 <div className="space-y-1.5">
 <label className="font-medium text-slate-700 dark:text-zinc-400 ml-1">Output Format</label>
 <div className="grid grid-cols-3 gap-2">
 {["mp3", "wav", "aac"].map((format) => (
 <button
 key={format}
 onClick={() => updateNode(selectedNode.id, { format })}
 className={cn(
 "h-10 rounded-lg border text-xs font-mono uppercase font-medium transition-all",
 selectedNode.data?.format === format
 ? "bg-zinc-500/20 border-zinc-500/50 text-slate-600"
 : "bg-zinc-900/50 border-white/5 text-slate-700 hover:border-white/10"
 )}
 >
 {format}
 </button>
 ))}
 </div>
 </div>
 )}
 </section>
 </div>
 </div>

 {/* Footer Actions */}
 <div className="p-4 bg-white dark:bg-zinc-900/30 border-gray-100 dark:border-white/5">
 <div className="grid grid-cols-2 gap-2">
 <Button
 variant="outline"
 className="h-9 text-xs rounded-lg border-blue-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/5"
 size="sm"
 onClick={() => duplicateNode(selectedNode.id)}
 >
 <Copy className="w-3.5 h-3.5 mr-2" />
 Clone
 </Button>
 <Button
 variant="danger"
 className="h-9 text-xs rounded-lg"
 size="sm"
 onClick={() => {
 deleteNode(selectedNode.id);
 selectNode(null);
 }}
 >
 <Trash2 className="w-3.5 h-3.5 mr-2" />
 Delete
 </Button>
 </div>
 </div>
 </motion.div>
 </AnimatePresence>
 );
}
