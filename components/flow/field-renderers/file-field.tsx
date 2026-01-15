"use client";

import { memo, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Upload, X, Loader2, Image as ImageIcon, Film, Volume2 } from "lucide-react";
import type { FileFieldConfig } from "@/lib/config/types";

interface FileFieldProps {
  config: FileFieldConfig;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
}

function FileFieldComponent({
  config,
  value,
  onChange,
  disabled = false,
  className,
}: FileFieldProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine file type from accept string
  const fileType = config.accept?.includes("image")
    ? "image"
    : config.accept?.includes("video")
    ? "video"
    : config.accept?.includes("audio")
    ? "audio"
    : "file";

  const FileIcon = fileType === "image" ? ImageIcon : fileType === "video" ? Film : Volume2;

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file) return;

      // Check file type
      if (config.accept && !file.type.match(config.accept.replace("/*", "/.*"))) {
        alert(`Invalid file type. Please select a ${fileType} file.`);
        return;
      }

      // Check file size
      const maxSize = config.maxSize ?? 10 * 1024 * 1024; // 10MB default
      if (file.size > maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
        alert(`File too large (${sizeMB}MB). Maximum size is ${maxMB}MB.`);
        return;
      }

      setIsUploading(true);

      try {
        // Convert to base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;

          // Try to upload to CDN for persistence
          try {
            const response = await fetch("/api/media/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dataUrl: base64,
                type: fileType,
                filename: file.name,
              }),
            });

            if (response.ok) {
              const { url } = await response.json();
              onChange(url);
              setIsUploading(false);
              return;
            }
          } catch (err) {
            console.warn("[FileField] CDN upload failed, using base64:", err);
          }

          // Fallback to base64 if CDN upload fails
          onChange(base64);
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("[FileField] Error reading file:", err);
        setIsUploading(false);
      }
    },
    [config.accept, config.maxSize, fileType, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  return (
    <div className={className}>
      {/* Label */}
      {config.label && (
        <label className="block text-[10px] text-zinc-500 mb-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {config.label}
          {config.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={config.accept}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={() => !value && !disabled && fileInputRef.current?.click()}
        className={cn(
          "nodrag nowheel relative rounded-lg border-2 border-dashed transition-all",
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
            : value
            ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5"
            : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/20",
          !value && !disabled && "cursor-pointer"
        )}
      >
        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-4 text-blue-500 dark:text-blue-400">
            <Loader2 className="w-5 h-5 mb-1 animate-spin" />
            <span className="text-[10px]">Uploading...</span>
          </div>
        ) : value ? (
          <div className="relative p-1">
            {/* Preview */}
            {config.preview && fileType === "image" && (
              <img
                src={value}
                alt="Preview"
                className="w-full h-16 object-cover rounded"
              />
            )}
            {config.preview && fileType === "video" && (
              <video
                src={value}
                className="w-full h-16 object-cover rounded"
                muted
              />
            )}
            {(!config.preview || fileType === "audio") && (
              <div className="flex items-center gap-2 p-2">
                <FileIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                <span className="text-[10px] text-gray-600 dark:text-zinc-400 truncate flex-1">
                  File selected
                </span>
              </div>
            )}

            {/* Clear button */}
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-gray-400 dark:text-zinc-500">
            <Upload className="w-5 h-5 mb-1" />
            <span className="text-[10px]">
              Drop {fileType} or click to upload
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      {config.description && (
        <p className="mt-1 text-[9px] text-gray-400 dark:text-zinc-600">
          {config.description}
        </p>
      )}
    </div>
  );
}

export const FileField = memo(FileFieldComponent);
