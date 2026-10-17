/**
 * Diff do design — o caminho de volta (Figma → app).
 *
 * Como o trabalho dos designers chega aqui:
 *   1. a reexportação reconstrói **duas** páginas — `Nexus · Componentes` e os
 *      frames `· EDIT`/`· REF` de `Nexus Export` —, então editar em cima do que
 *      foi exportado se perde na próxima importação. Por isso a regra é copiar
 *      o componente para uma página própria (`Page 1`) e editar a cópia lá;
 *   2. a cópia mantém o **nome** do mestre (`Button · primary · padrao`), e é
 *      pelo nome que este diff casa as duas pontas — vínculo de instância não
 *      importa, então *detach* não quebra nada;
 *   3. no plugin, a aba "Ler do Figma" lê essa página e envia um snapshot para
 *      `out/figma-export/figma/<pagina>.json`;
 *   4. este script compara o snapshot com a última colheita (o app como ele
 *      está) e com os tokens do `globals.css`, e escreve
 *      `out/figma-export/diff-design.md`.
 *
 * O relatório tem três níveis de certeza, e diz qual é qual:
 *   - **tokens e componentes** — casados por nome e com âncora de código: dá para
 *     implementar direto no arquivo apontado;
 *   - **telas** — os frames da camada editável têm nome de tag (`div`, `span`),
 *     então só dá para comparar tamanho e conjunto de elementos: o relatório
 *     aponta a tela, a interpretação é humana;
 *   - **sem correspondência** — o que aparece no Figma e não existe no app
 *     (componente novo) ou vice-versa: listado para revisão manual.
 *
 * Uso: npm run figma:diff              (usa a leitura mais recente)
 *      npm run figma:diff page-1       (usa out/figma-export/figma/page-1.json)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { FIGMA_DIR, GLOBALS_CSS, OUT_DIR, SCENES_FILE } from "./config";
import { ORIGEM } from "./origem";

/* ══════════════════════════════ formatos ══════════════════════════════ */

/** Nó do snapshot lido do Figma (o que `lerNo` do plugin escreve). */
interface NoFigma {
  tipo: string;
  nome: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visivel?: boolean;
  descricao?: string;
  texto?: string;
  fonte?: { familia: string | null; estilo: string | null; tamanho: number | null };
  layout?: { modo: string; gap: number; pad: number[]; principal: string; cruzado: string };
  fills?: Array<{ tipo: string; cor: string | null; opacidade: number; vinculo: string | null }>;
  strokes?: Array<{ tipo: string; cor: string | null; opacidade: number; vinculo: string | null }>;
  pesoContorno?: number;
  raio?: number[];
  componente?: string | null;
  ancoraDoComponente?: string | null;
  propriedades?: Record<string, unknown>;
  definicao?: string[];
  filhos?: NoFigma[];
}

interface Snapshot {
  pagina: string;
  lidoEm: string;
  variaveis: Array<{ colecao: string | null; nome: string; tipo: string; valor: string | number | null }>;
  raizes: NoFigma[];
}

/** Nó da colheita (o que o `dom-walker.js` escreve em `scenes/*.json`). */
interface NoCena {
  kind: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: number;
  componente?: string;
  componentProps?: Record<string, string>;
  layout?: {
    mode: string;
    gap: number;
    padding: number[];
    primaryAlign: string;
    counterAlign: string;
  };
  text?: { value?: string; style: { fontFamily: string; fontSize: number; fontWeight: number; color?: Cor } };
  children?: NoCena[];
}

interface Cor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface EstiloCena {
  bg: Cor | null;
  border: { color: Cor; style: string; w: number } | null;
  radius: number[];
  shadows: unknown[];
  opacity: number;
}

interface Cena {
  id: string;
  title: string;
  file?: string;
  group?: string;
  route?: string;
  styles: EstiloCena[];
  root: NoCena;
}

/* ══════════════════════════════ leitura ══════════════════════════════ */

function lerJson<T>(arquivo: string): T {
  return JSON.parse(readFileSync(arquivo, "utf8")) as T;
}

/** Snapshot pedido por argumento, ou o mais recente de `out/figma-export/figma`. */
function carregarSnapshot(pedido?: string): { arquivo: string; snapshot: Snapshot } | null {
  if (!existsSync(FIGMA_DIR)) return null;
  const arquivos = readdirSync(FIGMA_DIR).filter((nome) => nome.endsWith(".json"));
  if (!arquivos.length) return null;

  if (pedido) {
    const alvo = arquivos.find((nome) => nome === `${pedido}.json` || nome === pedido);
    if (!alvo) return null;
    return { arquivo: path.join(FIGMA_DIR, alvo), snapshot: lerJson<Snapshot>(path.join(FIGMA_DIR, alvo)) };
  }

  const recente = arquivos
    .map((nome) => ({ nome, mtime: statSync(path.join(FIGMA_DIR, nome)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0];
  const caminho = path.join(FIGMA_DIR, recente.nome);
  return { arquivo: caminho, snapshot: lerJson<Snapshot>(caminho) };
}

function cenarios(): Cena[] {
  if (!existsSync(SCENES_FILE)) return [];
  const manifesto = lerJson<{ scenes: Array<{ file?: string }> }>(SCENES_FILE);
  const saida: Cena[] = [];
  for (const cena of manifesto.scenes) {
    if (!cena.file) continue;
    const caminho = path.join(OUT_DIR, cena.file);
    if (existsSync(caminho)) saida.push(lerJson<Cena>(caminho));
  }
  return saida;
}

/* ══════════════════════════════ utilidades ══════════════════════════════ */

function hex(cor: Cor | null | undefined): string | null {
  if (!cor) return null;
  return (
    "#" +
    [cor.r, cor.g, cor.b]
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function arredondar(valor: number | null | undefined, casas = 2): number | null {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return null;
  const fator = Math.pow(10, casas);
  return Math.round(valor * fator) / fator;
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (Array.isArray(valor)) return "[" + valor.map((v) => texto(v)).join(", ") + "]";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

function mudou(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) > 0.51;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) if (mudou(a[i], b[i])) return true;
    return false;
  }
  if (a === null || a === undefined) return !(b === null || b === undefined);
  if (b === null || b === undefined) return true;
  if (typeof a === "string" && typeof b === "string") return a.toLowerCase() !== b.toLowerCase();
  return a !== b;
}

/* ══════════════════════════════ tokens ══════════════════════════════ */

/** `--nome: valor` do `globals.css`, sem comentários e em minúsculas. */
function lerTokensCss(): Map<string, string> {
  const tokens = new Map<string, string>();
  if (!existsSync(GLOBALS_CSS)) return tokens;
  const css = readFileSync(GLOBALS_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const achado of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set("--" + achado[1].toLowerCase(), achado[2].trim().toLowerCase());
  }
  return tokens;
}

/** Deixa hex e medidas comparáveis entre o Figma e o CSS. */
function normalizar(valor: string | number | null): string {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "number") return texto(arredondar(valor)) + "px";
  const bruto = valor.trim().toLowerCase();
  const curto = bruto.match(/^#([0-9a-f]{3})$/);
  if (curto) {
    return (
      "#" +
      curto[1]
        .split("")
        .map((c) => c + c)
        .join("")
    );
  }
  const rem = bruto.match(/^(-?[\d.]+)rem$/);
  if (rem) return texto(arredondar(Number(rem[1]) * 16)) + "px"; // 16px, a base assumida na exportação
  const px = bruto.match(/^(-?[\d.]+)px$/);
  if (px) return texto(arredondar(Number(px[1]))) + "px";
  const numero = bruto.match(/^(-?[\d.]+)$/);
  if (numero) return texto(arredondar(Number(numero[1]))) + "px";
  return bruto;
}

function diffTokens(snapshot: Snapshot): string[] {
  const css = lerTokensCss();
  const linhas: string[] = [];
  if (!snapshot.variaveis?.length) {
    linhas.push("  (a leitura não trouxe variáveis)");
    return linhas;
  }

  for (const variavel of snapshot.variaveis) {
    const nome = variavel.nome.toLowerCase();
    const candidatos =
      variavel.colecao === "Nexus / Cor"
        ? [`--color-${nome}`, `--${nome}`]
        : [`--${nome}`, `--color-${nome}`];
    const chave = candidatos.find((c) => css.has(c));
    const figma = normalizar(variavel.valor);
    if (!chave) {
      linhas.push(`  · ${variavel.nome} = ${figma}   (sem token equivalente no globals.css)`);
      continue;
    }
    const atual = normalizar(css.get(chave) ?? null);
    if (mudou(atual, figma)) {
      linhas.push(`  ~ ${chave}   ${atual} → ${figma}   (globals.css)`);
    }
  }

  if (!linhas.length) linhas.push("  (nenhuma diferença)");
  return linhas;
}

/* ══════════════════════════════ componentes ══════════════════════════════ */

// Espelham o plugin (mesma convenção de nome de mestre): se divergirem, o pior
// caso é um mestre aparecer em "sem correspondência" — visível, nunca silencioso.
const DIMENSOES_VARIANTE = ["variant", "state", "columns"];

function rotuloDaDimensao(dimensao: string, valor: string): string {
  return dimensao === "columns" ? valor + " colunas" : valor;
}

function nomeDoMestre(no: NoCena): string {
  const props = no.componentProps || {};
  const valores: string[] = [];
  for (const dimensao of DIMENSOES_VARIANTE) {
    if (props[dimensao]) valores.push(rotuloDaDimensao(dimensao, props[dimensao]));
  }
  // filhos posicionados (sem auto-layout) não reagem a redimensionar: a largura
  // entra no nome, como no plugin
  if (!no.layout && no.w > 0) valores.push(Math.round(no.w) + " de largura");
  return (no.componente ?? "?") + (valores.length ? " · " + valores.join(" · ") : "");
}

function contarNos(no: NoCena): number {
  let total = 1;
  for (const filho of no.children || []) total += contarNos(filho);
  return total;
}

interface Ocorrencia {
  mestre: string;
  cena: string;
  no: NoCena;
  estilo: EstiloCena | undefined;
}

/** Ocorrência mais completa de cada mestre — a mesma escolha que o plugin faz. */
function ocorrenciasDoApp(cenas: Cena[]): Map<string, Ocorrencia> {
  const escolhidas = new Map<string, Ocorrencia>();
  const pesos = new Map<string, { peso: number; area: number }>();

  const visitar = (no: NoCena, cena: Cena) => {
    if (no.componente) {
      const mestre = nomeDoMestre(no);
      const peso = contarNos(no);
      const area = no.w * no.h;
      const atual = pesos.get(mestre);
      if (!atual || peso > atual.peso || (peso === atual.peso && area > atual.area)) {
        pesos.set(mestre, { peso, area });
        escolhidas.set(mestre, { mestre, cena: cena.id, no, estilo: cena.styles[no.style] });
      }
    }
    for (const filho of no.children || []) visitar(filho, cena);
  };

  for (const cena of cenas) visitar(cena.root, cena);
  return escolhidas;
}

/** Percorre o snapshot e devolve todos os nós de um tipo. */
function acharNos(raiz: NoFigma, tipos: string[]): NoFigma[] {
  const saida: NoFigma[] = [];
  const visitar = (no: NoFigma) => {
    if (tipos.includes(no.tipo)) saida.push(no);
    for (const filho of no.filhos || []) visitar(filho);
  };
  visitar(raiz);
  return saida;
}

function primeiroTexto(no: NoFigma): NoFigma | null {
  if (no.tipo === "TEXT") return no;
  for (const filho of no.filhos || []) {
    const achado = primeiroTexto(filho);
    if (achado) return achado;
  }
  return null;
}

function primeiroTextoDaCena(no: NoCena): NoCena | null {
  if (no.kind === "text") return no;
  for (const filho of no.children || []) {
    const achado = primeiroTextoDaCena(filho);
    if (achado) return achado;
  }
  return null;
}

interface Campo {
  rotulo: string;
  app: unknown;
  figma: unknown;
}

function camposDoMestre(ocorrencia: Ocorrencia, mestre: NoFigma): Campo[] {
  const app = ocorrencia.no;
  const estilo = ocorrencia.estilo;
  const fills = mestre.fills?.[0];
  const strokes = mestre.strokes?.[0];

  const textoApp = primeiroTextoDaCena(app);
  const textoFigma = primeiroTexto(mestre);
  const corTextoFigma = textoFigma?.fills?.[0]?.cor ?? null;

  const campos: Campo[] = [
    { rotulo: "largura", app: arredondar(app.w), figma: arredondar(mestre.w) },
    { rotulo: "altura", app: arredondar(app.h), figma: arredondar(mestre.h) },
    {
      rotulo: "auto-layout",
      app: app.layout?.mode ?? "—",
      figma: mestre.layout?.modo ?? "—",
    },
    { rotulo: "espaço", app: app.layout?.gap ?? "—", figma: mestre.layout?.gap ?? "—" },
    {
      rotulo: "preenchimento",
      app: app.layout?.padding ?? "—",
      figma: mestre.layout?.pad ?? "—",
    },
    {
      rotulo: "alinhamento",
      app: app.layout ? app.layout.primaryAlign + "/" + app.layout.counterAlign : "—",
      figma: mestre.layout ? mestre.layout.principal + "/" + mestre.layout.cruzado : "—",
    },
    { rotulo: "fundo", app: hex(estilo?.bg ?? null), figma: fills?.cor ?? null },
    // canto reto não vem como `raio` na leitura (o plugin só grava se houver
    // raio): sem normalizar, todo componente de canto reto apareceria como
    // diferença
    { rotulo: "raio", app: estilo?.radius ?? [0, 0, 0, 0], figma: mestre.raio ?? [0, 0, 0, 0] },
    {
      rotulo: "contorno",
      app: estilo?.border ? hex(estilo.border.color) + " " + estilo.border.w : "—",
      figma: strokes?.cor ? strokes.cor + " " + (mestre.pesoContorno ?? "?") : "—",
    },
    { rotulo: "fonte", app: textoApp?.text?.style.fontFamily ?? "—", figma: textoFigma?.fonte?.familia ?? "—" },
    {
      rotulo: "tamanho do texto",
      app: arredondar(textoApp?.text?.style.fontSize),
      figma: arredondar(textoFigma?.fonte?.tamanho),
    },
    { rotulo: "cor do texto", app: hex(textoApp?.text?.style.color ?? null), figma: corTextoFigma },
  ];
  return campos;
}

function diffComponentes(
  snapshot: Snapshot,
  cenas: Cena[],
): { linhas: string[]; semCorrespondencia: string[]; mestres: number } {
  const app = ocorrenciasDoApp(cenas);
  const mestres = snapshot.raizes.flatMap((raiz) => acharNos(raiz, ["COMPONENT", "COMPONENT_SET"]));
  const linhas: string[] = [];
  const semCorrespondencia: string[] = [];

  for (const mestre of mestres) {
    const ocorrencia = app.get(mestre.nome);
    if (!ocorrencia) {
      semCorrespondencia.push(mestre.nome);
      continue;
    }    const origem = ORIGEM[ocorrencia.no.componente ?? ""] ?? null;
    const campos = camposDoMestre(ocorrencia, mestre).filter((campo) => mudou(campo.app, campo.figma));
    if (!campos.length) continue;

    linhas.push(`  ${mestre.nome}${origem ? "   (" + origem + ")" : "   (não mapeada)"}`);
    for (const campo of campos) {
      linhas.push(`      ${campo.rotulo.padEnd(16)} ${texto(campo.app)} → ${texto(campo.figma)}`);
    }
    linhas.push("");
  }

  if (!linhas.length) linhas.push("  (nenhuma diferença)");
  return { linhas, semCorrespondencia, mestres: mestres.length };
}

/* ══════════════════════════════ telas ══════════════════════════════ */

const SUFIXO_EDIT = " · EDIT";

function diffTelas(snapshot: Snapshot, cenas: Cena[]): string[] {
  const porId = new Map(cenas.map((cena) => [cena.id, cena]));
  const linhas: string[] = [];

  for (const raiz of snapshot.raizes) {
    if (!raiz.nome.endsWith(SUFIXO_EDIT)) continue;
    const id = raiz.nome.slice(0, -SUFIXO_EDIT.length);
    const cena = porId.get(id);
    if (!cena) {
      linhas.push(`  ${id}: tela que não existe no app`);
      continue;
    }
    const antes = contarNos(cena.root);
    const agora = contarNosDoFigma(raiz);
    const partes: string[] = [];
    if (mudou(arredondar(raiz.w), cena.root.w) || mudou(arredondar(raiz.h), cena.root.h)) {
      partes.push(`tamanho ${cena.root.w}×${cena.root.h} → ${Math.round(raiz.w)}×${Math.round(raiz.h)}`);
    }
    if (antes !== agora) partes.push(`elementos ${antes} → ${agora}`);
    if (partes.length) linhas.push(`  ${id}: ${partes.join("; ")}`);
  }

  if (!linhas.length) linhas.push("  (nenhuma diferença)");
  return linhas;
}

function contarNosDoFigma(no: NoFigma): number {
  let total = 1;
  for (const filho of no.filhos || []) total += contarNosDoFigma(filho);
  return total;
}

/* ══════════════════════════════ relatório ══════════════════════════════ */

function main() {
  const pedido = process.argv[2];
  const lido = carregarSnapshot(pedido);
  if (!lido) {
    console.error("✗ Nenhuma leitura do Figma encontrada em out/figma-export/figma.");
    console.error("  No plugin: aba “Ler do Figma” → escolha a página com as cópias → “Ler a página e enviar”.");
    process.exit(1);
  }
  const { snapshot } = lido;

  const tokens = diffTokens(snapshot);
  const cenas = cenarios();
  const componentes = diffComponentes(snapshot, cenas);
  const telas = diffTelas(snapshot, cenas);

  const aviso = ["Nexus Export", "Nexus · Componentes"].includes(snapshot.pagina)
    ? "\n> ⚠️  Esta página é reconstruída pela exportação: alterações feitas nela se perdem na\n" +
      "> próxima importação. O certo é copiar os componentes para uma página própria e ler essa.\n"
    : "";
  const semMestres =
    componentes.mestres === 0
      ? "\n> ⚠️  A página lida não tem nenhum componente. Leia a página onde estão as **cópias**\n" +
        "> (a de trabalho dos designers), não a página das telas — senão não há o que comparar.\n"
      : "";

  const relatorio = [
    `# Diff do design — página “${snapshot.pagina}”`,
    "",
    `Lido do Figma em ${snapshot.lidoEm}. Comparado com a última colheita do app.`,
    aviso,
    semMestres,
    "Como ler: à esquerda o app como está (colheita), à direita o que está no Figma.",
    "",
    "## Tokens",
    "",
    ...tokens,
    "",
    "## Componentes",
    "",
    ...componentes.linhas,
    "## Telas",
    "",
    ...telas,
    "",
    ...(componentes.semCorrespondencia.length
      ? [
          "## Sem correspondência",
          "",
          "Estes mestres existem no Figma e não no app (componente novo ou renomeado) —",
          "implementação manual, não automática:",
          "",
          ...componentes.semCorrespondencia.map((nome) => `  · ${nome}`),
          "",
        ]
      : []),
  ].join("\n");

  const destino = path.join(OUT_DIR, "diff-design.md");
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, relatorio, "utf8");

  console.log(`\n🔍 Diff do design — página “${snapshot.pagina}” (lida em ${snapshot.lidoEm})`);
  if (componentes.mestres === 0) {
    console.log("\n⚠️  A página lida não tem componentes — leia a página das cópias, não a das telas.");
  }
  console.log(`\nTokens\n${tokens.join("\n")}`);
  console.log(`\nComponentes\n${componentes.linhas.join("\n")}`);
  console.log(`\nTelas\n${telas.join("\n")}`);
  if (componentes.semCorrespondencia.length) {
    console.log(`\nSem correspondência (${componentes.semCorrespondencia.length}):`);
    for (const nome of componentes.semCorrespondencia.slice(0, 20)) console.log(`  · ${nome}`);
  }
  console.log(`\n📄 ${path.relative(process.cwd(), destino)}`);
}

main();
