"use client";

import { usePathname } from "next/navigation";
import DashboardLayout from "./DashboardLayout";

/**
 * Rotas públicas: não recebem o shell (header + sidebar).
 * A rota raiz apenas redireciona para o dashboard.
 */
const ROTAS_PUBLICAS = new Set(["/", "/login", "/primeiro-acesso", "/definir-senha"]);

/** Remove a barra final para comparar rotas como `/login/` com `/login`. */
function normalizarRota(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const rota = normalizarRota(pathname ?? "/");

  if (ROTAS_PUBLICAS.has(rota)) {
    return <>{children}</>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
