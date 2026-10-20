"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";
import TablePagination from "@/components/TablePagination";
import type { Column } from "@/components/DataTable";
import type { PaginatedResult } from "@/types";

/** Parâmetros de uma página do seletor. */
export type SearchEntityPageParams = {
  page: number;
  search: string;
  limit: number;
  /** Ids já adicionados, para a listagem não devolvê-los. */
  excludeIds?: number[];
};

interface SearchEntityModalProps<T> {
  open: boolean;
  onClose: () => void;
  onSelect: (item: T) => void;
  title: string;
  /** Colunas no mesmo formato do `DataTable` (`key`, `label`, `width` e `render`). */
  columns: Column<T>[];
  /** Carrega uma página; chamado ao abrir e a cada mudança de filtro/página. */
  loadPage: (params: SearchEntityPageParams) => Promise<PaginatedResult<T>>;
  getItemId: (item: T) => number;
  excludeIds?: number[];
  pageSize?: number;
  placeholder?: string;
}

const wrapperCls = "flex flex-col gap-3 w-full";
const tableCls = "flex flex-col rounded-[1.25rem] overflow-hidden w-full min-w-[560px]";
const headerCls =
  "grid bg-brand text-white font-display text-base [font-weight:590] tracking-[-0.028125rem] whitespace-nowrap";
const headerCellCls = "px-[0.6875rem] py-2 text-center";
const rowCls =
  "grid bg-white font-sans text-base text-ink cursor-pointer transition-[background-color] duration-100 hover:bg-[#eef6f1]";
const rowAltCls = "bg-table-alt!";
const cellCls =
  "px-[0.6875rem] py-2 whitespace-nowrap overflow-hidden text-ellipsis [&:first-child]:text-center";
const selectBtnCls =
  "px-2 py-1 border border-border rounded-md bg-white font-sans text-[0.8125rem] text-ink cursor-pointer transition-[background-color,border-color] duration-100 hover:bg-[#f2f4f8] hover:border-[#c1c7cd]";
const emptyCls =
  "flex items-center justify-center py-8 px-4 font-sans text-sm text-[#697077] bg-white last:rounded-b-[1.25rem]";

export default function SearchEntityModal<T>({
  open,
  onClose,
  onSelect,
  title,
  columns,
  loadPage,
  getItemId,
  excludeIds,
  pageSize = 10,
  placeholder = "Filtrar...",
}: SearchEntityModalProps<T>) {
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [page, setPage] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(pageSize);
  const [resultado, setResultado] = useState<PaginatedResult<T> | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const requisicao = useRef(0);

  // Lista estável de ids excluídos (evita recarregar a cada render do pai).
  const exclusoesChave = (excludeIds ?? []).join(",");
  const exclusoes = useMemo(
    () => (exclusoesChave ? exclusoesChave.split(",").map(Number) : []),
    [exclusoesChave],
  );

  // Ao abrir, foca o filtro.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Filtro com debounce: volta para a primeira página.
  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [busca, open]);

  // Carrega a página ao abrir e a cada mudança de filtro/página/tamanho.
  useEffect(() => {
    if (!open) return;
    const id = ++requisicao.current;

    async function carregar() {
      setCarregando(true);
      setErro(null);
      try {
        const res = await loadPage({
          page,
          search: buscaAplicada,
          limit: tamanhoPagina,
          excludeIds: exclusoes,
        });
        if (id === requisicao.current) setResultado(res);
      } catch {
        if (id !== requisicao.current) return;
        setResultado(null);
        setErro("Não foi possível carregar os registros.");
      } finally {
        if (id === requisicao.current) setCarregando(false);
      }
    }

    void carregar();
  }, [open, page, buscaAplicada, tamanhoPagina, exclusoes, loadPage]);

  const linhas = resultado?.data ?? [];

  const total = resultado?.total ?? 0;
  const totalPaginas = resultado?.totalPages ?? 0;

  function limpar() {
    setBusca("");
    setBuscaAplicada("");
    setPage(1);
    setResultado(null);
    setErro(null);
    setCarregando(false);
  }

  function selecionar(item: T) {
    onSelect(item);
    limpar();
    onClose();
  }

  function handleClose() {
    limpar();
    onClose();
  }

  function trocarTamanhoPagina(tamanho: number) {
    setTamanhoPagina(tamanho);
    setPage(1);
  }

  const gridCols = columns
    .map((c) => c.width || "1fr")
    .concat("7.5rem")
    .join(" ");

  return (
    <Modal open={open} onClose={handleClose} title={title} width="900px">
      <div className="flex flex-col gap-4 w-full">
        <div className="flex items-center gap-2 h-10 px-3 border border-[#c1c7cd] rounded-lg bg-white transition-[border-color] duration-150 focus-within:border-brand focus-within:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]">
          <img
            src="/icons/actions/Lupa.svg"
            alt=""
            className="w-[1.125rem] h-[1.125rem] shrink-0 opacity-50"
          />
          <input
            ref={inputRef}
            className="flex-1 border-none outline-none bg-transparent font-sans text-sm text-ink h-full min-w-0 placeholder:text-[#8a8f9a]"
            type="text"
            placeholder={placeholder}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className={wrapperCls}>
          <div className="overflow-x-auto w-full [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar-thumb]:bg-[#c1c7cd] [&::-webkit-scrollbar-thumb]:rounded-[3px]">
            <div
              className={`${tableCls} transition-opacity ${carregando ? "opacity-60" : ""}`}
            >
              <div className={headerCls} style={{ gridTemplateColumns: gridCols }}>
                {columns.map((col) => (
                  <div key={col.key} className={headerCellCls}>
                    {col.label}
                  </div>
                ))}
                <div className={headerCellCls}>Ação</div>
              </div>

              {linhas.length === 0 && (
                <div className={emptyCls}>
                  {carregando
                    ? "Carregando..."
                    : (erro ?? "Nenhum registro encontrado.")}
                </div>
              )}

              {linhas.map((item, index) => (
                <div
                  key={getItemId(item)}
                  className={`${rowCls} ${index % 2 === 1 ? rowAltCls : ""}`}
                  style={{ gridTemplateColumns: gridCols }}
                  onClick={() => selecionar(item)}
                >
                  {columns.map((col) => (
                    <div key={col.key} className={cellCls}>
                      {col.render
                        ? col.render(item[col.key], item)
                        : String(item[col.key] ?? "")}
                    </div>
                  ))}
                  <div className="flex items-center justify-center py-1">
                    <button
                      className={selectBtnCls}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selecionar(item);
                      }}
                    >
                      Selecionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-sans text-[0.8125rem] text-[#697077]">
              Exibindo {linhas.length} de {total} registro(s).
            </span>
            <TablePagination
              pageIndex={Math.max(0, page - 1)}
              pageCount={Math.max(1, totalPaginas)}
              pageSize={tamanhoPagina}
              canPrevious={page > 1}
              canNext={page < totalPaginas}
              onFirst={() => setPage(1)}
              onPrevious={() => setPage((atual) => Math.max(1, atual - 1))}
              onNext={() => setPage((atual) => Math.min(totalPaginas, atual + 1))}
              onLast={() => setPage(Math.max(1, totalPaginas))}
              onPageSizeChange={trocarTamanhoPagina}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
