import { redirect } from "next/navigation";
import Button from "@/components/Button";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import {
  metadadosEmissao,
} from "@/services/relatorio";
import {
  ROTULOS_ORIGEM_AJUSTE,
  ROTULOS_STATUS_AJUSTE,
  ROTULOS_STATUS_INVENTARIO,
} from "@/services/inventario";
import { getRelatorioInventario } from "../../actions";
import ImprimirButton from "../ImprimirButton";

export const dynamic = "force-dynamic";

function q(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function data(valor: Date | null): string {
  return valor ? valor.toLocaleDateString("pt-BR") : "—";
}

/** A, B, ..., Z, AA, AB... — mesma legenda usada no detalhe do inventário. */
function letraColuna(indice: number): string {
  let n = indice;
  let letra = "";
  while (n >= 0) {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  }
  return letra;
}

export default async function RelatorioInventarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "relatorio.gerar"))) redirect("/dashboard");
  if (
    !(await usuarioPodeAlguma(user, [
      "inventario.abrir",
      "inventario.contar",
      "inventario.aprovar_ajuste",
    ]))
  ) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const resultado = await getRelatorioInventario(Number(id));
  if (!resultado || "error" in resultado) redirect("/inventario");

  const { inventario, podeVerSistema, emitente } = resultado;
  const emissao = metadadosEmissao();
  const ajustes = new Map(
    inventario.ajustes.map((ajuste) => [ajuste.id_produto, ajuste]),
  );

  const funcionariosMap = new Map<number, string>();
  for (const item of inventario.itens) {
    for (const contagem of item.contagens) {
      if (!funcionariosMap.has(contagem.id_funcionario)) {
        funcionariosMap.set(contagem.id_funcionario, contagem.funcionario.pessoaFisica.nome);
      }
    }
  }
  const funcionarios = [...funcionariosMap.entries()]
    .map(([id_funcionario, nome]) => ({ id_funcionario, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const letraDe = (idFuncionario: number) => {
    const indice = funcionarios.findIndex((f) => f.id_funcionario === idFuncionario);
    return indice < 0 ? "?" : letraColuna(indice);
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold text-ink">Relatório do inventário</h2>
          <p className="m-0 text-sm text-[#697077]">
            Contagens, escolha/origem do ajuste, movimentação e aprovador.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          <Button
            label="Exportar CSV"
            href={`/inventario/${id}/relatorio/export`}
            variant="ghost"
          />
          <Button
            label="Exportar XLSX"
            href={`/inventario/${id}/relatorio/export?formato=xlsx`}
            variant="ghost"
          />
          <Button label="Voltar" href={`/inventario/${id}`} variant="ghost" />
        </div>
      </div>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Relatório do Inventário</h1>
              <div className="meta-info">
                <p>{inventario.observacao?.trim() || `Inventário #${inventario.id_inventario}`}</p>
                <p>
                  Status: {ROTULOS_STATUS_INVENTARIO[inventario.status] ?? inventario.status}
                </p>
                <p>
                  Início: {data(inventario.data_inicio)} · Fim: {data(inventario.data_fim)}
                </p>
                <p>Aprovador: {inventario.usuarioAprovacao?.funcionario.pessoaFisica.nome ?? "-"}</p>
                {funcionarios.length > 0 && (
                  <div className="legenda-contagens">
                    <span>Legenda das contagens:</span>
                    {funcionarios.map((funcionario, indice) => (
                      <span key={funcionario.id_funcionario}>
                        {letraColuna(indice)} — {funcionario.nome}
                      </span>
                    ))}
                  </div>
                )}
                <p>
                  Emissão: {emissao.data} {emissao.hora} · Emitente: {emitente}
                </p>
                <p>{inventario.itens.length} produto(s)</p>
              </div>
            </header>

            <table className="relatorio-tabela">
              <thead>
                <tr>
                  <th style={{ width: "8%" }} className="col-centro">Código</th>
                  <th style={{ width: "22%" }}>Produto</th>
                  {podeVerSistema && (
                    <th style={{ width: "8%" }} className="col-direita">Sistema</th>
                  )}
                  <th style={{ width: "20%" }}>Contagens</th>
                  <th style={{ width: "8%" }} className="col-direita">Média</th>
                  <th style={{ width: "8%" }} className="col-direita">Contada</th>
                  <th style={{ width: "10%" }}>Origem</th>
                  <th style={{ width: "8%" }}>Ajuste</th>
                  <th style={{ width: "8%" }}>Movimento</th>
                </tr>
              </thead>
              <tbody>
                {inventario.itens.length === 0 ? (
                  <tr>
                    <td colSpan={podeVerSistema ? 9 : 8} className="relatorio-vazio">
                      Nenhum produto neste inventário.
                    </td>
                  </tr>
                ) : (
                  inventario.itens.map((item) => {
                    const ajuste = ajustes.get(item.id_produto);
                    const movimento = ajuste?.movimentacoes[0];
                    return (
                      <tr key={item.id_item_inventario}>
                        <td className="col-centro">{String(item.id_produto).padStart(6, "0")}</td>
                        <td>{item.produto.descricao}</td>
                        {podeVerSistema && (
                          <td className="col-direita">{q(Number(item.quantidade_sistema))}</td>
                        )}
                        <td>
                          {item.contagens
                            .map(
                              (contagem) =>
                                `${letraDe(contagem.id_funcionario)} — ${contagem.funcionario.pessoaFisica.nome}: ${q(Number(contagem.quantidade_contada))}`,
                            )
                            .join(" | ")}
                        </td>
                        <td className="col-direita">
                          {q(
                            item.contagens.length === 0
                              ? 0
                              : item.contagens.reduce(
                                  (soma, contagem) => soma + Number(contagem.quantidade_contada),
                                  0,
                                ) / item.contagens.length,
                          )}
                        </td>
                        <td className="col-direita">
                          {podeVerSistema ? (item.quantidade_final === null ? "—" : q(Number(item.quantidade_final))) : "—"}
                        </td>
                        <td>
                          {item.origem ? ROTULOS_ORIGEM_AJUSTE[item.origem] ?? item.origem : "—"}
                        </td>
                        <td>
                          {podeVerSistema ? (ajuste ? ROTULOS_STATUS_AJUSTE[ajuste.status] ?? ajuste.status : "Sem ajuste") : "—"}
                        </td>
                        <td>
                          {podeVerSistema && movimento
                            ? `#${movimento.id_movimentacao} (${q(Number(movimento.quantidade))})`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <footer className="relatorio-footer">
            <span>Emitente: {emitente}</span>
            <span>Documento gerado para uso interno</span>
          </footer>
        </div>
      </div>
    </>
  );
}
