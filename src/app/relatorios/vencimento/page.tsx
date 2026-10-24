import { redirect } from "next/navigation";
import Button from "@/components/Button";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { DIAS_VENCIMENTO_RELATORIO } from "@/dao/relatorio";
import {
  formatarDataISO,
  metadadosEmissao,
  relatorioService,
  rotuloDiasVencimento,
} from "@/services/relatorio";
import ImprimirButton from "../produtos/ImprimirButton";

export const dynamic = "force-dynamic";

type Params = {
  dias?: string | string[];
};

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export default async function RelatorioVencimentoPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");

  const { filtros, data, totais } = await relatorioService.listarProdutosVencimento(
    await searchParams,
  );
  const emissao = metadadosEmissao();
  const emissor = await relatorioService.nomeEmissor(user.id_usuario);

  const query = new URLSearchParams({ dias: String(filtros.dias) }).toString();
  const filtroTexto = rotuloDiasVencimento(filtros.dias);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-ink m-0">
            Produtos Próximos ao Vencimento
          </h2>
          <p className="text-sm text-[#697077] m-0">
            Produtos perecíveis com validade, ordenados pela data de vencimento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          <Button
            label="Exportar CSV"
            href={`/relatorios/vencimento/export?${query}`}
            variant="ghost"
          />
          <Button label="Voltar" href="/relatorios" variant="ghost" />
        </div>
      </div>

      <form
        method="get"
        action="/relatorios/vencimento"
        className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-border p-4"
        data-print-hide
      >
        <label className="flex flex-col gap-1 text-sm text-ink">
          Dias para vencer
          <select
            name="dias"
            defaultValue={String(filtros.dias)}
            className="h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white font-sans text-sm text-ink outline-none focus:border-brand"
          >
            {DIAS_VENCIMENTO_RELATORIO.map((dias) => (
              <option key={dias} value={dias}>
                {rotuloDiasVencimento(dias)}
              </option>
            ))}
          </select>
        </label>
        <Button label="Filtrar" type="submit" />
      </form>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Produtos Próximos ao Vencimento</h1>
              <div className="meta-info">
                <p>Dias para vencer: {filtroTexto}</p>
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
                  <th style={{ width: "25%" }}>Produto</th>
                  <th style={{ width: "8%" }} className="col-centro">
                    Unidade
                  </th>
                  <th style={{ width: "10%" }} className="col-direita">
                    Quantidade
                  </th>
                  <th style={{ width: "12%" }} className="col-centro">
                    Validade
                  </th>
                  <th style={{ width: "12%" }} className="col-centro">
                    Dias restantes
                  </th>
                  <th style={{ width: "25%" }}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="relatorio-vazio">
                      Nenhum produto perecível próximo ao vencimento.
                    </td>
                  </tr>
                ) : (
                  data.map((linha) => (
                    <tr key={linha.id_produto}>
                      <td className="col-centro">{linha.codigo}</td>
                      <td>{linha.descricao}</td>
                      <td className="col-centro">{linha.unidade}</td>
                      <td className="col-direita">
                        {formatarQuantidade(linha.quantidade)}
                      </td>
                      <td className="col-centro">{formatarDataISO(linha.validade)}</td>
                      <td className="col-centro">{linha.dias_restantes}</td>
                      <td>{linha.situacao}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="relatorio-totais">
              <span>Itens: {totais.itens}</span>
              <span>Vencidos: {totais.vencidos}</span>
            </div>
          </div>

          <footer className="relatorio-footer">
            <span>Emissor: {emissor}</span>
            <span>Documento gerado para uso interno</span>
          </footer>
        </div>
      </div>
    </>
  );
}
