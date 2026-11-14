"use client";

import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import TablePagination from "@/components/TablePagination";
import SeletorColunas from "@/components/SeletorColunas";
import type {
  DirecaoOrdenacao,
  OrdenacaoTabela,
} from "@/types";
import {
  compararValores,
  proximaOrdenacao,
} from "@/lib/ordenacao-tabela";
import { useColunasVisiveis } from "@/lib/use-colunas-visiveis";
import {
  useTable,
  tableFeatures,
  rowPaginationFeature,
  createPaginatedRowModel,
  type ColumnDef,
  type PaginationState,
  type Updater,
} from "@tanstack/react-table";

/* ── Features (fora do componente = referência estável) ── */

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

/* ── Tipos públicos ── */

export type AlinhamentoColuna = "left" | "center" | "right";

export interface Column<T> {
  key: keyof T & string;
  label: string;
  width?: string;
  /** Alinhamento do cabeçalho e das células. Padrão: `left`. */
  align?: AlinhamentoColuna;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  /** Habilita a ordenação por esta coluna (ciclo asc → desc → sem ordenação). */
  sortable?: boolean;
  /** Campo enviado ao servidor; padrão: `key`. */
  sortKey?: string;
  /** Valor usado na ordenação local quando a coluna não é o próprio campo. */
  sortValue?: (row: T) => string | number | Date | null;
  /** Largura mínima da coluna em px (define a largura mínima da tabela). */
  minWidth?: number;
  /**
   * Coluna opcional: nasce oculta e "Restaurar padrão" volta a escondê-la. Sem
   * `idTabela` o padrão vale só em memória (não há seletor nem persistência).
   * Ignorada quando a coluna é `fixed`.
   */
  defaultHidden?: boolean;
  /**
   * Coluna sempre visível: o seletor mostra o checkbox marcado e desabilitado,
   * e uma preferência antiga não consegue escondê-la.
   */
  fixed?: boolean;
}

export interface Action<T> {
  icon: string;
  label: string;
  onClick: (row: T) => void;
  /** Quando informado, a ação só aparece nas linhas em que retornar `true`. */
  visible?: (row: T) => boolean;
}

export interface PaginacaoServidor {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  actions?: Action<T>[];
  /** Campo usado como React key (ex: "codigo", "placa"). Padrão: índice da linha. */
  idField?: keyof T & string;
  pageSize?: number;
  /** Quando informado, a paginação passa a ser server-side (manual). */
  paginacaoServidor?: PaginacaoServidor;
  carregando?: boolean;
  /** Quais linhas podem abrir a expansão (acordeão: uma aberta por vez). */
  rowExpansivel?: (row: T) => boolean;
  /** Conteúdo da linha de expansão. Só é renderizado nas linhas expansíveis. */
  renderExpandido?: (row: T) => React.ReactNode;
  /** Ordenação ativa controlada pelo servidor. */
  ordenacao?: OrdenacaoTabela | null;
  /**
   * Quando informado, a ordenação é server-side: a tabela só devolve o campo e
   * a direção, sem reordenar `data`.
   */
  onOrdenar?: (
    campo: string | null,
    direcao: DirecaoOrdenacao | null,
  ) => void;
  /** Largura mínima da tabela em px. Padrão: soma das larguras mínimas das colunas. */
  minTableWidth?: number;
  /** Rótulo acessível da tabela. */
  ariaLabel?: string;
  /**
   * Identifica a tabela para guardar as colunas visíveis no navegador
   * (IndexedDB). Sem ele não há seletor de colunas — é o caso dos DataTables de
   * modal/formulário.
   */
  idTabela?: string;
}

/* ── Classes ── */

const wrapperCls = "flex flex-col gap-3 w-full min-w-0";
const scrollWrapperCls =
  "w-full min-w-0 max-w-full rounded-[1.25rem] overflow-x-auto overscroll-x-contain [scrollbar-width:thin] [scrollbar-color:#c1c7cd_transparent] [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar-thumb]:bg-[#c1c7cd] [&::-webkit-scrollbar-thumb]:rounded-[3px]";
const tableCls = "w-full table-fixed border-separate border-spacing-0";
const headerRowCls = "bg-brand text-white";
const headerCellCls =
  "px-[0.6875rem] py-2 font-display text-[1.25rem] [font-weight:590] tracking-[-0.028125rem] leading-[1.5625rem] whitespace-nowrap overflow-hidden";
const rowCls = "bg-white font-sans text-base text-black";
const rowAltCls = "bg-table-alt!";
const cellCls =
  "px-[0.6875rem] py-2 whitespace-nowrap overflow-hidden text-ellipsis";
const actionsCellCls = "px-[0.6875rem] py-2";
const acoesStickyHeaderCls =
  "sticky right-0 z-20 bg-brand shadow-[-10px_0_14px_-14px_rgba(0,0,0,0.5)]";
const acoesStickyCellCls =
  "sticky right-0 z-10 shadow-[-10px_0_14px_-14px_rgba(0,0,0,0.5)]";
const actionsCls = "flex items-center justify-center gap-[0.625rem]";
const actionBtnCls =
  "flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer transition-[background-color] duration-[120ms] text-ink hover:bg-[rgba(0,0,0,0.06)] [&_svg]:w-5 [&_svg]:h-5";
const expansivelCls = "cursor-pointer hover:bg-[rgba(0,0,0,0.02)]";
const caretCls =
  "inline-flex shrink-0 items-center justify-center w-4 h-4 text-[#697077] transition-transform duration-[120ms]";
const celulaPrimeiraCls = "flex items-center gap-2 min-w-0";
const celulaTextoCls = "flex-1 min-w-0 overflow-hidden text-ellipsis";
const expansaoCellCls = "px-[0.6875rem] pb-3 pt-1";
const emptyCls =
  "py-8 px-4 text-center font-sans text-sm text-[#697077] bg-white";

/* ── Auxiliares ── */

const ALINHAMENTO_CLS: Record<AlinhamentoColuna, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** `justify-*` do botão de ordenação, acompanhando o alinhamento da coluna. */
const JUSTIFY_CLS: Record<AlinhamentoColuna, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

/** Campo de ordenação da coluna: `sortKey` quando informado; senão a própria key. */
function campoDeOrdenacao<T>(col: Column<T>): string {
  return col.sortKey ?? col.key;
}

/** Largura mínima de uma coluna: `minWidth` ou o `fr` convertido em px. */
function larguraMinimaDaColuna<T>(col: Column<T>): number {
  if (col.minWidth !== undefined) return col.minWidth;

  const fr = /^([\d.]+)fr$/.exec((col.width ?? "").trim());
  const fracao = fr ? Number(fr[1]) : 0;
  return Math.round(Math.max(128, 96 * (Number.isFinite(fracao) ? fracao : 0)));
}

/**
 * Seta do cabeçalho em SVG (paths, `aria-hidden`): o texto do cabeçalho não
 * carrega o indicador — ele não deve virar "Descrição ↕" no export do Figma.
 * Seta dupla discreta quando inativa; seta única na direção ativa.
 */
function IconeOrdenacao({ direcao }: { direcao: DirecaoOrdenacao | null }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      className={`shrink-0 ${direcao ? "opacity-100" : "opacity-60"}`}
    >
      {direcao === "asc" ? (
        <path d="M6 2 9.5 7H2.5L6 2Z" fill="currentColor" />
      ) : direcao === "desc" ? (
        <path d="M6 10 2.5 5H9.5L6 10Z" fill="currentColor" />
      ) : (
        <>
          <path d="M6 1.5 8.75 4.25H3.25L6 1.5Z" fill="currentColor" />
          <path d="M6 10.5 3.25 7.75H8.75L6 10.5Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** Alinhamento da coluna `index` — o mesmo no `<th>` e no `<td>`. */
function alinhamentoDe<T>(
  columns: Column<T>[],
  index: number,
): AlinhamentoColuna {
  return columns[index]?.align ?? "left";
}

/**
 * Larguras para o `<colgroup>`. `fr` vira porcentagem e `px` vira `px`; qualquer
 * outra medida cai no padrão `1fr`.
 *
 * Não use `calc((100% - Npx) * fração)` aqui: em `<col>` de tabela com
 * `table-layout: fixed` o Chrome **descarta** esse `calc` (a coluna cai para `auto`)
 * e o motor distribui as colunas restantes igualmente — foi o que achatou
 * `1fr 2fr 1fr 1fr` em quatro colunas de mesma largura. Porcentagem + px é resolvido
 * pelo próprio motor da tabela: ele reserva as colunas fixas em `px` e reparte o
 * espaço restante na proporção das porcentagens.
 */
function largurasDasColunas(
  columns: { width?: string }[],
  larguraAcoes: number | null,
): string[] {
  const medidas = columns.map((col) => {
    const largura = (col.width ?? "").trim();
    const fr = /^([\d.]+)fr$/.exec(largura);
    if (fr) return { fr: Number(fr[1]) };
    const px = /^([\d.]+)px$/.exec(largura);
    if (px) return { px: Number(px[1]) };
    return { fr: 1 };
  });
  if (larguraAcoes !== null) medidas.push({ px: larguraAcoes });

  const totalFr = medidas.reduce((soma, m) => soma + (m.fr ?? 0), 0);
  return medidas.map((m) =>
    m.px !== undefined
      ? `${m.px}px`
      : `${((m.fr ?? 0) / (totalFr || 1)) * 100}%`,
  );
}

/* ── Componente ── */

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  actions,
  idField,
  pageSize = 10,
  paginacaoServidor,
  carregando = false,
  rowExpansivel,
  renderExpandido,
  ordenacao,
  onOrdenar,
  minTableWidth,
  ariaLabel,
  idTabela,
}: DataTableProps<T>) {
  const [paginationInterna, setPaginationInterna] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  /** Chave da linha aberta — acordeão, uma por vez. */
  const [linhaExpandida, setLinhaExpandida] = useState<
    string | number | null
  >(null);
  /**
   * Ordenação local (sem `onOrdenar`). Com servidor, a fonte é a prop
   * `ordenacao` e a tabela não reordena `data`.
   */
  const [ordenacaoLocal, setOrdenacaoLocal] =
    useState<OrdenacaoTabela | null>(null);

  /** Overflow horizontal detectado no cliente (SSR começa sem sticky). */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [rolavel, setRolavel] = useState(false);

  const pagination: PaginationState = paginacaoServidor
    ? {
        pageIndex: Math.max(0, paginacaoServidor.page - 1),
        pageSize: paginacaoServidor.pageSize,
      }
    : paginationInterna;

  const ordenacaoAtiva = onOrdenar ? (ordenacao ?? null) : ordenacaoLocal;

  /* ── Colunas visíveis (preferência no IndexedDB) ── */

  const chaves = useMemo(() => columns.map((col) => col.key), [columns]);
  /** Colunas fixas: sempre visíveis, sem opção no seletor. */
  const chavesFixas = useMemo(
    () => columns.filter((col) => col.fixed === true).map((col) => col.key),
    [columns],
  );
  const fixas = useMemo(() => new Set(chavesFixas), [chavesFixas]);
  /** Colunas opcionais: ocultas por padrão e no "Restaurar padrão". */
  const ocultasPadrao = useMemo(
    () =>
      columns
        .filter((col) => col.defaultHidden === true && col.fixed !== true)
        .map((col) => col.key),
    [columns],
  );
  const {
    ocultas,
    alternar,
    restaurar,
    carregado: colunasCarregadas,
  } = useColunasVisiveis(idTabela, chaves, ocultasPadrao, chavesFixas);

  /** "Restaurar padrão" só habilita quando o conjunto atual difere do padrão. */
  const podeRestaurar = useMemo(() => {
    const padrao = new Set(ocultasPadrao);
    if (ocultas.size !== padrao.size) return true;
    for (const chave of padrao) {
      if (!ocultas.has(chave)) return true;
    }
    return false;
  }, [ocultas, ocultasPadrao]);

  const colunasVisiveis = useMemo(() => {
    // A fixa aparece mesmo que uma preferência antiga a tenha escondido.
    const visiveis = columns.filter(
      (col) => col.fixed === true || !ocultas.has(col.key),
    );
    // Fallback: uma tabela sem colunas não pode renderizar.
    return visiveis.length > 0 ? visiveis : columns.slice(0, 1);
  }, [columns, ocultas]);

  /** Lista do popover — só as colunas de dados (Ações nunca entra). */
  const colunasSeletor = useMemo(
    () => columns.map((col) => ({ key: col.key, label: col.label })),
    [columns],
  );

  /**
   * No modo local, ordena antes da paginação para que página, keys e totais
   * enxerguem a mesma sequência. No modo servidor, `data` já vem ordenado.
   */
  const dadosOrdenados = useMemo(() => {
    if (onOrdenar || !ordenacaoLocal) return data;

    const col = colunasVisiveis.find(
      (c) => campoDeOrdenacao(c) === ordenacaoLocal.campo,
    );
    if (!col) return data;

    const direcao = ordenacaoLocal.direcao;
    return [...data].sort((a, b) => {
      const valorA = col.sortValue
        ? col.sortValue(a)
        : ((a[col.key] ?? null) as unknown);
      const valorB = col.sortValue
        ? col.sortValue(b)
        : ((b[col.key] ?? null) as unknown);

      // Nulos ficam por último nas duas direções.
      const aNulo = valorA === null || valorA === undefined;
      const bNulo = valorB === null || valorB === undefined;
      if (aNulo || bNulo) {
        if (aNulo && bNulo) return 0;
        return aNulo ? 1 : -1;
      }

      const comparacao = compararValores(valorA, valorB);
      return direcao === "asc" ? comparacao : -comparacao;
    });
  }, [colunasVisiveis, data, onOrdenar, ordenacaoLocal]);

  const tanstackColumns = useMemo(
    () =>
      colunasVisiveis.map(
        (col) =>
          ({
            accessorKey: col.key,
            header: col.label,
            cell: (info: { getValue: () => unknown; row: { original: T } }) => {
              if (col.render) {
                return col.render(
                  info.getValue() as T[keyof T],
                  info.row.original,
                );
              }
              return String(info.getValue() ?? "");
            },
            meta: { width: col.width },
          }) satisfies ColumnDef<typeof features, T>,
      ),
    [colunasVisiveis],
  );

  const table = useTable(
    {
      features,
      columns: tanstackColumns,
      data: dadosOrdenados,
      manualPagination: paginacaoServidor !== undefined,
      rowCount: paginacaoServidor?.total,
      state: { pagination },
      onPaginationChange: (updater: Updater<PaginationState>) => {
        const proxima =
          typeof updater === "function" ? updater(pagination) : updater;
        if (!paginacaoServidor) {
          setPaginationInterna(proxima);
          return;
        }
        if (proxima.pageSize !== pagination.pageSize) {
          paginacaoServidor.onPageSizeChange(proxima.pageSize);
        } else if (proxima.pageIndex !== pagination.pageIndex) {
          paginacaoServidor.onPageChange(proxima.pageIndex + 1);
        }
      },
      autoResetPageIndex: false,
    },
    (state) => ({ pagination: state.pagination }),
  );

  /**
   * Largura mínima da tabela: a informada ou a soma das larguras mínimas das
   * colunas (+ a coluna de ações), com um piso baixo para não forçar scroll em
   * tabelas pequenas de modal. Tabelas grandes continuam rolando no zoom.
   */
  const larguraMinimaTabela =
    minTableWidth ??
    Math.max(
      480,
      colunasVisiveis.reduce(
        (soma, col) => soma + larguraMinimaDaColuna(col),
        actions !== undefined ? 178 : 0,
      ),
    );

  /**
   * Mede o overflow do wrapper. O `ResizeObserver` cobre mudanças de largura do
   * container; os efeitos em `colunasVisiveis`/`data`/largura mínima cobrem
   * mudanças do conteúdo. A medição é agendada em `requestAnimationFrame` para
   * ocorrer após o layout.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let frame: number | null = null;
    const medir = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        setRolavel(el.scrollWidth > el.clientWidth + 1);
      });
    };

    medir();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(medir)
        : null;
    observer?.observe(el);

    return () => {
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [colunasVisiveis, data, larguraMinimaTabela]);

  /** Ciclo asc → desc → sem ordenação — servidor ou local. */
  function aoOrdenarColuna(col: Column<T>) {
    const campo = campoDeOrdenacao(col);
    const proxima = proximaOrdenacao(ordenacaoAtiva, campo);

    if (onOrdenar) {
      onOrdenar(proxima?.campo ?? null, proxima?.direcao ?? null);
      return;
    }

    setOrdenacaoLocal(proxima);
    setPaginationInterna((atual) => ({ ...atual, pageIndex: 0 }));
    setLinhaExpandida(null);
  }

  /**
   * Alterna a visibilidade de uma coluna. Esconder a coluna que define a
   * ordenação limpa a ordenação — coluna invisível não ordena. A última coluna
   * visível não pode ser escondida (o hook e o checkbox também barram).
   */
  function aoAlternarColuna(chave: string) {
    const eraVisivel = !ocultas.has(chave);
    const podeEsconder = colunasVisiveis.length > 1;

    alternar(chave);

    if (!eraVisivel || !podeEsconder || !ordenacaoAtiva) return;

    const coluna = columns.find((col) => col.key === chave);
    if (!coluna || campoDeOrdenacao(coluna) !== ordenacaoAtiva.campo) return;

    if (onOrdenar) {
      onOrdenar(null, null);
      return;
    }

    setOrdenacaoLocal(null);
    setPaginationInterna((atual) => ({ ...atual, pageIndex: 0 }));
    setLinhaExpandida(null);
  }

  const larguras = largurasDasColunas(
    colunasVisiveis,
    actions !== undefined ? 178 : null,
  );

  /** Total de colunas visíveis (inclui a coluna de ações) — identifica a tabela no Figma. */
  const totalColunas = colunasVisiveis.length + (actions !== undefined ? 1 : 0);

  /**
   * Números do rodapé. As linhas visíveis são as da página atual; o total vem do
   * servidor quando a paginação é manual (`paginacaoServidor`) ou do conjunto
   * inteiro antes da paginação, no modo client-side.
   *
   * No TanStack Table v9 o método é `getPrePaginatedRowModel` (o v8 o chamava
   * `getPrePaginationRowModel`).
   */
  const linhasVisiveis = table.getRowModel().rows.length;
  const totalRegistros =
    paginacaoServidor?.total ?? table.getPrePaginatedRowModel().rows.length;

  // Garante keys únicas mesmo quando idField se repete (ex.: contatos duplicados).
  const rowKeys = useMemo(() => {
    const seen = new Map<string | number, number>();
    return dadosOrdenados.map((row, i) => {
      const base = idField ? (row[idField] as string | number) : i;
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      return count > 1 ? `${String(base)}-${i}` : base;
    });
  }, [dadosOrdenados, idField]);

  return (
    <div
      className={`${wrapperCls} transition-opacity ${carregando ? "opacity-60" : ""}`}
    >
      {idTabela !== undefined && columns.length > 0 && (
        <div className="flex justify-end">
          <SeletorColunas
            colunas={colunasSeletor}
            ocultas={ocultas}
            carregado={colunasCarregadas}
            onAlternar={aoAlternarColuna}
            onRestaurar={restaurar}
            podeRestaurar={podeRestaurar}
            fixas={fixas}
            totalVisiveis={colunasVisiveis.length}
          />
        </div>
      )}

      <div
        className="flex w-full min-w-0 flex-col gap-3"
        data-figma="DataTable"
        data-figma-hug="vertical"
      >
        <div ref={scrollRef} className={scrollWrapperCls}>
          <table
            className={tableCls}
            style={{ minWidth: `${larguraMinimaTabela}px` }}
            aria-label={ariaLabel}
          >
            <colgroup>
              {larguras.map((largura, i) => (
                <col key={i} style={{ width: largura }} />
              ))}
            </colgroup>

            {/* Header — mesma regra de alinhamento das células */}
            <thead>
              <tr
                className={headerRowCls}
                data-figma="TableHeader"
                data-figma-columns={String(totalColunas)}
              >
                {table.getHeaderGroups()[0]?.headers.map((header, index) => {
                  const col = colunasVisiveis[index];
                  if (!col) return null;

                  const alinhamento = alinhamentoDe(colunasVisiveis, index);
                  const campo = campoDeOrdenacao(col);
                  const direcaoAtiva =
                    ordenacaoAtiva?.campo === campo
                      ? ordenacaoAtiva.direcao
                      : null;
                  const ordenavel = col.sortable === true;

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        ordenavel
                          ? direcaoAtiva === "asc"
                            ? "ascending"
                            : direcaoAtiva === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
                      className={`${headerCellCls} ${ALINHAMENTO_CLS[alinhamento]}`}
                    >
                      {ordenavel ? (
                        <button
                          type="button"
                          onClick={() => aoOrdenarColuna(col)}
                          className={`flex w-full min-w-0 items-center gap-1 rounded-sm text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${JUSTIFY_CLS[alinhamento]}`}
                          aria-label={`Ordenar por ${col.label}`}
                          title={`Ordenar por ${col.label}`}
                        >
                          <span className="truncate">{col.label}</span>
                          <IconeOrdenacao direcao={direcaoAtiva} />
                        </button>
                      ) : (
                        <span className="block truncate">{col.label}</span>
                      )}
                    </th>
                  );
                })}
                {actions !== undefined && (
                  <th
                    scope="col"
                    className={`${headerCellCls} text-center ${rolavel ? acoesStickyHeaderCls : ""}`}
                  >
                    Ações
                  </th>
                )}
              </tr>
            </thead>

            {/* Rows */}
            <tbody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => {
                  const original = row.original as T;
                  const key = rowKeys[row.index] ?? row.index;
                  const podeExpandir = rowExpansivel?.(original) ?? false;
                  const aberta =
                    podeExpandir && renderExpandido !== undefined && linhaExpandida === key;

                  /**
                   * Clique na linha alterna a expansão, mas cliques em controles
                   * (botões, links, campos) continuam sendo deles — Ações e o
                   * cancelamento dentro da expansão não abrem/fecham a linha.
                   */
                  function aoClicarLinha(event: React.MouseEvent<HTMLTableRowElement>) {
                    if (!podeExpandir) return;
                    const alvo = event.target as HTMLElement | null;
                    if (
                      alvo?.closest("button, a, input, select, textarea, label")
                    ) {
                      return;
                    }
                    setLinhaExpandida((atual) => (atual === key ? null : key));
                  }

                  return (
                    <Fragment key={key}>
                      <tr
                        className={`${rowCls} ${row.index % 2 === 1 ? rowAltCls : ""} ${podeExpandir ? expansivelCls : ""}`}
                        data-figma="TableRow"
                        data-figma-variant={
                          row.index % 2 === 1 ? "alternada" : "normal"
                        }
                        data-figma-columns={String(totalColunas)}
                        data-figma-index={String(row.index)}
                        data-figma-part={aberta ? "expandida" : undefined}
                        onClick={podeExpandir ? aoClicarLinha : undefined}
                      >
                        {row.getAllCells().map((cell, index) => (
                          <td
                            key={cell.id}
                            className={`${cellCls} ${ALINHAMENTO_CLS[alinhamentoDe(colunasVisiveis, index)]}`}
                          >
                            {index === 0 && podeExpandir ? (
                              <div className={celulaPrimeiraCls}>
                                <span
                                  className={`${caretCls} ${aberta ? "rotate-90" : ""}`}
                                  aria-hidden="true"
                                  data-figma-part="caret"
                                >
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path
                                      d="M6 4L10 8L6 12"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </span>
                                <span className={celulaTextoCls}>
                                  <table.FlexRender cell={cell} />
                                </span>
                              </div>
                            ) : (
                              <table.FlexRender cell={cell} />
                            )}
                          </td>
                        ))}
                        {actions !== undefined && (
                          <td
                            className={`${actionsCellCls} text-center ${
                              rolavel
                                ? `${acoesStickyCellCls} ${
                                    row.index % 2 === 1
                                      ? "bg-table-alt!"
                                      : "bg-white"
                                  }`
                                : ""
                            }`}
                          >
                            <div className={actionsCls}>
                              {actions
                                .filter((action) => action.visible?.(original) ?? true)
                                .map((action, i) => (
                                  <button
                                    key={i}
                                    className={actionBtnCls}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      action.onClick(original);
                                    }}
                                    title={action.label}
                                    type="button"
                                  >
                                    <img src={action.icon} alt={action.label} />
                                  </button>
                                ))}
                            </div>
                          </td>
                        )}
                      </tr>
                      {aberta && (
                        <tr
                          className={rowCls}
                          data-figma-part="expansao"
                          data-figma-columns={String(totalColunas)}
                        >
                          <td colSpan={totalColunas} className={expansaoCellCls}>
                            {renderExpandido?.(original)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              ) : (
                <tr className={rowCls}>
                  <td
                    colSpan={totalColunas}
                    className={emptyCls}
                    data-figma-part="empty"
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé — contagem de registros + paginação */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-sans text-[0.8125rem] text-[#697077]">
            Exibindo {linhasVisiveis} de {totalRegistros} registro(s).
          </span>
          <TablePagination
            pageIndex={table.state.pagination.pageIndex}
            pageCount={table.getPageCount()}
            pageSize={table.state.pagination.pageSize}
            canPrevious={table.getCanPreviousPage()}
            canNext={table.getCanNextPage()}
            onFirst={() => table.firstPage()}
            onPrevious={() => table.previousPage()}
            onNext={() => table.nextPage()}
            onLast={() => table.lastPage()}
            onPageSizeChange={(size) => table.setPageSize(size)}
          />
        </div>
      </div>
    </div>
  );
}
