import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { veiculoDAO } from "@/dao/veiculo";

export default async function VeiculosPage() {
  const { data } = await veiculoDAO.list();

  const rows = data.map((v) => ({
    descricao: v.modelo ?? v.placa,
    placa: v.placa,
    status: v.status === "DISPONIVEL" ? "Ativo" : v.status === "EM_ROTA" ? "Em rota" : "Indisponível",
  }));

  return (
    <DashboardLayout title="Veículos">
      <SearchBar placeholder="Pesquisar veículos..." />
      <DataTable columns={columns} data={rows} idField="placa" />
    </DashboardLayout>
  );
}

const columns = [
  { key: "descricao" as const, label: "Descrição", width: "2fr" },
  { key: "placa" as const, label: "Placa", width: "1.5fr" },
  { key: "status" as const, label: "Status", width: "1fr" },
];