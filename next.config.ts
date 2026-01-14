import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignore TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Increase body size limit for API routes handling large media files
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Exclude large binaries from serverless function traces (moved from experimental in Next.js 16)
  outputFileTracingExcludes: {
    "*": [
      // FFmpeg binaries (very large) - these run on Trigger.dev, not Vercel
      "node_modules/ffmpeg-static/**",
      "node_modules/@ffmpeg-installer/**",
      "node_modules/@ffprobe-installer/**",
      // Sharp unused platform binaries
      "node_modules/sharp/vendor/**",
      // Other large unused binaries  
      "node_modules/esbuild/bin/**",
      "node_modules/esbuild-*/**",
      "node_modules/turbo-*/**",
      // NOTE: Do NOT exclude Prisma engines - they are needed!
    ],
  },
  // External packages - don't bundle these (they have native binaries or unsupported file types)
  serverExternalPackages: [
    "punycode",
    "ffmpeg-static",
    "@ffprobe-installer/ffprobe",
    "@ffmpeg-installer/ffmpeg",
  ],
};

export default nextConfig;
