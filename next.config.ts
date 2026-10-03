import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-mariadb", "mariadb"],
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;