import { format } from "date-fns";
import {
 Loader2,
 CheckCircle2,
 XCircle,
 Clock,
 Zap,
 Image,
 Film,
 Volume2,
 Pause,
 Crop,
 Scissors,
 Mic,
 Brain,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Error explanations (user-facing)
// -----------------------------------------------------------------------------
export const errorSuggestions: Record<string, string> = {
 "Not Found": "The endpoint/model may not exist. Verify the model name and that the provider is available.",
 "Unauthorized": "Missing/invalid API key. Check your env vars (e.g. OPENROUTER_API_KEY, FAL_KEY).",
 "Rate limit": "You hit a rate limit. Wait a bit and retry.",
 "timeout": "The request took too long. Try smaller inputs or increase timeouts.",
 "ECONNREFUSED": "Could not reach the server. Check provider status/network.",
 "Invalid": "Your input is malformed. Ensure required fields exist and types match.",
 "quota": "You ran out of quota/credits at the provider. Check billing/limits.",
 "expected object, received undefined": "A required input is missing. Usually the parent node didn't run or produced no output.",
 "received undefined": "A required input is missing. Run upstream nodes first or connect the correct handle.",
 "Unexpected token": "The server returned non-JSON (often an HTML error page). This can happen on 413 Request Entity Too Large.",
 "Request Entity Too Large": "Your input is too big for the API route. Upload media to CDN/Transloadit or use smaller files.",
 "can't view images": "The selected LLM/model may not support vision, or the image URL isn't accessible.",
};

export function getSuggestion(errorMessage: string): string | undefined {
 const msg = (errorMessage || "").toLowerCase();
 for (const [pattern, suggestion] of Object.entries(errorSuggestions)) {
 if (msg.includes(pattern.toLowerCase())) return suggestion;
 }
 return undefined;
}

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

export function formatExactTime(dateStr: string): string {
 const date = new Date(dateStr);
 return date.toLocaleTimeString("en-US", { 
 hour: "2-digit", 
 minute: "2-digit",
 second: "2-digit",
 hour12: false 
 });
}

export function formatExactDate(dateStr: string): string {
 const date = new Date(dateStr);
 const today = new Date();
 const isToday = date.toDateString() === today.toDateString();
 
 if (isToday) return "Today";
 
 const yesterday = new Date(today);
 yesterday.setDate(yesterday.getDate() - 1);
 if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
 
 return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDurationMs(ms: number): string {
 if (ms < 1000) return `${ms}ms`;
 if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
 const mins = Math.floor(ms / 60000);
 const secs = Math.floor((ms % 60000) / 1000);
 return `${mins}m ${secs}s`;
}

export function formatCredits(credits?: number): string {
 if (credits === undefined || credits === null || credits === 0) return "0";
 if (credits >= 1000000) return `${(credits / 1000000).toFixed(2)}M`;
 if (credits >= 1000) return `${(credits / 1000).toFixed(1)}K`;
 if (credits < 1) return credits.toFixed(2);
 return credits.toLocaleString();
}

export function formatVersionTime(dateStr: string): string {
 const date = new Date(dateStr);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 
 if (diffMins < 1) return "Just now";
 if (diffMins < 60) return `${diffMins}m ago`;
 
 if (date.toDateString() === now.toDateString()) {
 return format(date, "h:mm a");
 }
 
 const yesterday = new Date(now);
 yesterday.setDate(yesterday.getDate() - 1);
 if (date.toDateString() === yesterday.toDateString()) {
 return `Yesterday ${format(date, "h:mm a")}`;
 }
 
 if (diffMs < 7 * 24 * 60 * 60 * 1000) {
 return format(date, "EEE h:mm a");
 }
 
 return format(date, "MMM d, h:mm a");
}

// =============================================================================
// NODE STYLING HELPERS
// =============================================================================

export function getNodeIcon(nodeType: string) {
 switch (nodeType) {
 case "openrouter": return <Brain className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
 case "seedream": return <Image className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />;
 case "seedance": return <Film className="w-3 h-3 text-violet-600 dark:text-violet-400" />;
 case "seedvr": return <Film className="w-3 h-3 text-violet-600 dark:text-violet-400" />;
 case "lipsync": return <Mic className="w-3 h-3 text-amber-600 dark:text-amber-400" />;
 case "elevenlabs": return <Volume2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />;
 case "crop-image": return <Crop className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />;
 case "merge-videos": return <Film className="w-3 h-3 text-violet-600 dark:text-violet-400" />;
 case "merge-audio-video": return <Film className="w-3 h-3 text-violet-600 dark:text-violet-400" />;
 case "extract-audio": return <Scissors className="w-3 h-3 text-amber-600 dark:text-amber-400" />;
 default: return <Zap className="w-3 h-3 text-slate-700 dark:text-zinc-400" />;
 }
}

export function getNodeColor(nodeType: string): string {
 switch (nodeType) {
 case "openrouter": return "bg-blue-100 dark:bg-blue-500/15";
 case "seedream": return "bg-emerald-100 dark:bg-emerald-500/15";
 case "seedance": return "bg-violet-100 dark:bg-violet-500/15";
 case "seedvr": return "bg-violet-100 dark:bg-violet-500/15";
 case "lipsync": return "bg-amber-100 dark:bg-amber-500/15";
 case "elevenlabs": return "bg-amber-100 dark:bg-amber-500/15";
 case "crop-image": return "bg-emerald-100 dark:bg-emerald-500/15";
 case "merge-videos": return "bg-violet-100 dark:bg-violet-500/15";
 case "merge-audio-video": return "bg-violet-100 dark:bg-violet-500/15";
 case "extract-audio": return "bg-amber-100 dark:bg-amber-500/15";
 default: return "bg-white dark:bg-zinc-500/15";
 }
}

// =============================================================================
// STATUS STYLES
// =============================================================================

export const statusStyles = {
 PENDING: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-slate-700 dark:text-zinc-400", bg: "bg-white dark:bg-zinc-500/15", border: "border-gray-300 dark:border-zinc-500/30", label: "Pending", cardBg: "bg-white dark:bg-zinc-900/40", accentBar: "bg-gray-400 dark:bg-zinc-500" },
 QUEUED: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-slate-700 dark:text-zinc-400", bg: "bg-white dark:bg-zinc-500/15", border: "border-gray-300 dark:border-zinc-500/30", label: "Queued", cardBg: "bg-white dark:bg-zinc-900/40", accentBar: "bg-gray-400 dark:bg-zinc-500" },
 RUNNING: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/15", border: "border-blue-300 dark:border-blue-500/30", label: "Running", cardBg: "bg-blue-50 dark:bg-blue-950/20", accentBar: "bg-blue-500 dark:bg-gradient-to-b dark:from-blue-400 dark:to-blue-600" },
 WAITING: { icon: <Pause className="w-3.5 h-3.5" />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/15", border: "border-amber-300 dark:border-amber-500/30", label: "Waiting", cardBg: "bg-amber-50 dark:bg-amber-950/20", accentBar: "bg-amber-500 dark:bg-gradient-to-b dark:from-amber-400 dark:to-amber-600" },
 COMPLETED: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/15", border: "border-emerald-300 dark:border-emerald-500/30", label: "Success", cardBg: "bg-emerald-50 dark:bg-emerald-950/20", accentBar: "bg-emerald-500 dark:bg-gradient-to-b dark:from-emerald-400 dark:to-emerald-600" },
 FAILED: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/15", border: "border-red-300 dark:border-red-500/30", label: "Failed", cardBg: "bg-red-50 dark:bg-red-950/20", accentBar: "bg-red-500 dark:bg-gradient-to-b dark:from-red-400 dark:to-red-600" },
 CANCELLED: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-500/15", border: "border-orange-300 dark:border-orange-500/30", label: "Cancelled", cardBg: "bg-orange-50 dark:bg-orange-950/20", accentBar: "bg-orange-500 dark:bg-gradient-to-b dark:from-orange-400 dark:to-orange-600" },
};
