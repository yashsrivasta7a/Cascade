"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Film,
  Volume2,
  Play,
  Pause,
  Plus,
  ArrowRightLeft,
  Type,
} from "lucide-react";
import { useFlowStore } from "@/store";
import { dataTypeColors, type DataType } from "@/types/nodes";
import { showError, showWarning } from "@/lib/toast";

// =============================================================================
// TYPES
// =============================================================================

type InputType = "image" | "video" | "audio" | "text";

export interface InputNodeData {
  label: string;
  value?: string | null;
  mediaType?: InputType | null;
  [key: string]: unknown;
}

// Format time in mm:ss format
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Input type configuration
const inputTypeConfig: Record<InputType, {
  icon: typeof ImageIcon;
  accept?: string;
  color: string;
  label: string;
  maxSize?: number;
  isFile: boolean;
}> = {
  text: {
    icon: Type,
    color: "#3b82f6", // blue
    label: "Text",
    isFile: false,
  },
  image: {
    icon: ImageIcon,
    accept: "image/*",
    color: "#10b981", // emerald
    label: "Image",
    maxSize: 15 * 1024 * 1024,
    isFile: true,
  },
  video: {
    icon: Film,
    accept: "video/*",
    color: "#8b5cf6", // violet
    label: "Video",
    maxSize: 50 * 1024 * 1024,
    isFile: true,
  },
  audio: {
    icon: Volume2,
    accept: "audio/*",
    color: "#14b8a6", // teal
    label: "Audio",
    maxSize: 50 * 1024 * 1024,
    isFile: true,
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

function InputNodeComponent({ data, selected, id }: NodeProps<InputNodeData>) {
  const updateNode = useFlowStore((s) => s.updateNode);
  const propagateOutput = useFlowStore((s) => s.propagateOutput);
  const setNodeUploading = useFlowStore((s) => s.setNodeUploading);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);

  // Check dark mode
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

  const inputType = data.mediaType;
  const value = data.value;
  const config = inputType ? inputTypeConfig[inputType] : null;
  const handleColor = inputType ? dataTypeColors[inputType as DataType] : dataTypeColors.any;
  const accentColor = config?.color || "#71717a"; // zinc as default

  // Toggle audio playback
  const toggleAudioPlayback = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (audioPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn("[InputNode] Audio play failed:", err);
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

  // Reset audio state when value changes
  useEffect(() => {
    setAudioPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioLoaded(false);
  }, [value]);

  // Handle type selection
  const handleTypeSelect = useCallback((type: InputType) => {
    updateNode(id, { mediaType: type, label: `${type.toUpperCase()} INPUT` });
    setShowTypeSelector(false);
  }, [id, updateNode]);

  // Handle text input change
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      updateNode(id, { value: text, result: text });
      propagateOutput(id, text);
    },
    [id, updateNode, propagateOutput]
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file || !inputType || !config || !config.isFile) return;

      // Check file type
      if (config.accept && !file.type.match(config.accept.replace("/*", "/.*"))) {
        showWarning(`Invalid file type`, {
          description: `Please select a ${inputType} file. Got: ${file.type || "unknown"}`,
        });
        return;
      }

      // Check file size
      if (config.maxSize && file.size > config.maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxMB = (config.maxSize / (1024 * 1024)).toFixed(0);
        showError(`File too large (${sizeMB}MB)`, {
          description: `Maximum file size is ${maxMB}MB.`,
        });
        return;
      }

      setIsUploading(true);
      setNodeUploading(id, true);

      try {
        // For files > 3MB, use direct upload to Transloadit
        if (file.size > 3 * 1024 * 1024) {
          const signResponse = await fetch("/api/media/upload-direct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: inputType }),
          });

          if (!signResponse.ok) {
            showError("Upload failed", {
              description: "Could not initialize upload. Please try again.",
            });
            setIsUploading(false);
            setNodeUploading(id, false);
            return;
          }

          const { params, signature } = await signResponse.json();

          const formData = new FormData();
          formData.append("params", params);
          formData.append("signature", signature);
          formData.append("file", file);

          const uploadResponse = await fetch(
            "https://api2.transloadit.com/assemblies",
            { method: "POST", body: formData }
          );

          const result = await uploadResponse.json();

          if (result.error || uploadResponse.status >= 400) {
            showError("Upload failed", {
              description: result.message || result.error || "Unknown error",
            });
            setIsUploading(false);
            setNodeUploading(id, false);
            return;
          }

          // Poll for completion
          const assemblyUrl = result.assembly_ssl_url || result.assembly_url;
          let attempts = 0;
          const maxAttempts = 60;

          while (attempts < maxAttempts) {
            const statusResponse = await fetch(assemblyUrl);
            const status = await statusResponse.json();

            if (status.ok === "ASSEMBLY_COMPLETED") {
              const uploadedFile =
                status.results?.passthrough?.[0] ||
                status.uploads?.[0] ||
                status.results?.[":original"]?.[0];
              const fileUrl = uploadedFile?.ssl_url || uploadedFile?.url;
              if (fileUrl) {
                updateNode(id, { value: fileUrl, result: fileUrl });
                propagateOutput(id, fileUrl);
                setIsUploading(false);
                setNodeUploading(id, false);
                return;
              }
            } else if (status.ok === "ASSEMBLY_CANCELED" || status.error) {
              showError("Upload failed", {
                description: status.message || status.error || "Processing failed",
              });
              setIsUploading(false);
              setNodeUploading(id, false);
              return;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
            attempts++;
          }

          showError("Upload timed out", {
            description: "Please try again with a smaller file.",
          });
          setIsUploading(false);
          setNodeUploading(id, false);
          return;
        }

        // For smaller files, use base64 upload
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;

          try {
            const response = await fetch("/api/media/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dataUrl: base64,
                type: inputType,
                filename: file.name,
              }),
            });

            if (response.ok) {
              const { url } = await response.json();
              updateNode(id, { value: url, result: url });
              propagateOutput(id, url);
            } else {
              // Fallback to base64
              updateNode(id, { value: base64, result: base64 });
              propagateOutput(id, base64);
            }
          } catch {
            // Fallback to base64
            updateNode(id, { value: base64, result: base64 });
            propagateOutput(id, base64);
          }

          setIsUploading(false);
          setNodeUploading(id, false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("[InputNode] Error uploading file:", err);
        setIsUploading(false);
        setNodeUploading(id, false);
      }
    },
    [config, inputType, id, updateNode, propagateOutput, setNodeUploading]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateNode(id, { value: null, result: null });
    },
    [id, updateNode]
  );

  const handleReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateNode(id, { value: null, result: null, mediaType: null, label: "Input" });
    },
    [id, updateNode]
  );

  const nodeBgColor = isDarkMode ? "#161616" : "#ffffff";
  const borderColor = selected ? accentColor : isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.1)";

  // If no input type selected, show the type selector
  if (!inputType) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className={cn(
          "relative w-[200px] rounded-xl overflow-visible",
          "shadow-lg"
        )}
        style={{
          backgroundColor: nodeBgColor,
          border: `${selected ? 2 : 1}px solid ${borderColor}`,
        }}
      >
        {/* Accent bar */}
        <div
          className="h-1 w-full rounded-t-xl bg-gradient-to-r from-blue-500 via-emerald-500 via-violet-500 to-teal-500"
        />

        {/* Header */}
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-zinc-500" />
            <span
              className="text-xs font-medium text-zinc-800 dark:text-white/80"
              style={{ fontFamily: "Inter, system-ui, sans-serif" }}
            >
              {data.label || "Input"}
            </span>
          </div>
        </div>

        {/* Type Selector Content */}
        <div className="px-3 pb-3">
          <div className="relative">
            {/* Plus Button to Toggle Type Menu */}
            <button
              onClick={() => setShowTypeSelector(!showTypeSelector)}
              className={cn(
                "w-full py-4 rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2",
                showTypeSelector
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                  : "border-zinc-300 dark:border-white/20 bg-zinc-50 dark:bg-white/[0.02] hover:border-zinc-400 dark:hover:border-white/30"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                showTypeSelector
                  ? "bg-blue-500 text-white rotate-45"
                  : "bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-zinc-400"
              )}>
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {showTypeSelector ? "Select type" : "Add Input"}
              </span>
            </button>

            {/* Type Selection Dropdown */}
            <AnimatePresence>
              {showTypeSelector && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-white/10 shadow-xl overflow-hidden z-50"
                >
                  {(["text", "image", "video", "audio"] as InputType[]).map((type) => {
                    const typeConfig = inputTypeConfig[type];
                    const Icon = typeConfig.icon;
                    return (
                      <button
                        key={type}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTypeSelect(type);
                        }}
                        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${typeConfig.color}20` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: typeConfig.color }} />
                        </div>
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {typeConfig.label}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Output Handle - Right side (shows "any" type until selected) */}
        <div
          className="absolute right-0 top-1/2 z-30"
          style={{ transform: "translate(50%, -50%)" }}
        >
          <Handle
            id="output"
            type="source"
            position={Position.Right}
            data-handletype="any"
            style={{
              position: "relative",
              width: 12,
              height: 12,
              borderWidth: 0,
              backgroundColor: handleColor.solid,
            }}
            className="!relative !right-0 !top-0 !transform-none"
          />
        </div>
      </motion.div>
    );
  }

  // Input type is selected - show the appropriate input UI
  const InputIcon = config!.icon;

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className={cn(
        "relative w-[200px] rounded-xl overflow-visible",
        "shadow-lg"
      )}
      style={{
        backgroundColor: nodeBgColor,
        border: `${selected ? 2 : 1}px solid ${borderColor}`,
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
          <InputIcon className="w-4 h-4" style={{ color: accentColor }} />
          <span
            className="text-xs font-medium text-zinc-800 dark:text-white/80"
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}
          >
            {data.label || `${inputType.toUpperCase()} INPUT`}
          </span>
        </div>
        {/* Reset button - allows changing type */}
        {!value && (
          <button
            onClick={handleReset}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
            title="Change input type"
          >
            <X className="w-3 h-3 text-zinc-500" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        {/* Text Input */}
        {inputType === "text" ? (
          <div className="relative">
            <textarea
              value={value || ""}
              onChange={handleTextChange}
              placeholder="Enter text..."
              className={cn(
                "nodrag nowheel w-full h-20 px-2.5 py-2 rounded-lg text-xs resize-none",
                "bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10",
                "text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
                "focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-400/20",
                "transition-all"
              )}
            />
            {value && (
              <button
                onClick={handleClear}
                className="absolute top-1.5 right-1.5 p-1 bg-zinc-200 dark:bg-white/10 rounded hover:bg-zinc-300 dark:hover:bg-white/20 transition-colors"
              >
                <X className="w-3 h-3 text-zinc-500" />
              </button>
            )}
          </div>
        ) : (
          /* File Input (Image, Video, Audio) */
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={config!.accept}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />

            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => !value && !isUploading && fileInputRef.current?.click()}
              className={cn(
                "nodrag nowheel relative rounded-lg border-2 border-dashed transition-all",
                isDragOver
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                  : value
                  ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5"
                  : "border-gray-500 dark:border-white/20 bg-white dark:bg-white/[0.02] hover:border-gray-600 dark:hover:border-white/30 cursor-pointer"
              )}
            >
              {isUploading ? (
                <div className="flex flex-col items-center justify-center py-6 text-blue-500 dark:text-blue-400">
                  <Loader2 className="w-6 h-6 mb-2 animate-spin" />
                  <span className="text-[10px]">Uploading...</span>
                </div>
              ) : value ? (
                <div className="relative p-1">
                  {/* Image preview */}
                  {inputType === "image" && (
                    <img
                      src={value}
                      alt="Preview"
                      className="w-full h-20 object-cover rounded"
                    />
                  )}

                  {/* Video preview */}
                  {inputType === "video" && (
                    <video
                      src={value}
                      className="w-full h-20 object-cover rounded"
                      muted
                    />
                  )}

                  {/* Audio player */}
                  {inputType === "audio" && (
                    <div className="flex items-center gap-2 p-2">
                      <button
                        onClick={toggleAudioPlayback}
                        disabled={!audioLoaded}
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                          "bg-teal-500 text-white hover:bg-teal-600 transition-colors",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {!audioLoaded ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : audioPlaying ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 ml-0.5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div
                          onClick={handleAudioSeek}
                          className="h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden cursor-pointer"
                        >
                          <div
                            className="h-full bg-teal-500 transition-all duration-100"
                            style={{
                              width: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[8px] text-gray-500 dark:text-zinc-500 font-mono mt-0.5">
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
                        className="hidden"
                      />
                    </div>
                  )}

                  {/* Clear button */}
                  <button
                    onClick={handleClear}
                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-gray-500 dark:text-zinc-500">
                  <Upload className="w-6 h-6 mb-2" />
                  <span className="text-[10px]">
                    Drop {inputType} or click
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Output Handle - Right side */}
      <div
        className="absolute right-0 top-1/2 z-30"
        style={{ transform: "translate(50%, -50%)" }}
      >
        <Handle
          id="output"
          type="source"
          position={Position.Right}
          data-handletype={inputType}
          style={{
            position: "relative",
            width: 12,
            height: 12,
            borderWidth: 0,
            backgroundColor: handleColor.solid,
          }}
          className="!relative !right-0 !top-0 !transform-none"
        />
      </div>
    </motion.div>
  );
}

export const InputNode = memo(InputNodeComponent);
export default InputNode;
