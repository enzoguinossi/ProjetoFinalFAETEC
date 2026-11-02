import { prisma } from "@/lib/prisma";

// Prisma exige o runtime Node; a rota nunca pode ser pré-renderizada no build.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health check para o serviço/proxy de produção.
 *
 * Não expõe detalhes do erro do banco (mensagem, stack ou credenciais): apenas
 * informa se a conexão respondeu no momento da chamada.
 */
export async function GET() {
  const versao = process.env.NEXT_PUBLIC_APP_VERSION ?? null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: true, versao });
  } catch {
    return Response.json({ status: "degraded", db: false, versao }, { status: 503 });
  }
}
