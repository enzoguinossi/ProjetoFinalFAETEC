import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { gerarCsvProdutos, relatorioService } from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV da Lista de Produtos (RF024).
 * Route Handler é a exceção prevista no AGENTS §15: o navegador baixa um arquivo,
 * o que uma Server Action não entrega com `Content-Disposition`.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data } = await relatorioService.listarProdutos({
    situacao: url.searchParams.get("situacao"),
  });

  return new Response(gerarCsvProdutos(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="produtos-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
