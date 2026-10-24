import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Button from "@/components/Button";
import BarraFiltros, { type CampoFiltro } from "@/components/relatorios/BarraFiltros";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import {
  formatarDataHoraRelatorio,
  formatarDataISO,
  metadadosEmissao,
  relatorioService,
} from "@/services/relatorio";
import ImprimirButton from "../produtos/ImprimirButton";

export const dynamic = "force-dynamic";

type Params = {
  de?: string | string[];
  ate?: string | string[];
  produto?: string | string[];
  destinatario?: string | string[];
  fornecedor?: string | string[];
  tipo?: string | string[];
};

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** Quantidade da tabela: o sinal deixa claro o sentido do movimento. */
function formatarQuantidadeAssinada(valor: number): string {
  const texto = formatarQuantidade(valor);
  return valor > 0 ? `+${texto}` : texto;
}

export default async function RelatorioMovimentacaoPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data, totais } = await relatorioService.listarMovimentacoes(
    await searchParams,
  );
  const [produtos, destinatarios, fornecedores] = await Promise.all([
    relatorioService.produtosParaFiltro(filtros.id_produtos),
    relatorioService.destinatariosParaFiltro(filtros.id_destinatarios),
    relatorioService.fornecedoresParaFiltro(filtros.id_fornecedores),
  ]);
  const produtosSelecionados = produtos.filter((p) =>
    filtros.id_produtos.includes(p.id_produto),
  );
  const destinatariosSelecionados = destinatarios.filter((d) =>
    filtros.id_destinatarios.includes(d.id_destinatario),
  );
  const fornecedoresSelecionados = fornecedores.filter((f) =>
    filtros.id_fornecedores.includes(f.id_fornecedor),
  );
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  // Extrato: exatamente um produto selecionado (compatível com `?produto=<id>`).
  const produto = produtosSelecionados.length === 1 ? produtosSelecionados[0] : null;
  const extrato = produto !== null;
  const titulo = extrato ? "Extrato de Produto" : "Movimentação de Estoque";

  const campos: CampoFiltro[] = [
    { id: "periodo", rotulo: "Período", tipo: "periodo" },
    {
      id: "produto",
      rotulo: "Produto",
      tipo: "multi",
      opcoes: produtos.map((p) => ({
        valor: String(p.id_produto),
        rotulo: `${p.codigo} - ${p.descricao}`,
      })),
    },
    {
      id: "destinatario",
      rotulo: "Destinatário",
      tipo: "multi",
      opcoes: destinatarios.map((d) => ({
        valor: String(d.id_destinatario),
        rotulo: d.nome,
      })),
    },
    {
      id: "fornecedor",
      rotulo: "Fornecedor",
      tipo: "multi",
      opcoes: fornecedores.map((f) => ({
        valor: String(f.id_fornecedor),
        rotulo: f.nome,
      })),
    },
    {
      id: "tipo",
      rotulo: "Tipo",
      tipo: "multi",
      opcoes: [
        { valor: "entrada", rotulo: "Entradas" },
        { valor: "saida", rotulo: "Saídas" },
      ],
    },
  ];

  const valores = {
    periodo: { de: filtros.de, ate: filtros.ate },
    produto: filtros.id_produtos.map(String),
    destinatario: filtros.id_destinatarios.map(String),
    fornecedor: filtros.id_fornecedores.map(String),
    tipo: [...filtros.tipos],
  };

  const query = new URLSearchParams({ de: filtros.de, ate: filtros.ate });
  if (filtros.id_produtos.length > 0) {
    query.set("produto", filtros.id_produtos.join(","));
  }
  if (filtros.id_destinatarios.length > 0) {
    query.set("destinatario", filtros.id_destinatarios.join(","));
  }
  if (filtros.id_fornecedores.length > 0) {
    query.set("fornecedor", filtros.id_fornecedores.join(","));
  }
  if (filtros.tipos.length > 0) query.set("tipo", filtros.tipos.join(","));

  return (
    <DashboardLayout title="Relatórios">
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink m-0">{titulo}</h2>
          <p className="text-sm text-[#697077] m-0">
            {extrato
              ? "Entradas, saídas e ajustes do produto no período selecionado."
              : "Entradas, saídas e ajustes de estoque no período selecionado."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          <Button
            label="Exportar CSV"
            href={`/relatorios/movimentacao/export?${query.toString()}`}
            variant="ghost"
          />
          <Button label="Voltar" href="/relatorios" variant="ghost" />
        </div>
      </div>

      <div
        className="rounded-xl border border-border bg-white p-4"
        data-print-hide
      >
        <BarraFiltros
          key={JSON.stringify(valores)}
          basePath="/relatorios/movimentacao"
          campos={campos}
          valores={valores}
        />
      </div>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">{titulo}</h1>
              <div className="meta-info">
                {produtosSelecionados.length > 0 && (
                  <p>
                    {extrato ? "Produto" : "Produtos"}:{" "}
                    {produtosSelecionados
                      .map((p) => `${p.codigo} - ${p.descricao}`)
                      .join(", ")}
                  </p>
                )}
                {destinatariosSelecionados.length > 0 && (
                  <p>
                    Destinatário{destinatariosSelecionados.length === 1 ? "" : "s"}:{" "}
                    {destinatariosSelecionados.map((d) => d.nome).join(", ")}
                  </p>
                )}
                {fornecedoresSelecionados.length > 0 && (
                  <p>
                    Fornecedor{fornecedoresSelecionados.length === 1 ? "" : "es"}:{" "}
                    {fornecedoresSelecionados.map((f) => f.nome).join(", ")}
                  </p>
                )}
                <p>
                  Período: {formatarDataISO(filtros.de)} a {formatarDataISO(filtros.ate)}
                </p>
                <p>
                  Emissão: {emissao.data} {emissao.hora}
                </p>
                <p>
                  {data.length} movimentaç{data.length === 1 ? "ão" : "ões"}
                </p>
              </div>
            </header>

            <table className="relatorio-tabela">
              <thead>
                <tr>
                  <th style={{ width: "11%" }} className="col-centro">
                    Data
                  </th>
                  <th style={{ width: "20%" }}>Produto</th>
                  <th style={{ width: "7%" }} className="col-centro">
                    Tipo
                  </th>
                  <th style={{ width: "8%" }} className="col-centro">
                    Documento
                  </th>
                  <th style={{ width: "16%" }}>Destinatário / Fornecedor</th>
                  <th style={{ width: "9%" }} className="col-direita">
                    Quantidade
                  </th>
                  <th style={{ width: "9%" }} className="col-direita">
                    Saldo anterior
                  </th>
                  <th style={{ width: "9%" }} className="col-direita">
                    Saldo posterior
                  </th>
                  <th style={{ width: "11%" }}>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="relatorio-vazio">
                      Nenhuma movimentação encontrada no período.
                    </td>
                  </tr>
                ) : (
                  data.map((movimentacao) => (
                    <tr key={movimentacao.id_movimentacao}>
                      <td className="col-centro">
                        {formatarDataHoraRelatorio(movimentacao.data_hora)}
                      </td>
                      <td title={movimentacao.produto}>
                        {movimentacao.codigo} - {movimentacao.produto}
                      </td>
                      <td className="col-centro">{movimentacao.tipo}</td>
                      <td className="col-centro">{movimentacao.documento}</td>
                      <td title={movimentacao.destinatario_fornecedor}>
                        {movimentacao.destinatario_fornecedor}
                      </td>
                      <td className="col-direita">
                        {formatarQuantidadeAssinada(movimentacao.quantidade)}
                      </td>
                      <td className="col-direita">
                        {movimentacao.saldo_anterior === null
                          ? "—"
                          : formatarQuantidade(movimentacao.saldo_anterior)}
                      </td>
                      <td className="col-direita">
                        {movimentacao.saldo_posterior === null
                          ? "—"
                          : formatarQuantidade(movimentacao.saldo_posterior)}
                      </td>
                      <td>{movimentacao.usuario}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="relatorio-totais">
              <span>Entradas: {formatarQuantidade(totais.entradas)}</span>
              <span>Saídas: {formatarQuantidade(totais.saidas)}</span>
            </div>
          </div>

          <footer className="relatorio-footer">
            <span>Emissor: {emissor}</span>
            <span>Documento gerado para uso interno</span>
          </footer>
        </div>
      </div>
    </DashboardLayout>
  );
}
