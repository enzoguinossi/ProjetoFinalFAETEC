import { redirect } from "next/navigation";
import PageTitle from "@/components/PageTitle";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import PedidoForm from "../../PedidoForm";
import { listarEscolasSelecao, listarProdutosPedido, obterPedido } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditarPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "pedido.alterar"))) redirect("/pedidos");

  const { id } = await params;
  const pedido = await obterPedido(Number(id));
  if (!pedido) redirect("/pedidos");
  if (!pedido.podeEditar) redirect(`/pedidos/${pedido.id_pedido_escola}`);

  const [escolas, produtos] = await Promise.all([
    listarEscolasSelecao(),
    listarProdutosPedido(),
  ]);

  return (
    <>
      <PageTitle>Editar pedido</PageTitle>
      <div className="rounded-xl border border-border bg-white p-4">
        <PedidoForm
          mode="edit"
          initialData={pedido}
          escolas={escolas}
          produtos={produtos}
        />
      </div>
    </>
  );
}
