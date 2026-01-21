"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface AudioPlayerState {
  /** Reference to the audio element */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Current playback time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Whether audio metadata has loaded */
  isLoaded: boolean;
  /** Progress as percentage (0-100) */
  progress: number;
}

export interface AudioPlayerControls {
  /** Toggle play/pause */
  toggle: (e?: React.MouseEvent) => void;
  /** Seek to a position based on click event on a progress bar element */
  seek: (e: React.MouseEvent<HTMLDivElement>, progressBarRef?: React.RefObject<HTMLDivElement | null>) => void;
  /** Reset playback to beginning */
  reset: () => void;
}

export type UseAudioPlayerReturn = AudioPlayerState & AudioPlayerControls;

/**
 * Hook for managing audio playback with all common controls.
 * Handles play/pause, seeking, progress tracking, and metadata loading.
 * 
 * @param src - The audio source URL
 * @returns Audio player state and controls
 * 
 * @example
 * ```tsx
 * const { audioRef, isPlaying, currentTime, duration, toggle, seek, progress, isLoaded } = useAudioPlayer(audioUrl);
 * 
 * return (
 *   <>
 *     <button onClick={toggle}>{isPlaying ? 'Pause' : 'Play'}</button>
 *     <div onClick={(e) => seek(e)} style={{ width: '100%', height: '4px', background: 'gray' }}>
 *       <div style={{ width: `${progress}%`, height: '100%', background: 'blue' }} />
 *     </div>
 *     <audio ref={audioRef} src={audioUrl} />
 *   </>
 * );
 * ```
 */
export function useAudioPlayer(src: string | null | undefined): UseAudioPlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset state when source changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoaded(false);
  }, [src]);

  // Toggle play/pause
  const toggle = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {
        // Handle autoplay restrictions silently
      });
    }
  }, [isPlaying]);

  // Seek to position based on click
  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>, progressBarRef?: React.RefObject<HTMLDivElement | null>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;

    // Use the provided ref or the event target
    const bar = progressBarRef?.current || e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    
    audio.currentTime = Math.max(0, Math.min(percentage * duration, duration));
  }, [duration]);

  // Reset to beginning
  const reset = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.pause();
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Event handlers to be attached to audio element
  // Note: These are exposed via state updates that the component can use
  // The component is responsible for attaching these to the audio element

  return {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    isLoaded,
    progress,
    toggle,
    seek,
    reset,
  };
}

/**
 * Audio element event handlers factory.
 * Use this to get the event handlers to attach to your audio element.
 * 
 * @example
 * ```tsx
 * const player = useAudioPlayer(src);
 * const handlers = createAudioHandlers(player);
 * 
 * return <audio ref={player.audioRef} {...handlers} />;
 * ```
 */
export function createAudioHandlers(
  setIsPlaying: (playing: boolean) => void,
  setCurrentTime: (time: number) => void,
  setDuration: (duration: number) => void,
  setIsLoaded: (loaded: boolean) => void
) {
  return {
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onEnded: () => {
      setIsPlaying(false);
      setCurrentTime(0);
    },
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLAudioElement>) => {
      setDuration(e.currentTarget.duration);
      setIsLoaded(true);
    },
    onTimeUpdate: (e: React.SyntheticEvent<HTMLAudioElement>) => {
      setCurrentTime(e.currentTarget.currentTime);
    },
  };
}

export default useAudioPlayer;
