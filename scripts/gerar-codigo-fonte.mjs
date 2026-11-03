import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out", "codigo-fonte");
fs.mkdirSync(outDir, { recursive: true });

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
let commit = "";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
} catch {
  commit = "desconhecido";
}

const sections = [
  {
    id: "telas",
    title: "Telas, rotas e Server Actions",
    description: "Páginas, layouts, componentes de rota, actions e CSS de src/app.",
    dir: "src/app",
    extensions: [".ts", ".tsx", ".css"],
  },
  {
    id: "componentes",
    title: "Componentes de interface",
    description: "Componentes React reutilizáveis de src/components.",
    dir: "src/components",
    extensions: [".ts", ".tsx", ".css"],
  },
  {
    id: "servicos",
    title: "Serviços e regras de negócio",
    description: "Casos de uso e regras de domínio de src/services.",
    dir: "src/services",
    extensions: [".ts"],
  },
  {
    id: "dao",
    title: "DAO e acesso a dados",
    description: "Consultas Prisma e persistência de src/dao.",
    dir: "src/dao",
    extensions: [".ts"],
  },
  {
    id: "lib",
    title: "Biblioteca compartilhada",
    description: "Utilitários, autenticação, formatação e helpers de src/lib.",
    dir: "src/lib",
    extensions: [".ts"],
  },
  {
    id: "tipos",
    title: "Tipos TypeScript",
    description: "Tipos compartilhados de src/types.",
    dir: "src/types",
    extensions: [".ts"],
  },
  {
    id: "middleware",
    title: "Middleware de sessão",
    description: "Proteção das rotas privadas.",
    files: ["src/proxy.ts"],
  },
  {
    id: "banco",
    title: "Banco de dados (Prisma)",
    description: "Modelo físico e seed de referência.",
    files: ["prisma/schema.prisma", "prisma/seed.ts"],
  },
  {
    id: "config",
    title: "Configuração do projeto",
    description: "Dependências, Next.js, TypeScript, Prisma e variáveis de exemplo.",
    files: ["package.json", "next.config.ts", "tsconfig.json", "prisma.config.ts", ".env.example"],
  },
];

const language = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".tsx") return "tsx";
  if (ext === ".ts") return "ts";
  if (ext === ".css") return "css";
  if (ext === ".json") return "json";
  if (ext === ".prisma") return "prisma";
  if (ext === ".mjs" || ext === ".js") return "js";
  if (ext === ".example") return "dotenv";
  return "text";
};

const exclude = (file) =>
  /\.(test|spec)\.(ts|tsx)$/.test(file) ||
  file.includes(`${path.sep}__tests__${path.sep}`) ||
  file.includes(`${path.sep}node_modules${path.sep}`) ||
  file.includes(`${path.sep}.next${path.sep}`);

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      result.push(...walk(full));
    } else if (!exclude(full)) {
      result.push(full);
    }
  }
  return result;
}

const files = [];
for (const section of sections) {
  let paths = [];
  if (section.dir) {
    const absolute = path.join(root, section.dir);
    if (fs.existsSync(absolute)) {
      paths = walk(absolute).filter((p) => section.extensions.includes(path.extname(p).toLowerCase()));
    }
  }
  if (section.files) {
    paths = section.files.map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));
  }
  paths.sort((a, b) => a.localeCompare(b, "pt-BR"));
  for (const absolute of paths) {
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    const content = fs.readFileSync(absolute, "utf8");
    files.push({
      section,
      relative,
      absolute,
      content,
      lines: content.split(/\r\n|\n|\r/).length,
      bytes: Buffer.byteLength(content, "utf8"),
    });
  }
}

const totals = sections.map((section) => {
  const own = files.filter((f) => f.section.id === section.id);
  return {
    ...section,
    count: own.length,
    lines: own.reduce((sum, f) => sum + f.lines, 0),
    bytes: own.reduce((sum, f) => sum + f.bytes, 0),
  };
});

const totalFiles = files.length;
const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
const number = (n) => new Intl.NumberFormat("pt-BR").format(n);

function fenceFor(content) {
  const runs = content.match(/`+/g) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return "`".repeat(Math.max(3, longest + 1));
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const md = [];
md.push("# Nexus — Código-fonte completo");
md.push("");
md.push("**Sistema de controle de estoque e logística de remessas — FAETEC 2026**");
md.push("");
md.push(`- **Versão:** ${packageJson.version}`);
md.push(`- **Commit:** ${commit}`);
md.push(`- **Data da geração:** ${new Date().toLocaleDateString("pt-BR")}`);
md.push(`- **Arquivos:** ${number(totalFiles)}`);
md.push(`- **Linhas:** ${number(totalLines)}`);
md.push("");
md.push("## Escopo");
md.push("");
md.push("Este anexo reúne o código da aplicação Next.js: telas e rotas (`src/app`), componentes");
md.push("(`src/components`), serviços/regras de negócio (`src/services`), acesso a dados (`src/dao`),");
md.push("biblioteca compartilhada (`src/lib`), tipos (`src/types`), middleware (`src/proxy.ts`), o");
md.push("modelo Prisma/seed e a configuração do projeto.");
md.push("");
md.push("**Não incluídos:** `.env` e credenciais, `node_modules`, `.next`, `package-lock.json`,");
md.push("testes (`tests/`), scripts de instalação (`deploy/`), ferramentas (`tools/`), uploads e");
md.push("artefatos gerados. O snapshot é de leitura; nenhum segredo é exposto.");
md.push("");
md.push("## Resumo por seção");
md.push("");
md.push("| Seção | Arquivos | Linhas |");
md.push("| --- | ---: | ---: |");
for (const item of totals) {
  md.push(`| ${item.title} | ${item.count} | ${number(item.lines)} |`);
}
md.push(`| **Total** | **${totalFiles}** | **${number(totalLines)}** |`);
md.push("");
md.push("## Sumário");
md.push("");
files.forEach((file, index) => {
  md.push(`- [${file.relative}](#f-${index}) · ${file.lines} linhas`);
});
md.push("");

for (const section of sections) {
  const own = files.filter((f) => f.section.id === section.id);
  if (!own.length) continue;
  md.push("---");
  md.push("");
  md.push(`# ${section.title}`);
  md.push("");
  md.push(section.description);
  md.push("");
  for (const file of own) {
    const index = files.indexOf(file);
    const fence = fenceFor(file.content);
    md.push(`<a id="f-${index}"></a>`);
    md.push("");
    md.push(`### \`${file.relative}\``);
    md.push("");
    md.push(`*${section.title} · ${file.lines} linhas*`);
    md.push("");
    md.push(`${fence}${language(file.relative)}`);
    md.push(file.content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, ""));
    md.push(fence);
    md.push("");
  }
}

const mdFile = path.join(outDir, "CODIGO_FONTE_COMPLETO.md");
fs.writeFileSync(mdFile, md.join("\n"), "utf8");

const html = [];
html.push("<!doctype html>");
html.push('<html lang="pt-BR">');
html.push("<head>");
html.push('<meta charset="utf-8">');
html.push(`<title>Nexus — Código-fonte completo (${packageJson.version})</title>`);
html.push("<style>");
html.push(`
@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #111; font-size: 10pt; line-height: 1.4; margin: 0; }
h1 { font-size: 22pt; margin: 0 0 6px; }
h2 { font-size: 15pt; margin: 22px 0 8px; border-bottom: 1px solid #bbb; padding-bottom: 3px; }
h3 { font-family: Consolas, "Courier New", monospace; font-size: 10pt; margin: 0 0 3px; break-before: page; page-break-before: always; }
.cover { padding-top: 40mm; }
.cover h1 { font-size: 28pt; }
.cover .sub { font-size: 13pt; color: #444; margin-bottom: 28px; }
.cover dl { display: grid; grid-template-columns: 32mm 1fr; gap: 3px 8px; font-size: 10pt; }
.cover dt { color: #555; }
.cover dd { margin: 0; font-family: Consolas, monospace; }
.scope { margin-top: 18px; font-size: 9pt; color: #333; }
.scope h2 { font-size: 12pt; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; margin: 8px 0 16px; }
th, td { border: 1px solid #bbb; padding: 3px 5px; text-align: left; }
th { background: #eee; }
th + th, td + td { text-align: right; }
.toc { columns: 2; column-gap: 14px; font-size: 7.8pt; padding-left: 0; list-style: none; }
.toc li { break-inside: avoid; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.toc a { color: #111; text-decoration: none; }
.toc .n { color: #777; }
.section-intro { color: #333; margin: 0 0 10px; }
.file { margin: 0 0 14px; }
.file-meta { color: #555; font-size: 8pt; margin: 0 0 4px; }
pre { font-family: Consolas, "Courier New", monospace; font-size: 6.7pt; line-height: 1.22; background: #f7f8f9; border: 1px solid #ddd; padding: 5px 6px; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
code { font-family: inherit; }
footer { margin-top: 16px; font-size: 8pt; color: #666; }
`);
html.push("</style>");
html.push("</head>");
html.push("<body>");
html.push('<section class="cover">');
html.push("<h1>Nexus</h1>");
html.push('<div class="sub">Código-fonte completo — Sistema de controle de estoque e logística de remessas</div>');
html.push("<dl>");
html.push(`<dt>Versão</dt><dd>${escapeHtml(packageJson.version)}</dd>`);
html.push(`<dt>Commit</dt><dd>${escapeHtml(commit)}</dd>`);
html.push(`<dt>Data</dt><dd>${new Date().toLocaleDateString("pt-BR")}</dd>`);
html.push(`<dt>Arquivos</dt><dd>${number(totalFiles)}</dd>`);
html.push(`<dt>Linhas</dt><dd>${number(totalLines)}</dd>`);
html.push("</dl>");
html.push('<div class="scope">');
html.push("<h2>Escopo</h2>");
html.push("<p>Telas e rotas, componentes, serviços/regras de negócio, DAO, biblioteca compartilhada, tipos, middleware, modelo Prisma/seed e configuração.</p>");
html.push("<p><strong>Não incluídos:</strong> <code>.env</code> e credenciais, <code>node_modules</code>, <code>.next</code>, <code>package-lock.json</code>, testes, scripts de instalação, ferramentas, uploads e artefatos gerados.</p>");
html.push("</div>");
html.push("</section>");

html.push("<h2>Resumo por seção</h2>");
html.push("<table><thead><tr><th>Seção</th><th>Arquivos</th><th>Linhas</th></tr></thead><tbody>");
for (const item of totals) {
  html.push(`<tr><td>${escapeHtml(item.title)}</td><td>${item.count}</td><td>${number(item.lines)}</td></tr>`);
}
html.push(`<tr><th>Total</th><th>${totalFiles}</th><th>${number(totalLines)}</th></tr>`);
html.push("</tbody></table>");

html.push("<h2>Sumário</h2>");
html.push('<ul class="toc">');
files.forEach((file, index) => {
  html.push(`<li><a href="#f-${index}">${escapeHtml(file.relative)}</a> <span class="n">(${file.lines})</span></li>`);
});
html.push("</ul>");

for (const section of sections) {
  const own = files.filter((f) => f.section.id === section.id);
  if (!own.length) continue;
  html.push(`<h2>${escapeHtml(section.title)}</h2>`);
  html.push(`<p class="section-intro">${escapeHtml(section.description)}</p>`);
  for (const file of own) {
    const index = files.indexOf(file);
    html.push(`<section class="file" id="f-${index}">`);
    html.push(`<h3>${escapeHtml(file.relative)}</h3>`);
    html.push(`<p class="file-meta">${escapeHtml(section.title)} · ${file.lines} linhas</p>`);
    html.push(`<pre><code>${escapeHtml(file.content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, ""))}</code></pre>`);
    html.push("</section>");
  }
}

html.push("<footer>Documento gerado a partir do repositório. Snapshot de leitura; nenhum segredo é exposto.</footer>");
html.push("</body></html>");

const htmlFile = path.join(outDir, "CODIGO_FONTE_COMPLETO.html");
fs.writeFileSync(htmlFile, html.join("\n"), "utf8");

console.log(JSON.stringify({
  md: mdFile,
  html: htmlFile,
  files: totalFiles,
  lines: totalLines,
  bytes: totalBytes,
}, null, 2));
