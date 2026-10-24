import { redirect } from "next/navigation";
import PrimeiroAcessoForm from "./PrimeiroAcessoForm";
import { usuarioDAO } from "@/dao/usuario";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PrimeiroAcessoPage() {
  // Já autenticado → vai direto para o dashboard.
  const sessao = await getSession();
  if (sessao) redirect("/dashboard");

  // Já existe administrador → fluxo de primeiro acesso não se aplica.
  const admin = await usuarioDAO.getAdmin();
  if (admin) redirect("/login");

  return (
    <div className="flex justify-center items-center min-h-screen bg-brand">
      <PrimeiroAcessoForm />
    </div>
  );
}
