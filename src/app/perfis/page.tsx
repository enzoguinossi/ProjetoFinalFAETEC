import DashboardLayout from "@/components/DashboardLayout";
import PerfisClient from "./PerfisClient";
import { listarPerfisComPermissoes, listarPermissoesAgrupadas } from "./actions";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function PerfisPage() {
  const perms = await resolverPermissoes("perfil");
  if (!perms.canList) redirect("/dashboard");

  const [rows, grupos] = await Promise.all([
    listarPerfisComPermissoes(),
    listarPermissoesAgrupadas(),
  ]);

  return (
    <DashboardLayout title="Perfis">
      <PerfisClient rows={rows} grupos={grupos} />
    </DashboardLayout>
  );
}
