"use client";

import { usePathname } from "next/navigation";
import DashboardLayout from "./DashboardLayout";

/**
 * Rotas públicas: não recebem o shell (header + sidebar).
 * A rota raiz apenas redireciona para o dashboard.
 */
const ROTAS_PUBLICAS = new Set(["/", "/login", "/primeiro-acesso", "/definir-senha"]);

/**
 * Título exibido no header por rota. Os valores são os mesmos que cada página
 * passava ao `DashboardLayout` antes de o shell virar layout raiz.
 */
const TITULOS_POR_ROTA: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/destinatarios": "Destinatários",
  "/expedicoes": "Expedições",
  "/expedicoes/percursos": "Percursos",
  "/fornecedores": "Fornecedores",
  "/funcionarios": "Funcionários",
  "/mov-estoque/entrada": "Movimentação de Estoque",
  "/mov-estoque/saida": "Movimentação de Estoque",
  "/perfis": "Perfis",
  "/produtos": "Produtos",
  "/relatorios": "Relatórios",
  "/usuarios": "Usuários",
  "/veiculos": "Veículos",
};

/** Remove a barra final para comparar rotas como `/login/` com `/login`. */
function normalizarRota(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * Resolve o título do header: rota exata → prefixo mais específico.
 * Rotas dinâmicas caem no prefixo (`/expedicoes/[id]` → "Expedições").
 */
export function tituloDaRota(pathname: string): string | undefined {
  const rota = normalizarRota(pathname);

  const tituloExato = TITULOS_POR_ROTA[rota];
  if (tituloExato) return tituloExato;

  const prefixos = Object.keys(TITULOS_POR_ROTA).sort((a, b) => b.length - a.length);
  for (const prefixo of prefixos) {
    if (rota.startsWith(`${prefixo}/`)) return TITULOS_POR_ROTA[prefixo];
  }

  return undefined;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const rota = normalizarRota(pathname ?? "/");

  if (ROTAS_PUBLICAS.has(rota)) {
    return <>{children}</>;
  }

  return <DashboardLayout title={tituloDaRota(rota)}>{children}</DashboardLayout>;
}
