import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import { destinatarioDAO } from "@/dao/destinatario";

export const dynamic = "force-dynamic";

export default async function DestinatariosPage() {
  const { data } = await destinatarioDAO.list();

  const rows = data.map((d, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    razao: d.pessoaJuridica.razao_social,
  }));

  return (
    <DashboardLayout title="Destinatários">
      <SearchBar placeholder="Pesquisar destinatários..." />
      <DataTable columns={columns} data={rows} idField="codigo" />
    </DashboardLayout>
  );
}

const columns = [
  { key: "codigo" as const, label: "Código", width: "1fr" },
  { key: "razao" as const, label: "Razão Social", width: "5fr" },
];