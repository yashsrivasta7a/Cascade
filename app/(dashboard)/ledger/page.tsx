"use client";

import { motion } from "framer-motion";
import {
  DollarSign,
  Image,
  Film,
  Volume2,
  Brain,
  Zap,
  Info,
  ExternalLink,
  Calculator,
  Sparkles,
} from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { Header } from "@/components/layout";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/credits";

// =============================================================================
// DETAILED PROVIDER PRICING DATA
// =============================================================================

interface PricingTier {
  name: string;
  unit: string;
  dollarCost: number;
  credits: number;
  notes?: string;
}

interface ProviderPricing {
  provider: string;
  category: "image" | "video" | "audio" | "llm";
  description: string;
  docsUrl?: string;
  icon: React.ReactNode;
  color: string;
  tiers: PricingTier[];
  examples?: { description: string; cost: number }[];
}

const PROVIDER_PRICING: ProviderPricing[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // OPENROUTER (LLM) - Available models in Flowsmith
  // ─────────────────────────────────────────────────────────────────────────
  {
    provider: "OpenRouter",
    category: "llm",
    description: "Access to top LLM models through OpenRouter. These are the models available in Flowsmith's OpenRouter node. Prices shown are per 1 million tokens.",
    docsUrl: "https://openrouter.ai/docs#models",
    icon: <Brain className="w-5 h-5" />,
    color: "blue",
    tiers: [
      // ═══════════════════════════════════════════════════════════════════════
      // GPT-4o Mini (OpenAI) - Best value for most tasks
      // ═══════════════════════════════════════════════════════════════════════
      { name: "GPT-4o Mini (Input)", unit: "1M tokens", dollarCost: 0.15, credits: 150_000, notes: "OpenAI - Best value" },
      { name: "GPT-4o Mini (Output)", unit: "1M tokens", dollarCost: 0.60, credits: 600_000 },
      
      // ═══════════════════════════════════════════════════════════════════════
      // Gemini 2.5 Flash (Google) - Fastest, great for quick tasks
      // ═══════════════════════════════════════════════════════════════════════
      { name: "Gemini 2.5 Flash (Input)", unit: "1M tokens", dollarCost: 0.15, credits: 150_000, notes: "Google - Fastest" },
      { name: "Gemini 2.5 Flash (Output)", unit: "1M tokens", dollarCost: 0.60, credits: 600_000 },
      
      // ═══════════════════════════════════════════════════════════════════════
      // Claude Sonnet 4.5 (Anthropic) - Best for coding & complex tasks
      // ═══════════════════════════════════════════════════════════════════════
      { name: "Claude Sonnet 4.5 (Input)", unit: "1M tokens", dollarCost: 3.00, credits: 3_000_000, notes: "Anthropic - Best for coding" },
      { name: "Claude Sonnet 4.5 (Output)", unit: "1M tokens", dollarCost: 15.00, credits: 15_000_000 },
    ],
    examples: [
      { description: "Quick chat (GPT-4o Mini, ~100 in, ~200 out)", cost: 135 },
      { description: "Medium response (GPT-4o Mini, ~500 in, ~1000 out)", cost: 675 },
      { description: "Fast query (Gemini 2.5 Flash, ~300 in, ~500 out)", cost: 345 },
      { description: "Code generation (Claude 4.5, ~1000 in, ~2000 out)", cost: 33_000 },
      { description: "Long analysis (Claude 4.5, ~3000 in, ~3000 out)", cost: 54_000 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SEEDREAM (Image Generation)
  // ─────────────────────────────────────────────────────────────────────────
  {
    provider: "Seedream 4.5 (ByteDance)",
    category: "image",
    description: "High-quality text-to-image generation with advanced prompt understanding. Fixed cost per image regardless of resolution.",
    docsUrl: "https://fal.ai/models/fal-ai/seedream-4.5",
    icon: <Image className="w-5 h-5" />,
    color: "emerald",
    tiers: [
      { name: "Image Generation", unit: "per image", dollarCost: 0.04, credits: 40_000, notes: "Fixed price, any resolution" },
    ],
    examples: [
      { description: "1 image (any resolution)", cost: 40_000 },
      { description: "5 images", cost: 200_000 },
      { description: "25 images", cost: 1_000_000 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SEEDVR (Image Upscaling)
  // ─────────────────────────────────────────────────────────────────────────
  {
    provider: "SeedVR 2 (ByteDance)",
    category: "image",
    description: "AI-powered image upscaling with face enhancement. Cost scales with output resolution (megapixels).",
    docsUrl: "https://fal.ai/models/fal-ai/seedvr-2",
    icon: <Sparkles className="w-5 h-5" />,
    color: "emerald",
    tiers: [
      { name: "Upscaling", unit: "per megapixel", dollarCost: 0.001, credits: 1_000, notes: "Cost = width × height / 1M" },
    ],
    examples: [
      { description: "1K → 2K upscale (~2 MP)", cost: 2_000 },
      { description: "1K → 4K upscale (~8 MP)", cost: 8_000 },
      { description: "2K → 8K upscale (~33 MP)", cost: 33_000 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SEEDANCE (Video Generation)
  // ─────────────────────────────────────────────────────────────────────────
  {
    provider: "Seedance 1.5 (ByteDance)",
    category: "video",
    description: "Text-to-video and image-to-video generation. Cost based on video tokens: (width × height × FPS × duration) / 1024.",
    docsUrl: "https://fal.ai/models/fal-ai/seedance-1.5",
    icon: <Film className="w-5 h-5" />,
    color: "violet",
    tiers: [
      { name: "Video with Audio", unit: "1M tokens", dollarCost: 2.40, credits: 2_400_000, notes: "tokens = (w×h×fps×sec)/1024" },
      { name: "Video without Audio", unit: "1M tokens", dollarCost: 1.20, credits: 1_200_000 },
      { name: "720p 5s with audio", unit: "per video", dollarCost: 0.26, credits: 260_000, notes: "Reference baseline" },
    ],
    examples: [
      { description: "720p, 5 seconds, with audio", cost: 260_000 },
      { description: "1080p, 5 seconds, with audio", cost: 585_000 },
      { description: "720p, 10 seconds, with audio", cost: 520_000 },
      { description: "480p, 5 seconds, no audio", cost: 115_000 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ELEVENLABS (Text-to-Speech)
  // ─────────────────────────────────────────────────────────────────────────
  {
    provider: "ElevenLabs V3",
    category: "audio",
    description: "Ultra-realistic text-to-speech with 50+ voices. Cost scales linearly with character count.",
    docsUrl: "https://elevenlabs.io/pricing",
    icon: <Volume2 className="w-5 h-5" />,
    color: "amber",
    tiers: [
      { name: "Text-to-Speech (Eleven V3)", unit: "1000 characters", dollarCost: 0.10, credits: 100_000, notes: "100 credits per character" },
    ],
    examples: [
      { description: "Short sentence (~100 chars)", cost: 10_000 },
      { description: "Paragraph (~500 chars)", cost: 50_000 },
      { description: "Long script (~2000 chars)", cost: 200_000 },
      { description: "Full article (~5000 chars)", cost: 500_000 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LIPSYNC (Sync Labs)
  // ─────────────────────────────────────────────────────────────────────────
  {
    provider: "Sync Labs Lipsync",
    category: "video",
    description: "AI-powered lip synchronization that matches any audio to video. Cost scales with video duration.",
    docsUrl: "https://synclabs.so/pricing",
    icon: <Film className="w-5 h-5" />,
    color: "violet",
    tiers: [
      { name: "Lip Sync", unit: "per minute", dollarCost: 0.70, credits: 700_000, notes: "11,667 credits per second" },
    ],
    examples: [
      { description: "15 second clip", cost: 175_000 },
      { description: "30 second clip", cost: 350_000 },
      { description: "1 minute video", cost: 700_000 },
      { description: "5 minute video", cost: 3_500_000 },
    ],
  },
];

// Category configuration
const categoryConfig = {
  llm: { icon: <Brain className="w-4 h-4" />, label: "Language Models", color: "blue" },
  image: { icon: <Image className="w-4 h-4" />, label: "Image Generation", color: "emerald" },
  video: { icon: <Film className="w-4 h-4" />, label: "Video Generation", color: "violet" },
  audio: { icon: <Volume2 className="w-4 h-4" />, label: "Audio Generation", color: "amber" },
};

const colorClasses = {
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400" },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function LedgerPage() {
  return (
    <div className="h-full flex flex-col">
      <Header
        title="Pricing Ledger"
        description="Detailed credit costs for all AI providers"
        showCredits
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Info Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card variant="elevated" className="p-6 border border-white/10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Calculator className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">Credit Conversion</h2>
                  <p className="text-sm text-white/60 leading-relaxed">
                    <strong className="text-white">1,000,000 credits = $1.00 USD</strong>
                    <br />
                    Credits are deducted based on actual usage. Costs shown are estimates and may vary slightly based on provider pricing changes.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Provider Cards */}
          {PROVIDER_PRICING.map((provider, providerIndex) => {
            const colors = colorClasses[provider.color as keyof typeof colorClasses];
            
            return (
              <motion.div
                key={provider.provider}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + providerIndex * 0.05 }}
              >
                <Card variant="elevated" className="overflow-hidden">
                  {/* Provider Header */}
                  <div 
                    className="p-6 border-b border-white/5"
                    style={{ 
                      background: `linear-gradient(135deg, ${provider.color === 'blue' ? '#3b82f6' : provider.color === 'emerald' ? '#10b981' : provider.color === 'violet' ? '#8b5cf6' : '#f59e0b'}15 0%, transparent 50%)` 
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", colors.bg, colors.border, colors.text)}>
                          {provider.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-white">{provider.provider}</h3>
                            <Badge className={cn("text-[10px]", colors.bg, colors.text)}>
                              {categoryConfig[provider.category].label}
                            </Badge>
                          </div>
                          <p className="text-sm text-white/50 mt-1 max-w-2xl">{provider.description}</p>
                        </div>
                      </div>
                      {provider.docsUrl && (
                        <a
                          href={provider.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Docs
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Pricing Table */}
                  <div className="p-6">
                    <h4 className="text-sm font-medium text-white/70 mb-4 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Pricing Tiers
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left text-xs font-medium text-white/40 pb-3 pr-4">Tier</th>
                            <th className="text-left text-xs font-medium text-white/40 pb-3 pr-4">Unit</th>
                            <th className="text-right text-xs font-medium text-white/40 pb-3 pr-4">USD Cost</th>
                            <th className="text-right text-xs font-medium text-white/40 pb-3 pr-4">Credits</th>
                            <th className="text-left text-xs font-medium text-white/40 pb-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {provider.tiers.map((tier, tierIndex) => (
                            <tr key={tierIndex} className="hover:bg-white/[0.02]">
                              <td className="py-3 pr-4">
                                <span className="text-sm text-white">{tier.name}</span>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-sm text-white/50">{tier.unit}</span>
                              </td>
                              <td className="py-3 pr-4 text-right">
                                <span className="text-sm font-medium text-emerald-400 tabular-nums">
                                  ${tier.dollarCost.toFixed(tier.dollarCost < 0.01 ? 3 : 2)}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-right">
                                <span className="text-sm font-medium text-white tabular-nums">
                                  {formatCredits(tier.credits)}
                                </span>
                              </td>
                              <td className="py-3">
                                {tier.notes && (
                                  <span className="text-xs text-white/40 flex items-center gap-1">
                                    <Info className="w-3 h-3" />
                                    {tier.notes}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Examples */}
                    {provider.examples && provider.examples.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-white/5">
                        <h4 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          Example Costs
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {provider.examples.map((example, exIndex) => (
                            <div 
                              key={exIndex}
                              className="p-3 rounded-lg bg-white/[0.02] border border-white/5"
                            >
                              <p className="text-xs text-white/50 mb-1">{example.description}</p>
                              <p className="text-sm font-semibold text-white tabular-nums">
                                {formatCredits(example.cost)} credits
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}

          {/* Footer Note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center py-8"
          >
            <p className="text-xs text-white/30">
              Prices are based on provider APIs as of January 2025. Actual costs may vary.
              <br />
              We pass through provider costs with no markup.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
