"use client";

import { useRouter } from "next/navigation";
import BarraFiltrosBase from "./BarraFiltrosBase";
import type { CampoFiltro, Valores } from "./BarraFiltrosBase";

export type { CampoFiltro, OpcaoFiltro, Valores } from "./BarraFiltrosBase";

interface BarraFiltrosProps {
  /** Caminho da tela, sem query (ex.: `/relatorios/movimentacao`). */
  basePath: string;
  campos: CampoFiltro[];
  /** Seleção atual vinda da URL (já normalizada pelo servidor). */
  valores: Valores;
}

/**
 * Wrapper de URL da barra de filtros: a base é controlada e não conhece rota;
 * aqui os valores viram query string como antes (`multi` = `join(",")`,
 * período = `de`/`ate`, checkbox = `campo.id=1`).
 */
export default function BarraFiltros({ basePath, campos, valores }: BarraFiltrosProps) {
  const router = useRouter();

  function aplicar(novos: Valores) {
    const params = new URLSearchParams();
    for (const campo of campos) {
      const valor = novos[campo.id];
      if (!valor) continue;
      if (campo.tipo === "periodo") {
        if (!Array.isArray(valor)) {
          if (valor.de) params.set("de", valor.de);
          if (valor.ate) params.set("ate", valor.ate);
        }
      } else {
        const lista = Array.isArray(valor) ? valor : [];
        if (campo.tipo === "checkbox") {
          if (lista.includes("1")) params.set(campo.id, "1");
        } else if (lista.length > 0) {
          params.set(campo.id, lista.join(","));
        }
      }
    }
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  function limpar() {
    router.push(basePath);
  }

  return (
    <BarraFiltrosBase
      campos={campos}
      valores={valores}
      onAplicar={aplicar}
      onLimpar={limpar}
    />
  );
}
