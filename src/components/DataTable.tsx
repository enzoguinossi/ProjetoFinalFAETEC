"use client";

import { useState, useMemo } from "react";
import TablePagination from "@/components/TablePagination";
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
}

export interface Action<T> {
  icon: string;
  label: string;
  onClick: (row: T) => void;
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
}

/* ── Classes ── */

const wrapperCls = "flex flex-col gap-3 w-full";
const scrollWrapperCls =
  "w-full rounded-[1.25rem] overflow-x-auto [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar-thumb]:bg-[#c1c7cd] [&::-webkit-scrollbar-thumb]:rounded-[3px]";
const tableCls = "w-full table-fixed border-separate border-spacing-0";
const headerRowCls = "bg-brand text-white";
const headerCellCls =
  "px-[0.6875rem] py-2 font-display text-[1.25rem] [font-weight:590] tracking-[-0.028125rem] leading-[1.5625rem] whitespace-nowrap";
const rowCls = "bg-white font-sans text-base text-black";
const rowAltCls = "bg-table-alt!";
const cellCls =
  "px-[0.6875rem] py-2 whitespace-nowrap overflow-hidden text-ellipsis";
const actionsCellCls = "px-[0.6875rem] py-2";
const actionsCls = "flex items-center justify-center gap-[0.625rem]";
const actionBtnCls =
  "flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer transition-[background-color] duration-[120ms] text-ink hover:bg-[rgba(0,0,0,0.06)] [&_svg]:w-5 [&_svg]:h-5";
const emptyCls =
  "py-8 px-4 text-center font-sans text-sm text-[#697077] bg-white";

/* ── Auxiliares ── */

const ALINHAMENTO_CLS: Record<AlinhamentoColuna, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

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
}: DataTableProps<T>) {
  const [paginationInterna, setPaginationInterna] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const pagination: PaginationState = paginacaoServidor
    ? {
        pageIndex: Math.max(0, paginacaoServidor.page - 1),
        pageSize: paginacaoServidor.pageSize,
      }
    : paginationInterna;

  const tanstackColumns = useMemo(
    () =>
      columns.map(
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
    [columns],
  );

  const table = useTable(
    {
      features,
      columns: tanstackColumns,
      data,
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

  const larguras = largurasDasColunas(
    columns,
    actions !== undefined ? 178 : null,
  );

  /** Total de colunas (inclui a coluna de ações) — identifica a tabela no Figma. */
  const totalColunas = columns.length + (actions !== undefined ? 1 : 0);

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
    return data.map((row, i) => {
      const base = idField ? (row[idField] as string | number) : i;
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      return count > 1 ? `${String(base)}-${i}` : base;
    });
  }, [data, idField]);

  return (
    <div
      className={`${wrapperCls} transition-opacity ${carregando ? "opacity-60" : ""}`}
      data-figma="DataTable"
      data-figma-hug="vertical"
    >
      <div className={scrollWrapperCls}>
        <table className={tableCls}>
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
              {table.getHeaderGroups()[0]?.headers.map((header, index) => (
                <th
                  key={header.id}
                  scope="col"
                  className={`${headerCellCls} ${ALINHAMENTO_CLS[alinhamentoDe(columns, index)]}`}
                >
                  <table.FlexRender header={header} />
                </th>
              ))}
              {actions !== undefined && (
                <th scope="col" className={`${headerCellCls} text-center`}>
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
                return (
                  <tr
                    key={key}
                    className={`${rowCls} ${row.index % 2 === 1 ? rowAltCls : ""}`}
                    data-figma="TableRow"
                    data-figma-variant={
                      row.index % 2 === 1 ? "alternada" : "normal"
                    }
                    data-figma-columns={String(totalColunas)}
                    data-figma-index={String(row.index)}
                  >
                    {row.getAllCells().map((cell, index) => (
                      <td
                        key={cell.id}
                        className={`${cellCls} ${ALINHAMENTO_CLS[alinhamentoDe(columns, index)]}`}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                    {actions !== undefined && (
                      <td className={`${actionsCellCls} text-center`}>
                        <div className={actionsCls}>
                          {actions.map((action, i) => (
                            <button
                              key={i}
                              className={actionBtnCls}
                              onClick={() => action.onClick(original)}
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
  );
}
