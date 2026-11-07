#!/usr/bin/env node
/**
 * Empacota o build standalone do Next para o instalador do Nexus.
 *
 * Pré-requisito: `next build` já executado com `output: "standalone"`
 * (`npm run build:standalone`). O script:
 *
 *   1. copia `.next/standalone/*` para `out/standalone/app`;
 *   2. copia `.next/static` para `out/standalone/app/.next/static`;
 *   3. copia `public` para `out/standalone/app/public`, exceto `public/uploads`
 *      (uploads de runtime vivem em `UPLOADS_DIR`, fora da instalação);
 *   4. remove qualquer arquivo `.env*` que tenha entrado no rastro (o pacote
 *      nunca carrega segredos);
 *   5. gera `out/standalone/app.zip` com `Compress-Archive` do Windows.
 *
 * Não adiciona dependência: o zip usa o PowerShell já presente no Windows,
 * alvo do instalador (desktop only).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STANDALONE_BUILD = path.join(ROOT, ".next", "standalone");
const STATIC_BUILD = path.join(ROOT, ".next", "static");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_ROOT = path.join(ROOT, "out", "standalone");
const APP_DIR = path.join(OUT_ROOT, "app");
const ZIP_FILE = path.join(OUT_ROOT, "app.zip");

function fail(message) {
  console.error(`\n[ERRO] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`  ${message}`);
}

if (!fs.existsSync(STANDALONE_BUILD) || !fs.existsSync(path.join(STANDALONE_BUILD, "server.js"))) {
  fail(
    "Build standalone não encontrado em .next/standalone. " +
      "Rode `npm run build:standalone` (ou `npm run build`) antes de empacotar.",
  );
}
if (!fs.existsSync(STATIC_BUILD)) {
  fail("Diretório .next/static não encontrado. Rode o build antes de empacotar.");
}

console.log("==> Empacotando o app standalone");
fs.rmSync(OUT_ROOT, { recursive: true, force: true });
fs.mkdirSync(OUT_ROOT, { recursive: true });

// 1. Servidor + dependências rastreadas pelo Next.
fs.cpSync(STANDALONE_BUILD, APP_DIR, { recursive: true });
info(`standalone → ${path.relative(ROOT, APP_DIR)}`);

// 2. Assets estáticos (o standalone não os copia por padrão).
const staticDest = path.join(APP_DIR, ".next", "static");
fs.mkdirSync(path.dirname(staticDest), { recursive: true });
fs.cpSync(STATIC_BUILD, staticDest, { recursive: true });
info(`.next/static → ${path.relative(ROOT, staticDest)}`);

// 3. `public` sem uploads de runtime. O standalone pode trazer `public/uploads`
// pelo rastro da rota de uploads; a cópia abaixo substitui o diretório inteiro.
const publicDest = path.join(APP_DIR, "public");
fs.rmSync(publicDest, { recursive: true, force: true });
if (fs.existsSync(PUBLIC_DIR)) {
  fs.cpSync(PUBLIC_DIR, publicDest, {
    recursive: true,
    filter(source) {
      const relative = path.relative(PUBLIC_DIR, source);
      if (!relative) return true;
      const firstSegment = relative.split(path.sep)[0].toLowerCase();
      return firstSegment !== "uploads";
    },
  });
  info(`public (sem uploads) → ${path.relative(ROOT, publicDest)}`);
} else {
  info("public ausente; seguindo sem assets públicos");
}
if (fs.existsSync(path.join(publicDest, "uploads"))) {
  fail("public/uploads entrou no pacote; uploads de runtime não fazem parte da instalação.");
}

// 4. Nenhum segredo no pacote: remove `.env*` em qualquer nível.
function removeEnvFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      removeEnvFiles(full);
      continue;
    }
    if (/^\.env(\.|$)/i.test(entry.name)) {
      fs.rmSync(full, { force: true });
      info(`removido do pacote: ${path.relative(APP_DIR, full)}`);
    }
  }
}
removeEnvFiles(APP_DIR);

for (const required of ["server.js", path.join(".next", "static")]) {
  if (!fs.existsSync(path.join(APP_DIR, required))) {
    fail(`Pacote incompleto: ${required} não existe em ${path.relative(ROOT, APP_DIR)}.`);
  }
}

// Client Prisma: confirma o rastro e avisa (não falha) se não veio.
const prismaClient = path.join(APP_DIR, "node_modules", ".prisma", "client", "index.js");
if (fs.existsSync(prismaClient)) {
  info("client Prisma presente no pacote (node_modules/.prisma/client)");
} else {
  info("[AVISO] client Prisma não encontrado em node_modules/.prisma/client");
}

// 5. Zip (Compress-Archive, sem dependência nova).
if (process.platform !== "win32") {
  fail("O empacotamento usa Compress-Archive do Windows (plataforma alvo do instalador).");
}
const powershell = path.join(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
if (!fs.existsSync(powershell)) {
  fail(`PowerShell não encontrado em ${powershell}.`);
}

fs.rmSync(ZIP_FILE, { force: true });
const command = `Compress-Archive -Path '${path.join(APP_DIR, "*")}' -DestinationPath '${ZIP_FILE}' -Force`;
execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], {
  cwd: ROOT,
  stdio: "inherit",
});

if (!fs.existsSync(ZIP_FILE)) {
  fail(`O zip não foi gerado em ${path.relative(ROOT, ZIP_FILE)}.`);
}

const sizeMb = (fs.statSync(ZIP_FILE).size / (1024 * 1024)).toFixed(1);
console.log(`\nOK: ${path.relative(ROOT, ZIP_FILE)} (${sizeMb} MB)`);
