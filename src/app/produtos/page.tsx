import ProdutosClient from "./ProdutosClient";
import { listarProdutos } from "./actions";
import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  const perms = await resolverPermissoes("produto");
  if (!perms.canList) redirect("/dashboard");

  const [inicial, conversoes, tiposCodigo] = await Promise.all([
    listarProdutos({ page: 1, limit: 20 }),
    conversaoUnidadeDAO.list(),
    tipoCodigoDAO.listParaEntidade("PRODUTO"),
  ]);

  return (
    <>
      <ProdutosClient inicial={inicial} conversoes={conversoes} tiposCodigo={tiposCodigo} perms={perms} />
    </>
  );
}
