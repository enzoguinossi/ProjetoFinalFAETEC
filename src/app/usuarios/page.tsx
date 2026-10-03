import DashboardLayout from "@/components/DashboardLayout";
import UsuariosClient from "./UsuariosClient";
import { usuarioDAO } from "@/dao/usuario";
import { funcionarioDAO } from "@/dao/funcionario";
import { permissaoService } from "@/services/permissao";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const perms = await resolverPermissoes("usuario");
  if (!perms.canList) redirect("/dashboard");

  const [data, funcionarios, grupos, perfis] = await Promise.all([
    usuarioDAO.list(),
    funcionarioDAO.listDisponiveisParaUsuario(),
    permissaoService.listarTodasAgrupadas(),
    permissaoService.listarPerfis(),
  ]);

  const perfilPermissoes: Record<number, string[]> = {};
  await Promise.all(
    perfis.map(async (p) => {
      perfilPermissoes[p.id_perfil] = await permissaoService.permissoesDoPerfil(p.id_perfil);
    }),
  );

  const rows = data.map((u, i) => ({
    id_usuario: u.id_usuario,
    codigo: String(i + 1).padStart(3, "0"),
    login: u.login,
    nome: u.funcionario.pessoaFisica.nome,
  }));

  return (
    <DashboardLayout title="Usuários">
      <UsuariosClient
        rows={rows}
        funcionarios={funcionarios}
        grupos={grupos}
        perfis={perfis}
        perfilPermissoes={perfilPermissoes}
        perms={perms}
      />
    </DashboardLayout>
  );
}