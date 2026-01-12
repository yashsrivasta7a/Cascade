"use client";

import { useState, useMemo } from "react";
import {
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Trash2,
  RefreshCw,
  Search,
  Copy,
  Check,
  Bug,
  Zap,
  Clock,
  ExternalLink,
  Download,
  Terminal,
  Server,
  Code,
  Hash,
  Activity,
  FileJson,
  Lightbulb,
  Timer,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ErrorSeverity = "critical" | "warning" | "info";

export interface WorkflowError {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  stackTrace?: string;
  timestamp: Date;
  inputs?: Record<string, unknown>;
  canRetry?: boolean;
  // Enhanced fields
  provider?: string;
  executionId?: string;
  triggerRunId?: string;
  httpStatus?: number;
  errorCode?: string;
  duration?: number; // ms until failure
  rawResponse?: unknown;
  suggestion?: string;
}

interface ErrorInspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  errors: WorkflowError[];
  onClearErrors: () => void;
  onRetryNode?: (nodeId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  /** Offset position when another panel is open */
  offsetRight?: number;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Critical",
    badgeBg: "bg-red-500/20",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Warning",
    badgeBg: "bg-amber-500/20",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Info",
    badgeBg: "bg-blue-500/20",
  },
};

// Common error patterns and suggestions
const errorSuggestions: Record<string, string> = {
  "Not Found": "The API endpoint or model may not exist. Check if the model name is correct or if the service is available.",
  "Unauthorized": "API key is missing or invalid. Check your environment variables (FAL_KEY, OPENROUTER_API_KEY).",
  "Rate limit": "You've exceeded the API rate limit. Wait a few minutes before retrying.",
  "timeout": "The request took too long. Try with smaller inputs or increase the timeout.",
  "ECONNREFUSED": "Cannot connect to the server. Check if the service is running and accessible.",
  "Invalid": "The input data is malformed. Check the required fields and data types.",
  "quota": "You've exceeded your API quota. Check your billing or upgrade your plan.",
  "model": "The specified model may not be available. Try a different model.",
  "expected object, received undefined": "A required input is missing. Make sure all required inputs are connected and the parent node has run successfully.",
  "expected object": "A required input is missing or has the wrong format. Check that the connected node outputs the correct type.",
  "received undefined": "The input value is undefined. This usually means the parent node hasn't run or didn't produce output.",
  "Insufficient credits": "You don't have enough credits. Add credits in the billing section or wait for your balance to refresh.",
  "can't view images": "The LLM model may not support vision/images. Try using a vision-capable model like GPT-4o or Gemini.",
};

function getSuggestion(error: WorkflowError): string | undefined {
  if (error.suggestion) return error.suggestion;
  
  const message = error.message.toLowerCase();
  for (const [pattern, suggestion] of Object.entries(errorSuggestions)) {
    if (message.includes(pattern.toLowerCase())) {
      return suggestion;
    }
  }
  return undefined;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function DetailRow({ icon: Icon, label, value, mono = false, copyable = false }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon className="w-3.5 h-3.5 text-zinc-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</span>
        <div className="flex items-center gap-1.5">
          <p className={cn(
            "text-xs text-zinc-300 break-all",
            mono && "font-mono bg-zinc-900/50 px-1.5 py-0.5 rounded"
          )}>
            {value}
          </p>
          {copyable && (
            <button
              onClick={handleCopy}
              className="p-0.5 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorItem({
  error,
  onRetry,
  onNodeClick,
}: {
  error: WorkflowError;
  onRetry?: () => void;
  onNodeClick?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "inputs" | "raw">("details");
  const config = severityConfig[error.severity];
  const Icon = config.icon;
  const suggestion = getSuggestion(error);

  const copyFullError = async () => {
    const errorData = {
      id: error.id,
      nodeId: error.nodeId,
      nodeName: error.nodeName,
      nodeType: error.nodeType,
      severity: error.severity,
      message: error.message,
      details: error.details,
      provider: error.provider,
      executionId: error.executionId,
      triggerRunId: error.triggerRunId,
      httpStatus: error.httpStatus,
      errorCode: error.errorCode,
      duration: error.duration,
      timestamp: error.timestamp.toISOString(),
      inputs: error.inputs,
      stackTrace: error.stackTrace,
      rawResponse: error.rawResponse,
    };

    await navigator.clipboard.writeText(JSON.stringify(errorData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const timeAgo = () => {
    const seconds = Math.floor((Date.now() - error.timestamp.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div
      className={cn(
        "rounded-xl border transition-all overflow-hidden",
        config.bg,
        config.border,
        isExpanded && "ring-1 ring-zinc-700"
      )}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={cn("mt-0.5", config.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-medium text-zinc-200 truncate">
              {error.nodeName}
            </span>
            <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 bg-zinc-800/80 rounded font-mono">
              {error.nodeType}
            </span>
            {error.provider && (
              <span className="text-[10px] text-violet-400 px-1.5 py-0.5 bg-violet-500/10 rounded">
                {error.provider}
              </span>
            )}
            {error.httpStatus && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-mono",
                error.httpStatus >= 500 ? "text-red-400 bg-red-500/10" :
                error.httpStatus >= 400 ? "text-amber-400 bg-amber-500/10" :
                "text-zinc-400 bg-zinc-800"
              )}>
                {error.httpStatus}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 line-clamp-2">{error.message}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo()}
            </span>
            {error.duration && (
              <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {formatDuration(error.duration)}
              </span>
            )}
            {error.errorCode && (
              <span className="text-[10px] text-zinc-500 font-mono">
                {error.errorCode}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-zinc-800/50">
          {/* Suggestion Banner */}
          {suggestion && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/5 border-b border-amber-500/10">
              <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300/90">{suggestion}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-zinc-800/30">
            <button
              onClick={() => setActiveTab("details")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                activeTab === "details"
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Details
            </button>
            {error.inputs && Object.keys(error.inputs).length > 0 && (
              <button
                onClick={() => setActiveTab("inputs")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                  activeTab === "inputs"
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Inputs
              </button>
            )}
            {(error.rawResponse || error.stackTrace) && (
              <button
                onClick={() => setActiveTab("raw")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                  activeTab === "raw"
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Raw
              </button>
            )}
          </div>

          <div className="px-3 py-2">
            {/* Details Tab */}
            {activeTab === "details" && (
              <div className="space-y-0.5">
                <DetailRow icon={Layers} label="Node ID" value={error.nodeId} mono copyable />
                
                {error.executionId && (
                  <DetailRow icon={Hash} label="Execution ID" value={error.executionId} mono copyable />
                )}
                
                {error.triggerRunId && (
                  <DetailRow icon={Activity} label="Trigger Run" value={error.triggerRunId} mono copyable />
                )}
                
                {error.provider && (
                  <DetailRow icon={Server} label="Provider" value={error.provider} />
                )}
                
                {error.httpStatus && (
                  <DetailRow icon={Code} label="HTTP Status" value={error.httpStatus} />
                )}
                
                {error.errorCode && (
                  <DetailRow icon={Terminal} label="Error Code" value={error.errorCode} mono />
                )}
                
                {error.duration && (
                  <DetailRow icon={Timer} label="Duration" value={formatDuration(error.duration)} />
                )}
                
                <DetailRow icon={Clock} label="Timestamp" value={formatTime(error.timestamp)} />
                
                {error.details && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1 flex items-center gap-1">
                      <FileJson className="w-3 h-3" />
                      Additional Details
                    </p>
                    <p className="text-xs text-zinc-400 bg-zinc-900/50 rounded-lg p-2 border border-zinc-800/50">
                      {error.details}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Inputs Tab */}
            {activeTab === "inputs" && error.inputs && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
                  Node Inputs at Time of Error
                </p>
                <div className="text-xs text-zinc-400 bg-zinc-900/60 rounded-lg p-3 font-mono overflow-x-auto border border-zinc-800/50 max-h-48 overflow-y-auto">
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(error.inputs, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Raw Tab */}
            {activeTab === "raw" && (
              <div className="space-y-3">
                {error.stackTrace && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1 flex items-center gap-1">
                      <Terminal className="w-3 h-3" />
                      Stack Trace
                    </p>
                    <div className="text-[10px] text-zinc-500 bg-zinc-900/60 rounded-lg p-2 font-mono overflow-x-auto max-h-40 overflow-y-auto border border-zinc-800/50">
                      <pre className="whitespace-pre-wrap">{error.stackTrace}</pre>
                    </div>
                  </div>
                )}
                
                {error.rawResponse && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1 flex items-center gap-1">
                      <FileJson className="w-3 h-3" />
                      Raw Response
                    </p>
                    <div className="text-[10px] text-zinc-500 bg-zinc-900/60 rounded-lg p-2 font-mono overflow-x-auto max-h-40 overflow-y-auto border border-zinc-800/50">
                      <pre className="whitespace-pre-wrap">
                        {typeof error.rawResponse === "string"
                          ? error.rawResponse
                          : JSON.stringify(error.rawResponse, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-zinc-800/30 bg-zinc-900/20">
            {onNodeClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeClick();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Go to Node
              </button>
            )}
            {error.canRetry && onRetry && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyFullError();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors ml-auto"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  Copied JSON
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy as JSON
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ErrorInspectorPanel({
  isOpen,
  onClose,
  errors,
  onClearErrors,
  onRetryNode,
  onNodeClick,
  offsetRight = 0,
}: ErrorInspectorPanelProps) {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<ErrorSeverity | "all">("all");

  // Filter errors
  const filteredErrors = useMemo(() => {
    return errors.filter((error) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          error.nodeName.toLowerCase().includes(searchLower) ||
          error.nodeType.toLowerCase().includes(searchLower) ||
          error.message.toLowerCase().includes(searchLower) ||
          error.provider?.toLowerCase().includes(searchLower) ||
          error.errorCode?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Severity filter
      if (severityFilter !== "all" && error.severity !== severityFilter) {
        return false;
      }

      return true;
    });
  }, [errors, search, severityFilter]);

  // Count by severity
  const counts = useMemo(() => {
    return {
      critical: errors.filter((e) => e.severity === "critical").length,
      warning: errors.filter((e) => e.severity === "warning").length,
      info: errors.filter((e) => e.severity === "info").length,
      total: errors.length,
    };
  }, [errors]);

  const exportErrors = () => {
    const data = errors.map(e => ({
      ...e,
      timestamp: e.timestamp.toISOString(),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowsmith-errors-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{ right: `${12 + offsetRight}px` }}
      className="fixed top-16 bottom-3 w-[400px] z-40 flex flex-col bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 flex items-center justify-center">
            <Bug className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Diagnostics</h2>
            <p className="text-[10px] text-zinc-600">Debug & troubleshoot</p>
          </div>
          {counts.total > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-red-500/20 text-red-400 rounded-full ml-1">
              {counts.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {errors.length > 0 && (
            <>
              <button
                onClick={exportErrors}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                title="Export errors as JSON"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={onClearErrors}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                title="Clear all errors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {counts.total > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/20">
          <button
            onClick={() => setSeverityFilter(severityFilter === "critical" ? "all" : "critical")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
              severityFilter === "critical"
                ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                : counts.critical > 0
                  ? "text-red-400/70 hover:bg-red-500/10"
                  : "text-zinc-600"
            )}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {counts.critical} Critical
          </button>
          <button
            onClick={() => setSeverityFilter(severityFilter === "warning" ? "all" : "warning")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
              severityFilter === "warning"
                ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                : counts.warning > 0
                  ? "text-amber-400/70 hover:bg-amber-500/10"
                  : "text-zinc-600"
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {counts.warning}
          </button>
          <button
            onClick={() => setSeverityFilter(severityFilter === "info" ? "all" : "info")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
              severityFilter === "info"
                ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
                : counts.info > 0
                  ? "text-blue-400/70 hover:bg-blue-500/10"
                  : "text-zinc-600"
            )}
          >
            <Info className="w-3.5 h-3.5" />
            {counts.info}
          </button>
          
          {severityFilter !== "all" && (
            <button
              onClick={() => setSeverityFilter("all")}
              className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Search */}
      {counts.total > 0 && (
        <div className="px-4 py-2 border-b border-zinc-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by node, error, provider..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
            />
          </div>
        </div>
      )}

      {/* Error List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredErrors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            {errors.length === 0 ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                  <Zap className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-zinc-300 mb-1">All Systems Go</p>
                <p className="text-xs text-zinc-600 max-w-[200px]">
                  No errors detected. Your workflow is running smoothly.
                </p>
              </>
            ) : (
              <>
                <Search className="w-12 h-12 text-zinc-700 mb-4" />
                <p className="text-sm text-zinc-400 mb-1">No matching errors</p>
                <p className="text-xs text-zinc-600">Try adjusting your search or filters</p>
              </>
            )}
          </div>
        ) : (
          filteredErrors.map((error) => (
            <ErrorItem
              key={error.id}
              error={error}
              onRetry={onRetryNode ? () => onRetryNode(error.nodeId) : undefined}
              onNodeClick={onNodeClick ? () => onNodeClick(error.nodeId) : undefined}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {counts.total > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/20">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-600">
              {filteredErrors.length === counts.total
                ? `${counts.total} error${counts.total !== 1 ? "s" : ""}`
                : `Showing ${filteredErrors.length} of ${counts.total}`}
            </p>
            <p className="text-[10px] text-zinc-600">
              Press <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">E</kbd> to toggle
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ErrorInspectorPanel;
