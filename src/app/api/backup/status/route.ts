import { agentStatus } from "@/lib/agent";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Polling da página `/administracao/backup` (AGENTS §15: Route Handler para
 * consulta periódica da UI). A resposta nunca inclui o segredo do agente.
 * Agente fora do ar vira `200 { agentOnline: false }` — a tela mostra o aviso
 * em vez de tratar como erro do servidor.
 */
const SEM_CACHE = { "Cache-Control": "no-store, max-age=0" } as const;

export async function GET() {
  const user = await requireUser();

  if (!(await usuarioPode(user, "backup.listar"))) {
    return Response.json(
      { agentOnline: false, error: "Sem permissão." },
      { status: 403, headers: SEM_CACHE },
    );
  }

  const resultado = await agentStatus();
  if (!resultado.ok) {
    return Response.json(
      { agentOnline: false, error: resultado.error },
      { headers: SEM_CACHE },
    );
  }

  return Response.json(
    { agentOnline: true, status: resultado.data },
    { headers: SEM_CACHE },
  );
}
