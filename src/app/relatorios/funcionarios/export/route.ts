import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { gerarCsvFuncionarios, relatorioService } from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV da lista de Funcionários (RF023/RF024), com os mesmos filtros
 * da tela.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data } = await relatorioService.listarFuncionarios({
    situacao: url.searchParams.getAll("situacao"),
  });

  return new Response(gerarCsvFuncionarios(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="funcionarios-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
