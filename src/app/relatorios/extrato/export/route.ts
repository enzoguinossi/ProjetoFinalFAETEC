import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { criarXlsx, respostaXlsx } from "@/lib/planilha";
import {
  gerarCsvMovimentacoes,
  relatorioService,
  tabelaMovimentacoes,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV/XLSX do Extrato de Produto(s). Sem produto selecionado,
 * exporta todas as movimentações do período (o mesmo que a tela mostra).
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data } = await relatorioService.listarMovimentacoes({
    de: url.searchParams.get("de"),
    ate: url.searchParams.get("ate"),
    produto: url.searchParams.getAll("produto"),
  });

  if (url.searchParams.get("formato") === "xlsx") {
    const nomeArquivo = `extrato-produtos-${hojeISO()}.xlsx`;
    return respostaXlsx(
      await criarXlsx(tabelaMovimentacoes(data), {
        nome: "Extrato",
        nomeArquivo,
      }),
      nomeArquivo,
    );
  }

  return new Response(gerarCsvMovimentacoes(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="extrato-produtos-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
