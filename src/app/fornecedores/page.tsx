import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { fornecedorDAO } from "@/dao/fornecedor";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const { data } = await fornecedorDAO.list();

  const rows = data.map((f, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    razao: f.pessoaJuridica.razao_social,
  }));

  return (
    <DashboardLayout title="Fornecedores">
      <SearchBar placeholder="Pesquisar fornecedores..." />
      <DataTable columns={columns} data={rows} idField="codigo" />
    </DashboardLayout>
  );
}

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "razao" as const, label: "Razão Social", width: "5fr" },
];