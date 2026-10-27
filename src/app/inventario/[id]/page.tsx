import { redirect } from "next/navigation";
import PageTitle from "@/components/PageTitle";
import { requireUser } from "@/lib/auth";
import { usuarioPodeAlguma } from "@/lib/permissoes";
import { getInventario } from "../actions";
import InventarioDetalheClient from "./InventarioDetalheClient";

export const dynamic = "force-dynamic";

export default async function InventarioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const podeVer = await usuarioPodeAlguma(user, [
    "inventario.abrir",
    "inventario.contar",
    "inventario.aprovar_ajuste",
  ]);
  if (!podeVer) redirect("/dashboard");

  const { id } = await params;
  const inventario = await getInventario(Number(id));
  if (!inventario) redirect("/inventario");

  return (
    <>
      <PageTitle>Inventário</PageTitle>
      <InventarioDetalheClient inventario={inventario} />
    </>
  );
}
