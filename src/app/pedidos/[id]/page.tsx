import { redirect } from "next/navigation";
import PageTitle from "@/components/PageTitle";
import Button from "@/components/Button";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";
import { obterPedido } from "../actions";
import PedidoAcoes from "./PedidoAcoes";

export const dynamic = "force-dynamic";

const statusCls: Record<string, string> = {
  PENDENTE: "bg-[#fff4e5] text-[#7a4100]",
  CONFIRMADO: "bg-[#e7f6ec] text-[#0f5132]",
  RECUSADO: "bg-[#fdecea] text-[#8a1c1c]",
};

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (
    !(await usuarioPodeAlguma(user, [
      "pedido.consultar",
      "pedido.alterar",
      "pedido.aprovar",
    ]))
  ) {
    redirect("/pedidos");
  }

  const { id } = await params;
  const pedido = await obterPedido(Number(id));
  if (!pedido) redirect("/pedidos");

  const podeAlterar = await usuarioPode(user, "pedido.alterar");
  const podeAprovar = await usuarioPode(user, "pedido.aprovar");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <PageTitle>Pedido {formatarCodigo(pedido.id_pedido_escola)}</PageTitle>
          <span
            className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
              statusCls[pedido.status] ?? "bg-[#f2f4f8] text-[#4a4f55]"
            }`}
          >
            {pedido.statusLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeAlterar && pedido.podeEditar && (
            <Button
              label="Editar"
              variant="ghost"
              href={`/pedidos/${pedido.id_pedido_escola}/editar`}
            />
          )}
          {podeAprovar && pedido.status === "PENDENTE" && (
            <PedidoAcoes id={pedido.id_pedido_escola} podeAnalisar />
          )}
          <Button label="Voltar" variant="ghost" href="/pedidos" />
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 font-sans text-sm">
          <span className="text-xs text-[#697077]">Escola</span>
          <span className="text-ink-strong">{pedido.escola}</span>
        </div>
        <div className="flex flex-col gap-1 font-sans text-sm">
          <span className="text-xs text-[#697077]">Data</span>
          <span className="text-ink-strong">{pedido.data}</span>
        </div>
        <div className="flex flex-col gap-1 font-sans text-sm">
          <span className="text-xs text-[#697077]">Observação</span>
          <span className="text-ink-strong">{pedido.observacao?.trim() || ""}</span>
        </div>
        <div className="flex flex-col gap-1 font-sans text-sm">
          <span className="text-xs text-[#697077]">Nota de saída</span>
          <span className="text-ink-strong">
            {pedido.nota === null ? "Sem nota" : formatarCodigo(pedido.nota)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand text-left text-white">
              <th className="px-3 py-2 font-display font-semibold">Código</th>
              <th className="px-3 py-2 font-display font-semibold">Produto</th>
              <th className="px-3 py-2 text-right font-display font-semibold">
                Quantidade
              </th>
              <th className="px-3 py-2 font-display font-semibold">Observação</th>
            </tr>
          </thead>
          <tbody>
            {pedido.itens.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[#697077]">
                  Nenhum item no pedido.
                </td>
              </tr>
            ) : (
              pedido.itens.map((item, index) => (
                <tr
                  key={item.id_produto}
                  className={index % 2 === 1 ? "bg-[#f8fafb]" : "bg-white"}
                >
                  <td className="px-3 py-2 font-mono text-xs text-[#697077]">
                    {item.codigo}
                  </td>
                  <td className="px-3 py-2">{item.descricao}</td>
                  <td className="px-3 py-2 text-right">
                    {formatarQuantidade(item.quantidade)}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#697077]">
                    {item.observacao?.trim() || ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {pedido.itens.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2} className="border-t border-border px-3 py-2 text-right font-semibold">
                  Total
                </td>
                <td className="border-t border-border px-3 py-2 text-right font-semibold">
                  {formatarQuantidade(
                    pedido.itens.reduce((soma, item) => soma + item.quantidade, 0),
                  )}
                </td>
                <td className="border-t border-border" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {pedido.status === "CONFIRMADO" && (
        <p className="m-0 font-sans text-sm text-[#0f5132]">
          Pedido aprovado{pedido.nota === null ? " e disponível para importar na Saída." : "."}
        </p>
      )}
      {pedido.status === "RECUSADO" && (
        <p className="m-0 font-sans text-sm text-[#8a1c1c]">
          Pedido recusado — permanece no histórico e não pode ser importado.
        </p>
      )}
    </>
  );
}
