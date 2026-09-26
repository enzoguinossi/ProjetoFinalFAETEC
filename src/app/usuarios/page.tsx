import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const data = await prisma.usuario.findMany({
    where: { ativo: true },
    include: {
      funcionario: { include: { pessoaFisica: true } },
    },
    orderBy: { id_usuario: "asc" },
  });

  const rows = data.map((u, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    login: u.login,
    nome: u.funcionario.pessoaFisica.nome,
    admin: u.super_admin ? "Sim" : "Não",
  }));

  return (
    <DashboardLayout title="Usuários">
      <SearchBar placeholder="Pesquisar usuários..." novoHref="/usuarios/novo" />
      <DataTable columns={columns} data={rows} idField="codigo" />
    </DashboardLayout>
  );
}

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "login" as const, label: "Login", width: "1.5fr" },
  { key: "nome" as const, label: "Nome", width: "3fr" },
  { key: "admin" as const, label: "Administrador", width: "1fr" },
];