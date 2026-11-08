import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { criarXlsx, respostaXlsx } from "@/lib/planilha";
import {
  gerarCsvEntregas,
  relatorioService,
  tabelaEntregas,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV/XLSX de Entregas por Instituição (RF023/RF024). Route Handler
 * é a exceção prevista no AGENTS §15: o navegador baixa um arquivo, o que uma
 * Server Action não entrega com `Content-Disposition`.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data, filtros } = await relatorioService.listarEntregas({
    de: url.searchParams.get("de"),
    ate: url.searchParams.get("ate"),
    destinatario: url.searchParams.getAll("destinatario"),
    status: url.searchParams.getAll("status"),
    fotos: url.searchParams.get("fotos"),
  });

  if (url.searchParams.get("formato") === "xlsx") {
    const nomeArquivo = `entregas-${hojeISO()}.xlsx`;
    return respostaXlsx(
      await criarXlsx(tabelaEntregas(data, filtros.fotos), {
        nome: "Entregas",
        nomeArquivo,
      }),
      nomeArquivo,
    );
  }

  return new Response(gerarCsvEntregas(data, filtros.fotos), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="entregas-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
