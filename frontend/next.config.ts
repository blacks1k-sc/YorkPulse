import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone' produces a self-contained Node.js server in .next/standalone/
  // Required for Docker deployment (Azure Container Apps).
  // Standalone output includes only the files needed at runtime — no full node_modules.
  // The Docker runner stage copies .next/standalone/ + .next/static/ only, keeping
  // the production image small. Vercel ignores this setting — safe to keep enabled.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
