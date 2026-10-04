"use client";

import { useState, useMemo } from "react";
import {
  useTable,
  tableFeatures,
  rowPaginationFeature,
  createPaginatedRowModel,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";

/* ── Ações padrão (placeholder) ── */

const defaultActions: Action<Record<string, unknown>>[] = [
  {
    icon: "/icons/actions/Editar.svg",
    label: "Editar",
    onClick: (row) => console.log("Edit", row),
  },
  {
    icon: "/icons/actions/Olho.svg",
    label: "Visualizar",
    onClick: (row) => console.log("View", row),
  },
  {
    icon: "/icons/actions/Lixeira.svg",
    label: "Excluir",
    onClick: (row) => console.log("Delete", row),
  },
];

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

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  actions?: Action<T>[];
  /** Campo usado como React key (ex: "codigo", "placa"). Padrão: índice da linha. */
  idField?: keyof T & string;
  pageSize?: number;
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
const paginationCls =
  "flex items-center justify-center gap-1.5 font-sans text-[0.8125rem] text-ink";
const pageBtnCls =
  "flex items-center justify-center w-8 h-8 border border-border rounded-md bg-white cursor-pointer text-ink transition-[background-color,border-color] duration-[120ms] hover:enabled:bg-[#f2f4f8] hover:enabled:border-[#c1c7cd] disabled:opacity-35 disabled:cursor-default";
const pageInfoCls = "mx-2 whitespace-nowrap";
const pageSizeSelectCls =
  "ml-3 px-2 py-1 border border-border rounded-md bg-white font-sans text-[0.8125rem] text-ink cursor-pointer";
const emptyCls =
  "flex items-center justify-center py-8 px-4 font-sans text-sm text-[#697077] bg-white rounded-b-[1.25rem]";

/* ── Componente ── */

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  actions,
  idField,
  pageSize = 10,
}: DataTableProps<T>) {
  const resolvedActions = actions ?? (defaultActions as Action<T>[]);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

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
      state: { pagination },
      onPaginationChange: setPagination,
      autoResetPageIndex: false,
    },
    (state) => ({ pagination: state.pagination }),
  );

  const gridCols = columns
    .map((c) => c.width || "1fr")
    .concat(actions !== undefined ? "178px" : "")
    .join(" ");

  return (
    <div className={wrapperCls}>
      <div className={scrollWrapperCls}>
        <div className={tableCls}>
          {/* Header */}
          <div
            className={headerCls}
            style={{ gridTemplateColumns: gridCols }}
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
              const key = idField
                ? (original[idField] as string | number)
                : row.index;
              return (
                <div
                  key={key}
                  className={`${rowCls} ${row.index % 2 === 1 ? rowAltCls : ""}`}
                  style={{ gridTemplateColumns: gridCols }}
                >
                  {row.getAllCells().map((cell) => (
                    <div key={cell.id} className={cellCls}>
                      <table.FlexRender cell={cell} />
                    </div>
                  ))}
                  {actions !== undefined && (
                    <div className={actionsCls}>
                      {resolvedActions.map((action, i) => (
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
            <div className={emptyCls}>Nenhum registro encontrado.</div>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className={paginationCls}>
        <button
          className={pageBtnCls}
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
          title="Primeira página"
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M12 4L8 8L12 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 4L4 8L8 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          className={pageBtnCls}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          title="Página anterior"
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M10 4L6 8L10 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <span className={pageInfoCls}>
          Página{" "}
          <strong>
            {table.state.pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </strong>
        </span>

        <button
          className={pageBtnCls}
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          title="Próxima página"
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M6 4L10 8L6 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          className={pageBtnCls}
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}
          title="Última página"
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M4 4L8 8L4 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 4L12 8L8 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <select
          className={pageSizeSelectCls}
          value={table.state.pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
        >
          {[5, 10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size} por página
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
