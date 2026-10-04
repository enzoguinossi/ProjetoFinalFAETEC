import DashboardLayout from "@/components/DashboardLayout";
import FornecedoresClient from "./FornecedoresClient";
import { fornecedorDAO } from "@/dao/fornecedor";
import { tipoCodigoDAO } from "@/dao/tipo-codigo";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const perms = await resolverPermissoes("fornecedor");
  if (!perms.canList) redirect("/dashboard");

  const [{ data }, tiposCodigo] = await Promise.all([
    fornecedorDAO.list(),
    tipoCodigoDAO.listParaEntidade("FORNECEDOR"),
  ]);
  const rows = data.map((f) => ({
    id_fornecedor: f.id_fornecedor,
    codigo: formatarCodigo(f.id_fornecedor),
    razao: f.pessoaJuridica.razao_social,
  }));
  return (
    <DashboardLayout title="Fornecedores">
      <FornecedoresClient rows={rows} tiposCodigo={tiposCodigo} perms={perms} />
    </DashboardLayout>
  );
}