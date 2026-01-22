"use client";

import { toast, type ExternalToast } from "sonner";

// =============================================================================
// TOAST NOTIFICATION UTILITIES
// Typed helper functions for consistent toast notifications
// =============================================================================

export interface ToastOptions extends ExternalToast {
  /** Duration in milliseconds (default: 4000) */
  duration?: number;
  /** Action button configuration */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Show an error toast (red accent)
 * Use for: API failures, execution errors, critical issues
 */
export function showError(message: string, options?: ToastOptions) {
  return toast.error(message, {
    duration: 5000,
    ...options,
  });
}

/**
 * Show a warning toast (amber accent)
 * Use for: Invalid connections, cycle detection, insufficient credits
 */
export function showWarning(message: string, options?: ToastOptions) {
  return toast.warning(message, {
    duration: 4000,
    ...options,
  });
}

/**
 * Show a success toast (green accent)
 * Use for: Workflow completed, node finished, save successful
 */
export function showSuccess(message: string, options?: ToastOptions) {
  return toast.success(message, {
    duration: 3000,
    ...options,
  });
}

/**
 * Show an info toast (blue accent)
 * Use for: Neutral information, cancellation confirmations
 */
export function showInfo(message: string, options?: ToastOptions) {
  return toast.info(message, {
    duration: 3000,
    ...options,
  });
}

/**
 * Show a loading toast that can be updated
 * Returns a toast ID for updating/dismissing
 */
export function showLoading(message: string, options?: ToastOptions) {
  return toast.loading(message, options);
}

/**
 * Dismiss a specific toast by ID or dismiss all toasts
 */
export function dismissToast(toastId?: string | number) {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
}

/**
 * Update an existing toast (useful for loading -> success/error transitions)
 */
export function updateToast(
  toastId: string | number,
  type: "success" | "error" | "warning" | "info",
  message: string,
  options?: ToastOptions
) {
  const toastFn = {
    success: toast.success,
    error: toast.error,
    warning: toast.warning,
    info: toast.info,
  }[type];

  toastFn(message, {
    id: toastId,
    ...options,
  });
}

// =============================================================================
// SPECIALIZED TOAST HELPERS
// Pre-configured toasts for common scenarios
// =============================================================================

/**
 * Show invalid connection warning
 */
export function showInvalidConnection(reason: string) {
  return showWarning(`Cannot connect: ${reason}`, {
    duration: 3000,
  });
}

/**
 * Show cycle detection warning
 */
export function showCycleDetected() {
  return showWarning("Connection would create a cycle", {
    description: "Nodes cannot form circular dependencies",
    duration: 4000,
  });
}

/**
 * Show insufficient credits warning
 */
export function showInsufficientCredits(required?: number, available?: number) {
  const description = required && available !== undefined
    ? `Need ${required.toLocaleString()} credits, have ${available.toLocaleString()}`
    : "Add credits to continue";
  
  return showWarning("Insufficient credits", {
    description,
    duration: 5000,
    action: {
      label: "Add Credits",
      onClick: () => window.location.href = "/billing",
    },
  });
}

/**
 * Show provider error with retry option
 */
export function showProviderError(
  provider: string,
  error: string,
  onRetry?: () => void
) {
  return showError(`${provider} failed: ${error}`, {
    duration: 6000,
    ...(onRetry && {
      action: {
        label: "Retry",
        onClick: onRetry,
      },
    }),
  });
}

/**
 * Show network error
 */
export function showNetworkError(details?: string) {
  return showError("Network error", {
    description: details || "Check your connection and try again",
    duration: 5000,
  });
}

/**
 * Show timeout error
 */
export function showTimeoutError(operation: string) {
  return showError(`${operation} timed out`, {
    description: "The operation took too long. Try again or use smaller inputs.",
    duration: 5000,
  });
}

/**
 * Show cancellation confirmation
 */
export function showCancelled(what: string = "Operation") {
  return showInfo(`${what} cancelled`);
}

/**
 * Show node execution error
 */
export function showNodeError(nodeName: string, error: string) {
  return showError(`${nodeName} failed`, {
    description: error.length > 100 ? error.slice(0, 100) + "..." : error,
    duration: 5000,
  });
}

/**
 * Show workflow completion
 */
export function showWorkflowComplete(nodeCount?: number) {
  const message = nodeCount
    ? `Workflow completed (${nodeCount} node${nodeCount !== 1 ? "s" : ""})`
    : "Workflow completed";
  return showSuccess(message);
}

/**
 * Show LLM parsing error when LLM output cannot be converted to expected type
 * Uses simple format: "{field} not supported"
 */
export function showLLMParseError(targetNode: string, targetField: string, _error: string) {
  // Format field name for display (camelCase to Title Case)
  const fieldDisplay = targetField
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
  
  return showError(`${fieldDisplay} not supported`, {
    description: `The LLM response for "${targetNode}" doesn't match expected format`,
    duration: 4000,
  });
}

// =============================================================================
// SKIP NODE TOASTS
// =============================================================================

/**
 * Show warning when skip is enabled but node has no output to use
 */
export function showSkipWarning(nodeName: string) {
  return showWarning(`${nodeName} is skipped but has no output`, {
    description: "Run this node first or disable skip to continue.",
    duration: 5000,
  });
}

/**
 * Show info when all nodes in workflow are skipped
 */
export function showAllSkippedWarning() {
  return showInfo("All nodes are skipped", {
    description: "Nothing to execute. 0 credits used.",
    duration: 4000,
  });
}

/**
 * Show success when node execution was skipped (used existing output)
 */
export function showSkipped(nodeName: string) {
  return showInfo(`${nodeName} skipped`, {
    description: "Using existing output. 0 credits used.",
    duration: 2000,
  });
}

// =============================================================================
// WORKFLOW NAME TOASTS
// =============================================================================

/**
 * Show warning when workflow name already exists
 */
export function showDuplicateNameWarning(name: string) {
  return showWarning(`Workflow name "${name}" already exists`, {
    description: "Please choose a different name",
    duration: 4000,
  });
}
