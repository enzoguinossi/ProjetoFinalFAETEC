import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { gerarCsvMovimentacoes, relatorioService } from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV da Movimentação de Estoque / Extrato de Produto (RF023/RF024).
 * Route Handler é a exceção prevista no AGENTS §15: o navegador baixa um arquivo,
 * o que uma Server Action não entrega com `Content-Disposition`.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data, filtros } = await relatorioService.listarMovimentacoes({
    de: url.searchParams.get("de"),
    ate: url.searchParams.get("ate"),
    produto: url.searchParams.getAll("produto"),
    destinatario: url.searchParams.getAll("destinatario"),
    fornecedor: url.searchParams.getAll("fornecedor"),
    tipo: url.searchParams.getAll("tipo"),
  });

  const nome =
    filtros.id_produtos.length === 1
      ? `extrato-produto-${filtros.id_produtos[0]}`
      : "movimentacoes";

  return new Response(gerarCsvMovimentacoes(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
