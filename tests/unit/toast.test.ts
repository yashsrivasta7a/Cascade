import { describe, expect, it, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import {
  showError,
  showWarning,
  showSuccess,
  showInfo,
  showLoading,
  dismissToast,
  updateToast,
  showInvalidConnection,
  showCycleDetected,
  showInsufficientCredits,
  showProviderError,
  showNetworkError,
  showTimeoutError,
  showCancelled,
  showNodeError,
  showWorkflowComplete,
  showLLMParseError,
} from "@/lib/toast";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(() => "toast-id-error"),
    warning: vi.fn(() => "toast-id-warning"),
    success: vi.fn(() => "toast-id-success"),
    info: vi.fn(() => "toast-id-info"),
    loading: vi.fn(() => "toast-id-loading"),
    dismiss: vi.fn(),
  },
}));

describe("Toast Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Toast Functions", () => {
    describe("showError", () => {
      it("calls toast.error with message", () => {
        showError("Something went wrong");
        expect(toast.error).toHaveBeenCalledWith(
          "Something went wrong",
          expect.objectContaining({ duration: 5000 })
        );
      });

      it("accepts custom options", () => {
        showError("Error", { duration: 10000 });
        expect(toast.error).toHaveBeenCalledWith(
          "Error",
          expect.objectContaining({ duration: 10000 })
        );
      });

      it("returns toast ID", () => {
        const result = showError("Error");
        expect(result).toBe("toast-id-error");
      });
    });

    describe("showWarning", () => {
      it("calls toast.warning with message", () => {
        showWarning("Be careful");
        expect(toast.warning).toHaveBeenCalledWith(
          "Be careful",
          expect.objectContaining({ duration: 4000 })
        );
      });

      it("returns toast ID", () => {
        const result = showWarning("Warning");
        expect(result).toBe("toast-id-warning");
      });
    });

    describe("showSuccess", () => {
      it("calls toast.success with message", () => {
        showSuccess("Operation completed");
        expect(toast.success).toHaveBeenCalledWith(
          "Operation completed",
          expect.objectContaining({ duration: 3000 })
        );
      });

      it("returns toast ID", () => {
        const result = showSuccess("Success");
        expect(result).toBe("toast-id-success");
      });
    });

    describe("showInfo", () => {
      it("calls toast.info with message", () => {
        showInfo("FYI");
        expect(toast.info).toHaveBeenCalledWith(
          "FYI",
          expect.objectContaining({ duration: 3000 })
        );
      });

      it("returns toast ID", () => {
        const result = showInfo("Info");
        expect(result).toBe("toast-id-info");
      });
    });

    describe("showLoading", () => {
      it("calls toast.loading with message", () => {
        showLoading("Loading...");
        expect(toast.loading).toHaveBeenCalledWith("Loading...", undefined);
      });

      it("accepts custom options", () => {
        showLoading("Processing...", { description: "Please wait" });
        expect(toast.loading).toHaveBeenCalledWith(
          "Processing...",
          expect.objectContaining({ description: "Please wait" })
        );
      });

      it("returns toast ID", () => {
        const result = showLoading("Loading");
        expect(result).toBe("toast-id-loading");
      });
    });
  });

  describe("dismissToast", () => {
    it("dismisses specific toast by ID", () => {
      dismissToast("toast-123");
      expect(toast.dismiss).toHaveBeenCalledWith("toast-123");
    });

    it("dismisses all toasts when no ID provided", () => {
      dismissToast();
      expect(toast.dismiss).toHaveBeenCalledWith();
    });
  });

  describe("updateToast", () => {
    it("updates toast to success", () => {
      updateToast("toast-123", "success", "Done!");
      expect(toast.success).toHaveBeenCalledWith(
        "Done!",
        expect.objectContaining({ id: "toast-123" })
      );
    });

    it("updates toast to error", () => {
      updateToast("toast-123", "error", "Failed!");
      expect(toast.error).toHaveBeenCalledWith(
        "Failed!",
        expect.objectContaining({ id: "toast-123" })
      );
    });

    it("updates toast to warning", () => {
      updateToast("toast-123", "warning", "Warning!");
      expect(toast.warning).toHaveBeenCalledWith(
        "Warning!",
        expect.objectContaining({ id: "toast-123" })
      );
    });

    it("updates toast to info", () => {
      updateToast("toast-123", "info", "Note");
      expect(toast.info).toHaveBeenCalledWith(
        "Note",
        expect.objectContaining({ id: "toast-123" })
      );
    });
  });

  describe("Specialized Toast Functions", () => {
    describe("showInvalidConnection", () => {
      it("shows warning with connection reason", () => {
        showInvalidConnection("Type mismatch");
        expect(toast.warning).toHaveBeenCalledWith(
          "Cannot connect: Type mismatch",
          expect.objectContaining({ duration: 3000 })
        );
      });
    });

    describe("showCycleDetected", () => {
      it("shows warning about cycle", () => {
        showCycleDetected();
        expect(toast.warning).toHaveBeenCalledWith(
          "Connection would create a cycle",
          expect.objectContaining({
            description: "Nodes cannot form circular dependencies",
          })
        );
      });
    });

    describe("showInsufficientCredits", () => {
      it("shows warning with credit details", () => {
        showInsufficientCredits(50000, 10000);
        expect(toast.warning).toHaveBeenCalledWith(
          "Insufficient credits",
          expect.objectContaining({
            description: expect.stringContaining("50,000"),
          })
        );
      });

      it("shows warning without credit details", () => {
        showInsufficientCredits();
        expect(toast.warning).toHaveBeenCalledWith(
          "Insufficient credits",
          expect.objectContaining({
            description: "Add credits to continue",
          })
        );
      });

      it("includes action button to billing", () => {
        showInsufficientCredits();
        expect(toast.warning).toHaveBeenCalledWith(
          "Insufficient credits",
          expect.objectContaining({
            action: expect.objectContaining({
              label: "Add Credits",
            }),
          })
        );
      });
    });

    describe("showProviderError", () => {
      it("shows error with provider name", () => {
        showProviderError("fal.ai", "API timeout");
        expect(toast.error).toHaveBeenCalledWith(
          "fal.ai failed: API timeout",
          expect.objectContaining({ duration: 6000 })
        );
      });

      it("includes retry button when callback provided", () => {
        const onRetry = vi.fn();
        showProviderError("OpenRouter", "Rate limited", onRetry);
        expect(toast.error).toHaveBeenCalledWith(
          "OpenRouter failed: Rate limited",
          expect.objectContaining({
            action: expect.objectContaining({
              label: "Retry",
            }),
          })
        );
      });

      it("does not include retry button when no callback", () => {
        showProviderError("OpenRouter", "Error");
        const call = (toast.error as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(call[1].action).toBeUndefined();
      });
    });

    describe("showNetworkError", () => {
      it("shows network error with details", () => {
        showNetworkError("Connection refused");
        expect(toast.error).toHaveBeenCalledWith(
          "Network error",
          expect.objectContaining({
            description: "Connection refused",
          })
        );
      });

      it("shows network error with default message", () => {
        showNetworkError();
        expect(toast.error).toHaveBeenCalledWith(
          "Network error",
          expect.objectContaining({
            description: "Check your connection and try again",
          })
        );
      });
    });

    describe("showTimeoutError", () => {
      it("shows timeout error for operation", () => {
        showTimeoutError("Image generation");
        expect(toast.error).toHaveBeenCalledWith(
          "Image generation timed out",
          expect.objectContaining({
            description: expect.stringContaining("took too long"),
          })
        );
      });
    });

    describe("showCancelled", () => {
      it("shows cancellation with custom name", () => {
        showCancelled("Workflow");
        expect(toast.info).toHaveBeenCalledWith(
          "Workflow cancelled",
          expect.any(Object)
        );
      });

      it("shows cancellation with default name", () => {
        showCancelled();
        expect(toast.info).toHaveBeenCalledWith(
          "Operation cancelled",
          expect.any(Object)
        );
      });
    });

    describe("showNodeError", () => {
      it("shows node error with name and message", () => {
        showNodeError("Seedream", "Invalid prompt");
        expect(toast.error).toHaveBeenCalledWith(
          "Seedream failed",
          expect.objectContaining({
            description: "Invalid prompt",
          })
        );
      });

      it("truncates long error messages", () => {
        const longError = "A".repeat(150);
        showNodeError("Node", longError);
        expect(toast.error).toHaveBeenCalledWith(
          "Node failed",
          expect.objectContaining({
            description: expect.stringContaining("..."),
          })
        );
      });
    });

    describe("showWorkflowComplete", () => {
      it("shows completion with node count", () => {
        showWorkflowComplete(5);
        expect(toast.success).toHaveBeenCalledWith(
          "Workflow completed (5 nodes)",
          expect.any(Object)
        );
      });

      it("handles singular node", () => {
        showWorkflowComplete(1);
        expect(toast.success).toHaveBeenCalledWith(
          "Workflow completed (1 node)",
          expect.any(Object)
        );
      });

      it("shows completion without count", () => {
        showWorkflowComplete();
        expect(toast.success).toHaveBeenCalledWith(
          "Workflow completed",
          expect.any(Object)
        );
      });
    });

    describe("showLLMParseError", () => {
      it("shows LLM parse error with details", () => {
        showLLMParseError("Seedream", "aspectRatio", "Invalid value: widescreen");
        expect(toast.error).toHaveBeenCalledWith(
          "LLM output invalid for Seedream",
          expect.objectContaining({
            description: 'Cannot set "aspectRatio": Invalid value: widescreen',
          })
        );
      });
    });
  });
});
