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
          <div className="bg-[#09090b]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 flex items-center justify-center shadow-lg">
                  <Settings className="w-4 h-4 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">{title}</h2>
                  <p className="text-[10px] text-zinc-500 font-medium">Configure node settings</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg border border-white/5 bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/5 hover:border-white/10 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {children}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/5 bg-white/[0.02] flex items-center justify-end gap-3 backdrop-blur-sm">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 shadow-lg shadow-white/5 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Apply Changes
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
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-400">{label}</label>
        <span className="text-[10px] font-mono text-zinc-300 bg-white/[0.05] px-2 py-1 rounded-md border border-white/5 min-w-[3rem] text-center">
          {value}{unit}
        </span>
      </div>
      <div className="relative h-1.5 w-full rounded-full bg-zinc-800/50">
        <div 
          className="absolute h-full rounded-full bg-gradient-to-r from-zinc-500 to-zinc-200"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div 
          className="absolute h-4 w-4 bg-white rounded-full shadow-lg border border-zinc-200 top-1/2 -translate-y-1/2 pointer-events-none transition-transform"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
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
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-black/60 appearance-none cursor-pointer transition-all shadow-inner"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5 5L9 1" stroke="#71717A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
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
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
      <div>
        <label className="text-xs font-medium text-zinc-200 block">{label}</label>
        {description && (
          <p className="text-[10px] text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "relative w-11 h-6 rounded-full transition-all duration-300 ease-out border",
          value 
            ? "bg-zinc-200 border-transparent" 
            : "bg-zinc-900 border-white/10 hover:border-white/20"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full shadow-sm transition-all duration-300",
            value 
              ? "translate-x-5 bg-black" 
              : "translate-x-0 bg-zinc-500"
          )}
        />
      </button>
    </div>
  );
}

export default NodeSettingsModal;



