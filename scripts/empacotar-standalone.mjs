#!/usr/bin/env node
/**
 * Empacota o build standalone do Next para o instalador do Nexus.
 *
 * Pré-requisito: `next build` já executado com `output: "standalone"`
 * (`npm run build:standalone`). O script:
 *
 *   1. copia `.next/standalone/*` para `out/standalone/app`;
 *   2. copia os pacotes nativos `sharp` e `@img` do repositório. O rastro do
 *      Next inclui o JS do sharp e o `.node`, mas perde as DLLs do libvips em
 *      `@img/sharp-win32-x64/lib`; copiá-los explicitamente evita o
 *      `ERR_DLOPEN_FAILED` do app instalado;
 *   3. copia `.next/static` para `out/standalone/app/.next/static`;
 *   4. copia `public` para `out/standalone/app/public`, exceto `public/uploads`
 *      (uploads de runtime vivem em `UPLOADS_DIR`, fora da instalação);
 *   5. remove qualquer arquivo `.env*` que tenha entrado no rastro (o pacote
 *      nunca carrega segredos);
 *   6. gera `out/standalone/app.zip` com `Compress-Archive` do Windows.
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

// 2. Pacotes nativos do sharp. O rastro do Next perde as DLLs do libvips
// (`@img/sharp-win32-x64/lib/libvips*.dll`), então copiamos os pacotes
// completos do repositório por cima do que veio no standalone.
for (const pkg of ["sharp", "@img"]) {
  const src = path.join(ROOT, "node_modules", pkg);
  const dst = path.join(APP_DIR, "node_modules", pkg);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.cpSync(src, dst, { recursive: true, force: true });
    info(`node_modules/${pkg} → ${path.relative(ROOT, dst)}`);
  } else {
    info(`[AVISO] node_modules/${pkg} ausente no repositório; pacote nativo pode ficar incompleto`);
  }
}

// 3. Assets estáticos (o standalone não os copia por padrão).
const staticDest = path.join(APP_DIR, ".next", "static");
fs.mkdirSync(path.dirname(staticDest), { recursive: true });
fs.cpSync(STATIC_BUILD, staticDest, { recursive: true });
info(`.next/static → ${path.relative(ROOT, staticDest)}`);

// 4. `public` sem uploads de runtime. O standalone pode trazer `public/uploads`
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

// 5. Nenhum segredo no pacote: remove `.env*` em qualquer nível.
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

// O sharp nativo precisa do `.node` e das DLLs do libvips; sem elas o app
// instalado falha com ERR_DLOPEN_FAILED ao processar imagens.
const sharpLibDir = path.join(APP_DIR, "node_modules", "@img", "sharp-win32-x64", "lib");
const sharpNode = fs.existsSync(sharpLibDir)
  ? fs.readdirSync(sharpLibDir).find((name) => name.endsWith(".node"))
  : undefined;
const libvipsDll = fs.existsSync(sharpLibDir)
  ? fs.readdirSync(sharpLibDir).find((name) => /^libvips-.*\.dll$/i.test(name))
  : undefined;
if (!sharpNode || !libvipsDll) {
  fail(
    `Pacote nativo do sharp incompleto em ${path.relative(ROOT, sharpLibDir)}: ` +
      `esperado o arquivo .node e libvips-42.dll (encontrado ` +
      `${sharpNode ?? "nenhum .node"}, ${libvipsDll ?? "nenhuma DLL do libvips"}). ` +
      "Confira node_modules/@img no repositório.",
  );
}
info(`sharp nativo completo: ${sharpNode} + ${libvipsDll}`);

// Client Prisma: confirma o rastro e avisa (não falha) se não veio.
const prismaClient = path.join(APP_DIR, "node_modules", ".prisma", "client", "index.js");
if (fs.existsSync(prismaClient)) {
  info("client Prisma presente no pacote (node_modules/.prisma/client)");
} else {
  info("[AVISO] client Prisma não encontrado em node_modules/.prisma/client");
}

// 6. Zip (Compress-Archive, sem dependência nova).
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
