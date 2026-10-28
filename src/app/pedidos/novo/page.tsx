import { redirect } from "next/navigation";
import PageTitle from "@/components/PageTitle";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import PedidoForm from "../PedidoForm";
import { listarEscolasSelecao, listarProdutosPedido } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovoPedidoPage() {
  const user = await requireUser();
  if (!(await usuarioPode(user, "pedido.criar"))) redirect("/pedidos");

  const [escolas, produtos] = await Promise.all([
    listarEscolasSelecao(),
    listarProdutosPedido(),
  ]);

  return (
    <>
      <PageTitle>Novo pedido</PageTitle>
      <div className="rounded-xl border border-border bg-white p-4">
        <PedidoForm mode="create" escolas={escolas} produtos={produtos} />
      </div>
    </>
  );
}
