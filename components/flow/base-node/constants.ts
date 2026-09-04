import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Square,
} from "lucide-react";
import type { NodeStatus } from "@/types/nodes";

/**
 * Node accent colours.
 *
 * These were Tailwind's 500-weights — fully saturated primaries. On a dark
 * canvas a dozen of those at once reads as noise rather than as a system, and
 * the accent bar sits at the top of every card, so it is the loudest element
 * on screen by area.
 *
 * These are the same hues pulled down in chroma and up in lightness: muted
 * enough to coexist a dozen at a time, still distinct enough to tell an image
 * node from an audio node at a glance. Category identity survives; the shouting
 * does not.
 */
export const accentColors: Record<string, string> = {
  cyan: "#7fc7d9",
  violet: "#a99bd6",
  emerald: "#8fc7a8",
  amber: "#e0be8a",
  rose: "#dda1ac",
  blue: "#93b4e0",
  zinc: "#9a9aa2",
  teal: "#8cc4bd",
};

// Status configuration with icons and colors - minimal dark theme
export const statusConfig: Record<NodeStatus, { 
  icon: typeof Circle; 
  color: string; 
  bgColor: string;
  label: string;
  animate?: boolean 
}> = {
  idle: { 
    icon: Circle, 
    color: "text-slate-700", 
    bgColor: "",
    label: "Ready" 
  },
  queued: { 
    icon: Clock, 
    color: "text-slate-600", 
    bgColor: "",
    label: "Queued" 
  },
  running: { 
    icon: Loader2, 
    color: "text-blue-400", 
    bgColor: "",
    label: "Running",
    animate: true 
  },
  completed: { 
    icon: CheckCircle2, 
    color: "text-emerald-400", 
    bgColor: "",
    label: "Done" 
  },
  failed: { 
    icon: AlertCircle, 
    color: "text-red-400", 
    bgColor: "",
    label: "Failed" 
  },
  cancelled: {
    icon: Square,
    color: "text-amber-400",
    bgColor: "",
    label: "Cancelled"
  },
};
