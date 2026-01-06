"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Image,
  Film,
  Volume2,
  Brain,
  Wrench,
  Upload,
  Coins,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  NODE_DEFINITIONS,
  type NodeCategory,
  type AINodeType,
} from "@/types/nodes";

const categoryOrder: NodeCategory[] = ["input", "image", "video", "audio", "llm", "utility"];

interface NodeTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (nodeType: AINodeType) => void;
  intent?: "connect" | "add";
}

export function NodeTypeModal({
  isOpen,
  onClose,
  onSelect,
  intent = "add",
}: NodeTypeModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory | "all">("all");
  const [recent, setRecent] = useState<AINodeType[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem("flowsmith.recentNodes");
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        // only keep valid node types
        const valid = parsed.filter((x): x is AINodeType => typeof x === "string" && x in NODE_DEFINITIONS);
        setRecent(valid.slice(0, 5));
      }
    } catch {
      // ignore
    }
  }, [isOpen]);

  const filteredNodes = useMemo(() => {
    const nodes = Object.values(NODE_DEFINITIONS);
    return nodes.filter((node) => {
      if (selectedCategory !== "all" && node.category !== selectedCategory) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        node.label.toLowerCase().includes(q) ||
        node.description.toLowerCase().includes(q) ||
        node.provider.toLowerCase().includes(q)
      );
    });
  }, [search, selectedCategory]);

  const nodesByCategory = useMemo(() => {
    const grouped: Record<NodeCategory, typeof filteredNodes> = {
      input: [],
      image: [],
      video: [],
      audio: [],
      llm: [],
      utility: [],
    };
    for (const node of filteredNodes) grouped[node.category].push(node);
    return grouped;
  }, [filteredNodes]);

  const categoryLabel: Record<NodeCategory, string> = {
    input: "Input",
    image: "Image",
    video: "Video",
    audio: "Audio",
    llm: "LLM Call",
    utility: "Utility",
  };

  const categoryIcon: Record<NodeCategory, React.ReactNode> = {
    input: <Upload className="w-4 h-4" />,
    image: <Image className="w-4 h-4" />,
    video: <Film className="w-4 h-4" />,
    audio: <Volume2 className="w-4 h-4" />,
    llm: <Brain className="w-4 h-4" />,
    utility: <Wrench className="w-4 h-4" />,
  };

  const handleSelect = useCallback((nodeType: AINodeType) => {
    onSelect(nodeType);
    // update recent list
    try {
      const next = [nodeType, ...recent.filter((x) => x !== nodeType)].slice(0, 5);
      localStorage.setItem("flowsmith.recentNodes", JSON.stringify(next));
      setRecent(next);
    } catch {
      // ignore
    }
    setSearch("");
    setSelectedCategory("all");
  }, [onSelect, recent]);

  const handleClose = useCallback(() => {
    onClose();
    setSearch("");
    setSelectedCategory("all");
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[420px] mx-4 max-h-[80vh]"
        >
          <div className="bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Top bar */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-zinc-500">
                  {intent === "connect" ? "Connect to…" : "Add node"}
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Input
                placeholder="Search nodes or models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                className="h-9 bg-zinc-900/40 border-white/10"
                autoFocus
              />
            </div>

            <div className="h-px bg-white/5" />

            {/* List */}
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar px-2 py-2">
              {/* Quick category shortcuts (minimal) */}
              {intent === "connect" && (
                <div className="px-2 py-1">
                  <div className="text-[11px] text-zinc-500 mb-2">Connect to…</div>
                  <div className="space-y-1">
                    {categoryOrder.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm",
                          "text-zinc-200 hover:bg-white/5 transition-colors",
                          selectedCategory === cat && "bg-white/5"
                        )}
                      >
                        <span className="text-zinc-400">{categoryIcon[cat]}</span>
                        <span className="flex-1 text-left">{categoryLabel[cat]}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent */}
              {recent.length > 0 && (
                <div className="px-2 py-3">
                  <div className="text-[11px] text-zinc-500 mb-2">Recent</div>
                  <div className="space-y-1">
                    {recent.map((t) => {
                      const n = NODE_DEFINITIONS[t];
                      return (
                        <button
                          key={t}
                          onClick={() => handleSelect(t)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-zinc-200 hover:bg-white/5 transition-colors"
                        >
                          <span className="text-zinc-400">{categoryIcon[n.category]}</span>
                          <span className="flex-1 text-left">{n.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All nodes (grouped, minimal) */}
              <div className="px-2 py-2">
                {filteredNodes.length === 0 ? (
                  <div className="py-10 text-center text-sm text-zinc-500">No matches</div>
                ) : (
                  <div className="space-y-4">
                    {categoryOrder.map((cat) => {
                      const list = nodesByCategory[cat];
                      if (list.length === 0) return null;
                      if (selectedCategory !== "all" && selectedCategory !== cat) return null;
                      return (
                        <div key={cat}>
                          <div className="px-2 mb-2 text-[11px] text-zinc-500">{categoryLabel[cat]}</div>
                          <div className="space-y-1">
                            {list.map((node) => (
                              <button
                                key={node.type}
                                onClick={() => handleSelect(node.type)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
                              >
                                <span className="text-zinc-400">{categoryIcon[node.category]}</span>
                                <div className="flex-1 text-left min-w-0">
                                  <div className="text-sm text-zinc-200 truncate">{node.label}</div>
                                  <div className="text-[11px] text-zinc-600 truncate">{node.description}</div>
                                </div>
                                {node.estimatedCost > 0 ? (
                                  <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                                    <Coins className="w-3 h-3" />
                                    {node.estimatedCost}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-zinc-500">Free</div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

