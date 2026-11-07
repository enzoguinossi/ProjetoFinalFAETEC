"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ListParams, PaginatedResult } from "@/types";

const DEBOUNCE_MS = 300;
const MIN_BUSCA = 2;

/** Filtros de domínio adicionais enviados junto da paginação/busca. */
export type FiltrosLista = Record<
  string,
  string | string[] | number | number[] | boolean | null | undefined
>;

export function useListaPaginada<T>(
  buscar: (params: ListParams & FiltrosLista) => Promise<PaginatedResult<T>>,
  inicial: PaginatedResult<T>,
  filtrosIniciais: FiltrosLista = {},
) {
  const [resultado, setResultado] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosLista>(() => ({ ...filtrosIniciais }));
  const requisicao = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termoAtual = useRef("");
  const filtrosAtuais = useRef<FiltrosLista>({ ...filtrosIniciais });

  const carregar = useCallback(
    async (params: ListParams & FiltrosLista) => {
      const id = ++requisicao.current;
      setCarregando(true);
      try {
        const res = await buscar(params);
        if (id === requisicao.current) setResultado(res);
      } catch {
        if (id === requisicao.current) setResultado(inicial);
      } finally {
        if (id === requisicao.current) setCarregando(false);
      }
    },
    [buscar, inicial],
  );

  useEffect(() => {
    if (termoAtual.current.length < MIN_BUSCA) setResultado(inicial);
  }, [inicial]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const paramsAtuais = useCallback(
    (page: number, limit: number): ListParams & FiltrosLista => {
      const search = termoAtual.current.length >= MIN_BUSCA ? termoAtual.current : undefined;
      // `page`/`limit` são numéricos e o índice de `FiltrosLista` também admite
      // números; a asserção mantém o tipo de interseção esperado pelos chamadores.
      return { page, limit, search, ...filtrosAtuais.current } as ListParams & FiltrosLista;
    },
    [],
  );

  const buscarPorTermo = useCallback(
    (termo: string) => {
      termoAtual.current = termo;
      if (timer.current) clearTimeout(timer.current);
      if (termo.length < MIN_BUSCA) {
        void carregar(paramsAtuais(1, resultado.limit));
        return;
      }
      timer.current = setTimeout(() => {
        void carregar(paramsAtuais(1, resultado.limit));
      }, DEBOUNCE_MS);
    },
    [carregar, paramsAtuais, resultado.limit],
  );

  const irParaPagina = useCallback(
    (page: number) => {
      void carregar(paramsAtuais(page, resultado.limit));
    },
    [carregar, paramsAtuais, resultado.limit],
  );

  const mudarTamanho = useCallback(
    (limit: number) => {
      void carregar(paramsAtuais(1, limit));
    },
    [carregar, paramsAtuais],
  );

  const aplicarFiltros = useCallback(
    (novos: FiltrosLista) => {
      filtrosAtuais.current = { ...novos };
      setFiltros({ ...novos });
      void carregar(paramsAtuais(1, resultado.limit));
    },
    [carregar, paramsAtuais, resultado.limit],
  );

  return {
    resultado,
    carregando,
    buscarPorTermo,
    irParaPagina,
    mudarTamanho,
    aplicarFiltros,
    filtros,
  };
}
