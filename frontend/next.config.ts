import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // required for Docker/Azure Container Apps deployment
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
