"use client";

import type { FormEvent, ReactNode } from "react";

interface FormShellProps {
  /** Faixa de identidade no topo (normalmente um `IdentityBand`). */
  identity?: ReactNode;
  children: ReactNode;
  /** Ações do rodapé fixo. */
  actions: ReactNode;
  /**
   * Quando informado o shell é um `<form>`; sem ele, um contêiner de leitura.
   */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Marca lida pela exportação para o Figma (`data-figma`). */
  "data-figma"?: string;
  className?: string;
}

/**
 * Estrutura “ficha” dos formulários: faixa de identidade no topo, corpo em
 * seções e rodapé fixo.
 *
 * O rodapé é `sticky -bottom-8` dentro do corpo rolável do `Modal` (que aplica
 * `p-8`); as margens negativas fazem a faixa e o rodapé ocuparem a largura toda
 * (e cobrirem o respiro inferior do modal) sem alterar o `Modal`. Nenhuma regra
 * de negócio mora aqui.
 */
export default function FormShell({
  identity,
  children,
  actions,
  onSubmit,
  className = "",
  ...marcas
}: FormShellProps) {
  const conteudo = (
    <>
      {identity && <div className="-mx-8 -mt-8">{identity}</div>}

      <div className="flex flex-col gap-6 pb-8 pt-1">{children}</div>

      <footer className="sticky -bottom-8 z-10 -mx-8 -mb-8 mt-2 flex flex-wrap items-center justify-end gap-2.5 border-t border-border bg-white px-8 py-4">
        {actions}
      </footer>
    </>
  );

  if (!onSubmit) {
    return (
      <div className={`flex w-full flex-col ${className}`} {...marcas}>
        {conteudo}
      </div>
    );
  }

  return (
    <form
      className={`flex w-full flex-col ${className}`}
      onSubmit={onSubmit}
      data-figma-hug="vertical"
      {...marcas}
    >
      {conteudo}
    </form>
  );
}
