import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import Button from "@/components/Button";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import {
  formatarDataHoraRelatorio,
  formatarDataISO,
  metadadosEmissao,
  periodoSemestreAtual,
  periodoMesAtual,
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
    relatorioService.produtosParaFiltro(),
    relatorioService.destinatariosParaFiltro(filtros.id_destinatario),
    relatorioService.fornecedoresParaFiltro(filtros.id_fornecedor),
  ]);
  const produto =
    filtros.id_produto === null
      ? null
      : await relatorioService.produtoParaFiltro(filtros.id_produto);
  const destinatario =
    destinatarios.find((d) => d.id_destinatario === filtros.id_destinatario) ?? null;
  const fornecedor =
    fornecedores.find((f) => f.id_fornecedor === filtros.id_fornecedor) ?? null;
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const extrato = filtros.id_produto !== null;
  const titulo = extrato ? "Extrato de Produto" : "Movimentação de Estoque";
  // O produto filtrado pode estar inativo: continua no select para não perder o filtro.
  const produtoForaDaLista =
    produto && !produtos.some((p) => p.id_produto === produto.id_produto) ? produto : null;

  const query = new URLSearchParams({ de: filtros.de, ate: filtros.ate, tipo: filtros.tipo });
  if (filtros.id_produto !== null) query.set("produto", String(filtros.id_produto));
  if (filtros.id_destinatario !== null) {
    query.set("destinatario", String(filtros.id_destinatario));
  }
  if (filtros.id_fornecedor !== null) query.set("fornecedor", String(filtros.id_fornecedor));

  // Atalhos de período: trocam apenas de/até, preservando os demais filtros.
  function linkDoPeriodo(periodo: { de: string; ate: string }): string {
    const parametros = new URLSearchParams(query);
    parametros.set("de", periodo.de);
    parametros.set("ate", periodo.ate);
    return `/relatorios/movimentacao?${parametros.toString()}`;
  }
  const periodoMes = periodoMesAtual();
  const periodoSemestre = periodoSemestreAtual();
  const mesAtivo = filtros.de === periodoMes.de && filtros.ate === periodoMes.ate;
  const semestreAtivo =
    filtros.de === periodoSemestre.de && filtros.ate === periodoSemestre.ate;

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

      <form
        method="get"
        action="/relatorios/movimentacao"
        className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-border p-4"
        data-print-hide
      >
        <label className="flex flex-col gap-1 text-sm text-ink">
          De
          <input
            type="date"
            name="de"
            defaultValue={filtros.de}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Até
          <input
            type="date"
            name="ate"
            defaultValue={filtros.ate}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Destinatário
          <select
            name="destinatario"
            defaultValue={filtros.id_destinatario ?? ""}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            <option value="">Todos os destinatários</option>
            {destinatarios.map((d) => (
              <option key={d.id_destinatario} value={d.id_destinatario}>
                {d.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Fornecedor
          <select
            name="fornecedor"
            defaultValue={filtros.id_fornecedor ?? ""}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            <option value="">Todos os fornecedores</option>
            {fornecedores.map((f) => (
              <option key={f.id_fornecedor} value={f.id_fornecedor}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Produto
          <select
            name="produto"
            defaultValue={filtros.id_produto ?? ""}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            <option value="">Todos os produtos</option>
            {produtoForaDaLista && (
              <option value={produtoForaDaLista.id_produto}>
                {produtoForaDaLista.codigo} - {produtoForaDaLista.descricao}
              </option>
            )}
            {produtos.map((p) => (
              <option key={p.id_produto} value={p.id_produto}>
                {p.codigo} - {p.descricao}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Tipo
          <select
            name="tipo"
            defaultValue={filtros.tipo}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            <option value="todos">Todas</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
        </label>
        <Button label="Filtrar" type="submit" />
        <div className="flex items-center gap-3 text-sm mb-2.5">
          <span className="text-[#697077]">Período:</span>
          <Link
            href={linkDoPeriodo(periodoMes)}
            aria-current={mesAtivo ? "true" : undefined}
            className={mesAtivo ? "font-semibold text-brand" : "text-brand underline"}
          >
            Mês atual
          </Link>
          <Link
            href={linkDoPeriodo(periodoSemestre)}
            aria-current={semestreAtivo ? "true" : undefined}
            className={semestreAtivo ? "font-semibold text-brand" : "text-brand underline"}
          >
            Semestre atual
          </Link>
        </div>
      </form>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">{titulo}</h1>
              <div className="meta-info">
                {produto && (
                  <p>
                    Produto: {produto.codigo} - {produto.descricao}
                  </p>
                )}
                {destinatario && <p>Destinatário: {destinatario.nome}</p>}
                {fornecedor && <p>Fornecedor: {fornecedor.nome}</p>}
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
