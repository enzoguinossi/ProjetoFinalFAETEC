import { redirect } from "next/navigation";
import PageTitle from "@/components/PageTitle";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { listarInventarios } from "./actions";
import InventarioClient from "./InventarioClient";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const user = await requireUser();
  const podeVer = await usuarioPodeAlguma(user, [
    "inventario.abrir",
    "inventario.contar",
    "inventario.aprovar_ajuste",
  ]);
  if (!podeVer) redirect("/dashboard");

  const [inicial, podeAbrir] = await Promise.all([
    listarInventarios({ page: 1, limit: 20 }),
    usuarioPode(user, "inventario.abrir"),
  ]);

  return (
    <>
      <PageTitle>Inventário</PageTitle>
      <InventarioClient inicial={inicial} podeAbrir={podeAbrir} />
    </>
  );
}
