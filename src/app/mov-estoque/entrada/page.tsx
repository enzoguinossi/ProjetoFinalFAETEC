import DashboardLayout from "@/components/DashboardLayout";
import EntradaClient from "../EntradaClient";
import { listarNotasEntrada, listarUnidadesEntrada } from "../actions";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import type { ConversaoUnidadeItem } from "../tipos";

export const dynamic = "force-dynamic";

export default async function MovEstoqueEntradaPage() {
  const user = await requireUser();
  const podeVer = await usuarioPodeAlguma(user, ["estoque.ver_saldo", "estoque.entrada"]);
  if (!podeVer) redirect("/dashboard");

  const podeCriar = await usuarioPode(user, "estoque.entrada");
  const podeCriarFornecedor = podeCriar && (await usuarioPode(user, "fornecedor.criar"));

  const [inicial, conversoes, tiposCodigo] = await Promise.all([
    listarNotasEntrada({ page: 1, limit: 20 }),
    podeCriar ? listarUnidadesEntrada() : Promise.resolve<ConversaoUnidadeItem[]>([]),
    podeCriarFornecedor
      ? tipoCodigoDAO.listParaEntidade("FORNECEDOR")
      : Promise.resolve<{ id_tipo_codigo: number; nome: string }[]>([]),
  ]);

  return (
    <DashboardLayout title="Movimentação de Estoque">
      <EntradaClient
        inicial={inicial}
        conversoes={conversoes}
        podeCriar={podeCriar}
        podeCriarFornecedor={podeCriarFornecedor}
        tiposCodigoFornecedor={tiposCodigo.map((t) => ({ id_tipo_codigo: t.id_tipo_codigo, nome: t.nome }))}
      />
    </DashboardLayout>
  );
}
