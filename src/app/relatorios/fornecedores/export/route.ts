import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { gerarCsvFornecedores, relatorioService } from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV da lista de Fornecedores (RF023/RF024), com o mesmo filtro de
 * situação da tela.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data } = await relatorioService.listarFornecedores({
    situacao: url.searchParams.getAll("situacao"),
  });

  return new Response(gerarCsvFornecedores(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fornecedores-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
