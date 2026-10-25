import path from "node:path";

/** Raiz física dos uploads, gravada em runtime por `lib/imagem.ts`. */
export const UPLOADS_PUBLIC_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Resolve os segmentos de `/uploads/[...path]` para um caminho absoluto dentro de
 * `public/uploads`. Retorna `null` quando o caminho é vazio, absoluto ou escapa da raiz
 * (`..`, traversal), para que a rota nunca sirva nada fora do diretório de uploads.
 */
export function resolverCaminhoUpload(segmentos: string[]): string | null {
  if (!segmentos?.length) return null;
  const absoluto = path.resolve(UPLOADS_PUBLIC_DIR, segmentos.join("/"));
  if (absoluto !== UPLOADS_PUBLIC_DIR && !absoluto.startsWith(UPLOADS_PUBLIC_DIR + path.sep)) {
    return null;
  }
  return absoluto;
}
