import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Button from "@/components/Button";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { metadadosEmissao, relatorioService } from "@/services/relatorio";
import ImprimirButton from "./ImprimirButton";

export const dynamic = "force-dynamic";

type Params = {
  situacao?: string | string[];
};

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export default async function RelatorioProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data, totais } = await relatorioService.listarProdutos(
    await searchParams,
  );
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const query = new URLSearchParams({
    situacao: filtros.situacao,
  }).toString();

  return (
    <DashboardLayout title="Relatórios">
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink m-0">Lista de Produtos</h2>
          <p className="text-sm text-[#697077] m-0">
            Código, descrição, unidade, quantidade e saldo livre dos produtos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          <Button
            label="Exportar CSV"
            href={`/relatorios/produtos/export?${query}`}
            variant="ghost"
          />
          <Button label="Voltar" href="/relatorios" variant="ghost" />
        </div>
      </div>

      <form
        method="get"
        action="/relatorios/produtos"
        className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-border p-4"
        data-print-hide
      >
        <label className="flex flex-col gap-1 text-sm text-ink">
          Situação
          <select
            name="situacao"
            defaultValue={filtros.situacao}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            <option value="ativas">Ativas</option>
            <option value="inativas">Inativas</option>
            <option value="todas">Todas</option>
          </select>
        </label>
        <Button label="Filtrar" type="submit" />
      </form>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Lista de Produtos</h1>
              <div className="meta-info">
                <p>
                  Emissão: {emissao.data} {emissao.hora}
                </p>
                <p>
                  {data.length} produto{data.length === 1 ? "" : "s"}
                </p>
              </div>
            </header>

            <table className="relatorio-tabela">
              <thead>
                <tr>
                  <th style={{ width: "8%" }} className="col-centro">
                    Código
                  </th>
                  <th style={{ width: "34%" }}>Descrição</th>
                  <th style={{ width: "9%" }} className="col-centro">
                    Unidade
                  </th>
                  <th style={{ width: "17%" }} className="col-direita">
                    Quantidade
                  </th>
                  <th style={{ width: "17%" }} className="col-direita">
                    Qtd. Livre
                  </th>
                  <th style={{ width: "15%" }} className="col-centro">
                    Situação
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="relatorio-vazio">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  data.map((produto) => (
                    <tr key={produto.id_produto}>
                      <td className="col-centro">{produto.codigo}</td>
                      <td>{produto.descricao}</td>
                      <td className="col-centro">{produto.unidade}</td>
                      <td className="col-direita">
                        {formatarQuantidade(produto.quantidade)}
                      </td>
                      <td className="col-direita">
                        {formatarQuantidade(produto.livre)}
                      </td>
                      <td className="col-centro">{produto.situacao}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {data.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} className="col-direita">
                      Total
                    </td>
                    <td className="col-direita">
                      {formatarQuantidade(totais.quantidade)}
                    </td>
                    <td className="col-direita">
                      {formatarQuantidade(totais.livre)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
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
