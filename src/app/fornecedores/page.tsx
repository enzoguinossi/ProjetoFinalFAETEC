import DashboardLayout from "@/components/DashboardLayout";
import FornecedoresClient from "./FornecedoresClient";
import { listarFornecedores } from "./actions";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const perms = await resolverPermissoes("fornecedor");
  if (!perms.canList) redirect("/dashboard");

  const [inicial, tiposCodigo] = await Promise.all([
    listarFornecedores({ page: 1, limit: 20 }),
    tipoCodigoDAO.listParaEntidade("FORNECEDOR"),
  ]);

  return (
    <DashboardLayout title="Fornecedores">
      <FornecedoresClient inicial={inicial} tiposCodigo={tiposCodigo} perms={perms} />
    </DashboardLayout>
  );
}
