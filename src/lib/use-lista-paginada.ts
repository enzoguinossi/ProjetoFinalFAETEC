"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ListParams, PaginatedResult } from "@/types";

const DEBOUNCE_MS = 300;
const MIN_BUSCA = 2;

export function useListaPaginada<T>(
  buscar: (params: ListParams) => Promise<PaginatedResult<T>>,
  inicial: PaginatedResult<T>,
) {
  const [resultado, setResultado] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const requisicao = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termoAtual = useRef("");

  const carregar = useCallback(
    async (params: ListParams) => {
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
    (page: number, limit: number): ListParams => {
      const search = termoAtual.current.length >= MIN_BUSCA ? termoAtual.current : undefined;
      return { page, limit, search };
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

  return { resultado, carregando, buscarPorTermo, irParaPagina, mudarTamanho };
}
