import DashboardLayout from "@/components/DashboardLayout";
import UsuariosClient from "./UsuariosClient";
import { usuarioDAO } from "@/dao/usuario";
import { funcionarioDAO } from "@/dao/funcionario";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const perms = await resolverPermissoes("usuario");
  if (!perms.canList) redirect("/dashboard");

  const [data, funcionarios] = await Promise.all([
    usuarioDAO.list(),
    funcionarioDAO.listDisponiveisParaUsuario(),
  ]);

  const rows = data.map((u, i) => ({
    id_usuario: u.id_usuario,
    codigo: String(i + 1).padStart(3, "0"),
    login: u.login,
    nome: u.funcionario.pessoaFisica.nome,
  }));

  return (
    <DashboardLayout title="Usuários">
      <UsuariosClient rows={rows} funcionarios={funcionarios} perms={perms} />
    </DashboardLayout>
  );
}