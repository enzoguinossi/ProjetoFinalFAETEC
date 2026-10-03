import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { usuarioDAO } from "@/dao/usuario";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Primeiro setup: se não existir super admin, redireciona
  const admin = await usuarioDAO.getAdmin();

  if (!admin) {
    redirect("/primeiro-acesso");
  }

  return <LoginForm />;
}