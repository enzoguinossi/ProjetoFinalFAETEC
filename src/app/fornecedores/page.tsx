import DashboardLayout from "@/components/DashboardLayout";
import FornecedoresClient from "./FornecedoresClient";
import { fornecedorDAO } from "@/dao/fornecedor";
import { redirect } from "next/navigation";
import { resolverPermissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const perms = await resolverPermissoes("fornecedor");
  if (!perms.canList) redirect("/dashboard");

  const { data } = await fornecedorDAO.list();
  const rows = data.map((f, i) => ({
    id_fornecedor: f.id_fornecedor,
    codigo: String(i + 1).padStart(3, "0"),
    razao: f.pessoaJuridica.razao_social,
  }));
  return (
    <DashboardLayout title="Fornecedores">
      <FornecedoresClient rows={rows} perms={perms} />
    </DashboardLayout>
  );
}