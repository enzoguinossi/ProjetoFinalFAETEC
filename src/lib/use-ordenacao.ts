"use client";

import { useCallback, useRef, useState } from "react";
import type { DirecaoOrdenacao, ListParams, OrdenacaoTabela } from "@/types";
import { paramsDeOrdenacao } from "./ordenacao-tabela";

/**
 * Ordenação para clientes que mantêm o estado da lista por conta própria (sem
 * `useListaPaginada`). Não recarrega nada: o componente decide quando buscar.
 *
 * `ordenar` atualiza o ref de forma síncrona e o estado para renderizar; logo
 * depois, `params()` já devolve a nova ordenação.
 */
export function useOrdenacao() {
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTabela | null>(null);
  const ordenacaoRef = useRef<OrdenacaoTabela | null>(null);

  const ordenar = useCallback(
    (campo: string | null, direcao: DirecaoOrdenacao | null) => {
      const nova =
        campo !== null && direcao !== null ? { campo, direcao } : null;
      ordenacaoRef.current = nova;
      setOrdenacao(nova);
    },
    [],
  );

  const params = useCallback(
    (): Pick<ListParams, "sort" | "dir"> =>
      paramsDeOrdenacao(ordenacaoRef.current),
    [],
  );

  return { ordenacao, ordenar, params };
}
