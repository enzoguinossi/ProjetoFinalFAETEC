/**
 * Servidor local que entrega as cenas da exportação ao plugin do Figma.
 *
 * O plugin roda com origem `null`, então só consegue consumir respostas com
 * `Access-Control-Allow-Origin: *` — daí os cabeçalhos CORS em tudo.
 *
 *   GET  /ping                     → { ok: true }
 *   GET  /export/scenes.json       → manifesto
 *   GET  /export/scenes/<slug>.json→ árvore de nós da cena
 *   GET  /export/screens/<slug>.png→ captura 1:1
 *   GET  /export/<qualquer>        → arquivo em out/figma-export
 *   POST /verify/<slug>            → recebe o PNG reexportado pelo plugin
 *   POST /snapshot/<pagina>        → recebe a leitura de uma página do Figma
 *
 * Uso: npm run figma:serve
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { OUT_DIR, SERVER_PORT } from "./config";

const TIPOS: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function cors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function enviarJson(res: ServerResponse, status: number, corpo: unknown) {
  const texto = JSON.stringify(corpo);
  cors(res);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(texto),
  });
  res.end(texto);
}

function enviarErro(res: ServerResponse, status: number, mensagem: string) {
  enviarJson(res, status, { error: mensagem });
}

/** Impede path traversal: resolve e confirma que continua dentro de OUT_DIR. */
function caminhoSeguro(relativo: string): string | null {
  const destino = path.resolve(OUT_DIR, "." + path.posix.normalize("/" + relativo));
  const raiz = path.resolve(OUT_DIR);
  if (destino !== raiz && !destino.startsWith(raiz + path.sep)) return null;
  return destino;
}

async function lerCorpo(req: IncomingMessage, limite = 32 * 1024 * 1024): Promise<Buffer> {
  const partes: Buffer[] = [];
  let total = 0;
  for await (const pedaco of req) {
    const buffer = pedaco as Buffer;
    total += buffer.length;
    if (total > limite) throw new Error("corpo maior que o limite permitido");
    partes.push(buffer);
  }
  return Buffer.concat(partes);
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${SERVER_PORT}`);
  const rota = decodeURIComponent(url.pathname);

  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (rota === "/ping") {
    enviarJson(res, 200, { ok: true, out: OUT_DIR });
    return;
  }

  // O plugin reenvia o frame reexportado para conferência automática 1:1.
  if (req.method === "POST" && rota.startsWith("/verify/")) {
    // tolera a extensão vir junto (o plugin manda só o nome)
    const slug = rota.slice("/verify/".length).replace(/\.png$/i, "");
    const destino = caminhoSeguro(`verify/${slug}.png`);
    if (!destino) {
      enviarErro(res, 400, "caminho inválido");
      return;
    }
    try {
      const corpo = await lerCorpo(req);
      mkdirSync(path.dirname(destino), { recursive: true });
      writeFileSync(destino, corpo);
      console.log(`  ⇩ referência recebida do Figma: ${slug}.png (${corpo.length} bytes)`);
      enviarJson(res, 200, { ok: true, bytes: corpo.length });
    } catch (erro) {
      enviarErro(res, 400, erro instanceof Error ? erro.message : "falha ao receber");
    }
    return;
  }

  // O plugin devolve a leitura de uma página do Figma: é o caminho de volta
  // (design → app), consumido por `npm run figma:diff`.
  if (req.method === "POST" && rota.startsWith("/snapshot/")) {
    const pagina = rota.slice("/snapshot/".length);
    if (!pagina) {
      enviarErro(res, 400, "página não informada");
      return;
    }
    const slug =
      pagina
        .replace(/[^\p{L}\p{N}._-]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "pagina";
    const destino = caminhoSeguro(`figma/${slug}.json`);
    if (!destino) {
      enviarErro(res, 400, "caminho inválido");
      return;
    }
    try {
      const corpo = await lerCorpo(req);
      const texto = corpo.toString("utf8");
      const snapshot = JSON.parse(texto) as { raizes?: unknown[]; variaveis?: unknown[] };
      mkdirSync(path.dirname(destino), { recursive: true });
      writeFileSync(destino, texto);
      console.log(
        `  ⇧ leitura do Figma recebida: "${pagina}" → figma/${slug}.json ` +
          `(${(snapshot.raizes ?? []).length} nó(s), ${(snapshot.variaveis ?? []).length} variável(is))`,
      );
      enviarJson(res, 200, { ok: true, arquivo: `figma/${slug}.json` });
    } catch (erro) {
      enviarErro(res, 400, erro instanceof Error ? erro.message : "falha ao receber a leitura");
    }
    return;
  }

  if (req.method !== "GET") {
    enviarErro(res, 405, "método não permitido");
    return;
  }

  const relativo = rota.startsWith("/export/") ? rota.slice("/export/".length) : rota.replace(/^\//, "");
  const arquivo = caminhoSeguro(relativo);
  if (!arquivo || !existsSync(arquivo) || !statSync(arquivo).isFile()) {
    enviarErro(res, 404, `não encontrado: ${relativo}`);
    return;
  }

  const conteudo = readFileSync(arquivo);
  cors(res);
  res.writeHead(200, {
    "Content-Type": TIPOS[path.extname(arquivo).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": conteudo.length,
  });
  res.end(conteudo);
});

// Escuta só no loopback: o servidor entrega cenas e ACEITA ESCRITA sem
// autenticação (`POST /verify`, `POST /snapshot`); exposto na rede, qualquer
// host na LAN poderia injetar arquivos em `out/figma-export`.
servidor.listen(SERVER_PORT, "127.0.0.1", () => {
  const manifesto = path.join(OUT_DIR, "scenes.json");
  console.log(`🌐 Servidor de exportação em http://localhost:${SERVER_PORT}`);
  console.log(`   cenas:    http://localhost:${SERVER_PORT}/export/scenes.json`);
  if (!existsSync(manifesto)) {
    console.log("   ⚠️  Nenhuma cena encontrada. Rode antes: npm run figma:harvest");
  }
  console.log("   (Ctrl+C encerra)");
});
