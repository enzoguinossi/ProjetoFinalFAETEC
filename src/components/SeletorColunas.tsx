"use client";

import { useEffect, useRef, useState } from "react";

export interface ColunaSelecionavel {
  key: string;
  label: string;
}

interface SeletorColunasProps {
  /** Todas as colunas de dados da tabela (a coluna de Ações não entra). */
  colunas: ColunaSelecionavel[];
  /** Chaves das colunas ocultas. */
  ocultas: Set<string>;
  /** `true` depois de ler a preferência do navegador. */
  carregado: boolean;
  onAlternar: (key: string) => void;
  onRestaurar: () => void;
  /** `false` quando o conjunto atual já é o padrão (nada a restaurar). */
  podeRestaurar: boolean;
  /** Chaves das colunas fixas: checkbox marcado e desabilitado. */
  fixas: Set<string>;
  /** Quantidade de colunas visíveis agora (para o contador e a última coluna). */
  totalVisiveis: number;
}

const botaoCls =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c1c7cd] bg-white px-3 font-sans text-sm font-medium text-ink transition-[background-color,border-color,color] duration-[120ms] hover:enabled:border-brand hover:enabled:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(27,153,86,0.35)] disabled:cursor-default disabled:opacity-50";

const painelCls =
  "absolute right-0 top-[calc(100%+6px)] z-30 flex max-h-80 w-64 flex-col rounded-xl border border-[#dde1e6] bg-white shadow-lg";

function IconeColunas() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4 shrink-0"
      fill="none"
    >
      <rect
        x="2"
        y="2.5"
        width="12"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M6 2.5v11M10 2.5v11" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/**
 * Botão "Colunas" + popover de checkboxes, no espírito do `DataTableViewOptions`
 * do shadcn-table, com o visual do Nexus. O painel é ancorado à direita e ocupa
 * o espaço acima da tabela — ele fica fora do wrapper com `overflow`, então não
 * é cortado pelo scroll horizontal.
 */
export default function SeletorColunas({
  colunas,
  ocultas,
  carregado,
  onAlternar,
  onRestaurar,
  podeRestaurar,
  fixas,
  totalVisiveis,
}: SeletorColunasProps) {
  const raiz = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);

  // Fecha ao clicar fora e com Esc.
  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  // Sem colunas não há o que escolher; a tabela nem renderiza a barra.
  if (colunas.length === 0) return null;

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        disabled={!carregado}
        className={botaoCls}
      >
        <IconeColunas />
        Colunas
        <span className="font-normal text-[#697077]">
          {totalVisiveis}/{colunas.length}
        </span>
      </button>

      {aberto && carregado ? (
        <div
          role="dialog"
          aria-label="Alternar colunas"
          className={painelCls}
        >
          <div className="border-b border-[#eef0f3] px-3 py-2">
            <p className="m-0 font-sans text-sm font-semibold text-ink">
              Alternar colunas
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {colunas.map((coluna) => {
              const fixa = fixas.has(coluna.key);
              const visivel = fixa || !ocultas.has(coluna.key);
              // A última coluna visível não pode ser escondida; a fixa conta
              // como visível, mas o checkbox dela é sempre desabilitado.
              const unica = !fixa && visivel && totalVisiveis <= 1;

              return (
                <label
                  key={coluna.key}
                  title={fixa ? "Coluna fixa" : undefined}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 font-sans text-sm text-ink ${
                    fixa
                      ? "cursor-default"
                      : unica
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer transition-colors hover:bg-[#f2f4f8]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visivel}
                    disabled={fixa || unica}
                    onChange={() => {
                      if (!fixa) onAlternar(coluna.key);
                    }}
                    aria-label={
                      fixa ? `${coluna.label} (coluna fixa)` : undefined
                    }
                    className="size-4 shrink-0 accent-[#1b9956] disabled:cursor-default"
                  />
                  <span className="min-w-0 flex-1 truncate" title={coluna.label}>
                    {coluna.label}
                  </span>
                  {fixa && (
                    <span
                      className="shrink-0 font-sans text-xs text-[#697077]"
                      title="Coluna fixa"
                    >
                      Coluna fixa
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="border-t border-[#eef0f3] p-1">
            <button
              type="button"
              onClick={onRestaurar}
              disabled={!podeRestaurar}
              className="w-full rounded-md px-2 py-1.5 text-left font-sans text-sm font-medium text-brand transition-colors hover:enabled:bg-[rgba(27,153,86,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(27,153,86,0.35)] disabled:cursor-default disabled:text-[#8a8f9a] disabled:opacity-70"
            >
              Restaurar padrão
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
