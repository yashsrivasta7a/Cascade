"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Image as ImageIcon, Film, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// MEDIA LOADER - Shows loading state while media loads from CDN
// =============================================================================

interface MediaLoaderProps {
  src: string;
  type: "image" | "video";
  alt?: string;
  className?: string;
  containerClassName?: string;
  /** Callback when media is loaded */
  onLoad?: () => void;
  /** Callback when media fails to load */
  onError?: (error: string) => void;
  /** Show controls for video */
  controls?: boolean;
  /** Autoplay video */
  autoPlay?: boolean;
  /** Loop video */
  loop?: boolean;
  /** Mute video */
  muted?: boolean;
}

export function MediaLoader({
  src,
  type,
  alt = "Media",
  className,
  containerClassName,
  onLoad,
  onError,
  controls = true,
  autoPlay = false,
  loop = true,
  muted = true,
}: MediaLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

  // Reset loading state when src changes
  useEffect(() => {
    if (src) {
      setIsLoading(true);
      setHasError(false);
      setErrorMessage("");
    }
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    const msg = "Failed to load media";
    setErrorMessage(msg);
    onError?.(msg);
  };

  // Check if it's a data URL (base64) - these load instantly
  const isDataUrl = src?.startsWith("data:");
  const showLoader = isLoading && !isDataUrl && !hasError;

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {/* Loading State */}
      {showLoader && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
          {/* Animated shimmer background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>
          
          {/* Loading indicator */}
          <div className="relative flex flex-col items-center gap-2">
            <div className="relative">
              {/* Spinning ring */}
              <div className="w-10 h-10 rounded-full border-2 border-zinc-700 border-t-white/60 animate-spin" />
              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                {type === "image" ? (
                  <ImageIcon className="w-4 h-4 text-slate-700" />
                ) : (
                  <Film className="w-4 h-4 text-slate-700" />
                )}
              </div>
            </div>
            <span className="text-[10px] text-slate-700 font-medium animate-pulse">
              Loading {type}...
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
          <span className="text-[10px] text-red-400">{errorMessage}</span>
        </div>
      )}

      {/* Actual Media */}
      {type === "image" ? (
        <img
          ref={mediaRef as React.RefObject<HTMLImageElement>}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoading && !isDataUrl ? "opacity-0" : "opacity-100",
            className
          )}
        />
      ) : (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={src}
          controls={controls}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          playsInline
          onLoadedData={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoading && !isDataUrl ? "opacity-0" : "opacity-100",
            className
          )}
        />
      )}
    </div>
  );
}

// =============================================================================
// SIMPLE SKELETON LOADER - For use when no media src yet
// =============================================================================

interface MediaSkeletonProps {
  type?: "image" | "video";
  className?: string;
  message?: string;
}

export function MediaSkeleton({ 
  type = "image", 
  className,
  message = "No output yet"
}: MediaSkeletonProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800/50 rounded-lg",
      className
    )}>
      <div className="p-4 flex flex-col items-center gap-2">
        {type === "image" ? (
          <ImageIcon className="w-6 h-6 text-slate-800" />
        ) : (
          <Film className="w-6 h-6 text-slate-800" />
        )}
        <span className="text-[10px] text-slate-700">{message}</span>
      </div>
    </div>
  );
}
