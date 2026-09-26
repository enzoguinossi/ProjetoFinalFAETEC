import DashboardLayout from "@/components/DashboardLayout";
import ProdutosClient from "./ProdutosClient";
import { produtoDAO } from "@/dao/produto";
import { prisma } from "@/lib/prisma";

export default async function ProdutosPage() {
  const [listResult, conversoes, tiposCodigo] = await Promise.all([
    produtoDAO.list(),
    prisma.conversaoUnidade.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.tipoCodigo.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  const rows = listResult.data.map((p) => ({
    codigo: String(p.id_produto).padStart(6, "0"),
    descricao: p.descricao,
    qtd: "0",
    livre: "0",
  }));

  return (
    <DashboardLayout title="Produtos">
      <ProdutosClient rows={rows} conversoes={conversoes} tiposCodigo={tiposCodigo} />
    </DashboardLayout>
  );
}