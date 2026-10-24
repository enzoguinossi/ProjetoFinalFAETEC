import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  // Dev atrás do túnel (localhost:3000): o Next não aceita um curinga global,
  // então listamos os hosts em uso — o túnel e os locais. Em produção, troque pelo
  // domínio real.
  allowedDevOrigins: ["localhost:3000", "localhost", "127.0.0.1"],
  experimental: {
    typedEnv: true,
    serverActions: {
      allowedOrigins: ["localhost:3000", "localhost:3000", "127.0.0.1:3000"],
    },
  },
};

export default nextConfig;