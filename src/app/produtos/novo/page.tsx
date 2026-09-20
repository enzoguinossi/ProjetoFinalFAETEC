import DashboardLayout from "@/components/DashboardLayout";
import { prisma } from "@/lib/prisma";
import ProdutoForm from "./ProdutoForm";

export default async function NovoProdutoPage() {
  const [conversoes, tiposCodigo, produtos] = await Promise.all([
    prisma.conversaoUnidade.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.tipoCodigo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.produto.findMany({
      where: { ativo: true },
      select: { id_produto: true, descricao: true },
      orderBy: { descricao: "asc" },
    }),
  ]);

  return (
    <DashboardLayout title="Cadastro de Produto">
      <ProdutoForm
        conversoes={conversoes}
        tiposCodigo={tiposCodigo}
        produtos={produtos}
      />
    </DashboardLayout>
  );
}