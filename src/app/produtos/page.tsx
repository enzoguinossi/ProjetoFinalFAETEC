import DashboardLayout from "@/components/DashboardLayout";
import ProdutosClient from "./ProdutosClient";
import { produtoDAO } from "@/dao/produto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  const [listResult, conversoes, tiposCodigo] = await Promise.all([
    produtoDAO.list(),
    prisma.conversaoUnidade.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.tipoCodigo.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  const rows = listResult.data.map((p) => {
    const qtd = p.estoques.reduce((s, e) => s + Number(e.quantidade_atual), 0);
    const reservado = p.estoques.reduce((s, e) => s + Number(e.saldo_reservado), 0);
    return {
      codigo: String(p.id_produto).padStart(6, "0"),
      descricao: p.descricao,
      qtd: String(qtd),
      livre: String(qtd - reservado),
    };
  });

  return (
    <DashboardLayout title="Produtos">
      <ProdutosClient rows={rows} conversoes={conversoes} tiposCodigo={tiposCodigo} />
    </DashboardLayout>
  );
}