import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { gerarCsvEntregas, relatorioService } from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV de Entregas por Instituição (RF023/RF024). Route Handler é a
 * exceção prevista no AGENTS §15: o navegador baixa um arquivo, o que uma
 * Server Action não entrega com `Content-Disposition`.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data } = await relatorioService.listarEntregas({
    de: url.searchParams.get("de"),
    ate: url.searchParams.get("ate"),
    destinatario: url.searchParams.get("destinatario"),
    status: url.searchParams.get("status"),
  });

  return new Response(gerarCsvEntregas(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="entregas-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
