"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, Crop, MergeIcon, ScissorsLineDashed, FileAudio } from "lucide-react";
import { cn } from "@/lib/utils";

interface NodeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function NodeSettingsModal({
  isOpen,
  onClose,
  title,
  children,
}: NodeSettingsModalProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{title}</h2>
                  <p className="text-[10px] text-zinc-500">Configure node settings</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl border border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              {children}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/10 bg-zinc-900/30 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/15 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Slider component for settings
interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export function SliderInput({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
}: SliderInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-zinc-400">{label}</label>
        <span className="text-xs text-zinc-200 font-mono bg-white/[0.03] px-2 py-0.5 rounded border border-white/10">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="nodrag w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800"
        style={{
          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(value / max) * 100}%, #27272a ${(value / max) * 100}%, #27272a 100%)`,
        }}
      />
    </div>
  );
}

// Select component for settings
interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
}: SelectInputProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="nodrag w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:border-white/20 appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Toggle component for settings
interface ToggleInputProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleInput({
  label,
  description,
  value,
  onChange,
}: ToggleInputProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="text-xs text-zinc-200">{label}</label>
        {description && (
          <p className="text-[10px] text-zinc-500">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "nodrag w-10 h-5 rounded-full transition-colors relative",
          value ? "bg-blue-500" : "bg-zinc-700"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
            value ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

export default NodeSettingsModal;



