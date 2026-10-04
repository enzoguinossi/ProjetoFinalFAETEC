import DashboardLayout from "@/components/DashboardLayout";
import VeiculosClient from "./VeiculosClient";
import { veiculoDAO } from "@/dao/veiculo";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";

export const dynamic = "force-dynamic";

export default async function VeiculosPage() {
  const perms = await resolverPermissoes("veiculo");
  if (!perms.canList) redirect("/dashboard");

  const [{ data }, tiposCodigo] = await Promise.all([
    veiculoDAO.list(),
    tipoCodigoDAO.listParaEntidade("VEICULO"),
  ]);

  const rows = data.map((v) => ({
    id_veiculo: v.id_veiculo,
    codigo: formatarCodigo(v.id_veiculo),
    descricao: v.modelo ?? v.placa,
    placa: v.placa,
    status: v.status === "DISPONIVEL" ? "Ativo" : v.status === "EM_ROTA" ? "Em rota" : "Indisponível",
  }));

  return (
    <DashboardLayout title="Veículos">
      <VeiculosClient rows={rows} tiposCodigo={tiposCodigo} perms={perms} />
    </DashboardLayout>
  );
}