import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const pkg: { version?: string } = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version ?? "",
  },
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