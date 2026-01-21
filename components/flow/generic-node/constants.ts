import {
  Image as ImageIcon,
  Film,
  Volume2,
  Brain,
  Wrench,
  ArrowRightLeft,
} from "lucide-react";

// =============================================================================
// ICON MAPPING (based on category)
// =============================================================================

export const categoryIcons = {
  image: ImageIcon,
  video: Film,
  audio: Volume2,
  llm: Brain,
  utility: Wrench,
  io: ArrowRightLeft,
};

// Node types that use async (Trigger.dev/fal.ai) execution
export const ASYNC_NODE_TYPES = ["seedream", "seedvr", "seedance", "elevenlabs", "lipsync"];

// Node types that run locally/synchronously
export const LOCAL_NODE_TYPES = ["crop-image", "merge-audio-video", "merge-videos", "extract-audio"];
