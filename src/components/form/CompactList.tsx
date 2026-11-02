"use client";

import { useMemo, useState, type ReactNode } from "react";

export type CompactListColumn<T> = {
  key: string;
  /** Rótulo da coluna; sem rótulo a coluna fica só com o conteúdo. */
  label?: string;
  /** Largura no grid (padrão `1fr`). */
  width?: string;
  align?: "left" | "center" | "right";
  render: (item: T) => ReactNode;
};

export type CompactListAction<T> = {
  icon: string;
  label: string;
  onClick: (item: T) => void;
  disabled?: boolean;
};

interface CompactListProps<T> {
  items: T[];
  columns: CompactListColumn<T>[];
  rowKey: (item: T) => string | number;
  actions?: CompactListAction<T>[];
  /** Linhas exibidas recolhido (padrão 3). */
  collapsed?: number;
  /** Linhas por página expandido (padrão 5; não é escolhido pelo usuário). */
  pageSize?: number;
  /** Texto usado pela busca; sem ele a busca não aparece. */
  search?: (item: T) => string;
  searchPlaceholder?: string;
  /** Texto do estado vazio. */
  empty?: ReactNode;
  emptyAction?: { label: string; onClick: () => void };
  /** Ação de adicionar, no cabeçalho da lista. */
  onAdd?: { label: string; onClick: () => void };
  /** Substantivo da contagem: 1 código / 3 códigos. */
  noun?: { singular: string; plural: string };
  /** Expansão controlada (opcional). Sem ela, a lista controla o próprio estado. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

const ALINHAMENTO = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

const BOTAO_TEXTO =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-sans text-xs font-semibold text-brand transition-colors hover:bg-[rgba(27,153,86,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-default disabled:opacity-40";

const BOTAO_ICONE =
  "flex h-7 w-7 items-center justify-center rounded-md text-ink transition-colors hover:bg-[rgba(0,0,0,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-default disabled:opacity-40";

const BOTAO_PAGINA =
  "flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-ink transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-default disabled:opacity-40";

/**
 * Lista compacta para dentro de formulários: recolhida mostra até 3 linhas e
 * “Ver todos (N)”; expandida pagina de 5 em 5, com busca e “Recolher”.
 *
 * Não usa `DataTable` (que é para listagens de página inteira) e não abre modal
 * para expandir — a expansão é inline.
 */
export default function CompactList<T>({
  items,
  columns,
  rowKey,
  actions,
  collapsed = 3,
  pageSize = 5,
  search,
  searchPlaceholder = "Buscar...",
  empty = "Nenhum registro.",
  emptyAction,
  onAdd,
  noun = { singular: "item", plural: "itens" },
  expanded,
  onExpandedChange,
  className = "",
}: CompactListProps<T>) {
  const [expandidoInterno, setExpandidoInterno] = useState(false);
  const expandido = expanded ?? expandidoInterno;
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!expandido || !search || !termo) return items;
    return items.filter((item) => search(item).toLowerCase().includes(termo));
  }, [items, expandido, busca, search]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = expandido
    ? filtrados.slice((paginaAtual - 1) * pageSize, paginaAtual * pageSize)
    : filtrados.slice(0, collapsed);

  const inicio = filtrados.length === 0 ? 0 : (paginaAtual - 1) * pageSize + 1;
  const fim = Math.min(paginaAtual * pageSize, filtrados.length);

  const colunasGrid = columns
    .map((coluna) => coluna.width ?? "1fr")
    .concat(actions && actions.length > 0 ? "5.5rem" : [])
    .join(" ");

  function recolher() {
    definirExpandido(false);
  }

  function definirExpandido(valor: boolean) {
    setExpandidoInterno(valor);
    onExpandedChange?.(valor);
    if (!valor) {
      setBusca("");
      setPagina(1);
    }
  }

  const contagem = `${items.length} ${
    items.length === 1 ? noun.singular : noun.plural
  }`;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-sans text-xs text-[#697077]">{contagem}</span>
        {onAdd && (
          <button type="button" className={BOTAO_TEXTO} onClick={onAdd.onClick}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10 4V16M4 10H16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {onAdd.label}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {visiveis.length > 0 && (
          <div
            className="grid items-center bg-[#f7f9fb] px-3 py-1.5 font-sans text-xs leading-4 text-[#697077]"
            style={{ gridTemplateColumns: colunasGrid }}
          >
            {columns.map((coluna) => (
              <span
                key={coluna.key}
                className={`truncate ${ALINHAMENTO[coluna.align ?? "left"]}`}
              >
                {coluna.label ?? ""}
              </span>
            ))}
            {actions && actions.length > 0 && (
              <span className="text-right">Ações</span>
            )}
          </div>
        )}

        {visiveis.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-4 text-center">
            <span className="font-sans text-xs text-[#697077]">{empty}</span>
            {emptyAction && (
              <button
                type="button"
                className={BOTAO_TEXTO}
                onClick={emptyAction.onClick}
              >
                {emptyAction.label}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {visiveis.map((item) => (
              <div
                key={rowKey(item)}
                className="grid min-h-9 items-center px-3 py-1 font-sans text-[0.8125rem] leading-5 text-ink transition-colors hover:bg-[#f7f9fb]"
                style={{ gridTemplateColumns: colunasGrid }}
              >
                {columns.map((coluna) => (
                  <div
                    key={coluna.key}
                    className={`min-w-0 truncate ${
                      ALINHAMENTO[coluna.align ?? "left"]
                    }`}
                  >
                    {coluna.render(item)}
                  </div>
                ))}
                {actions && actions.length > 0 && (
                  <div className="flex items-center justify-end gap-1">
                    {actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        title={action.label}
                        aria-label={action.label}
                        disabled={action.disabled}
                        className={BOTAO_ICONE}
                        onClick={() => action.onClick(item)}
                      >
                        <img
                          src={action.icon}
                          alt=""
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {expandido && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {search ? (
            <div className="flex h-8 w-full max-w-56 items-center gap-2 rounded-md border border-border-input bg-white px-2 transition-[border-color] duration-150 focus-within:border-brand focus-within:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]">
              <img
                src="/icons/actions/Lupa.svg"
                alt=""
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 opacity-50"
              />
              <input
                type="text"
                value={busca}
                onChange={(event) => {
                  setBusca(event.target.value);
                  setPagina(1);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-full min-w-0 flex-1 border-none bg-transparent font-sans text-xs text-ink outline-none placeholder:text-[#8a8f9a]"
              />
            </div>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <span className="font-sans text-xs text-[#697077]">
              {inicio}–{fim} de {filtrados.length}
            </span>
            <button
              type="button"
              className={BOTAO_PAGINA}
              title="Página anterior"
              aria-label="Página anterior"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina(Math.max(1, paginaAtual - 1))}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 4L6 10L12 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className={BOTAO_PAGINA}
              title="Próxima página"
              aria-label="Próxima página"
              disabled={paginaAtual >= totalPaginas}
              onClick={() =>
                setPagina(Math.min(totalPaginas, paginaAtual + 1))
              }
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 4L14 10L8 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {items.length > collapsed && (
        <div className="flex justify-end">
          <button
            type="button"
            className={BOTAO_TEXTO}
            onClick={() => (expandido ? recolher() : definirExpandido(true))}
          >
            {expandido ? "Recolher" : `Ver todos (${items.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
