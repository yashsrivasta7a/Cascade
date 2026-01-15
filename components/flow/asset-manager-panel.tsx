"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FolderOpen,
  Download,
  ExternalLink,
  FileVideo,
  FileAudio,
  FileImage,
  Package,
  Target,
  Loader2,
  Inbox,
  Film,
  Volume2,
  Image,
  Brain,
  Zap,
  Crop,
  Scissors,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_DEFINITIONS, type AINodeType } from "@/types/nodes";
import { useFlowStore } from "@/store";

// =============================================================================
// TYPES
// =============================================================================

interface MediaAsset {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  type: "video" | "audio" | "image";
  url: string;
  fieldName: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getMediaType(nodeType: string, fieldName: string): "video" | "audio" | "image" {
  if (fieldName.toLowerCase().includes("audio")) return "audio";
  if (fieldName.toLowerCase().includes("image") || fieldName.toLowerCase().includes("crop")) return "image";
  if (fieldName.toLowerCase().includes("video")) return "video";
  
  switch (nodeType) {
    case "seedream":
    case "crop-image":
      return "image";
    case "elevenlabs":
    case "extract-audio":
      return "audio";
    default:
      return "video";
  }
}

function getNodeIcon(nodeType: string) {
  switch (nodeType) {
    case "openrouter": return <Brain className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
    case "seedream": return <Image className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
    case "seedance": return <Film className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />;
    case "seedvr": return <Film className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />;
    case "lipsync": return <Mic className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    case "elevenlabs": return <Volume2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    case "crop-image": return <Crop className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
    case "merge-videos": return <Film className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />;
    case "merge-audio-video": return <Film className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />;
    case "extract-audio": return <Scissors className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    default: return <Zap className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />;
  }
}

function getNodeColor(nodeType: string): string {
  switch (nodeType) {
    case "openrouter": return "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/15 dark:to-blue-600/10 border-l-4 border-l-blue-500 border-y border-r border-blue-200 dark:border-blue-500/30";
    case "seedream": return "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/15 dark:to-emerald-600/10 border-l-4 border-l-emerald-500 border-y border-r border-emerald-200 dark:border-emerald-500/30";
    case "seedance": return "bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/15 dark:to-violet-600/10 border-l-4 border-l-violet-500 border-y border-r border-violet-200 dark:border-violet-500/30";
    case "seedvr": return "bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/15 dark:to-violet-600/10 border-l-4 border-l-violet-500 border-y border-r border-violet-200 dark:border-violet-500/30";
    case "lipsync": return "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/15 dark:to-amber-600/10 border-l-4 border-l-amber-500 border-y border-r border-amber-200 dark:border-amber-500/30";
    case "elevenlabs": return "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/15 dark:to-amber-600/10 border-l-4 border-l-amber-500 border-y border-r border-amber-200 dark:border-amber-500/30";
    case "crop-image": return "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/15 dark:to-emerald-600/10 border-l-4 border-l-emerald-500 border-y border-r border-emerald-200 dark:border-emerald-500/30";
    case "merge-videos": return "bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/15 dark:to-violet-600/10 border-l-4 border-l-violet-500 border-y border-r border-violet-200 dark:border-violet-500/30";
    case "merge-audio-video": return "bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/15 dark:to-violet-600/10 border-l-4 border-l-violet-500 border-y border-r border-violet-200 dark:border-violet-500/30";
    case "extract-audio": return "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/15 dark:to-amber-600/10 border-l-4 border-l-amber-500 border-y border-r border-amber-200 dark:border-amber-500/30";
    default: return "bg-gradient-to-r from-gray-50 to-slate-50 dark:from-zinc-500/15 dark:to-zinc-600/10 border-l-4 border-l-gray-400 border-y border-r border-gray-200 dark:border-zinc-500/30";
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

interface AssetManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
}

export function AssetManagerPanel({ 
  isOpen, 
  onClose,
  onNodeClick,
}: AssetManagerPanelProps) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "video" | "audio" | "image">("all");
  
  const storeNodes = useFlowStore((s) => s.nodes);

  const mediaAssets = useMemo<MediaAsset[]>(() => {
    const assets: MediaAsset[] = [];
    const mediaFields = [
      "result", "outputVideo", "outputAudio", "outputImage", 
      "croppedImage", "mergedVideo", "extractedAudio", 
      "generatedImage", "generatedVideo", "generatedAudio"
    ];
    
    storeNodes.forEach(node => {
      const data = node.data as Record<string, unknown>;
      const nodeDef = NODE_DEFINITIONS[node.type as AINodeType];
      const nodeName = (data.label as string) || nodeDef?.label || node.type;
      
      mediaFields.forEach(field => {
        const value = data[field];
        if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))) {
          const mediaType = getMediaType(node.type as string, field);
          assets.push({
            id: `${node.id}-${field}`,
            nodeId: node.id,
            nodeName,
            nodeType: node.type as string,
            type: mediaType,
            url: value,
            fieldName: field,
          });
        }
      });
    });
    
    return assets;
  }, [storeNodes]);

  const filteredAssets = useMemo(() => {
    if (filter === "all") return mediaAssets;
    return mediaAssets.filter(a => a.type === filter);
  }, [mediaAssets, filter]);

  const counts = useMemo(() => ({
    all: mediaAssets.length,
    video: mediaAssets.filter(a => a.type === "video").length,
    audio: mediaAssets.filter(a => a.type === "audio").length,
    image: mediaAssets.filter(a => a.type === "image").length,
  }), [mediaAssets]);

  const downloadAsset = async (asset: MediaAsset) => {
    setDownloadingId(asset.id);
    try {
      const response = await fetch(asset.url);
      const blob = await response.blob();
      const ext = asset.type === "video" ? "mp4" : asset.type === "audio" ? "mp3" : "png";
      const filename = `${asset.nodeName.replace(/\s+/g, "_")}_${asset.fieldName}.${ext}`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadAllAssets = async () => {
    if (filteredAssets.length === 0) return;
    setDownloadingAll(true);
    
    try {
      for (const asset of filteredAssets) {
        await downloadAsset(asset);
        await new Promise(r => setTimeout(r, 300));
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  const getMediaIcon = (type: "video" | "audio" | "image") => {
    switch (type) {
      case "video": return <FileVideo className="w-4 h-4 text-violet-600 dark:text-violet-400" />;
      case "audio": return <FileAudio className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "image": return <FileImage className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{ right: "16px" }}
          className="fixed top-16 z-50 w-[340px] bg-white dark:bg-black/60 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl border border-gray-200 dark:border-white/[0.08] overflow-hidden shadow-xl shadow-gray-200/80 dark:shadow-black/40 flex flex-col max-h-[calc(100vh-120px)]"
        >
          {/* Dot Pattern */}
          {/* Dots removed - now only on ReactFlow background */}

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500 dark:bg-gradient-to-br dark:from-purple-500/20 dark:to-purple-600/10 border border-purple-600 dark:border-purple-500/20 flex items-center justify-center">
                  <FolderOpen className="w-3.5 h-3.5 text-white dark:text-purple-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Asset Manager</span>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-500">{mediaAssets.length} file{mediaAssets.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter + Download All */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-white/[0.04] bg-white dark:bg-white/[0.01] shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center bg-gray-100 dark:bg-white/[0.03] rounded-lg p-0.5 border border-gray-200 dark:border-white/[0.04]">
                {(["all", "video", "audio", "image"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={cn(
                      "h-6 px-2 text-[9px] font-semibold rounded-md flex items-center gap-1 transition-all capitalize",
                      filter === type ? "bg-white dark:bg-white/[0.08] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
                    )}
                  >
                    {type === "all" ? "All" : type}
                    {counts[type] > 0 && (
                      <span className={cn(
                        "px-1.5 py-0.5 text-[7px] font-bold rounded-full min-w-[14px]",
                        type === "video" ? "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400" :
                        type === "audio" ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400" :
                        type === "image" ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" :
                        "bg-gray-200 dark:bg-zinc-700/50 text-gray-700 dark:text-zinc-300"
                      )}>
                        {counts[type]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              
              {filteredAssets.length > 0 && (
                <button
                  onClick={downloadAllAssets}
                  disabled={downloadingAll}
                  className="flex items-center gap-1 h-6 px-2 text-[9px] font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-100 dark:bg-blue-500/10 hover:bg-blue-200 dark:hover:bg-blue-500/15 border border-blue-300 dark:border-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {downloadingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                  All
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10">
            {filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center mb-3">
                  <Inbox className="w-5 h-5 text-gray-400 dark:text-zinc-600" />
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-400">No {filter === "all" ? "assets" : filter + "s"} yet</p>
                <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Run nodes to generate outputs</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAssets.map((asset, idx) => (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      "rounded-xl border overflow-hidden",
                      getNodeColor(asset.nodeType)
                    )}
                  >
                    <div className="p-3 flex items-center gap-3">
                      {/* Preview */}
                      <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-black/30 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200 dark:border-white/[0.06]">
                        {asset.type === "image" ? (
                          <img src={asset.url} alt="" className="w-full h-full object-cover" />
                        ) : asset.type === "video" ? (
                          <video src={asset.url} className="w-full h-full object-cover" muted />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-100 dark:from-amber-500/10 to-orange-100 dark:to-amber-600/5">
                            <Volume2 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                          </div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center bg-white dark:bg-transparent border border-gray-200 dark:border-transparent">
                            {getNodeIcon(asset.nodeType)}
                          </div>
                          <span className="text-[11px] font-semibold text-gray-800 dark:text-zinc-200 truncate">{asset.nodeName}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {getMediaIcon(asset.type)}
                          <span className="text-[9px] text-gray-600 dark:text-zinc-500 capitalize font-semibold">{asset.type}</span>
                          <span className="text-[9px] text-gray-400 dark:text-zinc-600">•</span>
                          <span className="text-[9px] text-gray-500 dark:text-zinc-600 truncate">{asset.fieldName}</span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onNodeClick?.(asset.nodeId)}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                          title="Focus node"
                        >
                          <Target className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => downloadAsset(asset)}
                          disabled={downloadingId === asset.id}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                          title="Download"
                        >
                          {downloadingId === asset.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-500 dark:text-zinc-500 flex items-center gap-1.5 font-medium">
                <Target className="w-3 h-3" />
                Click to focus source node
              </p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-600">
                {filteredAssets.length} of {mediaAssets.length}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
