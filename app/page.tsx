"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Zap,
  Sparkles,
  ArrowRight,
  Workflow,
  Play,
  Code2,
  Database,
  Globe,
  GitBranch,
  Cpu,
  Layers,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui";

const HeroFlow = dynamic(
  () => import("@/components/flow/hero-flow").then((mod) => mod.HeroFlow),
  { 
    ssr: false,
    loading: () => <div className="w-full h-full" />
  }
);

const features = [
  {
    icon: Sparkles,
    title: "AI Models",
    description: "GPT-4, Claude, Gemini, Llama - any model, one interface.",
  },
  {
    icon: GitBranch,
    title: "Logic & Branching",
    description: "Conditionals, loops, parallel execution built-in.",
  },
  {
    icon: Database,
    title: "100+ Integrations",
    description: "Databases, APIs, webhooks, file storage.",
  },
  {
    icon: Code2,
    title: "Custom Code",
    description: "JavaScript & Python when you need full control.",
  },
  {
    icon: Cpu,
    title: "Real-time Processing",
    description: "Sub-50ms latency, auto-scaling infrastructure.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "SOC2, GDPR, end-to-end encryption.",
  },
];

const metrics = [
  { value: "10M+", label: "Executions" },
  { value: "50K+", label: "Users" },
  { value: "99.99%", label: "Uptime" },
  { value: "<50ms", label: "Latency" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050506] overflow-x-hidden">
      {/* Hero Section - Full Screen ReactFlow */}
      <section className="relative h-screen">
        {/* ReactFlow Background */}
        <div className="absolute inset-0">
          <HeroFlow />
        </div>

        {/* Gradient Overlays */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top fade for nav */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#050506] via-[#050506]/80 to-transparent" />
          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-60 bg-gradient-to-t from-[#050506] via-[#050506]/90 to-transparent" />
          {/* Left fade */}
          <div className="absolute top-0 bottom-0 left-0 w-40 bg-gradient-to-r from-[#050506] to-transparent" />
          {/* Right fade */}
          <div className="absolute top-0 bottom-0 right-0 w-40 bg-gradient-to-l from-[#050506] to-transparent" />
          
          {/* Accent glows */}
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[150px]" />
        </div>

        {/* Navigation - Glass */}
        <motion.nav
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
        >
          <div className="max-w-7xl mx-auto">
            <div className="glass rounded-2xl px-6 py-3 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center glow-sm">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg text-white">Flowsmith</span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                {["Features", "Pricing", "Docs", "Blog"].map((item) => (
                  <Link
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                  >
                    {item}
                  </Link>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Link href="/sign-in">
                  <Button variant="ghost" className="text-white/70 hover:text-white">
                    Sign In
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button className="bg-white text-black hover:bg-white/90 border-0">
                    Get Started
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.nav>

        {/* Hero Content - Glass Cards */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="max-w-7xl mx-auto px-6 w-full">
            <div className="flex flex-col items-center">
              {/* Main Headline Card */}
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="glass-card rounded-3xl p-10 max-w-2xl text-center pointer-events-auto"
              >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-light text-xs text-white/70 mb-6"
                >
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Live workflow running behind this card
                </motion.div>

                <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
                  <span className="text-white">Build </span>
                  <span className="text-gradient">AI Workflows</span>
                </h1>
                
                <p className="text-lg text-white/50 mb-8 max-w-md mx-auto">
                  Visual automation platform for AI. Connect models, APIs, and logic—deploy in seconds.
                </p>

                <div className="flex items-center justify-center gap-4">
                  <Link href="/dashboard">
                    <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-purple-500 border-0 glow-md hover:glow-lg transition-shadow">
                      Start Building
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Button variant="outline" size="lg" className="border-white/10 text-white hover:bg-white/5">
                    <Play className="w-5 h-5" />
                    Watch Demo
                  </Button>
                </div>
              </motion.div>

              {/* Metrics Row */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex items-center gap-3 mt-8 pointer-events-auto"
              >
                {metrics.map((metric, i) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                    className="glass-light rounded-2xl px-6 py-4 text-center min-w-[100px]"
                  >
                    <p className="text-xl font-bold text-gradient-static">{metric.value}</p>
                    <p className="text-xs text-white/40">{metric.label}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Floating UI Elements */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="absolute left-8 top-1/3 glass-accent rounded-xl px-4 py-3 text-sm hidden lg:flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-white/70">AI Processing</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute right-8 top-1/2 glass-accent rounded-xl px-4 py-3 text-sm hidden lg:flex items-center gap-2"
        >
          <Workflow className="w-4 h-4 text-cyan-400" />
          <span className="text-white/70">Visual Builder</span>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-6 h-10 rounded-full border border-white/20 flex items-start justify-center pt-2"
          >
            <div className="w-1 h-2 rounded-full bg-white/40" />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-32 px-6">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-purple-500/5 blur-[120px]" />
        </div>

        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-white mb-4">
              Everything you need
            </h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto">
              From simple automations to complex AI pipelines.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group glass-card rounded-2xl p-6 hover:border-white/10 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl glass-light flex items-center justify-center mb-4 group-hover:glow-sm transition-shadow">
                  <feature.icon className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/40">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-white mb-4">
              Three steps to automation
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Drag & Drop",
                description: "Add nodes from the palette. Triggers, AI, actions, logic.",
                icon: Layers,
              },
              {
                step: "02",
                title: "Connect",
                description: "Draw connections between nodes. Data flows automatically.",
                icon: GitBranch,
              },
              {
                step: "03",
                title: "Deploy",
                description: "One click to production. Auto-scaling, monitoring included.",
                icon: Globe,
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className="glass-card rounded-2xl p-8 h-full">
                  <span className="text-6xl font-bold text-gradient-static opacity-20 absolute top-4 right-6">
                    {item.step}
                  </span>
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl glass-accent flex items-center justify-center mb-6">
                      <item.icon className="w-7 h-7 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">
                      {item.title}
                    </h3>
                    <p className="text-white/40">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-cyan-500/10 to-purple-500/10 blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center relative"
        >
          <div className="glass-card rounded-3xl p-12 border-gradient">
            <h2 className="text-4xl font-bold text-white mb-4">
              Start building today
            </h2>
            <p className="text-lg text-white/40 mb-8 max-w-md mx-auto">
              Free tier includes 1,000 executions/month. No credit card required.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/dashboard">
                <Button size="lg" className="bg-white text-black hover:bg-white/90 border-0">
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" size="lg" className="border-white/10 text-white hover:bg-white/5">
                  Talk to Sales
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">Flowsmith</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-white/40">
            {["Privacy", "Terms", "Docs", "Status", "GitHub"].map((item) => (
              <Link
                key={item}
                href={`/${item.toLowerCase()}`}
                className="hover:text-white transition-colors"
              >
                {item}
              </Link>
            ))}
          </div>
          
          <p className="text-sm text-white/30">
            © 2026 Flowsmith
          </p>
        </div>
      </footer>
    </div>
  );
}
