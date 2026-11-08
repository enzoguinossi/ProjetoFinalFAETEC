import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { criarXlsx, respostaXlsx } from "@/lib/planilha";
import {
  gerarCsvVencimento,
  relatorioService,
  tabelaVencimento,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV/XLSX de Produtos Próximos ao Vencimento (RF023/RF024).
 * Route Handler é a exceção prevista no AGENTS §15: o navegador baixa um
 * arquivo, o que uma Server Action não entrega com `Content-Disposition`.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data } = await relatorioService.listarProdutosVencimento({
    dias: url.searchParams.getAll("dias"),
  });

  if (url.searchParams.get("formato") === "xlsx") {
    const nomeArquivo = `vencimento-${hojeISO()}.xlsx`;
    return respostaXlsx(
      await criarXlsx(tabelaVencimento(data), {
        nome: "Vencimento",
        nomeArquivo,
      }),
      nomeArquivo,
    );
  }

  return new Response(gerarCsvVencimento(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vencimento-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
