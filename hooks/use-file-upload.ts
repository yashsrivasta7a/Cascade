"use client";

import { useState, useCallback } from "react";
import { showError, showWarning } from "@/lib/toast";

export interface UseFileUploadOptions {
  /** Media type for the upload (image, video, audio) */
  mediaType: "image" | "video" | "audio";
  /** Callback when upload succeeds with the URL */
  onSuccess: (url: string) => void;
  /** Optional callback when upload fails */
  onError?: (error: string) => void;
  /** Optional callback when upload state changes */
  onUploadingChange?: (isUploading: boolean) => void;
  /** Maximum file size in bytes (default: no limit) */
  maxSize?: number;
  /** Allowed MIME types (if not provided, uses mediaType defaults) */
  accept?: string;
}

export interface UseFileUploadReturn {
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Upload a file */
  upload: (file: File) => Promise<void>;
  /** Handle file input change event */
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Handle drag and drop */
  handleDrop: (e: React.DragEvent) => void;
  /** Drag over state for styling */
  isDragOver: boolean;
  /** Set drag over state */
  setIsDragOver: (value: boolean) => void;
}

// Default MIME types for media types
const DEFAULT_ACCEPT: Record<string, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
};

/**
 * Hook for handling file uploads to Transloadit or base64 fallback.
 * Supports large files (> 3MB) via direct Transloadit upload.
 * 
 * @param options - Upload configuration options
 * @returns Upload state and handlers
 */
export function useFileUpload(options: UseFileUploadOptions): UseFileUploadReturn {
  const { mediaType, onSuccess, onError, onUploadingChange, maxSize, accept } = options;
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const setUploadingState = useCallback((value: boolean) => {
    setIsUploading(value);
    onUploadingChange?.(value);
  }, [onUploadingChange]);

  const upload = useCallback(async (file: File) => {
    // Validate file type
    const expectedAccept = accept || DEFAULT_ACCEPT[mediaType];
    const typeMatch = file.type.startsWith(mediaType + "/") || 
                      (expectedAccept === "*" || file.type.match(new RegExp(expectedAccept.replace("*", ".*"))));
    
    if (!typeMatch && !file.type.startsWith(mediaType + "/")) {
      showError("Invalid file type", {
        description: `Please select a ${mediaType} file. Got: ${file.type || "unknown"}`,
      });
      onError?.("Invalid file type");
      return;
    }

    // Validate file size
    if (maxSize && file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
      showError(`File too large (${sizeMB}MB)`, {
        description: `Maximum file size is ${maxMB}MB.`,
      });
      onError?.("File too large");
      return;
    }

    setUploadingState(true);

    try {
      // For files > 3MB, use direct upload to Transloadit
      if (file.size > 3 * 1024 * 1024) {
        const url = await uploadToTransloadit(file, mediaType);
        if (url) {
          onSuccess(url);
        } else {
          onError?.("Upload failed");
        }
        setUploadingState(false);
        return;
      }

      // For smaller files, use base64 upload via API
      const url = await uploadViaApi(file, mediaType);
      onSuccess(url);
      setUploadingState(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      showError("Upload failed", { description: errorMessage });
      onError?.(errorMessage);
      setUploadingState(false);
    }
  }, [mediaType, onSuccess, onError, setUploadingState, maxSize, accept]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      upload(file);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }, [upload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      upload(file);
    }
  }, [upload]);

  return {
    isUploading,
    upload,
    handleChange,
    handleDrop,
    isDragOver,
    setIsDragOver,
  };
}

/**
 * Upload file directly to Transloadit (for files > 3MB)
 */
async function uploadToTransloadit(file: File, mediaType: string): Promise<string | null> {
  // Get signed params from our API
  const signResponse = await fetch("/api/media/upload-direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: mediaType }),
  });

  if (!signResponse.ok) {
    showError("Upload failed", {
      description: "Could not initialize upload. Please try again.",
    });
    return null;
  }

  const { params, signature } = await signResponse.json();

  // Upload to Transloadit
  const formData = new FormData();
  formData.append("params", params);
  formData.append("signature", signature);
  formData.append("file", file);

  const uploadResponse = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: formData,
  });

  const result = await uploadResponse.json();

  if (result.error || uploadResponse.status >= 400) {
    showError("Upload failed", {
      description: result.message || result.error || "Unknown error",
    });
    return null;
  }

  // Poll for completion
  const assemblyUrl = result.assembly_ssl_url || result.assembly_url;
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const statusResponse = await fetch(assemblyUrl);
    const status = await statusResponse.json();

    if (status.ok === "ASSEMBLY_COMPLETED") {
      const uploadedFile =
        status.results?.passthrough?.[0] ||
        status.uploads?.[0] ||
        status.results?.[":original"]?.[0];
      const fileUrl = uploadedFile?.ssl_url || uploadedFile?.url;
      if (fileUrl) {
        return fileUrl;
      }
    } else if (status.ok === "ASSEMBLY_CANCELED" || status.error) {
      showError("Upload failed", {
        description: status.message || status.error || "Processing failed",
      });
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  showError("Upload timed out", {
    description: "Please try again with a smaller file.",
  });
  return null;
}

/**
 * Upload file via our API (for files < 3MB)
 * Falls back to base64 if API upload fails
 */
async function uploadViaApi(file: File, mediaType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;

      try {
        const response = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl: base64,
            type: mediaType,
            filename: file.name,
          }),
        });

        if (response.ok) {
          const { url } = await response.json();
          resolve(url);
        } else {
          // Fallback to base64
          showWarning("Using local storage", {
            description: "CDN upload unavailable, using embedded data.",
          });
          resolve(base64);
        }
      } catch {
        // Fallback to base64
        resolve(base64);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default useFileUpload;
