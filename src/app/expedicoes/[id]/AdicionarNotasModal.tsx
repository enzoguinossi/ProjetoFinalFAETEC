"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useAviso } from "@/components/AvisoProvider";
import {
  adicionarNotaExpedicao,
  listarNotasElegiveis,
  type ExpedicaoNotaRow,
  type NotaElegivelRow,
} from "../actions";
import type { PaginatedResult } from "@/types";

const LIMITE = 20;

interface Props {
  open: boolean;
  onClose: () => void;
  idExpedicao: number;
  /** Notas que já estão na expedição (vem do `detalhe.notas` do pai). */
  notas: ExpedicaoNotaRow[];
  /** Recarrega o detalhe no pai (atualiza a coluna da direita). */
  onAlterada: () => Promise<void> | void;
}

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(
    valor,
  );
}

function formatarItens(total: number): string {
  return total === 1 ? "1 item" : `${total} itens`;
}

const colunaCls =
  "flex flex-col gap-3 rounded-[1.25rem] border border-border bg-white p-4";
const cabecalhoCls = "flex items-baseline justify-between gap-2";
const tituloCls = "m-0 font-display text-base font-[590] text-ink-strong";
const contagemCls = "font-sans text-xs text-[#697077]";
const listaCls =
  "flex max-h-[24rem] flex-col overflow-y-auto rounded-[1.25rem] border border-border bg-white";
const vazioCls =
  "flex items-center justify-center px-4 py-8 font-sans text-sm text-[#697077]";
const linhaCls =
  "flex items-center justify-between gap-3 px-3 py-2 font-sans";
const botaoAdicionarCls =
  "shrink-0 rounded-md border border-border bg-white px-2 py-1 font-sans text-[0.8125rem] text-ink cursor-pointer transition-[background-color,border-color] duration-100 hover:bg-[#f2f4f8] hover:border-[#c1c7cd] disabled:cursor-default disabled:opacity-40";

export default function AdicionarNotasModal({
  open,
  onClose,
  idExpedicao,
  notas,
  onAlterada,
}: Props) {
  const mostrarAviso = useAviso();
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [page, setPage] = useState(1);
  const [resultado, setResultado] =
    useState<PaginatedResult<NotaElegivelRow> | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [adicionadas, setAdicionadas] = useState<number[]>([]);
  const [adicionandoId, setAdicionandoId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const requisicao = useRef(0);
  const adicionando = useRef(false);

  // Lista estável de ids já presentes (na expedição ou adicionados aqui).
  const exclusoesChave = [
    ...notas.map((nota) => nota.id_nota_saida),
    ...adicionadas,
  ].join(",");
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

  // Carrega a página ao abrir e a cada mudança de filtro/página/exclusões.
  useEffect(() => {
    if (!open) return;
    const id = ++requisicao.current;

    async function carregar() {
      setCarregando(true);
      setErro(null);
      try {
        const res = await listarNotasElegiveis({
          page,
          limit: LIMITE,
          search: buscaAplicada,
          excludeIds: exclusoes,
        });
        if (id === requisicao.current) setResultado(res);
      } catch {
        if (id !== requisicao.current) return;
        setResultado(null);
        setErro("Não foi possível carregar as remessas disponíveis.");
      } finally {
        if (id === requisicao.current) setCarregando(false);
      }
    }

    void carregar();
  }, [open, page, buscaAplicada, exclusoes]);

  const linhas = resultado?.data ?? [];
  const total = resultado?.total ?? 0;
  const totalPaginas = resultado?.totalPages ?? 0;

  function limpar() {
    requisicao.current++;
    setBusca("");
    setBuscaAplicada("");
    setPage(1);
    setResultado(null);
    setErro(null);
    setCarregando(false);
    setAdicionadas([]);
    setAdicionandoId(null);
  }

  function handleClose() {
    limpar();
    onClose();
  }

  async function adicionar(nota: NotaElegivelRow) {
    if (adicionando.current) return;
    adicionando.current = true;
    setAdicionandoId(nota.id_nota_saida);
    try {
      const resultadoAcao = await adicionarNotaExpedicao(
        idExpedicao,
        nota.id_nota_saida,
      );
      if ("error" in resultadoAcao && resultadoAcao.error) {
        mostrarAviso(resultadoAcao.error, "erro");
        return;
      }
      mostrarAviso(`Remessa ${nota.codigo} adicionada à expedição.`, "sucesso");
      setAdicionadas((atual) => [...atual, nota.id_nota_saida]);
      setPage(1);
      await onAlterada();
    } catch {
      mostrarAviso("Erro ao adicionar a remessa. Tente novamente.", "erro");
    } finally {
      adicionando.current = false;
      setAdicionandoId(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Adicionar notas à expedição"
      width="min(1040px, 95vw)"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Remessas disponíveis */}
        <section className={colunaCls}>
          <div className={cabecalhoCls}>
            <h3 className={tituloCls}>Remessas disponíveis</h3>
            <span className={contagemCls}>{total} disponível(is)</span>
          </div>

          <div className="flex h-10 items-center gap-2 rounded-lg border border-[#c1c7cd] bg-white px-3 transition-[border-color] duration-150 focus-within:border-brand focus-within:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]">
            <img
              src="/icons/actions/Lupa.svg"
              alt=""
              className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-50"
            />
            <input
              ref={inputRef}
              className="h-full min-w-0 flex-1 border-none bg-transparent font-sans text-sm text-ink outline-none placeholder:text-[#8a8f9a]"
              type="text"
              placeholder="Filtrar por código ou destinatário..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className={`${listaCls} ${carregando ? "opacity-60" : ""}`}>
            {linhas.length === 0 && (
              <div className={vazioCls}>
                {carregando
                  ? "Carregando..."
                  : (erro ?? "Nenhuma remessa disponível.")}
              </div>
            )}

            {linhas.map((nota, indice) => (
              <div
                key={nota.id_nota_saida}
                className={`${linhaCls} ${
                  indice % 2 === 1 ? "bg-table-alt!" : "bg-white"
                }`}
              >
                <div className="min-w-0">
                  <div className="whitespace-nowrap font-sans text-sm text-ink-strong">
                    {nota.codigo}
                  </div>
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap font-sans text-xs text-[#697077]">
                    {nota.destinatario}
                  </div>
                  <div className="font-sans text-xs text-[#697077]">
                    {formatarItens(nota.itens)} · saldo pendente{" "}
                    {formatarNumero(nota.saldo_pendente)}
                  </div>
                </div>
                <button
                  type="button"
                  className={botaoAdicionarCls}
                  onClick={() => void adicionar(nota)}
                  disabled={adicionandoId === nota.id_nota_saida}
                >
                  {adicionandoId === nota.id_nota_saida
                    ? "Adicionando..."
                    : "Adicionar"}
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-sans text-[0.8125rem] text-[#697077]">
              Página {totalPaginas === 0 ? 0 : page} de {totalPaginas}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={botaoAdicionarCls}
                onClick={() => setPage((atual) => Math.max(1, atual - 1))}
                disabled={carregando || page <= 1}
              >
                Anterior
              </button>
              <button
                type="button"
                className={botaoAdicionarCls}
                onClick={() =>
                  setPage((atual) => Math.min(totalPaginas, atual + 1))
                }
                disabled={carregando || page >= totalPaginas}
              >
                Próxima
              </button>
            </div>
          </div>
        </section>

        {/* Na expedição */}
        <section className={colunaCls}>
          <div className={cabecalhoCls}>
            <h3 className={tituloCls}>Na expedição</h3>
            <span className={contagemCls}>{notas.length} nota(s)</span>
          </div>

          <div className={listaCls}>
            {notas.length === 0 ? (
              <div className={vazioCls}>Nenhuma remessa nesta expedição.</div>
            ) : (
              notas.map((nota, indice) => (
                <div
                  key={nota.id_nota_saida}
                  className={`${linhaCls} ${
                    indice % 2 === 1 ? "bg-table-alt!" : "bg-white"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-6 shrink-0 text-center font-sans text-sm font-semibold text-ink">
                      {nota.ordem_visita}
                    </span>
                    <div className="min-w-0">
                      <div className="whitespace-nowrap font-sans text-sm text-ink-strong">
                        {nota.codigo}
                      </div>
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap font-sans text-xs text-[#697077]">
                        {nota.destinatario ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="font-sans text-xs text-[#697077]">
                      {nota.statusLabel}
                    </span>
                    <span className="font-sans text-sm text-ink">
                      {formatarNumero(nota.saldo_pendente)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="m-0 font-sans text-xs text-[#697077]">
            O modal continua aberto para adicionar várias remessas. A ordem pode
            ser ajustada na lista da expedição.
          </p>
        </section>
      </div>
    </Modal>
  );
}
