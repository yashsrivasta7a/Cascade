"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Upload, X, Loader2, Image as ImageIcon, Film, Volume2, Play, Pause } from "lucide-react";
import type { FileFieldConfig } from "@/lib/config/types";
import { showError, showWarning } from "@/lib/toast";

// Format time in mm:ss format
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export interface CropOverlay {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

// Separate component for image preview with crop overlay
// This ensures the overlay is positioned relative to the actual image, not the container
function CropPreview({ 
  src, 
  cropOverlay, 
  maxHeight = 160 
}: { 
  src: string; 
  cropOverlay?: CropOverlay;
  maxHeight?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageBounds, setImageBounds] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  // Calculate actual image bounds within container after load
  // This accounts for object-contain behavior where the actual rendered image
  // may be smaller than the element's bounding box due to aspect ratio
  const updateImageBounds = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    // Calculate the actual rendered image size with object-contain
    // The image element might be larger than the visible image due to aspect ratio
    const naturalAspect = img.naturalWidth / img.naturalHeight;
    const elementAspect = imgRect.width / imgRect.height;
    
    let renderedWidth: number;
    let renderedHeight: number;
    let offsetX = 0;
    let offsetY = 0;
    
    if (naturalAspect > elementAspect) {
      // Image is wider than element - constrained by width, letterboxed vertically
      renderedWidth = imgRect.width;
      renderedHeight = imgRect.width / naturalAspect;
      offsetY = (imgRect.height - renderedHeight) / 2;
    } else {
      // Image is taller than element - constrained by height, pillarboxed horizontally
      renderedHeight = imgRect.height;
      renderedWidth = imgRect.height * naturalAspect;
      offsetX = (imgRect.width - renderedWidth) / 2;
    }

    // Calculate the actual rendered position of the image within the container
    setImageBounds({
      left: imgRect.left - containerRect.left + offsetX,
      top: imgRect.top - containerRect.top + offsetY,
      width: renderedWidth,
      height: renderedHeight,
    });
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Update bounds when image loads
    if (img.complete) {
      updateImageBounds();
    }
    img.addEventListener('load', updateImageBounds);
    
    // Also update on resize
    const observer = new ResizeObserver(updateImageBounds);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      img.removeEventListener('load', updateImageBounds);
      observer.disconnect();
    };
  }, [src, updateImageBounds]);

  // Clamp values to stay within bounds
  const x = cropOverlay ? Math.min(Math.max(0, cropOverlay.xPercent), 100) : 0;
  const y = cropOverlay ? Math.min(Math.max(0, cropOverlay.yPercent), 100) : 0;
  const w = cropOverlay ? Math.min(Math.max(1, cropOverlay.widthPercent), 100 - x) : 100;
  const h = cropOverlay ? Math.min(Math.max(1, cropOverlay.heightPercent), 100 - y) : 100;

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden rounded bg-black/20"
      style={{ maxHeight }}
    >
      <img
        ref={imgRef}
        src={src}
        alt="Preview"
        className="w-full h-auto object-contain"
        style={{ maxHeight }}
      />
      {/* Crop overlay - darkens areas that will be REMOVED, keeps crop area clear */}
      {cropOverlay && imageBounds && imageBounds.width > 0 && (
        <>
          {/* Dark overlay on areas that will be CROPPED OUT */}
          {/* Left side - will be removed */}
          <div 
            className="absolute bg-black/60 pointer-events-none"
            style={{
              left: imageBounds.left,
              top: imageBounds.top,
              width: (x / 100) * imageBounds.width,
              height: imageBounds.height,
            }}
          />
          {/* Right side - will be removed */}
          <div 
            className="absolute bg-black/60 pointer-events-none"
            style={{
              left: imageBounds.left + ((x + w) / 100) * imageBounds.width,
              top: imageBounds.top,
              width: ((100 - x - w) / 100) * imageBounds.width,
              height: imageBounds.height,
            }}
          />
          {/* Top - will be removed */}
          <div 
            className="absolute bg-black/60 pointer-events-none"
            style={{
              left: imageBounds.left + (x / 100) * imageBounds.width,
              top: imageBounds.top,
              width: (w / 100) * imageBounds.width,
              height: (y / 100) * imageBounds.height,
            }}
          />
          {/* Bottom - will be removed */}
          <div 
            className="absolute bg-black/60 pointer-events-none"
            style={{
              left: imageBounds.left + (x / 100) * imageBounds.width,
              top: imageBounds.top + ((y + h) / 100) * imageBounds.height,
              width: (w / 100) * imageBounds.width,
              height: ((100 - y - h) / 100) * imageBounds.height,
            }}
          />
          {/* Crop box border - this is what you'll GET */}
          <div 
            className="absolute border-2 border-amber-400 pointer-events-none"
            style={{
              left: imageBounds.left + (x / 100) * imageBounds.width,
              top: imageBounds.top + (y / 100) * imageBounds.height,
              width: (w / 100) * imageBounds.width,
              height: (h / 100) * imageBounds.height,
            }}
          >
            {/* Corner markers */}
            <div className="absolute -left-0.5 -top-0.5 w-2.5 h-2.5 border-l-2 border-t-2 border-amber-400" />
            <div className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 border-r-2 border-t-2 border-amber-400" />
            <div className="absolute -left-0.5 -bottom-0.5 w-2.5 h-2.5 border-l-2 border-b-2 border-amber-400" />
            <div className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 border-r-2 border-b-2 border-amber-400" />
          </div>
          {/* Crop dimensions label - positioned at bottom of crop box */}
          <div 
            className="absolute text-[8px] font-mono text-white bg-amber-500/90 px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap shadow-sm"
            style={{
              left: imageBounds.left + (x / 100) * imageBounds.width + ((w / 100) * imageBounds.width) / 2,
              top: imageBounds.top + ((y + h) / 100) * imageBounds.height - 2,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {Math.round(w)}% × {Math.round(h)}%
          </div>
        </>
      )}
    </div>
  );
}

interface FileFieldProps {
  config: FileFieldConfig;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  /** Called when upload state changes - use to disable run button during uploads */
  onUploadingChange?: (uploading: boolean) => void;
  /** Optional crop overlay to show what area will be cropped */
  cropOverlay?: CropOverlay;
  /** Whether this field has an incoming connection */
  isConnected?: boolean;
  /** The value from the connected upstream node (for preview) */
  connectedValue?: string | null;
}

function FileFieldComponent({
  config,
  value,
  onChange,
  disabled = false,
  className,
  onUploadingChange,
  cropOverlay,
  isConnected = false,
  connectedValue,
}: FileFieldProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Audio playback state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);

  // Toggle audio play/pause
  const toggleAudioPlayback = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (audioPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn("[FileField] Audio play failed:", err);
      });
    }
  }, [audioPlaying]);

  // Handle audio progress bar click
  const handleAudioSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !audioDuration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audio.currentTime = Math.max(0, Math.min(percentage * audioDuration, audioDuration));
  }, [audioDuration]);

  // Reset audio state when value changes
  useEffect(() => {
    setAudioPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioLoaded(false);
  }, [value]);

  // Determine file type from accept string
  const fileType = config.accept?.includes("image")
    ? "image"
    : config.accept?.includes("video")
    ? "video"
    : config.accept?.includes("audio")
    ? "audio"
    : "file";

  const FileIcon = fileType === "image" ? ImageIcon : fileType === "video" ? Film : Volume2;

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file) return;

      // Check file type
      if (config.accept && !file.type.match(config.accept.replace("/*", "/.*"))) {
        showWarning(`Invalid file type`, {
          description: `Please select a ${fileType} file. Got: ${file.type || "unknown"}`,
        });
        return;
      }

      // Check file size - increased to 50MB for video/audio
      const maxSize = config.maxSize ?? 50 * 1024 * 1024; // 50MB default
      if (file.size > maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
        showError(`File too large (${sizeMB}MB)`, {
          description: `Maximum file size is ${maxMB}MB. Try compressing the file or using a smaller one.`,
        });
        return;
      }

      setIsUploading(true);
      onUploadingChange?.(true);

      try {
        const sizeMB = file.size / (1024 * 1024);
        console.log(`[FileField] Uploading ${fileType} file: ${file.name} (${sizeMB.toFixed(2)}MB)`);

        // For files > 3MB, use direct upload to Transloadit (bypasses Vercel limit)
        // NO FALLBACK for large files - base64 will always fail with 413
        if (file.size > 3 * 1024 * 1024) {
          console.log(`[FileField] File > 3MB, using direct Transloadit upload (no fallback)`);
          
          try {
            // Get upload signature from our API
            const signResponse = await fetch("/api/media/upload-direct", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: fileType }),
            });

            if (!signResponse.ok) {
              const errorText = await signResponse.text();
              console.error(`[FileField] Failed to get upload signature:`, errorText);
              showError("Upload failed", {
                description: "Could not initialize upload. Please try again.",
              });
              setIsUploading(false);
              onUploadingChange?.(false);
              return;
            }

            const { params, signature } = await signResponse.json();
            
            // Log params for debugging (hide sensitive parts)
            try {
              const parsedParams = JSON.parse(params);
              console.log(`[FileField] Transloadit params:`, {
                auth: { key: parsedParams.auth?.key?.slice(0, 8) + "...", expires: parsedParams.auth?.expires },
                steps: Object.keys(parsedParams.steps || {}),
              });
              console.log(`[FileField] Signature prefix:`, signature?.slice(0, 15));
            } catch {
              console.log(`[FileField] Raw params:`, params?.slice(0, 100));
            }
            
            // Upload directly to Transloadit
            const formData = new FormData();
            formData.append("params", params);
            formData.append("signature", signature);
            formData.append("file", file);

            console.log(`[FileField] Uploading to Transloadit (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
            const uploadResponse = await fetch(`https://api2.transloadit.com/assemblies`, {
              method: "POST",
              body: formData,
            });

            // Log full response for debugging
            const responseText = await uploadResponse.text();
            console.log(`[FileField] Transloadit response status:`, uploadResponse.status);
            console.log(`[FileField] Transloadit response:`, responseText.slice(0, 500));
            
            let result;
            try {
              result = JSON.parse(responseText);
            } catch {
              console.error(`[FileField] Failed to parse Transloadit response`);
              showError("Upload failed", {
                description: "Invalid response from server. Please try again.",
              });
              setIsUploading(false);
              onUploadingChange?.(false);
              return;
            }

            if (result.error || uploadResponse.status >= 400) {
              console.error(`[FileField] Transloadit error:`, result.error, result.message, result.reason);
              showError("Upload failed", {
                description: result.message || result.error || "Unknown error occurred",
              });
              setIsUploading(false);
              onUploadingChange?.(false);
              return;
            }

            console.log(`[FileField] Transloadit assembly created:`, result.assembly_id);
            
            // Poll for completion (Transloadit processes async)
            const assemblyUrl = result.assembly_ssl_url || result.assembly_url;
            let attempts = 0;
            const maxAttempts = 60; // 60 seconds max
            
            while (attempts < maxAttempts) {
              const statusResponse = await fetch(assemblyUrl);
              const status = await statusResponse.json();
              
              console.log(`[FileField] Assembly status (${attempts}):`, status.ok);
              
              if (status.ok === "ASSEMBLY_COMPLETED") {
                // Get the uploaded file URL - try multiple locations
                // Order: passthrough results > uploads > :original results
                const uploadedFile = 
                  status.results?.passthrough?.[0] ||
                  status.uploads?.[0] ||
                  status.results?.[":original"]?.[0];
                  
                const fileUrl = uploadedFile?.ssl_url || uploadedFile?.url;
                if (fileUrl) {
                  console.log(`[FileField] Direct upload complete: ${fileUrl.slice(0, 80)}...`);
                  onChange(fileUrl);
                  setIsUploading(false);
                  onUploadingChange?.(false);
                  return;
                } else {
                  console.error(`[FileField] No URL in completed assembly. Results:`, JSON.stringify(status.results), "Uploads:", JSON.stringify(status.uploads));
                }
              } else if (status.ok === "ASSEMBLY_CANCELED" || status.error) {
                console.error(`[FileField] Transloadit assembly failed:`, status.error || status.message);
                showError("Upload failed", {
                  description: status.message || status.error || "Assembly processing failed",
                });
                setIsUploading(false);
                onUploadingChange?.(false);
                return;
              }
              
              // Wait 1 second before polling again
              await new Promise(resolve => setTimeout(resolve, 1000));
              attempts++;
            }
            
            console.error(`[FileField] Direct upload timed out`);
            showError("Upload timed out", {
              description: "The upload took too long. Please try again with a smaller file.",
            });
            setIsUploading(false);
            onUploadingChange?.(false);
            return;
          } catch (err) {
            console.error("[FileField] Direct upload failed:", err);
            showError("Upload failed", {
              description: err instanceof Error ? err.message : "Unknown error occurred",
            });
            setIsUploading(false);
            onUploadingChange?.(false);
            return;
          }
        }

        // For smaller files or as fallback, use base64 through our API
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;

          // Try to upload to CDN for persistence
          try {
            const response = await fetch("/api/media/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dataUrl: base64,
                type: fileType,
                filename: file.name,
              }),
            });

            if (response.ok) {
              const { url } = await response.json();
              onChange(url);
              setIsUploading(false);
              onUploadingChange?.(false);
              return;
            } else {
              console.warn(`[FileField] CDN upload failed (${response.status}):`, await response.text());
            }
          } catch (err) {
            console.warn("[FileField] CDN upload failed, using base64:", err);
          }

          // Fallback to base64 if CDN upload fails
          console.log(`[FileField] Using base64 fallback (${(base64.length / 1024 / 1024).toFixed(2)}MB)`);
          onChange(base64);
          setIsUploading(false);
          onUploadingChange?.(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("[FileField] Error reading file:", err);
        setIsUploading(false);
        onUploadingChange?.(false);
      }
    },
    [config.accept, config.maxSize, fileType, onChange, onUploadingChange]
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

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  return (
    <div className={className}>
      {/* Label */}
      {config.label && (
        <label className="block text-[10px] text-gray-600 dark:text-zinc-500 mb-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {config.label}
          {config.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={config.accept}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Use connected value for preview if connected and no manual value */}
      {(() => {
        const displayValue = value || (isConnected ? connectedValue : null);
        const hasConnectedPreview = isConnected && connectedValue && !value;
        
        return (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => !displayValue && !disabled && fileInputRef.current?.click()}
            className={cn(
              "nodrag nowheel relative rounded-lg border-2 border-dashed transition-all",
              isDragOver
                ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                : hasConnectedPreview
                ? "border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/5"
                : displayValue
                ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5"
                : isConnected
                ? "border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/5"
                : "border-gray-500 dark:border-white/20 bg-white dark:bg-white/[0.02] hover:border-gray-600 dark:hover:border-white/30",
              !displayValue && !disabled && !isConnected && "cursor-pointer"
            )}
          >
            {/* Connected indicator badge */}
            {isConnected && (
              <div className="absolute top-1 right-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30">
                <span className="text-[8px] text-violet-600 dark:text-violet-400 font-medium">
                  {connectedValue ? "Linked" : "Waiting..."}
                </span>
              </div>
            )}
            
            {isUploading ? (
          <div className="flex flex-col items-center justify-center py-4 text-blue-500 dark:text-blue-400">
            <Loader2 className="w-5 h-5 mb-1 animate-spin" />
            <span className="text-[10px]">Uploading...</span>
          </div>
            ) : displayValue ? (
              <div className="relative p-1">
                {/* Preview with optional crop overlay */}
                {config.preview && fileType === "image" && (
                  <CropPreview 
                    src={displayValue} 
                    cropOverlay={cropOverlay}
                    maxHeight={cropOverlay ? 160 : 80}
                  />
                )}
                {config.preview && fileType === "video" && (
                  <video
                    src={displayValue}
                    className="w-full h-16 object-cover rounded"
                    muted
                  />
                )}
                {/* Audio player with controls */}
                {fileType === "audio" && (
                  <div className="flex items-center gap-2 p-2">
                    {/* Play/Pause button */}
                    <button
                      onClick={toggleAudioPlayback}
                      disabled={!audioLoaded}
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                        "bg-amber-500 text-white hover:bg-amber-600 transition-colors",
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

                    {/* Progress bar and time */}
                    <div className="flex-1 min-w-0">
                      <div
                        onClick={handleAudioSeek}
                        className="h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden cursor-pointer"
                      >
                        <div
                          className="h-full bg-amber-500 transition-all duration-100"
                          style={{ width: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] text-gray-500 dark:text-zinc-500 font-mono mt-0.5">
                        <span>{formatTime(audioCurrentTime)}</span>
                        <span>{formatTime(audioDuration)}</span>
                      </div>
                    </div>

                    {/* Hidden audio element */}
                    <audio
                      ref={audioRef}
                      src={displayValue}
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
                      onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime)}
                      className="hidden"
                    />
                  </div>
                )}
                {/* Non-preview file display (not audio) */}
                {!config.preview && fileType !== "audio" && (
                  <div className="flex items-center gap-2 p-2">
                    <FileIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-[10px] text-gray-600 dark:text-zinc-400 truncate flex-1">
                      File selected
                    </span>
                  </div>
                )}

                {/* Clear button - only show for manual uploads, not connected values */}
                {!hasConnectedPreview && (
                  <button
                    onClick={handleClear}
                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
            ) : isConnected ? (
              <div className="flex flex-col items-center justify-center py-4 text-violet-500 dark:text-violet-400">
                <Loader2 className="w-5 h-5 mb-1 animate-spin" />
                <span className="text-[10px]">Waiting for input...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-gray-500 dark:text-zinc-500">
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-[10px]">
                  Drop {fileType} or click to upload
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Description */}
      {config.description && (
        <p className="mt-1 text-[9px] text-gray-400 dark:text-zinc-600">
          {config.description}
        </p>
      )}
    </div>
  );
}

export const FileField = memo(FileFieldComponent);
