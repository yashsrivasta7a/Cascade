"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "General",
    shortcuts: [
      { keys: ["Esc"], description: "Cancel / Deselect all" },
      { keys: ["Ctrl", "S"], description: "Save workflow" },
      { keys: ["S"], description: "Keyboard shortcuts" },
      { keys: ["Ctrl", "Z"], description: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], description: "Redo" },
      { keys: ["Ctrl", "Y"], description: "Redo (alt)" },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { keys: ["Ctrl", "A"], description: "Select all nodes" },
      { keys: ["Ctrl", "C"], description: "Copy selected nodes" },
      { keys: ["Ctrl", "V"], description: "Paste nodes" },
      { keys: ["Ctrl", "D"], description: "Duplicate selected" },
      { keys: ["Delete"], description: "Delete selected" },
      { keys: ["Backspace"], description: "Delete selected" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: ["Ctrl", "+"], description: "Zoom in" },
      { keys: ["Ctrl", "-"], description: "Zoom out" },
      { keys: ["Ctrl", "0"], description: "Fit to view" },
    ],
  },
  {
    title: "Panels",
    shortcuts: [
      { keys: ["N"], description: "Toggle node palette" },
      { keys: ["H"], description: "Toggle timeline" },
      { keys: ["A"], description: "Toggle asset manager" },
      { keys: ["C"], description: "Toggle credits panel" },
      { keys: ["W"], description: "Toggle workflow sidebar" },
      { keys: ["R"], description: "Run workflow" },
    ],
  },
  {
    title: "Canvas",
    shortcuts: [
      { keys: ["G"], description: "Auto-arrange nodes" },
      { keys: ["Space", "Drag"], description: "Pan canvas" },
      { keys: ["Scroll"], description: "Zoom in/out" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-[11px] font-medium bg-white/60 dark:bg-white/[0.08] text-gray-600 dark:text-zinc-300 border border-gray-200/60 dark:border-white/[0.1] rounded-md shadow-sm backdrop-blur-sm">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function KeyboardShortcutsModalComponent({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[80vh] overflow-hidden"
          >
            <div className="relative group">
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-gray-500/10 dark:bg-white/[0.02] rounded-2xl blur-3xl opacity-60" />
              
              {/* Main container - Glass effect */}
              <div className="relative bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl backdrop-saturate-150 border border-gray-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl shadow-gray-400/30 dark:shadow-black/50 overflow-hidden">
                {/* Glass inner highlight */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-gray-100/50 dark:from-white/[0.05] to-transparent pointer-events-none" />
                
                {/* Header */}
                <div className="relative flex items-center justify-between px-6 py-4 border-b border-gray-200/50 dark:border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 backdrop-blur-sm border border-blue-500/20">
                      <Keyboard className="w-5 h-5 text-blue-500" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                      Keyboard Shortcuts
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100/80 dark:hover:bg-white/[0.05] transition-all duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="relative p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {SHORTCUTS.map((group) => (
                      <div key={group.title} className="space-y-3">
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                          {group.title}
                        </h3>
                        <div className="space-y-1">
                          {group.shortcuts.map((shortcut, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-100/50 dark:hover:bg-white/[0.03] transition-colors"
                            >
                              <span className="text-sm text-gray-700 dark:text-zinc-300">
                                {shortcut.description}
                              </span>
                              <div className="flex items-center gap-1">
                                {shortcut.keys.map((key, keyIdx) => (
                                  <span key={keyIdx} className="flex items-center gap-1">
                                    <Kbd>{key}</Kbd>
                                    {keyIdx < shortcut.keys.length - 1 && (
                                      <span className="text-xs text-gray-400 dark:text-zinc-600">+</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer tip */}
                  <div className="mt-6 pt-4 border-t border-gray-200/50 dark:border-white/[0.06]">
                    <p className="text-xs text-gray-500 dark:text-zinc-500 text-center">
                      Press <Kbd>S</Kbd> to toggle this dialog
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export const KeyboardShortcutsModal = memo(KeyboardShortcutsModalComponent);
