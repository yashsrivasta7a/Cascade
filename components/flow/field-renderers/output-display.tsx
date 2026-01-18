"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Play, Pause, Volume2 } from "lucide-react";
import type { OutputConfig, OutputType } from "@/lib/config/types";

interface OutputDisplayProps {
  config: OutputConfig;
  value: unknown;
  isLoading?: boolean;
  className?: string;
}

// Placeholder for different media types - maintains height with text placeholder
function MediaSkeleton({ type, className }: { type: OutputType; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        "rounded-lg",
        className
      )}
    >
      <span className="text-[11px] text-gray-500 dark:text-zinc-600" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        Results will be shown here
      </span>
    </div>
  );
}

// Image display component
function ImageDisplay({ url, className }: { url: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Check for Transloadit URLs (they expire after 24h)
  const isTransloaditUrl = url?.includes("transloadit.com") || url?.includes("tlcdn.com") || url?.includes("tmp.transloadit");

  if (error) {
    // Check if it's likely an expired Transloadit URL
    if (isTransloaditUrl) {
      return (
        <div className={cn("flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 gap-1", className)}>
          <span className="text-[10px] text-amber-600 dark:text-amber-400">Image URL expired (24h limit)</span>
          <span className="text-[9px] text-amber-500 dark:text-amber-500/70">Re-run the node for fresh image</span>
        </div>
      );
    }
    return (
      <div className={cn("flex items-center justify-center bg-red-50 dark:bg-red-500/10 rounded-lg", className)}>
        <span className="text-[10px] text-red-500 dark:text-red-400">Failed to load image</span>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden bg-gray-100 dark:bg-white/[0.02]", className)}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-gray-400 dark:text-zinc-600 animate-spin" />
        </div>
      )}
      <img
        src={url}
        alt="Output"
        className={cn("w-full h-full object-contain transition-opacity", loaded ? "opacity-100" : "opacity-0")}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

// Video display component
function VideoDisplay({ url, className }: { url: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Check for Transloadit URLs (they expire after 24h)
  const isTransloaditUrl = url?.includes("transloadit.com") || url?.includes("tlcdn.com") || url?.includes("tmp.transloadit");

  if (error) {
    // Check if it's likely an expired Transloadit URL
    if (isTransloaditUrl) {
      return (
        <div className={cn("flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 gap-1", className)}>
          <span className="text-[10px] text-amber-600 dark:text-amber-400">Video URL expired (24h limit)</span>
          <span className="text-[9px] text-amber-500 dark:text-amber-500/70">Re-run the node for fresh video</span>
        </div>
      );
    }
    return (
      <div className={cn("flex items-center justify-center bg-red-50 dark:bg-red-500/10 rounded-lg", className)}>
        <span className="text-[10px] text-red-500 dark:text-red-400">Failed to load video</span>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden bg-gray-100 dark:bg-white/[0.02]", className)}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-gray-400 dark:text-zinc-600 animate-spin" />
        </div>
      )}
      <video
        src={url}
        controls
        className={cn("w-full h-full object-cover transition-opacity", loaded ? "opacity-100" : "opacity-0")}
        onLoadedData={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

// Format time in mm:ss format
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Audio display component with working controls
function AudioDisplay({ url, className }: { url: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Check for known problematic URLs (old mock URLs with CORS issues)
  const isProblematicUrl = url?.includes("www2.cs.uic.edu") || url?.includes("StarWars");
  
  // If URL is problematic, show error immediately
  if (isProblematicUrl) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 gap-1", className)}>
        <span className="text-[10px] text-amber-600 dark:text-amber-400">Audio from previous run</span>
        <span className="text-[9px] text-amber-500 dark:text-amber-500/70">Re-run the node for fresh audio</span>
      </div>
    );
  }

  // Check for Transloadit URLs (they expire after 24h)
  const isTransloaditUrl = url?.includes("transloadit.com") || url?.includes("tlcdn.com") || url?.includes("tmp.transloadit");

  // Handle play/pause toggle
  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn("[AudioDisplay] Play failed:", err);
      });
    }
  }, [playing]);

  // Handle progress bar click for seeking
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressRef.current;
    if (!audio || !progressBar || !duration) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audio.currentTime = Math.max(0, Math.min(newTime, duration));
  }, [duration]);

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    // Check if it's likely an expired Transloadit URL
    if (isTransloaditUrl) {
      return (
        <div className={cn("flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 gap-1", className)}>
          <span className="text-[10px] text-amber-600 dark:text-amber-400">Audio URL expired (24h limit)</span>
          <span className="text-[9px] text-amber-500 dark:text-amber-500/70">Re-run the node for fresh audio</span>
        </div>
      );
    }
    return (
      <div className={cn("flex items-center justify-center bg-red-50 dark:bg-red-500/10 rounded-lg p-3", className)}>
        <span className="text-[10px] text-red-500 dark:text-red-400">Failed to load audio</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        "bg-gray-50 dark:bg-white/[0.02] border border-gray-400 dark:border-white/10",
        className
      )}
    >
      {/* Play/Pause Button */}
      <button
        onClick={togglePlayPause}
        disabled={!loaded}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          "bg-amber-500 text-white hover:bg-amber-600 transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {!loaded ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      {/* Progress Bar */}
      <div className="flex-1 flex flex-col gap-1">
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden cursor-pointer group"
        >
          <div
            className="h-full bg-amber-500 transition-all duration-100 group-hover:bg-amber-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {/* Time Display */}
        <div className="flex justify-between text-[9px] text-gray-500 dark:text-zinc-500 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume Icon */}
      <Volume2 className="w-4 h-4 text-gray-400 dark:text-zinc-500 shrink-0" />

      {/* Hidden Audio Element - don't use crossOrigin as it breaks data URLs and some CDNs */}
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          setDuration(audio.duration);
          setLoaded(true);
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onError={(e) => {
          console.error("[AudioDisplay] Failed to load audio:", url?.slice(0, 100), e);
          setError(true);
        }}
        className="hidden"
      />
    </div>
  );
}

// Text display component
function TextDisplay({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 200;
  const displayText = isLong && !expanded ? text.slice(0, 200) + "..." : text;

  return (
    <div
      className={cn(
        "p-3 rounded-lg",
        "bg-gray-50 dark:bg-white/[0.02] border border-gray-400 dark:border-white/10",
        className
      )}
    >
      <p className="text-xs text-gray-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function OutputDisplayComponent({
  config,
  value,
  isLoading = false,
  className,
}: OutputDisplayProps) {
  // Extract URL or text from value
  const getMediaUrl = (): string | null => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      const v = value as Record<string, unknown>;
      // Check common output formats
      if (v.url) return v.url as string;
      if (v.image && typeof v.image === "object") return (v.image as { url?: string }).url || null;
      if (v.video && typeof v.video === "object") return (v.video as { url?: string }).url || null;
      if (v.audio && typeof v.audio === "object") return (v.audio as { url?: string }).url || null;
      if (v.text) return v.text as string;
    }
    return null;
  };

  const getText = (): string | null => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      const v = value as Record<string, unknown>;
      if (v.text) return v.text as string;
    }
    return null;
  };

  const mediaUrl = getMediaUrl();
  const text = getText();

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-4", className)}>
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
        <span className="text-[10px] text-gray-500 dark:text-zinc-500">Generating...</span>
      </div>
    );
  }

  // No value state
  if (!value || (!mediaUrl && !text)) {
    return (
      <MediaSkeleton
        type={config.type}
        className={cn(
          config.type === "image" && "aspect-square",
          config.type === "video" && "aspect-video",
          config.type === "audio" && "h-16",
          config.type === "text" && "h-20",
          className
        )}
      />
    );
  }

  // Render based on type
  switch (config.type) {
    case "image":
      return mediaUrl ? (
        <ImageDisplay url={mediaUrl} className={cn("aspect-square", className)} />
      ) : (
        <MediaSkeleton type="image" className={cn("aspect-square", className)} />
      );

    case "video":
      return mediaUrl ? (
        <VideoDisplay url={mediaUrl} className={cn("aspect-video", className)} />
      ) : (
        <MediaSkeleton type="video" className={cn("aspect-video", className)} />
      );

    case "audio":
      return mediaUrl ? (
        <AudioDisplay url={mediaUrl} className={className} />
      ) : (
        <MediaSkeleton type="audio" className={cn("h-16", className)} />
      );

    case "text":
      return text ? (
        <TextDisplay text={text} className={className} />
      ) : (
        <MediaSkeleton type="text" className={cn("h-20", className)} />
      );

    default:
      return (
        <div className={cn("p-3 bg-gray-100 dark:bg-white/[0.02] rounded-lg", className)}>
          <pre className="text-[10px] text-gray-600 dark:text-zinc-400 overflow-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      );
  }
}

export const OutputDisplay = memo(OutputDisplayComponent);
export { MediaSkeleton };
