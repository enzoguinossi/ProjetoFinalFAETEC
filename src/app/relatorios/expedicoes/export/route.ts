import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { criarXlsx, respostaXlsx } from "@/lib/planilha";
import {
  gerarCsvExpedicoes,
  relatorioService,
  tabelaExpedicoes,
} from "@/services/relatorio";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV/XLSX de Expedições por Período (RF023/RF024). Route Handler é
 * a exceção prevista no AGENTS §15: o navegador baixa um arquivo, o que uma
 * Server Action não entrega com `Content-Disposition`.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }

  const url = new URL(request.url);
  const { data, filtros } = await relatorioService.listarExpedicoes({
    de: url.searchParams.get("de"),
    ate: url.searchParams.get("ate"),
    expedicao: url.searchParams.getAll("expedicao"),
    destinatario: url.searchParams.getAll("destinatario"),
    condutor: url.searchParams.getAll("condutor"),
    status: url.searchParams.getAll("status"),
    fotos: url.searchParams.get("fotos"),
  });

  if (url.searchParams.get("formato") === "xlsx") {
    const nomeArquivo = `expedicoes-${hojeISO()}.xlsx`;
    return respostaXlsx(
      await criarXlsx(tabelaExpedicoes(data, filtros.fotos), {
        nome: "Expedições",
        nomeArquivo,
      }),
      nomeArquivo,
    );
  }

  return new Response(gerarCsvExpedicoes(data, filtros.fotos), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expedicoes-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
