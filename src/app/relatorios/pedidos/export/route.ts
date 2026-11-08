import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { hojeISO } from "@/lib/formatar";
import { criarXlsx, respostaXlsx } from "@/lib/planilha";
import { gerarCsvPedidos, pedidoService, tabelaPedidos } from "@/services/pedido";
import type { StatusPedido } from "@prisma/client";

export const dynamic = "force-dynamic";

function lista(valor: string | null): string[] {
  return (valor ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const STATUS_VALIDOS: StatusPedido[] = ["PENDENTE", "CONFIRMADO", "RECUSADO"];

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function periodoPadrao(): { de: string; ate: string } {
  const [ano, mes] = hojeSaoPaulo().split("-").map(Number);
  const mesTexto = String(mes).padStart(2, "0");
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return {
    de: `${ano}-${mesTexto}-01`,
    ate: `${ano}-${mesTexto}-${String(ultimo).padStart(2, "0")}`,
  };
}

/**
 * CSV de Pedidos por Escola. Route Handler é a exceção do AGENTS §15: o
 * navegador baixa o arquivo com `Content-Disposition`.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) {
    return new Response("Sem permissão para gerar relatórios.", { status: 403 });
  }
  if (
    !(await usuarioPodeAlguma(user, [
      "pedido.listar",
      "pedido.consultar",
      "pedido.aprovar",
    ]))
  ) {
    return new Response("Sem permissão para consultar pedidos.", { status: 403 });
  }

  const url = new URL(request.url);
  const padrao = periodoPadrao();
  const de = url.searchParams.get("de") || padrao.de;
  const ate = url.searchParams.get("ate") || padrao.ate;
  const notas = lista(url.searchParams.get("nota")).filter(
    (valor) => valor === "com" || valor === "sem",
  );

  const linhas = await pedidoService.relatorio({
    de,
    ate,
    destinatarios: lista(url.searchParams.get("escola"))
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0),
    produtos: lista(url.searchParams.get("produto"))
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0),
    status: lista(url.searchParams.get("status")).filter((valor): valor is StatusPedido =>
      STATUS_VALIDOS.includes(valor as StatusPedido),
    ),
    com_nota: notas.length === 1 ? notas[0] === "com" : null,
  });

  if (url.searchParams.get("formato") === "xlsx") {
    const nomeArquivo = `pedidos-${hojeISO()}.xlsx`;
    return respostaXlsx(
      await criarXlsx(tabelaPedidos(linhas), {
        nome: "Pedidos",
        nomeArquivo,
      }),
      nomeArquivo,
    );
  }

  return new Response(gerarCsvPedidos(linhas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-${hojeISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
