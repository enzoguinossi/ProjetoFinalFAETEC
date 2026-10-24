import UsuariosClient from "./UsuariosClient";
import { listarUsuarios } from "./actions";
import { funcionarioDAO } from "@/dao/funcionario";
import { permissaoService } from "@/services/permissao";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const perms = await resolverPermissoes("usuario");
  if (!perms.canList) redirect("/dashboard");

  const [inicial, funcionarios, grupos, perfis] = await Promise.all([
    listarUsuarios({ page: 1, limit: 20 }),
    funcionarioDAO.listDisponiveisParaUsuario(),
    permissaoService.listarTodasAgrupadas(),
    permissaoService.listarPerfisComPermissoes(),
  ]);

  const perfilPermissoes: Record<number, string[]> = {};
  for (const p of perfis) perfilPermissoes[p.id_perfil] = p.permissoes;

  return (
    <>
      <PageTitle>Usuários</PageTitle>
      <UsuariosClient
        inicial={inicial}
        funcionarios={funcionarios}
        grupos={grupos}
        perfis={perfis}
        perfilPermissoes={perfilPermissoes}
        perms={perms}
      />
    </>
  );
}
