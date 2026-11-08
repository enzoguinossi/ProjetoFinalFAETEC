import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { criarXlsx, respostaXlsx } from "@/lib/planilha";
import {
  gerarCsvDestinatarios,
  relatorioService,
  tabelaDestinatarios,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV/XLSX da lista de Destinatários (RF023/RF024), com os mesmos
 * filtros de situação e tipo da tela.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data, filtros } = await relatorioService.listarDestinatarios({
    situacao: url.searchParams.getAll("situacao"),
    tipo: url.searchParams.getAll("tipo"),
    codigos: url.searchParams.get("codigos"),
    contatos: url.searchParams.get("contatos"),
  });

  if (url.searchParams.get("formato") === "xlsx") {
    const nomeArquivo = `destinatarios-${hojeISO()}.xlsx`;
    return respostaXlsx(
      await criarXlsx(
        tabelaDestinatarios(data, filtros.codigos, filtros.contatos),
        { nome: "Destinatários", nomeArquivo },
      ),
      nomeArquivo,
    );
  }

  return new Response(gerarCsvDestinatarios(data, filtros.codigos, filtros.contatos), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="destinatarios-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
