"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

// Three lines, not four, and no twinkling node field. The restraint is the
// point — every element left here has to earn its place.
const FLOW_PATHS = [
  { d: "M-100,240 Q260,140 560,250 T1180,190", gradient: "flowCyan", delay: 0 },
  { d: "M-80,430 Q300,330 620,430 T1280,370", gradient: "flowViolet", delay: 0.1 },
  { d: "M-100,620 Q280,520 600,600 T1240,540", gradient: "flowCyan", delay: 0.2 },
];

/**
 * Pointer parallax. Each layer subscribes with its own depth factor, so the
 * scene separates as the cursor moves instead of sliding as one flat plane.
 */
function useParallax(reduced: boolean) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  // Heavy spring — the background should lag well behind the cursor, never
  // track it. Tracking reads as a gimmick; lag reads as depth.
  const x = useSpring(px, { stiffness: 40, damping: 26, mass: 1.2 });
  const y = useSpring(py, { stiffness: 40, damping: 26, mass: 1.2 });

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [px, py, reduced]);

  return { x, y };
}

export function AuthFlowBackground() {
  const reduced = useReducedMotion() ?? false;
  const { x, y } = useParallax(reduced);

  // Depth factors, far layer to near.
  const auroraX = useTransform(x, (v) => v * -50);
  const auroraY = useTransform(y, (v) => v * -50);
  const linesX = useTransform(x, (v) => v * -22);
  const linesY = useTransform(y, (v) => v * -22);
  const glowAX = useTransform(x, (v) => v * 70);
  const glowAY = useTransform(y, (v) => v * 70);
  const glowBX = useTransform(x, (v) => v * -90);
  const glowBY = useTransform(y, (v) => v * -90);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0e0e13_0%,_#050507_100%)]" />

      {/* Aurora wash — one slow rotation, nothing else */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[1500px] w-[1500px] rounded-full"
        style={{
          x: auroraX,
          y: auroraY,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "conic-gradient(from 0deg, rgba(6,182,212,0.06), rgba(139,92,246,0.05), transparent 50%, rgba(34,211,238,0.05), rgba(6,182,212,0.06))",
          filter: "blur(140px)",
        }}
        initial={{ opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, rotate: 360 }}
        transition={{
          opacity: { duration: 0.7, ease: "easeOut" },
          rotate: { duration: 90, repeat: Infinity, ease: "linear" },
        }}
      />

      {/* Flow lines */}
      <motion.svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        style={{ x: linesX, y: linesY }}
      >
        <defs>
          <linearGradient id="flowCyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flowViolet" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
          <filter id="pulseGlow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {FLOW_PATHS.map((path, i) => (
          <g key={path.d}>
            <motion.path
              d={path.d}
              fill="none"
              stroke={`url(#${path.gradient})`}
              strokeWidth="1"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 1.2, delay: path.delay, ease: [0.16, 1, 0.3, 1] }
              }
            />

            {/* One pulse per line. Native SMIL — no JS per frame. */}
            {!reduced && (
              <circle r="2.5" fill="#22d3ee" filter="url(#pulseGlow)" opacity="0">
                <animateMotion
                  dur={`${9 + i * 2}s`}
                  begin={`${path.delay + 1}s`}
                  repeatCount="indefinite"
                  path={path.d}
                  rotate="auto"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.85;0.85;0"
                  keyTimes="0;0.12;0.8;1"
                  dur={`${9 + i * 2}s`}
                  begin={`${path.delay + 1}s`}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        ))}
      </motion.svg>

      {/* Two accent glows, breathing out of phase */}
      <motion.div
        className="absolute left-[18%] top-[-10%] h-[620px] w-[620px] rounded-full bg-cyan-500/[0.045] blur-[190px]"
        style={{ x: glowAX, y: glowAY }}
        initial={{ opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 0.55, 1] }}
        transition={
          reduced
            ? { duration: 0.4 }
            : { duration: 14, repeat: Infinity, ease: "easeInOut", times: [0, 0.06, 0.5, 1] }
        }
      />
      <motion.div
        className="absolute bottom-[-12%] right-[16%] h-[540px] w-[540px] rounded-full bg-violet-500/[0.045] blur-[190px]"
        style={{ x: glowBX, y: glowBY }}
        initial={{ opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 0.5, 1] }}
        transition={
          reduced
            ? { duration: 0.4 }
            : { duration: 17, delay: 0.2, repeat: Infinity, ease: "easeInOut", times: [0, 0.06, 0.5, 1] }
        }
      />

      {/* A single horizon line, drawn once. The one hard edge in the composition. */}
      <motion.div
        className="absolute left-0 right-0 top-1/2 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(34,211,238,0.14) 35%, rgba(168,85,247,0.14) 65%, transparent)",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#050507_72%)]" />
    </div>
  );
}
