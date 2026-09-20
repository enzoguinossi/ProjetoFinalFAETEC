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
import styles from "./DataTable.module.css";

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

/* ── Componente ── */

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  actions = defaultActions as Action<T>[],
  idField,
  pageSize = 10,
}: DataTableProps<T>) {
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
    .concat(actions ? "178px" : "")
    .join(" ");

  return (
    <div className={styles.wrapper}>
      <div className={styles.scrollWrapper}>
        <div className={styles.table}>
          {/* Header */}
          <div
            className={styles.header}
            style={{ gridTemplateColumns: gridCols }}
          >
            {table.getHeaderGroups()[0]?.headers.map((header) => (
              <div key={header.id} className={styles.headerCell}>
                <table.FlexRender header={header} />
              </div>
            ))}
            {actions && <div className={styles.headerCell}>Ações</div>}
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
                  className={`${styles.row} ${row.index % 2 === 1 ? styles.rowAlt : ""}`}
                  style={{ gridTemplateColumns: gridCols }}
                >
                  {row.getAllCells().map((cell) => (
                    <div key={cell.id} className={styles.cell}>
                      <table.FlexRender cell={cell} />
                    </div>
                  ))}
                  {actions && (
                    <div className={styles.actions}>
                      {actions.map((action, i) => (
                        <button
                          key={i}
                          className={styles.actionBtn}
                          onClick={() => action.onClick(original)}
                          title={action.label}
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
            <div className={styles.empty}>Nenhum registro encontrado.</div>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className={styles.pagination}>
        <button
          className={styles.pageBtn}
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
          title="Primeira página"
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
          className={styles.pageBtn}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          title="Página anterior"
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

        <span className={styles.pageInfo}>
          Página{" "}
          <strong>
            {table.state.pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </strong>
        </span>

        <button
          className={styles.pageBtn}
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          title="Próxima página"
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
          className={styles.pageBtn}
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}
          title="Última página"
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
          className={styles.pageSizeSelect}
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