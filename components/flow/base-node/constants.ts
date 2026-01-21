import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Square,
} from "lucide-react";
import type { NodeStatus } from "@/types/nodes";

// Color mapping for accent bars
export const accentColors: Record<string, string> = {
  cyan: "#06b6d4",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  blue: "#3b82f6",
  zinc: "#71717a",
  teal: "#14b8a6", // For audio nodes
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
    color: "text-zinc-500", 
    bgColor: "",
    label: "Ready" 
  },
  queued: { 
    icon: Clock, 
    color: "text-zinc-400", 
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
