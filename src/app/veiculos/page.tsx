import DashboardLayout from "@/components/DashboardLayout";
import VeiculosClient from "./VeiculosClient";
import { listarVeiculos } from "./actions";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function VeiculosPage() {
  const perms = await resolverPermissoes("veiculo");
  if (!perms.canList) redirect("/dashboard");

  const [inicial, tiposCodigo] = await Promise.all([
    listarVeiculos({ page: 1, limit: 20 }),
    tipoCodigoDAO.listParaEntidade("VEICULO"),
  ]);

  return (
    <DashboardLayout title="Veículos">
      <VeiculosClient inicial={inicial} tiposCodigo={tiposCodigo} perms={perms} />
    </DashboardLayout>
  );
}
