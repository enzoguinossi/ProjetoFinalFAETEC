import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import "dotenv/config";

const urlDeTeste =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL?.replace(/\/[^/?]+(\?.*)?$/, "/nexus_test$1");

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: urlDeTeste
      ? { TEST_DATABASE_URL: urlDeTeste, DATABASE_URL: urlDeTeste }
      : {},
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/dao/**/*.ts", "src/services/**/*.ts", "src/lib/**/*.ts"],
      exclude: [
        "src/dao/index.ts",
        "src/services/index.ts",
        "src/lib/imagem.ts",
        "src/lib/prisma.ts",
        "src/lib/auth.ts",
        "src/lib/cookies.ts",
        "src/lib/jwt.ts",
        "src/lib/permissoes.ts",
        "src/lib/use-lista-paginada.ts",
        "src/lib/ui.ts",
      ],
      thresholds: {
        "src/dao/**/*.ts": { lines: 80 },
      },
    },
  },
});
