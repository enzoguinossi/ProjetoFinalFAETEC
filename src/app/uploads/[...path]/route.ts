import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolverCaminhoUpload } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_POR_EXTENSAO: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/**
 * Serve os uploads gravados em `public/uploads` em runtime (produtos, etc.).
 * O `next start` só serve o `public` existente no momento do build, então arquivos
 * enviados depois ficam 404 sem esta rota. O `proxy.ts` continua exigindo sessão
 * para `/uploads` — a imagem segue protegida.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segmentos } = await params;
  const arquivo = resolverCaminhoUpload(segmentos);
  if (!arquivo) return new Response("Não encontrado.", { status: 404 });

  let conteudo: Buffer;
  try {
    conteudo = await readFile(arquivo);
  } catch {
    return new Response("Não encontrado.", { status: 404 });
  }

  const extensao = path.extname(arquivo).toLowerCase();
  const tipo = TIPOS_POR_EXTENSAO[extensao] ?? "application/octet-stream";
  const corpo = new Uint8Array(conteudo);

  return new Response(corpo, {
    headers: {
      "Content-Type": tipo,
      "Content-Length": String(corpo.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
