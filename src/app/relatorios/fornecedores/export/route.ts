import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { criarXlsx, respostaXlsx } from "@/lib/planilha";
import {
  gerarCsvFornecedores,
  relatorioService,
  tabelaFornecedores,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV/XLSX da lista de Fornecedores (RF023/RF024), com o mesmo
 * filtro de situação da tela.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data, filtros } = await relatorioService.listarFornecedores({
    situacao: url.searchParams.getAll("situacao"),
    codigos: url.searchParams.get("codigos"),
    contatos: url.searchParams.get("contatos"),
  });

  if (url.searchParams.get("formato") === "xlsx") {
    const nomeArquivo = `fornecedores-${hojeISO()}.xlsx`;
    return respostaXlsx(
      await criarXlsx(
        tabelaFornecedores(data, filtros.codigos, filtros.contatos),
        { nome: "Fornecedores", nomeArquivo },
      ),
      nomeArquivo,
    );
  }

  return new Response(gerarCsvFornecedores(data, filtros.codigos, filtros.contatos), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fornecedores-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
