import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { resolverCaminhoUpload } from "./uploads";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIM = 1024;
const WEBP_QUALITY = 80;
const MIMES = ["image/jpeg", "image/png", "image/webp"];

export type ResultadoImagem =
  | { ok: true; buffer: Buffer; hash: string }
  | { ok: false; error: string };

/**
 * Converte um buffer de imagem (já validado) para WEBP redimensionado.
 * Não grava em disco — apenas retorna o buffer processado.
 */
export async function processarBufferWebp(original: Buffer): Promise<ResultadoImagem> {
  if (original.byteLength > MAX_BYTES) {
    return { ok: false, error: "Imagem maior que 5 MB." };
  }

  try {
    const buffer = await sharp(original)
      .rotate()
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 12);
    return { ok: true, buffer, hash };
  } catch {
    return { ok: false, error: "Não foi possível processar a imagem." };
  }
}

/**
 * Valida e converte uma imagem enviada (upload) para WEBP (redimensionada).
 * Não grava em disco — apenas retorna o buffer processado.
 */
export async function processarImagemWebp(file: File): Promise<ResultadoImagem> {
  if (!MIMES.includes(file.type)) {
    return { ok: false, error: "Formato inválido. Use JPG, PNG ou WEBP." };
  }
  const original = Buffer.from(await file.arrayBuffer());
  return processarBufferWebp(original);
}

/**
 * Baixa uma imagem de uma URL externa, valida o tipo e converte para WEBP.
 * Usado quando o usuário informa uma URL em vez de fazer upload.
 */
export async function processarImagemDeUrl(url: string): Promise<ResultadoImagem> {
  let resposta: Response;
  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch {
    return { ok: false, error: "Não foi possível baixar a imagem da URL informada." };
  }

  if (!resposta.ok) {
    return { ok: false, error: "Não foi possível baixar a imagem da URL informada." };
  }

  const tipo = resposta.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!MIMES.includes(tipo)) {
    return { ok: false, error: "A URL não aponta para uma imagem JPG, PNG ou WEBP." };
  }

  const original = Buffer.from(await resposta.arrayBuffer());
  return processarBufferWebp(original);
}

/**
 * Resolve a imagem de um formulário: upload (`campoArquivo`) ou URL externa.
 * Converte para WEBP; retorna `null` quando não há imagem. Ponto único de
 * entrada usado por produto e funcionário (cadastro).
 */
export async function processarImagemDoFormulario(
  formData: FormData,
  campoArquivo: string,
  urlExterna?: string | null,
): Promise<
  | { buffer: Buffer; hash: string; nome_arquivo: string; tipo_mime: string }
  | null
  | { error: string }
> {
  const arquivo = formData.get(campoArquivo);
  if (arquivo instanceof File && arquivo.size > 0) {
    const res = await processarImagemWebp(arquivo);
    if (!res.ok) return { error: res.error };
    return {
      buffer: res.buffer,
      hash: res.hash,
      nome_arquivo: arquivo.name || "imagem.webp",
      tipo_mime: "image/webp",
    };
  }

  const url = urlExterna?.trim();
  if (url && /^https?:\/\//i.test(url)) {
    const res = await processarImagemDeUrl(url);
    if (!res.ok) return { error: res.error };
    const nomeUrl = (() => {
      try {
        return decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
      } catch {
        return "";
      }
    })();
    return {
      buffer: res.buffer,
      hash: res.hash,
      nome_arquivo: nomeUrl || "imagem.webp",
      tipo_mime: "image/webp",
    };
  }

  return null;
}

/**
 * Grava o buffer WEBP em `public/uploads/{pasta}/{nome}.webp` e devolve o
 * caminho público relativo. `pasta` é relativa a `public/uploads`
 * (ex.: `produtos/12`, `funcionarios/5`, `entregas/3/8`).
 */
export async function salvarImagemAnexo(
  pasta: string,
  buffer: Buffer,
  hash: string,
): Promise<string> {
  const bruta = pasta.replace(/\\/g, "/");
  const relativa = bruta.replace(/^\/+|\/+$/g, "");
  const segmentos = relativa.split("/");
  if (
    relativa === "" ||
    path.posix.isAbsolute(bruta) ||
    /^[A-Za-z]:/.test(bruta) ||
    segmentos.some((s) => s === "" || s === "." || s === "..")
  ) {
    throw new Error("Pasta de anexo inválida.");
  }

  const dirAbsoluto = resolverCaminhoUpload(segmentos);
  if (!dirAbsoluto) {
    throw new Error("Pasta de anexo inválida.");
  }

  await fs.mkdir(dirAbsoluto, { recursive: true });

  const nomeArquivo = `${Date.now()}-${hash}.webp`;
  await fs.writeFile(path.join(dirAbsoluto, nomeArquivo), buffer);

  return `/uploads/${relativa}/${nomeArquivo}`;
}

/**
 * Remove um arquivo de imagem salvo em `public/uploads`. URLs externas são
 * ignoradas; a ausência do arquivo não é erro. Qualquer caminho que resolva
 * fora de `public/uploads` é recusado (proteção contra path traversal).
 */
export async function removerImagemAnexo(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/uploads/")) return;
  const relativo = url.slice("/uploads/".length).split(/[?#]/)[0] ?? "";
  const absoluto = resolverCaminhoUpload(relativo.split("/").filter(Boolean));
  if (!absoluto) return;
  await fs.rm(absoluto, { force: true });
}
