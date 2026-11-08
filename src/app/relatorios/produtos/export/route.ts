import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { criarXlsx, respostaXlsx } from "@/lib/planilha";
import {
  gerarCsvProdutos,
  relatorioService,
  tabelaProdutos,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV/XLSX da Lista de Produtos (RF024).
 * Route Handler é a exceção prevista no AGENTS §15: o navegador baixa um arquivo,
 * o que uma Server Action não entrega com `Content-Disposition`.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data, filtros } = await relatorioService.listarProdutos({
    situacao: url.searchParams.get("situacao"),
    fotos: url.searchParams.get("fotos"),
    codigos: url.searchParams.get("codigos"),
  });

  if (url.searchParams.get("formato") === "xlsx") {
    const nomeArquivo = `produtos-${hojeISO()}.xlsx`;
    return respostaXlsx(
      await criarXlsx(tabelaProdutos(data, filtros.fotos, filtros.codigos), {
        nome: "Produtos",
        nomeArquivo,
      }),
      nomeArquivo,
    );
  }

  return new Response(gerarCsvProdutos(data, filtros.fotos, filtros.codigos), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="produtos-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
