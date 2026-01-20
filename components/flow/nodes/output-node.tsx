"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { cn } from "@/lib/utils";
import {
  Image as ImageIcon,
  Film,
  Volume2,
  FileText,
  Play,
  Pause,
  Loader2,
  Download,
  ExternalLink,
} from "lucide-react";
import { useFlowStore } from "@/store";
import { dataTypeColors } from "@/types/nodes";

// =============================================================================
// TYPES
// =============================================================================

export interface OutputNodeData {
  label: string;
  result?: string | null;
  detectedType?: "image" | "video" | "audio" | "text" | null;
  [key: string]: unknown;
}

// Format time in mm:ss format
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Detect content type from URL or data
function detectContentType(value: string): "image" | "video" | "audio" | "text" {
  if (!value) return "text";

  const lowerValue = value.toLowerCase();

  // Check for data URLs
  if (lowerValue.startsWith("data:image/")) return "image";
  if (lowerValue.startsWith("data:video/")) return "video";
  if (lowerValue.startsWith("data:audio/")) return "audio";

  // Check for common extensions
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(lowerValue)) return "image";
  if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(lowerValue)) return "video";
  if (/\.(mp3|wav|ogg|aac|m4a|flac)(\?|$)/i.test(lowerValue)) return "audio";

  // Check for CDN patterns
  if (lowerValue.includes("transloadit") || lowerValue.includes("edgly")) {
    if (lowerValue.includes("image") || lowerValue.includes(".jpg") || lowerValue.includes(".png")) return "image";
    if (lowerValue.includes("video") || lowerValue.includes(".mp4")) return "video";
    if (lowerValue.includes("audio") || lowerValue.includes(".mp3")) return "audio";
  }

  // If it's a URL, might be media - default to trying image first
  if (lowerValue.startsWith("http://") || lowerValue.startsWith("https://")) {
    // Could be any media type, we'll try to detect via loading
    return "image"; // Will fall back to text if loading fails
  }

  // Plain text
  return "text";
}

// =============================================================================
// COMPONENT
// =============================================================================

function OutputNodeComponent({ data, selected, id }: NodeProps<OutputNodeData>) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const updateNode = useFlowStore((s) => s.updateNode);

  // Find connected source node and get its result
  const connectedEdge = edges.find((e) => e.target === id && e.targetHandle === "input");
  const sourceNode = connectedEdge
    ? nodes.find((n) => n.id === connectedEdge.source)
    : null;
  const connectedResult = sourceNode?.data?.result as string | undefined;

  // Use connected result or own result
  const value = connectedResult || data.result;

  const [detectedType, setDetectedType] = useState<"image" | "video" | "audio" | "text">("text");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState(true);
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Detect type when value changes
  useEffect(() => {
    if (value) {
      const detected = detectContentType(value);
      setDetectedType(detected);
      setLoadError(false);
      updateNode(id, { detectedType: detected });
    } else {
      setDetectedType("text");
      updateNode(id, { detectedType: null });
    }
  }, [value, id, updateNode]);

  // Reset audio state when value changes
  useEffect(() => {
    setAudioPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioLoaded(false);
  }, [value]);

  // Toggle audio playback
  const toggleAudioPlayback = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (audioPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn("[OutputNode] Audio play failed:", err);
      });
    }
  }, [audioPlaying]);

  // Handle audio seek
  const handleAudioSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const audio = audioRef.current;
      if (!audio || !audioDuration) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      audio.currentTime = Math.max(
        0,
        Math.min(percentage * audioDuration, audioDuration)
      );
    },
    [audioDuration]
  );

  // Handle image load error - fallback to text
  const handleMediaError = useCallback(() => {
    setLoadError(true);
    setDetectedType("text");
  }, []);

  // Get icon based on detected type
  const TypeIcon =
    detectedType === "image"
      ? ImageIcon
      : detectedType === "video"
      ? Film
      : detectedType === "audio"
      ? Volume2
      : FileText;

  // Colors
  const accentColor = "#71717a"; // zinc
  const handleColor = dataTypeColors.any;
  const nodeBgColor = isDarkMode ? "#161616" : "#ffffff";
  const borderColor = selected ? accentColor : isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.1)";

  // Download handler
  const handleDownload = useCallback(() => {
    if (!value) return;
    const link = document.createElement("a");
    link.href = value;
    link.download = `output.${detectedType === "image" ? "png" : detectedType === "video" ? "mp4" : detectedType === "audio" ? "mp3" : "txt"}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [value, detectedType]);

  // Open in new tab
  const handleOpenExternal = useCallback(() => {
    if (!value) return;
    window.open(value, "_blank");
  }, [value]);

  return (
    <div
      className="relative w-[220px] rounded-xl overflow-visible"
      style={{
        backgroundColor: nodeBgColor,
        border: `${selected ? 2 : 1}px solid ${borderColor}`,
        boxShadow: isDarkMode 
          ? "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)"
          : "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Accent bar */}
      <div
        className="h-1 w-full rounded-t-xl"
        style={{ backgroundColor: accentColor }}
      />

      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeIcon className="w-4 h-4 text-zinc-500" />
          <span
            className="text-xs font-medium text-zinc-800 dark:text-white/80"
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}
          >
            {data.label || "OUTPUT"}
          </span>
        </div>

        {/* Action buttons */}
        {value && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownload}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              title="Download"
            >
              <Download className="w-3 h-3 text-zinc-500" />
            </button>
            <button
              onClick={handleOpenExternal}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        <div
          className={cn(
            "rounded-lg border transition-all overflow-hidden",
            value
              ? "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
              : "border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50"
          )}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-[10px]">Loading...</span>
            </div>
          ) : !value ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
              <TypeIcon className="w-6 h-6 mb-2 opacity-50" />
              <span className="text-[10px]">Waiting for output...</span>
            </div>
          ) : loadError || detectedType === "text" ? (
            // Text output
            <div className="p-3 max-h-[150px] overflow-auto">
              <p
                className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words"
                style={{ fontFamily: "Inter, system-ui, sans-serif" }}
              >
                {value.length > 500 ? value.slice(0, 500) + "..." : value}
              </p>
            </div>
          ) : detectedType === "image" ? (
            // Image output
            <img
              src={value}
              alt="Output"
              className="w-full h-auto max-h-[150px] object-contain"
              onError={handleMediaError}
              onLoad={() => setIsLoading(false)}
            />
          ) : detectedType === "video" ? (
            // Video output
            <video
              src={value}
              className="w-full h-auto max-h-[150px]"
              controls
              muted
              onError={handleMediaError}
            />
          ) : detectedType === "audio" ? (
            // Audio output
            <div className="flex items-center gap-2 p-3">
              <button
                onClick={toggleAudioPlayback}
                disabled={!audioLoaded}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  "bg-zinc-600 text-white hover:bg-zinc-700 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {!audioLoaded ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : audioPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div
                  onClick={handleAudioSeek}
                  className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden cursor-pointer"
                >
                  <div
                    className="h-full bg-zinc-500 transition-all duration-100"
                    style={{
                      width: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-zinc-500 font-mono mt-1">
                  <span>{formatTime(audioCurrentTime)}</span>
                  <span>{formatTime(audioDuration)}</span>
                </div>
              </div>

              <audio
                ref={audioRef}
                src={value}
                preload="metadata"
                onPlay={() => setAudioPlaying(true)}
                onPause={() => setAudioPlaying(false)}
                onEnded={() => {
                  setAudioPlaying(false);
                  setAudioCurrentTime(0);
                }}
                onLoadedMetadata={(e) => {
                  setAudioDuration(e.currentTarget.duration);
                  setAudioLoaded(true);
                }}
                onTimeUpdate={(e) =>
                  setAudioCurrentTime(e.currentTarget.currentTime)
                }
                onError={handleMediaError}
                className="hidden"
              />
            </div>
          ) : null}
        </div>

        {/* Type indicator */}
        {value && !loadError && (
          <div className="mt-2 flex items-center justify-center gap-1">
            <TypeIcon className="w-3 h-3 text-zinc-400" />
            <span className="text-[9px] text-zinc-400 uppercase">
              {detectedType}
            </span>
          </div>
        )}
      </div>

      {/* Input Handle - Left side */}
      <div
        className="absolute left-0 top-1/2 z-30"
        style={{ transform: "translate(-50%, -50%)" }}
      >
        <Handle
          id="input"
          type="target"
          position={Position.Left}
          data-handletype="any"
          style={{
            position: "relative",
            width: 12,
            height: 12,
            borderWidth: 0,
            backgroundColor: handleColor.solid,
          }}
          className="!relative !left-0 !top-0 !transform-none"
        />
      </div>
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
export default OutputNode;
