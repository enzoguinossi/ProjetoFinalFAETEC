import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;