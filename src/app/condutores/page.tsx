import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { condutorDAO } from "@/dao/condutor";

export default async function CondutoresPage() {
  const { data } = await condutorDAO.list();

  const rows = data.map((c, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    nome: c.funcionario.pessoaFisica.nome,
    cnh: c.numero_cnh ?? "",
  }));

  return (
    <DashboardLayout title="Condutores">
      <SearchBar placeholder="Pesquisar condutores..." />
      <DataTable columns={columns} data={rows} idField="codigo" />
    </DashboardLayout>
  );
}

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "nome" as const, label: "Nome", width: "2fr" },
  { key: "cnh" as const, label: "CNH", width: "3fr" },
];