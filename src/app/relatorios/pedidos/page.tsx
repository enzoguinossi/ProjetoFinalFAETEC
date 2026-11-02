import { Fragment } from "react";
import { redirect } from "next/navigation";
import BadgeStatus from "@/components/relatorios/BadgeStatus";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import RelatorioCadastro from "@/components/relatorios/RelatorioCadastro";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";
import {
  formatarDataISO,
  metadadosEmissao,
  relatorioService,
} from "@/services/relatorio";
import {
  pedidoService,
  ROTULOS_STATUS_PEDIDO,
  type PedidoRelatorioRow,
} from "@/services/pedido";
import type { StatusPedido } from "@prisma/client";
import { listarEscolasSelecao, listarProdutosPedido } from "../../pedidos/actions";

export const dynamic = "force-dynamic";

type Params = {
  de?: string | string[];
  ate?: string | string[];
  escola?: string | string[];
  status?: string | string[];
  produto?: string | string[];
  nota?: string | string[];
};

function primeiro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? (valor[0] ?? "") : (valor ?? "");
}

function lista(valor: string | string[] | undefined): string[] {
  const bruto = Array.isArray(valor) ? valor.join(",") : (valor ?? "");
  return bruto
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Período padrão do relatório: mês corrente (igual às demais telas). */
function periodoPadrao(): { de: string; ate: string } {
  const [ano, mes] = hojeSaoPaulo().split("-").map(Number);
  const mesTexto = String(mes).padStart(2, "0");
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return {
    de: `${ano}-${mesTexto}-01`,
    ate: `${ano}-${mesTexto}-${String(ultimo).padStart(2, "0")}`,
  };
}

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

const STATUS_VALIDOS: StatusPedido[] = ["PENDENTE", "CONFIRMADO", "RECUSADO"];

export default async function RelatorioPedidosPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");
  if (
    !(await usuarioPodeAlguma(user, [
      "pedido.listar",
      "pedido.consultar",
      "pedido.aprovar",
    ]))
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const padrao = periodoPadrao();
  const de = primeiro(params.de) || padrao.de;
  const ate = primeiro(params.ate) || padrao.ate;

  const escolas = lista(params.escola)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  const produtos = lista(params.produto)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  const status = lista(params.status).filter((valor): valor is StatusPedido =>
    STATUS_VALIDOS.includes(valor as StatusPedido),
  );
  const notas = lista(params.nota).filter(
    (valor) => valor === "com" || valor === "sem",
  );
  // "com" e "sem" juntos significam todas; um único valor filtra.
  const comNota = notas.length === 1 ? notas[0] === "com" : null;

  const [linhas, escolasOpcoes, produtosOpcoes] = await Promise.all([
    pedidoService.relatorio({
      de,
      ate,
      destinatarios: escolas,
      produtos,
      status,
      com_nota: comNota,
    }),
    listarEscolasSelecao(),
    listarProdutosPedido(),
  ]);

  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);
  const totalGeral = linhas.reduce((soma, linha) => soma + linha.total, 0);

  type GrupoEscola = {
    id_destinatario: number;
    nome: string;
    pedidos: PedidoRelatorioRow[];
    itens: number;
  };
  const porEscola = new Map<number, GrupoEscola>();
  for (const linha of linhas) {
    const grupo = porEscola.get(linha.id_destinatario) ?? {
      id_destinatario: linha.id_destinatario,
      nome: linha.escola,
      pedidos: [],
      itens: 0,
    };
    grupo.pedidos.push(linha);
    grupo.itens += linha.itens.length;
    porEscola.set(linha.id_destinatario, grupo);
  }
  const grupos = [...porEscola.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((grupo) => ({
      ...grupo,
      pedidos: [...grupo.pedidos].sort(
        (a, b) =>
          a.data.localeCompare(b.data) || a.codigo.localeCompare(b.codigo),
      ),
    }));

  function tomStatus(status: string): "forte" | "contorno" | "duplo" {
    if (status === "Aprovado") return "forte";
    if (status === "Recusado") return "duplo";
    return "contorno";
  }

  const campos: CampoFiltro[] = [
    { id: "periodo", rotulo: "Período", tipo: "periodo" },
    {
      id: "escola",
      rotulo: "Escola",
      tipo: "multi",
      opcoes: escolasOpcoes.map((escola) => ({
        valor: String(escola.id_destinatario),
        rotulo: escola.razao_social,
      })),
    },
    {
      id: "status",
      rotulo: "Status",
      tipo: "multi",
      opcoes: STATUS_VALIDOS.map((valor) => ({
        valor,
        rotulo: ROTULOS_STATUS_PEDIDO[valor],
      })),
    },
    {
      id: "produto",
      rotulo: "Produto",
      tipo: "multi",
      opcoes: produtosOpcoes.map((produto) => ({
        valor: String(produto.id_produto),
        rotulo: `${produto.codigo} - ${produto.descricao}`,
      })),
    },
    {
      id: "nota",
      rotulo: "Nota",
      tipo: "multi",
      opcoes: [
        { valor: "com", rotulo: "Com nota" },
        { valor: "sem", rotulo: "Sem nota" },
      ],
    },
  ];

  const valores = {
    periodo: { de, ate },
    escola: escolas.map(String),
    status,
    produto: produtos.map(String),
    nota: notas,
  };

  const query = new URLSearchParams({ de, ate });
  if (escolas.length > 0) query.set("escola", escolas.join(","));
  if (status.length > 0) query.set("status", status.join(","));
  if (produtos.length > 0) query.set("produto", produtos.join(","));
  if (notas.length === 1) query.set("nota", notas[0]);

  const escolasSelecionadas = escolasOpcoes.filter((escola) =>
    escolas.includes(escola.id_destinatario),
  );
  const produtosSelecionados = produtosOpcoes.filter((produto) =>
    produtos.includes(produto.id_produto),
  );

  const meta = [
    ...(escolasSelecionadas.length > 0
      ? [
          `Escola${escolasSelecionadas.length === 1 ? "" : "s"}: ${escolasSelecionadas
            .map((escola) => escola.razao_social)
            .join(", ")}`,
        ]
      : []),
    ...(produtosSelecionados.length > 0
      ? [
          `Produto${produtosSelecionados.length === 1 ? "" : "s"}: ${produtosSelecionados
            .map((produto) => `${produto.codigo} - ${produto.descricao}`)
            .join(", ")}`,
        ]
      : []),
    ...(status.length > 0
      ? [`Status: ${status.map((valor) => ROTULOS_STATUS_PEDIDO[valor]).join(", ")}`]
      : []),
    comNota === null
      ? "Nota: com ou sem"
      : comNota
        ? "Somente pedidos com nota"
        : "Somente pedidos sem nota",
    `Período: ${formatarDataISO(de)} a ${formatarDataISO(ate)}`,
    `Emissão: ${emissao.data} ${emissao.hora}`,
    `${linhas.length} pedido(s)`,
  ];

  return (
    <RelatorioCadastro
      titulo="Pedidos por Escola"
      descricao="Solicitações das escolas no período, com status, itens, total e nota de saída."
      exportHref={`/relatorios/pedidos/export?${query.toString()}`}
      filtros={
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/pedidos"
          campos={campos}
          valores={valores}
        />
      }
      meta={meta}
      emissor={emissor}
      quantidade={linhas.length}
      vazio="Nenhum pedido encontrado com os filtros informados."
      totais={[
        { rotulo: "Pedidos", valor: String(linhas.length) },
        { rotulo: "Itens", valor: formatarQuantidade(totalGeral) },
      ]}
    >
      <table className="relatorio-faixa">
        <thead>
          <tr>
            <th style={{ width: "78%" }}>Item</th>
            <th style={{ width: "22%" }} className="col-direita">
              Quantidade
            </th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.id_destinatario}>
              <tr className="faixa-grupo">
                <td colSpan={2}>
                  <div className="faixa-grupo-linha">
                    <span className="faixa-grupo-nome">{grupo.nome}</span>
                    <span className="faixa-grupo-dir">
                      {grupo.pedidos.length} pedido
                      {grupo.pedidos.length === 1 ? "" : "s"} · {grupo.itens} ite
                      {grupo.itens === 1 ? "m" : "ns"}
                    </span>
                  </div>
                </td>
              </tr>

              {grupo.pedidos.map((pedido) => (
                <Fragment key={pedido.id_pedido_escola}>
                  <tr className="faixa-subgrupo">
                    <td colSpan={2}>
                      <div className="faixa-subgrupo-linha">
                        <span className="faixa-subgrupo-nome">
                          Pedido {pedido.codigo} · {pedido.data} ·{" "}
                          <BadgeStatus tom={tomStatus(pedido.status)}>
                            {pedido.status}
                          </BadgeStatus>{" "}
                          ·{" "}
                          {pedido.nota === null
                            ? "Sem nota"
                            : `Nota ${formatarCodigo(pedido.nota)}`}
                        </span>
                        <span className="faixa-subgrupo-dir">
                          {pedido.itens.length} ite
                          {pedido.itens.length === 1 ? "m" : "ns"}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {pedido.itens.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="mov-vazio">
                        —
                      </td>
                    </tr>
                  ) : (
                    pedido.itens.map((item) => (
                      <tr key={`${pedido.id_pedido_escola}-${item.descricao}`}>
                        <td>{item.descricao}</td>
                        <td className="col-direita">
                          {formatarQuantidade(item.quantidade)}
                        </td>
                      </tr>
                    ))
                  )}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </RelatorioCadastro>
  );
}
