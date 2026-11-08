import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { inventarioDAO } from "@/dao/inventario";
import { gerarCsvInventario, tabelaInventario } from "@/services/inventario";
import { hojeISO } from "@/lib/formatar";
import { criarXlsx, respostaXlsx } from "@/lib/planilha";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }
  if (
    !(await usuarioPodeAlguma(user, [
      "inventario.abrir",
      "inventario.contar",
      "inventario.aprovar_ajuste",
    ]))
  ) {
    return new Response("Sem permissão para consultar inventários.", { status: 403 });
  }

  const { id } = await params;
  const inventario = await inventarioDAO.getById(Number(id));
  if (
    !inventario ||
    (inventario.status !== "FINALIZADO" && inventario.status !== "CANCELADO")
  ) {
    return new Response("Inventário fechado não encontrado.", { status: 404 });
  }

  const incluirSistema = inventario.contagem_cega
    ? await usuarioPode(user, "estoque.ver_saldo")
    : true;

  if (new URL(request.url).searchParams.get("formato") === "xlsx") {
    const nomeArquivo = `inventario-${id}-${hojeISO()}.xlsx`;
    return respostaXlsx(
      await criarXlsx(tabelaInventario(inventario, { incluirSistema }), {
        nome: "Inventário",
        nomeArquivo,
      }),
      nomeArquivo,
    );
  }

  return new Response(gerarCsvInventario(inventario, { incluirSistema }), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario-${id}-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
