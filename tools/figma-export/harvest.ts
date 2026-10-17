/**
 * Colheita: sobe a aplicação contra o banco isolado da exportação, percorre
 * cada cenário em um navegador real e grava
 *
 *   out/figma-export/scenes.json      — manifesto
 *   out/figma-export/scenes/<slug>.json — árvore de nós + tabela de estilos
 *   out/figma-export/screens/<slug>.png — captura 1:1 (referência)
 *
 * Nada aqui é consumido pela aplicação: é ferramental de desenvolvimento.
 *
 * Uso:
 *   npm run figma:harvest
 *   npm run figma:harvest -- --only produtos/lista --only acesso/login
 *   npm run figma:harvest -- --app-url http://localhost:3000   (usa um dev já rodando)
 */
import "./bootstrap";

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Browser, type Page } from "playwright-core";

import {
  APP_PORT,
  APP_URL,
  DEVICE_SCALE,
  OUT_DIR,
  ROOT,
  SCENES_FILE,
  SCREENS_DIR,
  SERVER_PORT,
  TOOL_DIR,
  VIEWPORT,
  exportDatabaseUrl,
} from "./config";
import { GLOBAL_HIDE, selecionar, type Scenario, type ScenarioStep } from "./scenarios";
import { COOKIE_NAME, criarSessao } from "./session";
import { ORIGEM } from "./origem";

/* ══════════════════════════════ argumentos ══════════════════════════════ */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function argAll(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((value, i) => {
    if (value === name && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
}

const appareUrl = arg("--app-url");
const somente = argAll("--only");
const semFixtures = process.argv.includes("--no-fixtures");
const navegador = arg("--browser");

const escopo = selecionar(somente.length ? somente : undefined);

/* ══════════════════════════════ utilidades ══════════════════════════════ */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function slug(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "__");
}

function log(mensagem: string) {
  console.log(mensagem);
}

/** Aguarda a aplicação responder. */
async function esperarApp(url: string, timeoutMs = 180_000) {
  const prazo = Date.now() + timeoutMs;
  while (Date.now() < prazo) {
    try {
      const res = await fetch(`${url}/login`, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      /* ainda subindo */
    }
    await sleep(1000);
  }
  throw new Error(`A aplicação não respondeu em ${timeoutMs}ms (${url}).`);
}

function iniciarApp(): ChildProcess {
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  log(`▶️  Subindo a aplicação em ${APP_URL} (banco de exportação)`);
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(APP_PORT)], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: exportDatabaseUrl(), PORT: String(APP_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (data: Buffer) => {
    const texto = data.toString();
    if (/error|Error|✗|failed/.test(texto)) process.stdout.write(`   [next] ${texto.trim()}\n`);
  });
  child.stderr?.on("data", (data: Buffer) => {
    process.stdout.write(`   [next:err] ${data.toString().trim()}\n`);
  });
  return child;
}

/** Encerra o dev server e toda a árvore de processos filhos. */
async function encerrarApp(child: ChildProcess) {
  if (!child.pid || child.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
  await new Promise((resolver) => setTimeout(resolver, 200));
}

/** Roda um script Node do projeto herdando o ambiente (já apontado ao banco de exportação). */
async function rodar(rotulo: string, argumentos: string[]): Promise<void> {
  log(`▶️  ${rotulo}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, argumentos, {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: exportDatabaseUrl() },
      stdio: "inherit",
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${rotulo} falhou (código ${code})`)),
    );
  });
}

const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const PRISMA = path.join(ROOT, "node_modules", "prisma", "build", "index.js");

/** Garante que o banco de exportação existe com o schema atual. */
async function garantirSchema(): Promise<void> {
  await rodar("Sincronizando o schema no banco de exportação", [PRISMA, "db", "push"]);
}

/** Dados de referência da aplicação (permissões, perfis-template, conversões). */
async function garantirSeed(): Promise<void> {
  await rodar("Aplicando o seed de referência", [TSX, path.join(ROOT, "prisma", "seed.ts")]);
}

async function limparCadastros(): Promise<void> {
  await rodar("Limpando cadastros (banco sem administrador)", [
    TSX,
    path.join(TOOL_DIR, "fixtures.ts"),
    "--clean",
  ]);
}

async function aplicarFixtures(): Promise<void> {
  await rodar("Aplicando fixtures no banco de exportação", [
    TSX,
    path.join(TOOL_DIR, "fixtures.ts"),
  ]);
}

/* ══════════════════════════════ motor de captura ══════════════════════════════ */

/** CSS que congela a página: sem animações, sem cursores, sem overlay de dev. */
const CONGELAR = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
  ${GLOBAL_HIDE.join(",\n  ")} { display: none !important; }
`;

const walkerSrc = readFileSync(path.join(TOOL_DIR, "dom-walker.js"), "utf8");const walker = new Function(`${walkerSrc}\nreturn walkDom;`)() as (
  opts: unknown,
) => Promise<unknown>;

/** Exporta todos os ícones de `public/icons` para o plugin montar a biblioteca. */
function exportarIcones(): number {
  const raiz = path.join(ROOT, "public", "icons");
  const icones: { nome: string; arquivo: string; svg: string }[] = [];

  const percorrer = (pasta: string) => {
    for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
      const caminho = path.join(pasta, entrada.name);
      if (entrada.isDirectory()) {
        percorrer(caminho);
      } else if (entrada.name.toLowerCase().endsWith(".svg")) {
        icones.push({
          nome: path.basename(entrada.name, path.extname(entrada.name)),
          arquivo: path
            .relative(path.join(ROOT, "public"), caminho)
            .split(path.sep)
            .join("/"),
          svg: readFileSync(caminho, "utf8"),
        });
      }
    }
  };
  if (existsSync(raiz)) percorrer(raiz);

  writeFileSync(
    path.join(OUT_DIR, "icons.json"),
    JSON.stringify({ icons: icones.sort((a, b) => a.nome.localeCompare(b.nome)) }),
    "utf8",
  );
  return icones.length;
}

/** Guarda HTML e captura de uma tela que falhou, para inspeção. */
async function registrarDiagnostico(page: Page, cena: Scenario) {
  try {
    const pasta = path.join(OUT_DIR, "debug");
    mkdirSync(pasta, { recursive: true });
    const arquivo = slug(cena.id);
    writeFileSync(path.join(pasta, `${arquivo}.html`), await page.content(), "utf8");
    await page.screenshot({ path: path.join(pasta, `${arquivo}.png`) });
    log(`   ↳ diagnóstico: out/figma-export/debug/${arquivo}.html`);
  } catch {
    /* o diagnóstico é melhor esforço */
  }
}

interface ResultadoCena {
  ids: string;
  caminho: string;
  stats: { nodes: number; styles: number; hoisted: number };
  warnings: string[];
}

async function capturarCena(
  page: Page,
  cena: Scenario,
  sessao: string | null,
): Promise<ResultadoCena> {
  const arquivo = slug(cena.id);

  if (sessao) {
    await page.context().addCookies([
      {
        name: COOKIE_NAME,
        value: sessao,
        url: (appareUrl ?? APP_URL) + "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }

  const errosConsole: string[] = [];
  page.on("pageerror", (erro) => errosConsole.push(`pageerror: ${erro.message}`));

  const endereco = `${appareUrl ?? APP_URL}${cena.route}`;
  let ultimoErro: unknown = null;
  let pronta = false;

  for (let tentativa = 1; tentativa <= 2 && !pronta; tentativa++) {
    try {
      await page.goto(endereco, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.addStyleTag({ content: CONGELAR });
      await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => {});
      // Em `next dev` a primeira carga da rota compila a página no servidor;
      // esperar reduz os cliques que escapam antes da hidratação do React.
      await page.waitForTimeout(tentativa === 1 ? 700 : 1400);

      // A sidebar busca o usuário em uma server action depois do mount: sem
      // esta espera ela é capturada mostrando "Carregando...".
      await page
        .locator("aside")
        .getByText("Carregando...")
        .first()
        .waitFor({ state: "detached", timeout: 8_000 })
        .catch(() => {});

      for (const passo of cena.steps ?? []) {
        await executarPasso(page, passo, cena);
      }
      pronta = true;
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < 2) await page.waitForTimeout(600);
    }
  }

  if (!pronta) {
    await registrarDiagnostico(page, cena);
    throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
  }

  // a página pode ter re-renderizado: garante o CSS e o scroll zerado
  await page.addStyleTag({ content: CONGELAR });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);

  const png = path.join(SCREENS_DIR, `${arquivo}.png`);
  await page.screenshot({ path: png, animations: "disabled" });

  const resultado = (await page.evaluate(walker, {
    viewport: VIEWPORT,
    maxNodes: 9000,
  })) as {
    root: unknown;
    styles: unknown[];
    warnings: string[];
    stats: { nodes: number; styles: number; hoisted: number };
  };

  const cenaJson = {
    id: cena.id,
    title: cena.title,
    group: cena.group,
    route: cena.route,
    viewport: VIEWPORT,
    refImage: `screens/${arquivo}.png`,
    styles: resultado.styles,
    root: resultado.root,
  };
  writeFileSync(
    path.join(OUT_DIR, "scenes", `${arquivo}.json`),
    JSON.stringify(cenaJson),
    "utf8",
  );

  return {
    ids: cena.id,
    caminho: `scenes/${arquivo}.json`,
    stats: resultado.stats,
    warnings: [...resultado.warnings, ...errosConsole],
  };
}

async function clicar(page: Page, alvo: string, cena: Scenario) {
  const pareceSeletor = /[\[\]#.:>]/.test(alvo) || /^[a-z]+\s*\[/.test(alvo);
  const locator = pareceSeletor
    ? page.locator(alvo).first()
    : page.getByText(alvo, { exact: true }).first();

  const quantidade = await locator.count().catch(() => 0);
  if (quantidade === 0) {
    throw new Error(`[${cena.id}] elemento não encontrado para clicar: "${alvo}"`);
  }
  await locator.click({ timeout: 15_000 });
}

async function executarPasso(page: Page, passo: ScenarioStep, cena: Scenario) {
  if (passo.fill) {
    await page.fill(passo.fill.selector, passo.fill.value, { timeout: 15_000 });
    return;
  }

  if (passo.click) {
    if (!passo.waitFor) {
      await clicar(page, passo.click, cena);
    } else {
      // Em `next dev` o primeiro clique pode escapar antes da hidratação do
      // React. Clicamos, confirmamos o efeito e repetimos se necessário.
      let sucesso = false;
      for (let tentativa = 1; tentativa <= 4 && !sucesso; tentativa++) {
        await clicar(page, passo.click, cena);
        try {
          await page.waitForSelector(passo.waitFor, { timeout: 3_000, state: "attached" });
          sucesso = true;
        } catch {
          await page.waitForTimeout(400);
        }
      }
      if (!sucesso) {
        throw new Error(
          `[${cena.id}] clicar em "${passo.click}" não fez aparecer "${passo.waitFor}" (4 tentativas)`,
        );
      }
    }
  }

  if (passo.waitForOnly) {
    await page.waitForSelector(passo.waitForOnly, { timeout: 20_000, state: "attached" });
  }

  if (passo.waitForText) {
    await page.getByText(passo.waitForText, { exact: false }).first().waitFor({ timeout: 20_000 });
  }

  if (passo.waitMs) {
    await page.waitForTimeout(passo.waitMs);
  }
}

/* ══════════════════════════════ execução ══════════════════════════════ */

async function novoBrowser(): Promise<Browser> {
  const canais = navegador ? [navegador] : ["chrome", "msedge"];
  let ultimoErro: unknown;
  for (const channel of canais) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (erro) {
      ultimoErro = erro;
      log(`   ⚠️  Não foi possível abrir o canal "${channel}", tentando o próximo…`);
    }
  }
  throw new Error(`Nenhum navegador disponível (${canais.join(", ")}). Último erro: ${ultimoErro}`);
}

async function main() {
  rmSync(path.join(OUT_DIR, "scenes"), { recursive: true, force: true });
  rmSync(SCREENS_DIR, { recursive: true, force: true });
  mkdirSync(path.join(OUT_DIR, "scenes"), { recursive: true });
  mkdirSync(SCREENS_DIR, { recursive: true });

  /** Com `--app-url` a responsabilidade do banco é de quem chamou. */
  const prepararBanco = !appareUrl;
  const totalIcones = exportarIcones();
  log(`🎨 ${totalIcones} ícones exportados de public/icons`);

  if (prepararBanco) {
    await garantirSchema();
    await garantirSeed();
  }

  const app = prepararBanco ? iniciarApp() : null;
  let browser: Browser | null = null;
  const resultados: ResultadoCena[] = [];
  const falhas: { id: string; erro: string }[] = [];

  try {
    await esperarApp(appareUrl ?? APP_URL);
    log("✅ Aplicação respondendo");

    browser = await novoBrowser();
    log(`✅ Navegador pronto`);

    const contexto = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE,
      reducedMotion: "reduce",
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      colorScheme: "light",
    });
    const page = await contexto.newPage();

    /* ── passo 1: telas de primeiro acesso (banco sem administrador) ── */
    const passo1 = escopo.filter((c) => c.pass === 1);
    if (passo1.length > 0 && prepararBanco) {
      await limparCadastros();
    }
    for (const cena of passo1) {
      await processarCena(page, cena, null);
    }

    /* ── fixtures + sessão ── */
    const passo2 = escopo.filter((c) => c.pass !== 1);
    if (passo2.length > 0 && prepararBanco && !semFixtures) {
      await aplicarFixtures();
    }

    let sessao: string | null = null;
    if (passo2.some((c) => c.auth !== false)) {
      const criada = await criarSessao();
      sessao = criada.token;
      log(`✅ Sessão emitida para ${criada.login}`);
    }

    for (const cena of passo2) {
      await processarCena(page, cena, cena.auth === false ? null : sessao);
    }
  } finally {
    await browser?.close().catch(() => {});
    if (app) await encerrarApp(app);
  }

  /* ── manifesto ── */
  const manifesto = {
    generatedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    scale: DEVICE_SCALE,
    sceneServer: `http://localhost:${SERVER_PORT}`,
    scenes: escopo.map((c) => ({
      id: c.id,
      title: c.title,
      group: c.group,
      route: c.route,
      file: `scenes/${slug(c.id)}.json`,
      refImage: `screens/${slug(c.id)}.png`,
    })),
    sentinel: { total: escopo.length, capturadas: resultados.length, falhas: falhas.length },
    // O plugin carimba a descrição de cada mestre com o caminho do código, e o
    // `figma:diff` usa a mesma tabela para apontar onde mexer.
    origem: ORIGEM,
  };
  writeFileSync(SCENES_FILE, JSON.stringify(manifesto, null, 2), "utf8");

  log("");
  log(`📦 ${resultados.length}/${escopo.length} cenários capturados`);
  const avisos = resultados.flatMap((r) => r.warnings);
  if (avisos.length) {
    log(`⚠️  ${avisos.length} aviso(s) do caminhador:`);
    for (const aviso of [...new Set(avisos)].slice(0, 15)) log(`   • ${aviso}`);
  }
  if (falhas.length) {
    log(`❌ ${falhas.length} cenário(s) falharam:`);
    for (const falha of falhas) log(`   • ${falha.id}: ${falha.erro}`);
    process.exitCode = 1;
  }
  log(`\nManifesto: ${path.relative(ROOT, SCENES_FILE)}`);
  log(`Sirva para o plugin com: npm run figma:serve`);

  // O dev server e o navegador podem segurar o event loop: encerra explícito.
  await new Promise((resolver) => setTimeout(resolver, 200));
  process.exit(falhas.length ? 1 : 0);

  async function processarCena(page: Page, cena: Scenario, sessao: string | null) {
    const inicio = Date.now();
    try {
      const resultado = await capturarCena(page, cena, sessao);
      resultados.push(resultado);
      log(
        `  ✓ ${cena.id.padEnd(34)} ${resultado.stats.nodes} nós / ${resultado.stats.styles} estilos  (${Date.now() - inicio}ms)`,
      );
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      falhas.push({ id: cena.id, erro: mensagem });
      log(`  ✗ ${cena.id.padEnd(34)} ${mensagem.split("\n")[0]}`);
    }
  }
}

main().catch((erro) => {
  console.error("\n❌ Colheita interrompida:\n", erro);
  process.exit(1);
});
