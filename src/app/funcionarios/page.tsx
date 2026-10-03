import DashboardLayout from "@/components/DashboardLayout";
import FuncionariosClient from "./FuncionariosClient";
import { funcionarioDAO } from "@/dao/funcionario";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function FuncionariosPage() {
  const perms = await resolverPermissoes("funcionario");
  if (!perms.canList) redirect("/dashboard");

  const [{ data }, tiposCodigo] = await Promise.all([
    funcionarioDAO.list(),
    tipoCodigoDAO.listParaEntidade("FUNCIONARIO"),
  ]);

  const rows = data.map((f, i) => ({
    id_funcionario: f.id_funcionario,
    codigo: String(i + 1).padStart(3, "0"),
    nome: f.pessoaFisica.nome,
    cargo: f.cargo ?? "",
    condutor: f.condutor ? "Sim" : "Não",
  }));

  return (
    <DashboardLayout title="Funcionários">
      <FuncionariosClient rows={rows} tiposCodigo={tiposCodigo} perms={perms} />
    </DashboardLayout>
  );
}