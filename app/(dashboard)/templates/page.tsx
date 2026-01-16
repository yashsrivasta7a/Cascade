"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Star,
  Play,
  Clock,
  Coins,
  Image,
  Film,
  Volume2,
  Brain,
  Sparkles,
  ChevronRight,
  Plus,
  ArrowRight,
  Heart,
  Layers,
} from "lucide-react";
import { Button, Badge, Input, DotPattern, PageBackground } from "@/components/ui";
import { UserMenu } from "@/components/layout";
import { cn } from "@/lib/utils";

type TemplateCategory = "all" | "image" | "video" | "audio" | "llm" | "multimodal";

interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  nodes: number;
  estimatedCost: number;
  estimatedDuration: string;
  author: string;
  downloads: number;
  rating: number;
  featured?: boolean;
  tags: string[];
}

const templates: Template[] = [
  { id: "t1", name: "AI Video Generator", description: "Generate videos from text prompts with voice narration", category: "multimodal", nodes: 6, estimatedCost: 48, estimatedDuration: "3-5 min", author: "Flowsmith", downloads: 12500, rating: 4.9, featured: true, tags: ["video", "voice", "script"] },
  { id: "t2", name: "Product Photo Enhancement", description: "Upscale, relight, and remove backgrounds from product photos", category: "image", nodes: 4, estimatedCost: 15, estimatedDuration: "30 sec", author: "Flowsmith", downloads: 8200, rating: 4.8, tags: ["ecommerce", "photos", "enhancement"] },
  { id: "t3", name: "Podcast Audio Enhancer", description: "Clean up audio, remove background noise, and enhance voice", category: "audio", nodes: 3, estimatedCost: 8, estimatedDuration: "1-2 min", author: "Community", downloads: 3400, rating: 4.7, tags: ["podcast", "audio", "cleanup"] },
  { id: "t4", name: "Blog Post Generator", description: "Generate SEO-optimized blog posts with images from a topic", category: "llm", nodes: 5, estimatedCost: 12, estimatedDuration: "45 sec", author: "Flowsmith", downloads: 15600, rating: 4.6, featured: true, tags: ["content", "seo", "blog"] },
  { id: "t5", name: "Social Media Video Clips", description: "Create short-form video clips with captions for social media", category: "video", nodes: 5, estimatedCost: 32, estimatedDuration: "2-3 min", author: "Community", downloads: 6800, rating: 4.5, tags: ["social", "tiktok", "reels"] },
  { id: "t6", name: "Character Consistent Art", description: "Generate consistent character illustrations across multiple scenes", category: "image", nodes: 4, estimatedCost: 20, estimatedDuration: "1 min", author: "Community", downloads: 4200, rating: 4.7, tags: ["art", "character", "consistency"] },
  { id: "t7", name: "Voice Cloning & Dubbing", description: "Clone a voice and use it to dub videos in different languages", category: "multimodal", nodes: 7, estimatedCost: 55, estimatedDuration: "5-8 min", author: "Flowsmith", downloads: 2100, rating: 4.8, tags: ["voice", "dubbing", "localization"] },
  { id: "t8", name: "AI Music Video", description: "Create music visualizations and lyric videos from audio tracks", category: "video", nodes: 6, estimatedCost: 45, estimatedDuration: "4-6 min", author: "Community", downloads: 1800, rating: 4.4, tags: ["music", "visualization", "lyrics"] },
];

const categoryIcons: Record<TemplateCategory, React.ReactNode> = {
  all: <Sparkles className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  audio: <Volume2 className="w-4 h-4" />,
  llm: <Brain className="w-4 h-4" />,
  multimodal: <Sparkles className="w-4 h-4" />,
};

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("all");

  const filteredTemplates = templates.filter((template) => {
    if (selectedCategory !== "all" && template.category !== selectedCategory) return false;
    if (searchQuery && !template.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const featuredTemplates = templates.filter((t) => t.featured);

  return (
    <PageBackground>
      {/* Header */}
      <div className="shrink-0 h-14 px-6 flex items-center justify-between border-b border-gray-200 dark:border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center">
            <Layers className="w-4 h-4 text-gray-600 dark:text-zinc-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Templates</h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-500">Pre-built workflows</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<Plus className="w-4 h-4" />} size="sm">Submit Template</Button>
          <UserMenu />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Featured Section */}
        <section className="px-6 py-6 border-b border-zinc-800/40">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" /> Featured
              </h2>
              <button className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {featuredTemplates.map((template, i) => (
                <motion.div key={template.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <div className="relative p-0 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden group hover:border-zinc-700/60 transition-colors">
                    <div className="relative h-32 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent">
                      <DotPattern className="text-blue-500/10" />
                      <div className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-zinc-800/80 backdrop-blur flex items-center justify-center">
                        {categoryIcons[template.category]}
                      </div>
                      <Badge variant="accent" className="absolute top-4 right-4 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" /> Featured
                      </Badge>
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">{template.name}</h3>
                      <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{template.description}</p>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-600 mb-3">
                        <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> {template.nodes} nodes</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {template.estimatedDuration}</span>
                        <span className="flex items-center gap-1 text-amber-500"><Coins className="w-3 h-3" /> ~{template.estimatedCost}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                          <span className="text-xs text-white">{template.rating}</span>
                          <span className="text-[10px] text-zinc-600">({template.downloads.toLocaleString()})</span>
                        </div>
                        <Button size="sm" className="h-7 text-xs">Use <ArrowRight className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* All Templates */}
        <section className="px-6 py-6">
          <div className="max-w-6xl mx-auto">
            {/* Filters */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-56 h-9 pl-9 pr-4 text-sm bg-zinc-900/50 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                  />
                </div>
                <div className="flex items-center gap-1 p-0.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                  {(["all", "image", "video", "audio", "llm", "multimodal"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "h-8 px-3 text-xs font-medium rounded-md flex items-center gap-1.5 capitalize transition-colors",
                        selectedCategory === cat ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {categoryIcons[cat]}
                      {cat === "llm" ? "LLM" : cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 gap-4">
              {filteredTemplates.map((template, i) => (
                <motion.div key={template.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="p-4 bg-zinc-900/50 border border-zinc-800/60 rounded-xl hover:border-zinc-700/60 transition-colors group h-full flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        template.category === "image" && "bg-emerald-500/10 text-emerald-400",
                        template.category === "video" && "bg-violet-500/10 text-violet-400",
                        template.category === "audio" && "bg-amber-500/10 text-amber-400",
                        template.category === "llm" && "bg-blue-500/10 text-blue-400",
                        template.category === "multimodal" && "bg-pink-500/10 text-pink-400"
                      )}>
                        {categoryIcons[template.category]}
                      </div>
                      <button className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="font-medium text-white mb-1 group-hover:text-blue-400 transition-colors">{template.name}</h3>
                    <p className="text-xs text-zinc-500 mb-3 line-clamp-2 flex-1">{template.description}</p>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {template.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-400">{tag}</span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-600 mb-3 pt-3 border-t border-zinc-800/60">
                      <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> {template.nodes}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {template.estimatedDuration}</span>
                      <span className="flex items-center gap-1 text-amber-500"><Coins className="w-3 h-3" /> ~{template.estimatedCost}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Star className="w-3 h-3 text-amber-400 fill-current" />
                        <span className="text-xs text-white">{template.rating}</span>
                        <span className="text-[10px] text-zinc-600">({template.downloads.toLocaleString()})</span>
                      </div>
                      <Button size="sm" className="h-7 text-xs">Use <ArrowRight className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PageBackground>
  );
}
