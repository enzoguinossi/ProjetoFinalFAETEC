"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type FormTabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

interface FormTabsProps {
  items: FormTabItem[];
  /** Aba aberta ao montar (padrão: a primeira). */
  defaultId?: string;
  className?: string;
}

/**
 * Abas de uma ficha. Os painéis ocultos continuam montados (`hidden`) para que
 * todos os campos participem do `FormData` enviado pelo formulário.
 *
 * Visual: faixa com divisória, aba ativa em verde e sublinhado de 2px. Sem
 * ícones e sem marcação de exportação para o Figma.
 */
export default function FormTabs({
  items,
  defaultId,
  className = "",
}: FormTabsProps) {
  const baseId = useId();
  const [ativo, setAtivo] = useState(() => {
    if (defaultId && items.some((item) => item.id === defaultId)) {
      return defaultId;
    }
    return items[0]?.id ?? "";
  });
  const botoes = useRef(new Map<string, HTMLButtonElement>());

  function selecionar(id: string) {
    setAtivo(id);
    botoes.current.get(id)?.focus();
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const indice = items.findIndex((item) => item.id === ativo);
    if (indice < 0) return;

    let destino: number | null = null;
    if (evento.key === "ArrowRight") {
      destino = (indice + 1) % items.length;
    } else if (evento.key === "ArrowLeft") {
      destino = (indice - 1 + items.length) % items.length;
    } else if (evento.key === "Home") {
      destino = 0;
    } else if (evento.key === "End") {
      destino = items.length - 1;
    }
    if (destino === null) return;

    evento.preventDefault();
    const alvo = items[destino];
    if (alvo) selecionar(alvo.id);
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        role="tablist"
        aria-label="Seções do formulário"
        onKeyDown={aoTeclar}
        className="flex items-stretch gap-6 border-b border-border"
      >
        {items.map((item) => {
          const selecionada = item.id === ativo;
          return (
            <button
              key={item.id}
              ref={(elemento) => {
                if (elemento) botoes.current.set(item.id, elemento);
                else botoes.current.delete(item.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selecionada}
              aria-controls={`${baseId}-painel-${item.id}`}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => setAtivo(item.id)}
              className={`-mb-px shrink-0 border-b-2 px-0.5 py-3 font-sans text-sm font-medium leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                selecionada
                  ? "border-brand text-brand"
                  : "border-transparent text-[#697077] hover:text-ink-strong"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item) => {
        const selecionada = item.id === ativo;
        return (
          <div
            key={item.id}
            role="tabpanel"
            id={`${baseId}-painel-${item.id}`}
            aria-labelledby={`${baseId}-tab-${item.id}`}
            hidden={!selecionada}
            className={selecionada ? "flex flex-col gap-6 pt-6" : "hidden"}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
}
