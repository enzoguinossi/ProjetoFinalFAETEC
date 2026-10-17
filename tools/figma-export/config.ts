/**
 * Configuração compartilhada das ferramentas de exportação para o Figma.
 *
 * Este diretório NÃO faz parte da aplicação: é ferramental de desenvolvimento
 * (`tools/`), executado com `tsx`, e nunca é importado pelo bundle do Next.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(TOOL_DIR, "..", "..");

export const OUT_DIR = path.join(ROOT, "out", "figma-export");
export const SCREENS_DIR = path.join(OUT_DIR, "screens");
export const ASSETS_DIR = path.join(OUT_DIR, "assets");
export const STATE_FILE = path.join(OUT_DIR, "state.json");
export const SCENES_FILE = path.join(OUT_DIR, "scenes.json");

/** Snapshots lidos de volta do Figma: um arquivo por página lida. */
export const FIGMA_DIR = path.join(OUT_DIR, "figma");
/** Tokens do app — a contraparte das variáveis do Figma em `figma:diff`. */
export const GLOBALS_CSS = path.join(ROOT, "src", "app", "globals.css");

/** Nome do banco isolado usado apenas para a exportação (nunca o banco de dev). */
export const EXPORT_DB_NAME = "nexus_figma_export";

/**
 * Carrega `.env` sem depender do pacote `dotenv`.
 * A raiz é carregada primeiro; `tools/figma-export/.env` sempre sobrescreve.
 */
function loadEnvFile(file: string, force: boolean) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (force || !process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env"), false);
loadEnvFile(path.join(TOOL_DIR, ".env"), true);

/**
 * `DATABASE_URL` da **aplicação** — o "banco-base" — capturada no carregamento
 * deste módulo, antes de `bootstrap.ts` redirecioná-la para o banco isolado.
 *
 * É contra este nome que os fixtures conferem se **não** vão apagar dados de
 * desenvolvimento (ver `exigirBancoIsolado` em `fixtures.ts`). Como o processo da
 * colheita já roda com a variável redirecionada, quem o chama (os fixtures) é
 * spawnado sem a `DATABASE_URL` do banco de exportação, para que o filho a
 * resolva do `.env` — exatamente como numa execução direta.
 */
export const BASE_DATABASE_URL: string = process.env.DATABASE_URL ?? "";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Porta do `next dev` usado só pela colheita. */
export const APP_PORT = intEnv("FIGMA_EXPORT_APP_PORT", 3210);
/** Porta do servidor local que entrega cenas/imagens ao plugin do Figma. */
export const SERVER_PORT = intEnv("FIGMA_EXPORT_SERVER_PORT", 5178);

export const APP_URL = `http://localhost:${APP_PORT}`;
/** Precisa ser `localhost` para casar com o `devAllowedDomains` do manifest. */
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;

/** Viewport congelado na colheita e usado como tamanho do frame no Figma. */
export const VIEWPORT = { width: 1366, height: 768 };
export const DEVICE_SCALE = 2;

/** Segredo do JWT vem da aplicação (nunca é escrito em nenhum artefato). */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não definida. Configure o .env da raiz.");
  return secret;
}

/** URL do banco de desenvolvimento (origem das credenciais de conexão). */
export function baseDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida. Configure o .env da raiz.");
  return url;
}

/**
 * URL do banco isolado da exportação.
 *
 * Por padrão deriva da `DATABASE_URL` trocando apenas o nome do banco, para
 * reaproveitar host/porta/usuário. Pode ser sobrescrita com
 * `FIGMA_EXPORT_DATABASE_URL` em `tools/figma-export/.env`.
 */
export function exportDatabaseUrl(): string {
  const override = process.env.FIGMA_EXPORT_DATABASE_URL;
  if (override) return override;
  const url = new URL(baseDatabaseUrl());
  url.pathname = `/${EXPORT_DB_NAME}`;
  return url.toString();
}
