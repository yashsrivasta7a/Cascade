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
  BookOpen,
} from "lucide-react";
import { Badge, DotPattern, PageBackground } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/credits";

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
  {
    provider: "OpenRouter",
    category: "llm",
    description: "Access to top LLM models. Prices per 1M tokens.",
    docsUrl: "https://openrouter.ai/docs#models",
    icon: <Brain className="w-5 h-5" />,
    color: "blue",
    tiers: [
      { name: "GPT-4o Mini (Input)", unit: "1M tokens", dollarCost: 0.15, credits: 150_000, notes: "Best value" },
      { name: "GPT-4o Mini (Output)", unit: "1M tokens", dollarCost: 0.60, credits: 600_000 },
      { name: "Gemini 2.5 Flash (Input)", unit: "1M tokens", dollarCost: 0.15, credits: 150_000, notes: "Fastest" },
      { name: "Claude Sonnet 4.5 (Input)", unit: "1M tokens", dollarCost: 3.00, credits: 3_000_000, notes: "Best for coding" },
    ],
    examples: [
      { description: "Quick chat (GPT-4o Mini)", cost: 135 },
      { description: "Medium response", cost: 675 },
      { description: "Code generation (Claude)", cost: 33_000 },
    ],
  },
  {
    provider: "Seedream 4.5 (ByteDance)",
    category: "image",
    description: "High-quality text-to-image generation.",
    docsUrl: "https://fal.ai/models/fal-ai/seedream-4.5",
    icon: <Image className="w-5 h-5" />,
    color: "emerald",
    tiers: [
      { name: "Image Generation", unit: "per image", dollarCost: 0.04, credits: 40_000, notes: "Fixed price" },
    ],
    examples: [
      { description: "1 image", cost: 40_000 },
      { description: "5 images", cost: 200_000 },
    ],
  },
  {
    provider: "SeedVR 2 (ByteDance)",
    category: "image",
    description: "AI-powered image upscaling.",
    docsUrl: "https://fal.ai/models/fal-ai/seedvr-2",
    icon: <Sparkles className="w-5 h-5" />,
    color: "emerald",
    tiers: [
      { name: "Upscaling", unit: "per megapixel", dollarCost: 0.001, credits: 1_000 },
    ],
    examples: [
      { description: "1K → 4K upscale", cost: 8_000 },
      { description: "2K → 8K upscale", cost: 33_000 },
    ],
  },
  {
    provider: "Seedance 1.5 (ByteDance)",
    category: "video",
    description: "Text-to-video and image-to-video generation.",
    docsUrl: "https://fal.ai/models/fal-ai/seedance-1.5",
    icon: <Film className="w-5 h-5" />,
    color: "violet",
    tiers: [
      { name: "Video with Audio", unit: "1M tokens", dollarCost: 2.40, credits: 2_400_000 },
      { name: "720p 5s with audio", unit: "per video", dollarCost: 0.26, credits: 260_000, notes: "Baseline" },
    ],
    examples: [
      { description: "720p, 5 seconds", cost: 260_000 },
      { description: "1080p, 5 seconds", cost: 585_000 },
    ],
  },
  {
    provider: "ElevenLabs V3",
    category: "audio",
    description: "Ultra-realistic text-to-speech with 50+ voices.",
    docsUrl: "https://elevenlabs.io/pricing",
    icon: <Volume2 className="w-5 h-5" />,
    color: "amber",
    tiers: [
      { name: "Text-to-Speech", unit: "1000 chars", dollarCost: 0.10, credits: 100_000 },
    ],
    examples: [
      { description: "Short sentence (~100 chars)", cost: 10_000 },
      { description: "Paragraph (~500 chars)", cost: 50_000 },
    ],
  },
  {
    provider: "Sync Labs Lipsync",
    category: "video",
    description: "AI-powered lip synchronization.",
    docsUrl: "https://synclabs.so/pricing",
    icon: <Film className="w-5 h-5" />,
    color: "violet",
    tiers: [
      { name: "Lip Sync", unit: "per minute", dollarCost: 0.70, credits: 700_000 },
    ],
    examples: [
      { description: "15 second clip", cost: 175_000 },
      { description: "1 minute video", cost: 700_000 },
    ],
  },
];

const colorClasses = {
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400" },
};

const categoryLabels = {
  llm: "Language Models",
  image: "Image",
  video: "Video",
  audio: "Audio",
};

export default function LedgerPage() {
  return (
    <PageBackground>
      {/* Header */}
      <div className="shrink-0 h-14 px-6 flex items-center border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Pricing Ledger</h1>
            <p className="text-[11px] text-zinc-500">Credit costs for all providers</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Info Banner */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="relative p-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
              <DotPattern className="text-amber-500/5" />
              <div className="relative flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Calculator className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white mb-1">Credit Conversion</h2>
                  <p className="text-xs text-zinc-500">
                    <strong className="text-white">1,000,000 credits = $1.00 USD</strong>
                    <br />
                    Credits are deducted based on actual usage. Costs shown are estimates.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Provider Cards */}
          {PROVIDER_PRICING.map((provider, providerIndex) => {
            const colors = colorClasses[provider.color as keyof typeof colorClasses];
            
            return (
              <motion.div
                key={provider.provider}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + providerIndex * 0.03 }}
              >
                <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
                  {/* Provider Header */}
                  <div className="p-5 border-b border-zinc-800/60">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", colors.bg, colors.border, colors.text)}>
                          {provider.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white">{provider.provider}</h3>
                            <Badge className={cn("text-[10px]", colors.bg, colors.text)}>
                              {categoryLabels[provider.category]}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">{provider.description}</p>
                        </div>
                      </div>
                      {provider.docsUrl && (
                        <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white">
                          <ExternalLink className="w-3 h-3" /> Docs
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Pricing Table */}
                  <div className="p-5">
                    <h4 className="text-xs font-medium text-zinc-500 mb-3 flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5" /> Pricing Tiers
                    </h4>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-800/60">
                          <th className="text-left text-[11px] font-medium text-zinc-500 pb-2">Tier</th>
                          <th className="text-left text-[11px] font-medium text-zinc-500 pb-2">Unit</th>
                          <th className="text-right text-[11px] font-medium text-zinc-500 pb-2">USD</th>
                          <th className="text-right text-[11px] font-medium text-zinc-500 pb-2">Credits</th>
                          <th className="text-left text-[11px] font-medium text-zinc-500 pb-2 pl-4">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {provider.tiers.map((tier, tierIndex) => (
                          <tr key={tierIndex} className="hover:bg-zinc-800/20">
                            <td className="py-2.5 text-sm text-white">{tier.name}</td>
                            <td className="py-2.5 text-xs text-zinc-500">{tier.unit}</td>
                            <td className="py-2.5 text-right text-sm font-medium text-emerald-400">${tier.dollarCost.toFixed(tier.dollarCost < 0.01 ? 3 : 2)}</td>
                            <td className="py-2.5 text-right text-sm font-medium text-white">{formatCredits(tier.credits)}</td>
                            <td className="py-2.5 pl-4">
                              {tier.notes && (
                                <span className="text-[11px] text-zinc-600 flex items-center gap-1">
                                  <Info className="w-3 h-3" /> {tier.notes}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Examples */}
                    {provider.examples && provider.examples.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-zinc-800/40">
                        <h4 className="text-xs font-medium text-zinc-500 mb-3 flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5" /> Examples
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                          {provider.examples.map((example, exIndex) => (
                            <div key={exIndex} className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/60">
                              <p className="text-[11px] text-zinc-500 mb-1">{example.description}</p>
                              <p className="text-sm font-medium text-white">{formatCredits(example.cost)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Footer */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center py-8">
            <p className="text-xs text-zinc-600">
              Prices based on provider APIs as of January 2025. We pass through costs with no markup.
            </p>
          </motion.div>
        </div>
      </div>
    </PageBackground>
  );
}
