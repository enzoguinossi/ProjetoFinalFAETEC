import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-auth"],
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;