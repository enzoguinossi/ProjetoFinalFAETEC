import DashboardLayout from "@/components/DashboardLayout";
import DestinatariosClient from "./DestinatariosClient";
import { destinatarioDAO } from "@/dao/destinatario";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function DestinatariosPage() {
  const perms = await resolverPermissoes("destinatario");
  if (!perms.canList) redirect("/dashboard");

  const { data } = await destinatarioDAO.list();
  const rows = data.map((d, i) => ({
    id_destinatario: d.id_destinatario,
    codigo: String(i + 1).padStart(3, "0"),
    razao: d.pessoaJuridica.razao_social,
  }));
  return (
    <DashboardLayout title="Destinatários">
      <DestinatariosClient rows={rows} perms={perms} />
    </DashboardLayout>
  );
}