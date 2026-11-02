import { Fragment } from "react";
import type {
  MovimentacaoRelatorioRow,
  ProdutoFiltroRelatorio,
} from "@/dao/relatorio";
import { formatarQuantidade } from "@/lib/formatar";
import { agruparExtratoPorProduto } from "@/lib/relatorio-movimentacao";
import { formatarDataHoraRelatorio } from "@/services/relatorio";

/** Quantidade da tabela: o sinal deixa claro o sentido do movimento. */
function formatarQuantidadeAssinada(valor: number): string {
  const texto = formatarQuantidade(valor);
  return valor > 0 ? `+${texto}` : texto;
}

function formatarSaldo(valor: number | null): string {
  return valor === null ? "—" : formatarQuantidade(valor);
}

/**
 * Extrato de Produto(s): um grupo por produto selecionado, com saldo inicial,
 * movimentações e subtotal (saldo final, entradas e saídas).
 */
export function TabelaExtrato({
  data,
  produtos,
}: {
  data: MovimentacaoRelatorioRow[];
  produtos: ProdutoFiltroRelatorio[];
}) {
  const grupos = agruparExtratoPorProduto(data, produtos);

  return (
    <table className="relatorio-mov">
      <thead>
        <tr>
          <th style={{ width: "15%" }}>Data/hora</th>
          <th style={{ width: "9%" }}>Documento</th>
          <th style={{ width: "36%" }}>Origem / Destino</th>
          <th style={{ width: "9%" }} className="col-direita">
            Quantidade
          </th>
          <th style={{ width: "12%" }} className="col-direita">
            Saldo
          </th>
          <th style={{ width: "19%" }}>Usuário</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map((grupo) => (
          <Fragment key={grupo.id_produto}>
            <tr className="prod-grupo">
              <td colSpan={6}>
                <div className="prod-grupo-linha">
                  <span className="prod-codigo">{grupo.codigo}</span>
                  <span className="prod-nome">{grupo.produto}</span>
                  <span className="prod-saldo">
                    <b>Saldo inicial</b>
                    {formatarSaldo(grupo.saldo_inicial)}
                  </span>
                </div>
              </td>
            </tr>

            {grupo.itens.length === 0 ? (
              <tr>
                <td colSpan={6} className="mov-vazio">
                  Nenhuma movimentação no período.
                </td>
              </tr>
            ) : (
              grupo.itens.map((item) => (
                <Fragment key={item.id_movimentacao}>
                  <tr>
                    <td>{formatarDataHoraRelatorio(item.data_hora)}</td>
                    <td className="mov-doc">{item.documento}</td>
                    <td>
                      {item.tipo === "Ajuste" ? "Ajuste" : item.destinatario_fornecedor}
                    </td>
                    <td className="col-direita">
                      <span className="mov-qtd">
                        {formatarQuantidadeAssinada(item.quantidade)}
                      </span>
                    </td>
                    <td className="col-direita">
                      <span className="mov-saldo">
                        {formatarSaldo(item.saldo_posterior)}
                      </span>
                    </td>
                    <td>{item.usuario}</td>
                  </tr>
                  {item.observacao && (
                    <tr className="mov-obs-linha">
                      <td colSpan={6}>{item.observacao}</td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}

            <tr className="prod-total">
              <td colSpan={6}>
                <div className="prod-total-linha">
                  <span>
                    <b>Saldo final</b>
                    {formatarSaldo(grupo.saldo_final)}
                  </span>
                  <span>
                    <b>Entradas</b>
                    {formatarQuantidade(grupo.entradas)}
                  </span>
                  <span>
                    <b>Saídas</b>
                    {formatarQuantidade(grupo.saidas)}
                  </span>
                </div>
              </td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
