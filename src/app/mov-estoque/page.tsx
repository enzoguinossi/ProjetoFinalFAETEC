import DashboardLayout from "@/components/DashboardLayout";
import MovEstoqueClient from "./MovEstoqueClient";
import { listarNotasEntrada, listarUnidadesEntrada } from "./actions";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function MovEstoquePage() {
  const user = await requireUser();
  const podeVer = await usuarioPodeAlguma(user, ["estoque.ver_saldo", "estoque.entrada"]);
  if (!podeVer) redirect("/dashboard");

  const podeCriar = await usuarioPode(user, "estoque.entrada");
  const [inicial, conversoes] = await Promise.all([
    listarNotasEntrada({ page: 1, limit: 20 }),
    podeCriar ? listarUnidadesEntrada() : Promise.resolve([]),
  ]);

  return (
    <DashboardLayout title="Movimentação de Estoque">
      <MovEstoqueClient inicial={inicial} conversoes={conversoes} podeCriar={podeCriar} />
    </DashboardLayout>
  );
}
