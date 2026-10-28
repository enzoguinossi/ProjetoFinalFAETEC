import { redirect } from "next/navigation";
import Button from "@/components/Button";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import RelatorioAmpliado from "@/components/relatorios/RelatorioAmpliado";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";
import {
  formatarDataISO,
  formatarQuantidadeCsv,
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
import ImprimirButton from "../produtos/ImprimirButton";

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
    <>
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink m-0">Pedidos por Escola</h2>
          <p className="text-sm text-[#697077] m-0">
            Solicitações das escolas no período, com status, itens, total e nota de saída.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          <Button
            label="Exportar CSV"
            href={`/relatorios/pedidos/export?${query.toString()}`}
            variant="ghost"
          />
          <Button label="Voltar" href="/relatorios" variant="ghost" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4" data-print-hide>
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/pedidos"
          campos={campos}
          valores={valores}
        />
      </div>

      <RelatorioAmpliado titulo="Pedidos por Escola" meta={meta} emissor={emissor}>
        <table className="relatorio-tabela relatorio-tabela-ampliada">
          <thead>
            <tr>
              <th style={{ width: "26%" }}>Escola</th>
              <th style={{ width: "10%" }} className="col-centro">
                Pedido
              </th>
              <th style={{ width: "9%" }} className="col-centro">
                Data
              </th>
              <th style={{ width: "9%" }} className="col-centro">
                Status
              </th>
              <th style={{ width: "30%" }} className="col-itens">
                Itens
              </th>
              <th style={{ width: "8%" }} className="col-direita">
                Total
              </th>
              <th style={{ width: "8%" }} className="col-centro">
                Nota
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={7} className="relatorio-vazio">
                  Nenhum pedido encontrado com os filtros informados.
                </td>
              </tr>
            ) : (
              linhas.map((linha: PedidoRelatorioRow) => (
                <tr key={linha.id_pedido_escola}>
                  <td>{linha.escola}</td>
                  <td className="col-centro">{linha.codigo}</td>
                  <td className="col-centro">{linha.data}</td>
                  <td className="col-centro">{linha.status}</td>
                  <td>
                    {linha.itens.length === 0
                      ? "—"
                      : linha.itens.map((item) => (
                          <div key={item.descricao}>
                            {item.descricao}: {formatarQuantidade(item.quantidade)}
                          </div>
                        ))}
                  </td>
                  <td className="col-direita">{formatarQuantidade(linha.total)}</td>
                  <td className="col-centro">
                    {linha.nota === null ? "Sem nota" : formatarCodigo(linha.nota)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>
                {linhas.length} pedido(s) —{" "}
                {escolasSelecionadas.length > 0 ? "filtro por escola aplicado" : "todas as escolas"}
              </td>
              <td className="col-direita">{formatarQuantidadeCsv(totalGeral)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </RelatorioAmpliado>
    </>
  );
}
