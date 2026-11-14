import ProdutosClient from "./ProdutosClient";
import { listarProdutos } from "./actions";
import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { tipoProdutoDAO } from "@/dao/tipo-produto";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { resolverPermissoesPara, usuarioPode } from "@/lib/permissoes";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  const user = await requireUser();
  const perms = await resolverPermissoesPara(user, "produto");
  if (!perms.canList) redirect("/dashboard");
  const permsTipo = await resolverPermissoesPara(user, "tipo_produto");

  const [inicial, conversoes, tiposCodigo, tiposProduto, podeVerInativos, podeEntrada, podeSaida] =
    await Promise.all([
      listarProdutos({ page: 1, limit: 20 }),
      conversaoUnidadeDAO.list(),
      tipoCodigoDAO.listParaEntidade("PRODUTO"),
      tipoProdutoDAO.list(),
      usuarioPode(user, "produto.ver_inativos"),
      usuarioPode(user, "estoque.entrada"),
      usuarioPode(user, "estoque.saida"),
    ]);
  const podeDesmembrar = podeEntrada && podeSaida;

  return (
    <>
      <PageTitle>Produtos</PageTitle>
      <ProdutosClient
        inicial={inicial}
        conversoes={conversoes}
        tiposCodigo={tiposCodigo}
        tiposProduto={tiposProduto}
        perms={perms}
        permsTipo={permsTipo}
        podeVerInativos={podeVerInativos}
        podeDesmembrar={podeDesmembrar}
      />
    </>
  );
}
