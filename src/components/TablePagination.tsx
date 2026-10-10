const paginationCls =
  "flex items-center justify-center gap-1.5 font-sans text-[0.8125rem] text-ink";
const pageBtnCls =
  "flex items-center justify-center w-8 h-8 border border-border rounded-md bg-white cursor-pointer text-ink transition-[background-color,border-color] duration-[120ms] hover:enabled:bg-[#f2f4f8] hover:enabled:border-[#c1c7cd] disabled:opacity-35 disabled:cursor-default";
const pageInfoCls = "mx-2 whitespace-nowrap";
const pageSizeSelectCls =
  "ml-3 px-2 py-1 border border-border rounded-md bg-white font-sans text-[0.8125rem] text-ink cursor-pointer";

function PageButton({
  paths,
  title,
  disabled,
  onClick,
}: {
  paths: string[];
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={pageBtnCls}
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        {paths.map((d) => (
          <path
            key={d}
            d={d}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </button>
  );
}

export interface TablePaginationProps {
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  canPrevious: boolean;
  canNext: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  onPageSizeChange: (size: number) => void;
}

export default function TablePagination({
  pageIndex,
  pageCount,
  pageSize,
  canPrevious,
  canNext,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  onPageSizeChange,
}: TablePaginationProps) {
  return (
    <div className={paginationCls}>
      <PageButton
        paths={["M12 4L8 8L12 12", "M8 4L4 8L8 12"]}
        title="Primeira página"
        disabled={!canPrevious}
        onClick={onFirst}
      />
      <PageButton
        paths={["M10 4L6 8L10 12"]}
        title="Página anterior"
        disabled={!canPrevious}
        onClick={onPrevious}
      />

      <span className={pageInfoCls}>
        Página{" "}
        <strong>
          {pageIndex + 1} de {pageCount}
        </strong>
      </span>

      <PageButton
        paths={["M6 4L10 8L6 12"]}
        title="Próxima página"
        disabled={!canNext}
        onClick={onNext}
      />
      <PageButton
        paths={["M4 4L8 8L4 12", "M8 4L12 8L8 12"]}
        title="Última página"
        disabled={!canNext}
        onClick={onLast}
      />

      <select
        className={pageSizeSelectCls}
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
      >
        {[5, 10, 20, 50].map((size) => (
          <option key={size} value={size}>
            {size} por página
          </option>
        ))}
      </select>
    </div>
  );
}
