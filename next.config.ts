import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase body size limit for API routes handling large media files
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Suppress punycode deprecation warning
  serverExternalPackages: ["punycode"],
};

export default nextConfig;
