import { redirect } from "next/navigation";
import PageTitle from "@/components/PageTitle";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { getInventario } from "../../actions";
import AprovacaoClient from "./AprovacaoClient";

export const dynamic = "force-dynamic";

export default async function InventarioAprovacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "inventario.aprovar_ajuste"))) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const inventario = await getInventario(Number(id));
  if (!inventario || !inventario.podeAprovar) redirect(`/inventario/${id}`);

  return (
    <>
      <PageTitle>Aprovação do inventário</PageTitle>
      <AprovacaoClient inventario={inventario} />
    </>
  );
}
