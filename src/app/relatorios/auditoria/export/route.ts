import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { gerarCsvAuditoria, relatorioService } from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV da Auditoria (RF023/RF024). Route Handler é a exceção prevista
 * no AGENTS §15: o navegador baixa um arquivo, o que uma Server Action não
 * entrega com `Content-Disposition`.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data } = await relatorioService.listarAuditoria({
    de: url.searchParams.get("de"),
    ate: url.searchParams.get("ate"),
    usuario: url.searchParams.getAll("usuario"),
    entidade: url.searchParams.getAll("entidade"),
    acao: url.searchParams.getAll("acao"),
  });

  return new Response(gerarCsvAuditoria(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
