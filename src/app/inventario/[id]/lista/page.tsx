import { redirect } from "next/navigation";
import Button from "@/components/Button";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { metadadosEmissao } from "@/services/relatorio";
import { getListaContagem } from "../../actions";
import ImprimirButton from "../ImprimirButton";

export const dynamic = "force-dynamic";

type Params = { sistema?: string | string[] };

export default async function ListaContagemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
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
  const query = await searchParams;
  const sistema = Array.isArray(query.sistema)
    ? query.sistema[0] === "1"
    : query.sistema === "1";
  const resultado = await getListaContagem(Number(id), sistema);
  if (!resultado || "error" in resultado) redirect("/inventario");

  const emissao = metadadosEmissao();
  const data = new Date(resultado.data_inicio).toLocaleDateString("pt-BR");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3" data-print-hide>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold text-ink">Lista de contagem</h2>
          <p className="m-0 text-sm text-[#697077]">
            Campos em branco para preencher à mão. Sem assinatura.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImprimirButton />
          {resultado.podeVerSistema && (
            <Button
              label={resultado.mostrarSistema ? "Ocultar quantidades do sistema" : "Mostrar quantidades do sistema"}
              href={`/inventario/${id}/lista${resultado.mostrarSistema ? "" : "?sistema=1"}`}
              variant="ghost"
            />
          )}
          <Button label="Voltar" href={`/inventario/${id}`} variant="ghost" />
        </div>
      </div>

      <div className="relatorio-scroll">
        <div className="relatorio-container">
          <div className="relatorio-conteudo">
            <header className="relatorio-header">
              <h1 className="titulo-relatorio">Lista de Contagem</h1>
              <div className="meta-info">
                <p>{resultado.observacao}</p>
                <p>Data do inventário: {data}</p>
                <p>Emitente: {resultado.emitente}</p>
                <p>
                  Gerado em: {emissao.data} {emissao.hora}
                </p>
              </div>
            </header>

            <table className="relatorio-tabela">
              <thead>
                <tr>
                  <th style={{ width: "10%" }} className="col-centro">Código</th>
                  <th style={{ width: "40%" }}>Produto</th>
                  {resultado.mostrarSistema && (
                    <th style={{ width: "14%" }} className="col-direita">Sistema</th>
                  )}
                  <th style={{ width: "18%" }} className="col-centro">Contagem</th>
                  <th style={{ width: "18%" }}>Observação</th>
                </tr>
              </thead>
              <tbody>
                {resultado.itens.length === 0 ? (
                  <tr>
                    <td colSpan={resultado.mostrarSistema ? 5 : 4} className="relatorio-vazio">
                      Nenhum produto neste inventário.
                    </td>
                  </tr>
                ) : (
                  resultado.itens.map((item) => (
                    <tr key={item.id_item_inventario}>
                      <td className="col-centro">{item.codigo}</td>
                      <td>{item.descricao}</td>
                      {resultado.mostrarSistema && (
                        <td className="col-direita">
                          {item.quantidade_sistema === null
                            ? ""
                            : item.quantidade_sistema.toLocaleString("pt-BR", {
                                maximumFractionDigits: 3,
                              })}
                        </td>
                      )}
                      <td className="col-centro">
                        <span className="block h-6 border-b border-[#697077]" aria-hidden="true" />
                      </td>
                      <td>
                        <span className="block h-6 border-b border-[#697077]" aria-hidden="true" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="relatorio-footer">
            <span>Emitente: {resultado.emitente}</span>
            <span>Documento gerado para uso interno</span>
          </footer>
        </div>
      </div>
    </>
  );
}
