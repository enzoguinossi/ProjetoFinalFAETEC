import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import PrimeiroAcessoForm from "./PrimeiroAcessoForm";
import { usuarioDAO } from "@/dao/usuario";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PrimeiroAcessoPage() {
  // Já autenticado → vai direto para o dashboard.
  const sessao = await getSession();
  if (sessao) redirect("/dashboard");

  // Já existe administrador → fluxo de primeiro acesso não se aplica.
  const existente = await usuarioDAO.existeSuperAdmin();
  if (existente) redirect("/login");

  return (
    <DashboardLayout title="Bem-vindo ao Nexus">
      <PrimeiroAcessoForm />
    </DashboardLayout>
  );
}
