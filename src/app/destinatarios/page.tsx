import DestinatariosClient from "./DestinatariosClient";
import { listarDestinatarios } from "./actions";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function DestinatariosPage() {
  const perms = await resolverPermissoes("destinatario");
  if (!perms.canList) redirect("/dashboard");

  const [inicial, tiposCodigo] = await Promise.all([
    listarDestinatarios({ page: 1, limit: 20 }),
    tipoCodigoDAO.listParaEntidade("DESTINATARIO"),
  ]);

  return (
    <>
      <DestinatariosClient inicial={inicial} tiposCodigo={tiposCodigo} perms={perms} />
    </>
  );
}
