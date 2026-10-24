import FuncionariosClient from "./FuncionariosClient";
import { listarFuncionarios } from "./actions";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

export default async function FuncionariosPage() {
  const perms = await resolverPermissoes("funcionario");
  if (!perms.canList) redirect("/dashboard");

  const [inicial, tiposCodigo] = await Promise.all([
    listarFuncionarios({ page: 1, limit: 20 }),
    tipoCodigoDAO.listParaEntidade("FUNCIONARIO"),
  ]);

  return (
    <>
      <PageTitle>Funcionários</PageTitle>
      <FuncionariosClient inicial={inicial} tiposCodigo={tiposCodigo} perms={perms} />
    </>
  );
}
