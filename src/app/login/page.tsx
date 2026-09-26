import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Primeiro setup: se não existir super admin, redireciona
  const admin = await prisma.usuario.findFirst({
    where: { super_admin: true },
  });

  if (!admin) {
    redirect("/primeiro-acesso");
  }

  return <LoginForm />;
}