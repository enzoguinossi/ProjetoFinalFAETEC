import DashboardLayout from "@/components/DashboardLayout";
import { listFuncionarios } from "./actions";
import UsuarioForm from "./UsuarioForm";

export default async function NovoUsuarioPage() {
  const funcionarios = await listFuncionarios();
  return (
    <DashboardLayout title="Novo Usuário">
      <UsuarioForm funcionarios={funcionarios} />
    </DashboardLayout>
  );
}