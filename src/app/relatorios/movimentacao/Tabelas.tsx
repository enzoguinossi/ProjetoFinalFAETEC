import { Fragment } from "react";
import type { MovimentacaoRelatorioRow } from "@/dao/relatorio";
import { formatarQuantidade } from "@/lib/formatar";
import { agruparPorDocumento } from "@/lib/relatorio-movimentacao";
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
 * Movimentação de Estoque: linhas consecutivas agrupadas por documento, com
 * uma faixa por nota e os itens compactos.
 */
export function TabelaDocumentos({
  data,
  totais,
}: {
  data: MovimentacaoRelatorioRow[];
  totais: { entradas: number; saidas: number };
}) {
  const grupos = agruparPorDocumento(data);

  return (
    <>
      <table className="relatorio-mov">
        <thead>
          <tr>
            <th style={{ width: "50%" }}>Produto</th>
            <th style={{ width: "14%" }} className="col-direita">
              Quantidade
            </th>
            <th style={{ width: "18%" }} className="col-direita">
              Saldo anterior
            </th>
            <th style={{ width: "18%" }} className="col-direita">
              Saldo posterior
            </th>
          </tr>
        </thead>
        <tbody>
          {grupos.length === 0 ? (
            <tr>
              <td colSpan={4} className="mov-vazio">
                Nenhuma movimentação encontrada no período.
              </td>
            </tr>
          ) : (
            grupos.map((grupo) => {
              const usuario =
                grupo.usuarios.length > 1
                  ? "Vários usuários"
                  : (grupo.usuarios[0] ?? "—");

              return (
                <Fragment key={`${grupo.chave}-${grupo.itens[0]?.id_movimentacao}`}>
                  <tr className="mov-grupo">
                    <td colSpan={4}>
                      <div className="mov-grupo-linha">
                        <span className="mov-tipo">{grupo.tipo}</span>
                        <span className="mov-doc">{grupo.documento}</span>
                        <span className="mov-meta">
                          {formatarDataHoraRelatorio(grupo.data_hora)}
                        </span>
                        {grupo.destinatario_fornecedor !== "—" && (
                          <span className="mov-meta">
                            {grupo.destinatario_fornecedor}
                          </span>
                        )}
                        <span className="mov-meta">
                          {grupo.itens.length} {grupo.itens.length === 1 ? "item" : "itens"}
                        </span>
                        <span className="mov-user">{usuario}</span>
                      </div>
                    </td>
                  </tr>

                  {grupo.itens.map((item) => (
                    <tr key={item.id_movimentacao}>
                      <td>
                        <span className="mov-prod-codigo">{item.codigo}</span>
                        <span className="mov-produto">{item.produto}</span>
                        {item.observacao && (
                          <span className="mov-obs">{item.observacao}</span>
                        )}
                      </td>
                      <td className="col-direita">
                        <span className="mov-qtd">
                          {formatarQuantidadeAssinada(item.quantidade)}
                        </span>
                      </td>
                      <td className="col-direita">
                        <span className="mov-saldo">
                          {formatarSaldo(item.saldo_anterior)}
                        </span>
                      </td>
                      <td className="col-direita">
                        <span className="mov-saldo">
                          {formatarSaldo(item.saldo_posterior)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>

      <div className="relatorio-totais">
        <span>Entradas: {formatarQuantidade(totais.entradas)}</span>
        <span>Saídas: {formatarQuantidade(totais.saidas)}</span>
      </div>
    </>
  );
}
