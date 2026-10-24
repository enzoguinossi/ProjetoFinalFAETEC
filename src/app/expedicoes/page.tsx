import { resolverPermissoes } from "@/lib/permissoes";
import { redirect } from "next/navigation";
import ExpedicoesClient from "./ExpedicoesClient";
import { listarExpedicoes } from "./actions";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

export default async function ExpedicoesPage() {
  const perms = await resolverPermissoes("expedicao");
  if (!perms.canList) redirect("/dashboard");

  const inicial = await listarExpedicoes({ page: 1, limit: 20 });

  return (
    <>
      <PageTitle>Expedições</PageTitle>
      <ExpedicoesClient inicial={inicial} perms={perms} />
    </>
  );
}
