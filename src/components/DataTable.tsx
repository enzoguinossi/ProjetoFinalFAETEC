import styles from "./DataTable.module.css";

export interface Column<T> {
  key: keyof T & string;
  label: string;
  width?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface Action {
  icon: string;
  label: string;
  onClick: (rowIndex: number) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  actions?: Action[];
  keyExtractor: (row: T, index: number) => string | number;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  actions,
  keyExtractor,
}: DataTableProps<T>) {
  const gridCols = columns
    .map((c) => c.width || "1fr")
    .concat(actions ? "178px" : "")
    .join(" ");

  return (
    <div className={styles.scrollWrapper}>
      <div className={styles.table}>
        {/* Header */}
        <div className={styles.header} style={{ gridTemplateColumns: gridCols }}>
          {columns.map((col) => (
            <div key={col.key} className={styles.headerCell}>
              {col.label}
            </div>
          ))}
          {actions && <div className={styles.headerCell}>Ações</div>}
        </div>

        {/* Rows */}
        {data.map((row, idx) => (
          <div
            key={keyExtractor(row, idx)}
            className={`${styles.row} ${idx % 2 === 1 ? styles.rowAlt : ""}`}
            style={{ gridTemplateColumns: gridCols }}
          >
            {columns.map((col) => (
              <div key={col.key} className={styles.cell}>
                {col.render
                  ? col.render(row[col.key], row)
                  : String(row[col.key] ?? "")}
              </div>
            ))}
            {actions && (
              <div className={styles.actions}>
                {actions.map((action, i) => (
                  <button
                    key={i}
                    className={styles.actionBtn}
                    onClick={() => action.onClick(idx)}
                    title={action.label}
                  >
                    <img src={action.icon} alt={action.label}/>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}