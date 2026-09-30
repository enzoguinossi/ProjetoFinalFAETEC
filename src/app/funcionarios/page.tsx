import DashboardLayout from "@/components/DashboardLayout";
import FuncionariosClient from "./FuncionariosClient";
import { funcionarioDAO } from "@/dao/funcionario";

export const dynamic = "force-dynamic";

export default async function FuncionariosPage() {
  const { data } = await funcionarioDAO.list();

  const rows = data.map((f, i) => ({
    id_funcionario: f.id_funcionario,
    codigo: String(i + 1).padStart(3, "0"),
    nome: f.pessoaFisica.nome,
    cargo: f.cargo ?? "",
    condutor: f.condutor?.ativo ? "Sim" : "Não",
  }));

  return (
    <DashboardLayout title="Funcionários">
      <FuncionariosClient rows={rows} />
    </DashboardLayout>
  );
}