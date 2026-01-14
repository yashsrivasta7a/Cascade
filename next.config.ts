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
  // External packages - don't bundle these (they have native binaries or unsupported file types)
  serverExternalPackages: [
    "punycode",
    "ffmpeg-static",
    "@ffprobe-installer/ffprobe",
  ],
};

export default nextConfig;
