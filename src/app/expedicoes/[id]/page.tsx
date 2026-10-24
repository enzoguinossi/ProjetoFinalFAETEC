import { resolverPermissoes } from "@/lib/permissoes";
import { notFound, redirect } from "next/navigation";
import ExpedicaoClient from "./ExpedicaoClient";
import { obterExpedicao } from "../actions";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

export default async function ExpedicaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perms = await resolverPermissoes("expedicao");
  if (!perms.canList) redirect("/dashboard");

  const { id } = await params;
  const idExpedicao = Number(id);
  if (!Number.isInteger(idExpedicao) || idExpedicao <= 0) notFound();

  const inicial = await obterExpedicao(idExpedicao);
  if (!inicial) notFound();

  return (
    <>
      <PageTitle>Expedições</PageTitle>
      <ExpedicaoClient inicial={inicial} perms={perms} />
    </>
  );
}
