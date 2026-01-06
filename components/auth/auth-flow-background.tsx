"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Sophisticated particle/node system
function FlowParticle({ delay, duration, startX, startY, endX, endY, size, color }: {
  delay: number;
  duration: number;
  startX: string;
  startY: string;
  endX: string;
  endY: string;
  size: number;
  color: string;
}) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        background: color,
        filter: `blur(${size / 4}px)`,
        left: startX,
        top: startY,
      }}
      animate={{
        left: [startX, endX, startX],
        top: [startY, endY, startY],
        opacity: [0, 1, 0],
        scale: [0.5, 1, 0.5],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

// Flowing connection lines
function FlowLine({ d, delay, color }: { d: string; delay: number; color: string }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth="1"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.4 }}
      transition={{ duration: 3, delay, ease: "easeInOut" }}
    />
  );
}

export function AuthFlowBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0f0f14_0%,_#050507_100%)]" />
      
      {/* Flowing SVG paths */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="flow1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flow2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flow3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Elegant curved paths representing data flow */}
        <FlowLine d="M-100,200 Q200,100 400,200 T800,150 T1200,250" delay={0} color="url(#flow1)" />
        <FlowLine d="M-50,350 Q250,250 500,350 T900,300 T1300,400" delay={0.5} color="url(#flow2)" />
        <FlowLine d="M-100,500 Q300,400 600,480 T1000,420 T1400,500" delay={1} color="url(#flow3)" />
        <FlowLine d="M-80,650 Q200,550 450,620 T850,580 T1250,650" delay={1.5} color="url(#flow1)" />
        
        {/* Subtle grid nodes */}
        {[...Array(20)].map((_, i) => (
          <motion.circle
            key={i}
            cx={100 + (i % 5) * 250 + Math.random() * 100}
            cy={100 + Math.floor(i / 5) * 150 + Math.random() * 50}
            r={2}
            fill="#ffffff"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 4, delay: i * 0.3, repeat: Infinity }}
          />
        ))}
      </svg>

      {/* Floating orbs */}
      <FlowParticle delay={0} duration={12} startX="10%" startY="20%" endX="15%" endY="30%" size={120} color="rgba(6, 182, 212, 0.08)" />
      <FlowParticle delay={2} duration={15} startX="70%" startY="60%" endX="75%" endY="50%" size={150} color="rgba(139, 92, 246, 0.08)" />
      <FlowParticle delay={4} duration={10} startX="50%" startY="80%" endX="45%" endY="70%" size={100} color="rgba(34, 211, 238, 0.06)" />
      <FlowParticle delay={1} duration={14} startX="80%" startY="15%" endX="85%" endY="25%" size={80} color="rgba(168, 85, 247, 0.06)" />
      
      {/* Accent glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/[0.03] rounded-full blur-[200px]" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/[0.03] rounded-full blur-[200px]" />
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#050507_70%)]" />
    </div>
  );
}
