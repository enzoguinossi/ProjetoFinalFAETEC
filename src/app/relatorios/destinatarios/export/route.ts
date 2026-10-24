import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { gerarCsvDestinatarios, relatorioService } from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV da lista de Destinatários (RF023/RF024), com os mesmos filtros
 * de situação e tipo da tela.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data } = await relatorioService.listarDestinatarios({
    situacao: url.searchParams.getAll("situacao"),
    tipo: url.searchParams.getAll("tipo"),
  });

  return new Response(gerarCsvDestinatarios(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="destinatarios-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
