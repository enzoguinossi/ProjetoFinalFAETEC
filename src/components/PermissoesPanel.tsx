"use client";

import { useMemo } from "react";

export interface PermissaoOption {
  id_permissao: number;
  nome: string;
  descricao: string | null;
}

export interface GrupoPermissoes {
  prefixo: string;
  permissoes: PermissaoOption[];
}

interface Props {
  grupos: GrupoPermissoes[];
  selecionadas: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  tituloDisponiveis?: string;
  tituloSelecionadas?: string;
  /** Renderiza o botão + slot de ações (ex.: "Aplicar perfil"). */
  acoes?: React.ReactNode;
}

const cardClass =
  "rounded-xl border border-table-alt p-3 flex flex-col gap-1.5 max-h-80 overflow-y-auto min-h-[200px]";

const labelClass = "font-sans text-sm font-medium text-ink mb-1.5";

export default function PermissoesPanel({
  grupos,
  selecionadas,
  onChange,
  disabled = false,
  tituloDisponiveis = "Disponíveis",
  tituloSelecionadas = "Selecionadas",
  acoes,
}: Props) {
  const itemClass = (selected: boolean) =>
    `px-2.5 py-1.5 rounded-lg font-sans text-[0.8125rem] border border-transparent text-left ${disabled ? "cursor-default" : "cursor-pointer"} ${selected ? "bg-[#e7f6ee] text-[#0f7a44]" : "bg-transparent text-ink"}`;

  const todasDisponiveis = useMemo(
    () => grupos.flatMap((g) => g.permissoes.map((p) => p.nome)),
    [grupos],
  );
  const set = new Set(todasDisponiveis);

  function alternar(nome: string) {
    if (disabled) return;
    onChange(
      selecionadas.includes(nome)
        ? selecionadas.filter((n) => n !== nome)
        : [...selecionadas, nome],
    );
  }

  const validas = selecionadas.filter((n) => set.has(n));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-[590] m-0 text-ink-strong">
          Permissões
        </h3>
        {acoes}
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-4">
        {/* Disponíveis */}
        <div>
          <p className={labelClass}>{tituloDisponiveis}</p>
          <div className={cardClass}>
            {grupos.map((g) => (
              <div key={g.prefixo} className="flex flex-col gap-0.5">
                <span className="font-sans text-[0.6875rem] uppercase tracking-[0.5px] text-[#9aa0a6] my-1">
                  {g.prefixo}
                </span>
                {g.permissoes
                  .filter((p) => !validas.includes(p.nome))
                  .map((p) => (
                    <button
                      key={p.nome}
                      type="button"
                      className={itemClass(false)}
                      onClick={() => alternar(p.nome)}
                      disabled={disabled}
                      title={p.descricao ?? p.nome}
                    >
                      {p.nome}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>

        {/* Selecionadas */}
        <div>
          <p className={labelClass}>{tituloSelecionadas}</p>
          <div className={cardClass}>
            {validas.length === 0 && (
              <span className="font-sans text-[0.8125rem] text-[#9aa0a6]">
                Nenhuma permissão.
              </span>
            )}
            {[...validas].sort().map((nome) => (
              <button
                key={nome}
                type="button"
                className={itemClass(true)}
                onClick={() => alternar(nome)}
                disabled={disabled}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
