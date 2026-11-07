import { resolverPermissoes } from "@/lib/permissoes";
import { redirect } from "next/navigation";
import ExpedicoesClient from "./ExpedicoesClient";
import {
  listarCondutoresParaExpedicao,
  listarExpedicoes,
  listarVeiculosParaExpedicao,
} from "./actions";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

export default async function ExpedicoesPage() {
  const perms = await resolverPermissoes("expedicao");
  if (!perms.canList) redirect("/dashboard");

  const [inicial, veiculos, condutores] = await Promise.all([
    listarExpedicoes({ page: 1, limit: 20 }),
    listarVeiculosParaExpedicao({ page: 1, limit: 100 }),
    listarCondutoresParaExpedicao({ page: 1, limit: 100 }),
  ]);

  return (
    <>
      <PageTitle>Expedições</PageTitle>
      <ExpedicoesClient
        inicial={inicial}
        perms={perms}
        veiculos={veiculos.data}
        condutores={condutores.data}
      />
    </>
  );
}
