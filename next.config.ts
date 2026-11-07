import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const pkg: { version?: string } = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
);

// O host do túnel vem do ambiente (TUNNEL_HOST), nunca do repositório.
const tunnelHost = process.env.TUNNEL_HOST?.trim();

const nextConfig: NextConfig = {
  // Gera `.next/standalone` com o servidor e as dependências rastreadas; o
  // `scripts/empacotar-standalone.mjs` completa o pacote com `.next/static` e
  // `public` (sem uploads) para o instalador autocontido.
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version ?? "",
  },
  serverExternalPackages: [],
  // Hosts de desenvolvimento: os locais e, se configurado fora do repositório,
  // o host do túnel (TUNNEL_HOST no .env local).
  allowedDevOrigins: tunnelHost
    ? ["localhost", "127.0.0.1", tunnelHost]
    : ["localhost", "127.0.0.1"],
  experimental: {
    typedEnv: true,
    serverActions: {
      bodySizeLimit: "30mb",
      allowedOrigins: tunnelHost
        ? ["localhost:3000", "127.0.0.1:3000", tunnelHost]
        : ["localhost:3000", "127.0.0.1:3000"],
    },
  },
};

export default nextConfig;