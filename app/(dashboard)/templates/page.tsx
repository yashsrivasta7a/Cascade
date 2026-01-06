"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Filter,
  Star,
  Download,
  Play,
  Clock,
  Users,
  Coins,
  Image,
  Film,
  Volume2,
  Brain,
  Sparkles,
  ChevronRight,
  Plus,
  Eye,
  ArrowRight,
  Heart,
} from "lucide-react";
import { Button, Card, Badge, Input } from "@/components/ui";
import { Header } from "@/components/layout";
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
  thumbnail?: string;
  tags: string[];
}

const templates: Template[] = [
  {
    id: "t1",
    name: "AI Video Generator",
    description: "Generate videos from text prompts with voice narration and professional editing",
    category: "multimodal",
    nodes: 6,
    estimatedCost: 48,
    estimatedDuration: "3-5 min",
    author: "Flowsmith",
    downloads: 12500,
    rating: 4.9,
    featured: true,
    tags: ["video", "voice", "script"],
  },
  {
    id: "t2",
    name: "Product Photo Enhancement",
    description: "Upscale, relight, and remove backgrounds from product photos automatically",
    category: "image",
    nodes: 4,
    estimatedCost: 15,
    estimatedDuration: "30 sec",
    author: "Flowsmith",
    downloads: 8200,
    rating: 4.8,
    tags: ["ecommerce", "photos", "enhancement"],
  },
  {
    id: "t3",
    name: "Podcast Audio Enhancer",
    description: "Clean up audio, remove background noise, and enhance voice clarity",
    category: "audio",
    nodes: 3,
    estimatedCost: 8,
    estimatedDuration: "1-2 min",
    author: "Community",
    downloads: 3400,
    rating: 4.7,
    tags: ["podcast", "audio", "cleanup"],
  },
  {
    id: "t4",
    name: "Blog Post Generator",
    description: "Generate SEO-optimized blog posts with images from a topic",
    category: "llm",
    nodes: 5,
    estimatedCost: 12,
    estimatedDuration: "45 sec",
    author: "Flowsmith",
    downloads: 15600,
    rating: 4.6,
    featured: true,
    tags: ["content", "seo", "blog"],
  },
  {
    id: "t5",
    name: "Social Media Video Clips",
    description: "Create short-form video clips with captions for social media",
    category: "video",
    nodes: 5,
    estimatedCost: 32,
    estimatedDuration: "2-3 min",
    author: "Community",
    downloads: 6800,
    rating: 4.5,
    tags: ["social", "tiktok", "reels"],
  },
  {
    id: "t6",
    name: "Character Consistent Art",
    description: "Generate consistent character illustrations across multiple scenes",
    category: "image",
    nodes: 4,
    estimatedCost: 20,
    estimatedDuration: "1 min",
    author: "Community",
    downloads: 4200,
    rating: 4.7,
    tags: ["art", "character", "consistency"],
  },
  {
    id: "t7",
    name: "Voice Cloning & Dubbing",
    description: "Clone a voice and use it to dub videos in different languages",
    category: "multimodal",
    nodes: 7,
    estimatedCost: 55,
    estimatedDuration: "5-8 min",
    author: "Flowsmith",
    downloads: 2100,
    rating: 4.8,
    tags: ["voice", "dubbing", "localization"],
  },
  {
    id: "t8",
    name: "AI Music Video",
    description: "Create music visualizations and lyric videos from audio tracks",
    category: "video",
    nodes: 6,
    estimatedCost: 45,
    estimatedDuration: "4-6 min",
    author: "Community",
    downloads: 1800,
    rating: 4.4,
    tags: ["music", "visualization", "lyrics"],
  },
];

const categoryIcons: Record<TemplateCategory, React.ReactNode> = {
  all: <Sparkles className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  audio: <Volume2 className="w-4 h-4" />,
  llm: <Brain className="w-4 h-4" />,
  multimodal: <Sparkles className="w-4 h-4" />,
};

const categoryColors: Record<TemplateCategory, string> = {
  all: "cyan",
  image: "emerald",
  video: "violet",
  audio: "amber",
  llm: "blue",
  multimodal: "pink",
};

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("all");
  const [sortBy, setSortBy] = useState<"popular" | "rating" | "recent">("popular");

  const filteredTemplates = templates.filter((template) => {
    if (selectedCategory !== "all" && template.category !== selectedCategory) {
      return false;
    }
    if (searchQuery && !template.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const featuredTemplates = templates.filter((t) => t.featured);

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Templates"
        description="Start with pre-built workflow templates"
        actions={
          <Button variant="outline" leftIcon={<Plus className="w-4 h-4" />}>
            Submit Template
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        {/* Featured Section */}
        <section className="px-8 py-6 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Featured Templates
              </h2>
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {featuredTemplates.map((template, i) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card variant="gradient" hover className="p-0 overflow-hidden group">
                    <div className="relative h-40 bg-gradient-to-br from-cyan-500/20 via-violet-500/10 to-transparent">
                      {/* Decorative elements */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,212,255,0.15),transparent_50%)]" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.15),transparent_50%)]" />
                      
                      {/* Floating icons */}
                      <div className="absolute top-6 left-6 w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                        {categoryIcons[template.category]}
                      </div>
                      
                      <Badge variant="accent" className="absolute top-6 right-6 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        Featured
                      </Badge>

                      {/* Gradient overlay */}
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent" />
                    </div>

                    <div className="p-5 pt-0 -mt-4 relative">
                      <h3 className="text-xl font-bold text-zinc-100 mb-2 group-hover:text-cyan-400 transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
                        {template.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {template.nodes} nodes
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {template.estimatedDuration}
                        </span>
                        <span className="flex items-center gap-1">
                          <Coins className="w-3 h-3 text-amber-400" />
                          ~{template.estimatedCost} credits
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-400 fill-current" />
                            <span className="text-sm font-medium text-zinc-100">{template.rating}</span>
                          </div>
                          <span className="text-xs text-zinc-500">
                            {template.downloads.toLocaleString()} uses
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" className="h-8">
                            Use Template
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* All Templates Section */}
        <section className="px-8 py-6">
          <div className="max-w-7xl mx-auto">
            {/* Filters */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  className="w-64 h-9"
                />
                <div className="flex items-center gap-1 ml-4">
                  {(["all", "image", "video", "audio", "llm", "multimodal"] as const).map(
                    (category) => (
                      <Button
                        key={category}
                        variant={selectedCategory === category ? "primary" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-8 px-3 text-xs capitalize",
                          selectedCategory === category && "bg-white/10 text-white"
                        )}
                        onClick={() => setSelectedCategory(category)}
                      >
                        {categoryIcons[category]}
                        <span className="ml-1">{category === "llm" ? "LLM" : category}</span>
                      </Button>
                    )
                  )}
                </div>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300"
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="recent">Most Recent</option>
              </select>
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-3 gap-4">
              {filteredTemplates.map((template, i) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card variant="elevated" hover className="p-5 h-full flex flex-col group">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          template.category === "image" && "bg-emerald-500/10 text-emerald-400",
                          template.category === "video" && "bg-violet-500/10 text-violet-400",
                          template.category === "audio" && "bg-amber-500/10 text-amber-400",
                          template.category === "llm" && "bg-blue-500/10 text-blue-400",
                          template.category === "multimodal" && "bg-pink-500/10 text-pink-400"
                        )}
                      >
                        {categoryIcons[template.category]}
                      </div>
                      <button className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="font-semibold text-zinc-100 mb-1 group-hover:text-cyan-400 transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-xs text-zinc-500 mb-3 line-clamp-2 flex-1">
                      {template.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-4 pt-3 border-t border-white/5">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {template.nodes} nodes
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {template.estimatedDuration}
                      </span>
                      <span className="flex items-center gap-1 text-amber-400">
                        <Coins className="w-3 h-3" />
                        ~{template.estimatedCost}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                          <span className="text-xs font-medium text-zinc-300">
                            {template.rating}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-600">
                          ({template.downloads.toLocaleString()})
                        </span>
                      </div>
                      <Button size="sm" className="h-7 text-xs">
                        Use
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

