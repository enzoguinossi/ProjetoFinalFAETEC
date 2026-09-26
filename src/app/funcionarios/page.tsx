import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { funcionarioDAO } from "@/dao/funcionario";

export const dynamic = "force-dynamic";

export default async function FuncionariosPage() {
  const { data } = await funcionarioDAO.list();

  const rows = data.map((f, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    nome: f.pessoaFisica.nome,
    cargo: f.cargo ?? "",
  }));

  return (
    <DashboardLayout title="Funcionários">
      <SearchBar placeholder="Pesquisar funcionários..." />
      <DataTable columns={columns} data={rows} idField="codigo" />
    </DashboardLayout>
  );
}

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "nome" as const, label: "Nome", width: "3fr" },
  { key: "cargo" as const, label: "Cargo", width: "2fr" },
];