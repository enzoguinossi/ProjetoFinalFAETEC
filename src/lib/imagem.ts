import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIM = 1024;
const WEBP_QUALITY = 80;
const MIMES = ["image/jpeg", "image/png", "image/webp"];

export type ResultadoImagem =
  | { ok: true; buffer: Buffer; hash: string }
  | { ok: false; error: string };

/**
 * Valida e converte uma imagem enviada para WEBP (redimensionada).
 * Não grava em disco — apenas retorna o buffer processado.
 */
export async function processarImagemWebp(file: File): Promise<ResultadoImagem> {
  if (!MIMES.includes(file.type)) {
    return { ok: false, error: "Formato inválido. Use JPG, PNG ou WEBP." };
  }
  const original = Buffer.from(await file.arrayBuffer());
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
 * Grava o buffer WEBP em public/uploads/produtos/{idProduto}/{nome}.webp
 * e retorna o caminho público relativo.
 */
export async function salvarImagemProduto(
  idProduto: number,
  buffer: Buffer,
  hash: string,
): Promise<string> {
  const dirRelativo = path.posix.join("uploads", "produtos", String(idProduto));
  const dirAbsoluto = path.join(process.cwd(), "public", dirRelativo);
  await fs.mkdir(dirAbsoluto, { recursive: true });

  const nomeArquivo = `${Date.now()}-${hash}.webp`;
  await fs.writeFile(path.join(dirAbsoluto, nomeArquivo), buffer);

  return `/${dirRelativo}/${nomeArquivo}`;
}

/** Remove um arquivo de imagem previamente salvo (ignora ausência). */
export async function removerImagemProduto(fotoUrl: string | null | undefined): Promise<void> {
  if (!fotoUrl || !fotoUrl.startsWith("/uploads/")) return;
  const absoluto = path.join(process.cwd(), "public", fotoUrl.replace(/^\//, ""));
  await fs.rm(absoluto, { force: true });
}
