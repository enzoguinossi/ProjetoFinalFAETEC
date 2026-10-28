import { redirect } from "next/navigation";
import PageTitle from "@/components/PageTitle";
import { requireUser } from "@/lib/auth";
import { resolverPermissoes, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import {
  listarEscolasSelecao,
  listarPedidos,
  listarProdutosPedido,
} from "./actions";
import PedidosClient from "./PedidosClient";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const user = await requireUser();
  const perms = await resolverPermissoes("pedido");
  // A tela é acessível por qualquer permissão do módulo (listar/consultar/
  // criar/alterar/aprovar); cada ação é escondida sem a permissão própria.
  const podeEntrar = await usuarioPodeAlguma(user, [
    "pedido.listar",
    "pedido.consultar",
    "pedido.criar",
    "pedido.alterar",
    "pedido.aprovar",
  ]);
  if (!podeEntrar) redirect("/dashboard");

  const [inicial, escolas, produtos, podeAprovar, podeConsultar] = await Promise.all([
    listarPedidos({ page: 1, limit: 20 }),
    listarEscolasSelecao(),
    listarProdutosPedido(),
    usuarioPode(user, "pedido.aprovar"),
    usuarioPode(user, "pedido.consultar"),
  ]);

  return (
    <>
      <PageTitle>Pedidos</PageTitle>
      <PedidosClient
        inicial={inicial}
        escolas={escolas}
        produtos={produtos}
        filtros={{
          busca: "",
          escola: "",
          status: "",
          de: "",
          ate: "",
          produto: "",
          nota: "todos",
        }}
        podeCriar={perms.canCreate}
        podeAlterar={perms.canEdit}
        podeAprovar={podeAprovar}
        podeConsultar={podeConsultar}
      />
    </>
  );
}
