import DashboardLayout from "@/components/DashboardLayout";
import ProdutosClient from "./ProdutosClient";
import { produtoDAO } from "@/dao/produto";
import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  const perms = await resolverPermissoes("produto");
  if (!perms.canList) redirect("/dashboard");

  const [listResult, conversoes, tiposCodigo] = await Promise.all([
    produtoDAO.list(),
    conversaoUnidadeDAO.list(),
    tipoCodigoDAO.list(),
  ]);

  const rows = listResult.data.map((p) => {
    const qtd = p.estoques.reduce((s, e) => s + Number(e.quantidade_atual), 0);
    const reservado = p.estoques.reduce((s, e) => s + Number(e.saldo_reservado), 0);
    return {
      id_produto: p.id_produto,
      codigo: String(p.id_produto).padStart(6, "0"),
      descricao: p.descricao,
      qtd: String(qtd),
      livre: String(qtd - reservado),
    };
  });

  return (
    <DashboardLayout title="Produtos">
      <ProdutosClient rows={rows} conversoes={conversoes} tiposCodigo={tiposCodigo} perms={perms} />
    </DashboardLayout>
  );
}