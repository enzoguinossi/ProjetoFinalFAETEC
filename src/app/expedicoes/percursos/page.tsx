import PercursosClient from "./PercursosClient";
import { listarPercursos } from "./actions";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

export default async function PercursosPage() {
  const perms = await resolverPermissoes("percurso");
  if (!perms.canList) redirect("/dashboard");

  const inicial = await listarPercursos({ page: 1, limit: 20 });

  return (
    <>
      <PageTitle>Percursos</PageTitle>
      <PercursosClient inicial={inicial} perms={perms} />
    </>
  );
}
