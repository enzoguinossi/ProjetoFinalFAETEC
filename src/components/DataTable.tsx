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

export interface Column<T> {
  key: keyof T & string;
  label: string;
  width?: string;
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
  "overflow-x-auto w-full [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar-thumb]:bg-[#c1c7cd] [&::-webkit-scrollbar-thumb]:rounded-[3px]";
const tableCls = "flex flex-col rounded-[1.25rem] overflow-hidden w-full min-w-0";
const headerCls =
  "grid bg-brand text-white font-display text-[1.25rem] [font-weight:590] tracking-[-0.028125rem] leading-[1.5625rem] whitespace-nowrap";
const headerCellCls = "px-[0.6875rem] py-2 text-center";
const rowCls = "grid bg-white font-sans text-base text-black last:rounded-b-[1.25rem]";
const rowAltCls = "bg-table-alt!";
const cellCls =
  "px-[0.6875rem] py-2 whitespace-nowrap overflow-hidden text-ellipsis [&:first-child]:text-center [&:nth-child(2)]:text-left";
const actionsCls = "flex items-center justify-center gap-[0.625rem] py-1";
const actionBtnCls =
  "flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer transition-[background-color] duration-[120ms] text-ink hover:bg-[rgba(0,0,0,0.06)] [&_svg]:w-5 [&_svg]:h-5";
const emptyCls =
  "flex items-center justify-center py-8 px-4 font-sans text-sm text-[#697077] bg-white rounded-b-[1.25rem]";

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

  const gridCols = columns
    .map((c) => c.width || "1fr")
    .concat(actions !== undefined ? "178px" : "")
    .join(" ");

  /** Total de colunas (inclui a coluna de ações) — identifica a tabela no Figma. */
  const totalColunas = columns.length + (actions !== undefined ? 1 : 0);

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
        <div className={tableCls}>
          {/* Header */}
          <div
            className={headerCls}
            style={{ gridTemplateColumns: gridCols }}
            data-figma="TableHeader"
            data-figma-columns={String(totalColunas)}
          >
            {table.getHeaderGroups()[0]?.headers.map((header) => (
              <div key={header.id} className={headerCellCls}>
                <table.FlexRender header={header} />
              </div>
            ))}
            {actions !== undefined && <div className={headerCellCls}>Ações</div>}
          </div>

          {/* Rows */}
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => {
              const original = row.original as T;
              const key = rowKeys[row.index] ?? row.index;
              return (
                <div
                  key={key}
                  className={`${rowCls} ${row.index % 2 === 1 ? rowAltCls : ""}`}
                  style={{ gridTemplateColumns: gridCols }}
                  data-figma="TableRow"
                  data-figma-variant={row.index % 2 === 1 ? "alternada" : "normal"}
                  data-figma-columns={String(totalColunas)}
                  data-figma-index={String(row.index)}
                >
                  {row.getAllCells().map((cell) => (
                    <div key={cell.id} className={cellCls}>
                      <table.FlexRender cell={cell} />
                    </div>
                  ))}
                  {actions !== undefined && (
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
                  )}
                </div>
              );
            })
          ) : (
            <div className={emptyCls} data-figma-part="empty">Nenhum registro encontrado.</div>
          )}
        </div>
      </div>

      {/* Pagination */}
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
  );
}
