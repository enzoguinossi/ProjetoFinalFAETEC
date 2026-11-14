"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DirecaoOrdenacao,
  ListParams,
  OrdenacaoTabela,
  PaginatedResult,
} from "@/types";
import { paramsDeOrdenacao } from "./ordenacao-tabela";

const DEBOUNCE_MS = 300;
const MIN_BUSCA = 2;

/** Filtros de domínio adicionais enviados junto da paginação/busca. */
export type FiltrosLista = Record<
  string,
  string | string[] | number | number[] | boolean | null | undefined
>;

/**
 * Um valor de filtro conta como "aplicado" quando é **explícito**. `null` é um
 * recorte escolhido (ex.: Situação "Ativos + Inativos"), não ausência de
 * filtro: só `undefined`, string vazia/em branco e array vazio significam
 * "sem filtro".
 */
export function filtroAtivo(valor: FiltrosLista[string]): boolean {
  if (valor === undefined) return false;
  if (valor === null) return true;
  if (typeof valor === "string") return valor.trim().length > 0;
  if (Array.isArray(valor)) return valor.length > 0;
  return true;
}

/** Há ao menos um filtro aplicado (valor explícito, inclusive `null`). */
export function temFiltrosAtivos(filtros: FiltrosLista): boolean {
  return Object.values(filtros).some(filtroAtivo);
}

/**
 * Decide o que fazer quando o resultado inicial do servidor é revalidado
 * (`router.refresh()` após salvar/excluir): o `inicial` só representa a lista
 * visível quando **não há busca nem filtros**. Com busca/filtro ativo, trocar o
 * resultado por `inicial` apagaria o recorte e voltaria a mostrar tudo, então é
 * preciso reconsultar com os filtros atuais.
 */
export function deveUsarInicial(termo: string, filtros: FiltrosLista): boolean {
  const buscaAtiva = termo.length >= MIN_BUSCA;
  return !buscaAtiva && !temFiltrosAtivos(filtros);
}

export function useListaPaginada<T>(
  buscar: (params: ListParams & FiltrosLista) => Promise<PaginatedResult<T>>,
  inicial: PaginatedResult<T>,
  filtrosIniciais: FiltrosLista = {},
) {
  const [resultado, setResultado] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosLista>(() => ({ ...filtrosIniciais }));
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTabela | null>(null);
  const requisicao = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termoAtual = useRef("");
  const filtrosAtuais = useRef<FiltrosLista>({ ...filtrosIniciais });
  const ordenacaoRef = useRef<OrdenacaoTabela | null>(null);

  // Refs para manter `carregar` estável: o efeito de revalidação não pode
  // depender de `buscar`/`inicial` (identidades novas a cada render do servidor)
  // nem reexecutar a cada resultado — isso criaria loop de requisições.
  const buscarRef = useRef(buscar);
  const inicialRef = useRef(inicial);
  const resultadoRef = useRef(resultado);

  useEffect(() => {
    buscarRef.current = buscar;
    inicialRef.current = inicial;
  });

  useEffect(() => {
    resultadoRef.current = resultado;
  }, [resultado]);

  const carregar = useCallback(
    async (params: ListParams & FiltrosLista) => {
      const id = ++requisicao.current;
      setCarregando(true);
      try {
        const res = await buscarRef.current(params);
        if (id === requisicao.current) setResultado(res);
      } catch {
        // Em erro, só volta ao inicial quando a lista não está recortada nem
        // ordenada: com busca/filtro/ordenação ativa é melhor manter o último
        // resultado do que exibir tudo como se o recorte não existisse.
        if (
          id === requisicao.current &&
          deveUsarInicial(termoAtual.current, filtrosAtuais.current) &&
          !ordenacaoRef.current
        ) {
          setResultado(inicialRef.current);
        }
      } finally {
        if (id === requisicao.current) setCarregando(false);
      }
    },
    [],
  );

  const paramsAtuais = useCallback(
    (page: number, limit: number): ListParams & FiltrosLista => {
      const search = termoAtual.current.length >= MIN_BUSCA ? termoAtual.current : undefined;
      // `page`/`limit` são numéricos e o índice de `FiltrosLista` também admite
      // números; a asserção mantém o tipo de interseção esperado pelos chamadores.
      return {
        page,
        limit,
        search,
        ...filtrosAtuais.current,
        ...paramsDeOrdenacao(ordenacaoRef.current),
      } as ListParams & FiltrosLista;
    },
    [],
  );

  const primeiraCarga = useRef(true);

  useEffect(() => {
    // A primeira renderização já recebe o resultado do servidor.
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      return;
    }

    if (
      deveUsarInicial(termoAtual.current, filtrosAtuais.current) &&
      !ordenacaoRef.current
    ) {
      setResultado(inicial);
      return;
    }

    // Reconsulta na primeira página com o recorte/ordenação atual: salvar/excluir
    // pode esvaziar a página em que o usuário estava.
    void carregar(paramsAtuais(1, resultadoRef.current.limit));
  }, [inicial, carregar, paramsAtuais]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
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

  /**
   * Ordenação server-side: grava campo/direção (ref síncrono usado por
   * `paramsAtuais`), volta à primeira página e recarrega. `null` nos dois
   * parâmetros limpa a ordenação e devolve o padrão do servidor.
   */
  const ordenar = useCallback(
    (campo: string | null, direcao: DirecaoOrdenacao | null) => {
      const nova =
        campo !== null && direcao !== null ? { campo, direcao } : null;
      ordenacaoRef.current = nova;
      setOrdenacao(nova);
      void carregar(paramsAtuais(1, resultadoRef.current.limit));
    },
    [carregar, paramsAtuais],
  );

  return {
    resultado,
    carregando,
    buscarPorTermo,
    irParaPagina,
    mudarTamanho,
    aplicarFiltros,
    filtros,
    ordenacao,
    ordenar,
  };
}
