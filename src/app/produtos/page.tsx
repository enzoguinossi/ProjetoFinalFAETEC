import ProdutosClient from "./ProdutosClient";
import { listarProdutos } from "./actions";
import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { resolverPermissoesPara, usuarioPode } from "@/lib/permissoes";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  const user = await requireUser();
  const perms = await resolverPermissoesPara(user, "produto");
  if (!perms.canList) redirect("/dashboard");

  const [inicial, conversoes, tiposCodigo, podeVerInativos] = await Promise.all([
    listarProdutos({ page: 1, limit: 20 }),
    conversaoUnidadeDAO.list(),
    tipoCodigoDAO.listParaEntidade("PRODUTO"),
    usuarioPode(user, "produto.ver_inativos"),
  ]);

  return (
    <>
      <PageTitle>Produtos</PageTitle>
      <ProdutosClient
        inicial={inicial}
        conversoes={conversoes}
        tiposCodigo={tiposCodigo}
        perms={perms}
        podeVerInativos={podeVerInativos}
      />
    </>
  );
}
