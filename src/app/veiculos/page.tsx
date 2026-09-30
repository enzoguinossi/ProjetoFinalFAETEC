import DashboardLayout from "@/components/DashboardLayout";
import VeiculosClient from "./VeiculosClient";
import { veiculoDAO } from "@/dao/veiculo";

export const dynamic = "force-dynamic";

export default async function VeiculosPage() {
  const { data } = await veiculoDAO.list();

  const rows = data.map((v, i) => ({
    id_veiculo: v.id_veiculo,
    codigo: String(i + 1).padStart(3, "0"),
    descricao: v.modelo ?? v.placa,
    placa: v.placa,
    status: v.status === "DISPONIVEL" ? "Ativo" : v.status === "EM_ROTA" ? "Em rota" : "Indisponível",
  }));

  return (
    <DashboardLayout title="Veículos">
      <VeiculosClient rows={rows} />
    </DashboardLayout>
  );
}