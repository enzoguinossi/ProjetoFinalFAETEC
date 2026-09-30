import DashboardLayout from "@/components/DashboardLayout";
import UsuariosClient from "./UsuariosClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const [data, funcionarios] = await Promise.all([
    prisma.usuario.findMany({
      where: { ativo: true },
      include: {
        funcionario: { include: { pessoaFisica: true } },
      },
      orderBy: { id_usuario: "asc" },
    }),
    prisma.funcionario.findMany({
      where: { ativo: true, usuario: null },
      include: { pessoaFisica: true },
      orderBy: { id_funcionario: "asc" },
    }),
  ]);

  const rows = data.map((u, i) => ({
    id_usuario: u.id_usuario,
    codigo: String(i + 1).padStart(3, "0"),
    login: u.login,
    nome: u.funcionario.pessoaFisica.nome,
    admin: u.super_admin ? "Sim" : "Não",
  }));

  return (
    <DashboardLayout title="Usuários">
      <UsuariosClient rows={rows} funcionarios={funcionarios} />
    </DashboardLayout>
  );
}