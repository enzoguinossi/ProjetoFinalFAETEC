import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  /** Contagem ou explicação curta ao lado do título. */
  note?: ReactNode;
  /** Ação opcional alinhada à direita (ex.: “Gerenciar unidades”). */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Seção de uma ficha: título em sentence case, nota/contagem, ação opcional e
 * divisória fina. Sem card, sem sombra, sem borda decorativa.
 */
export default function FormSection({
  title,
  note,
  action,
  children,
  className = "",
}: FormSectionProps) {
  return (
    <section className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border pb-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="m-0 font-display text-base font-[590] leading-6 tracking-[-0.01rem] text-ink-strong">
            {title}
          </h3>
          {note && (
            <span className="font-sans text-xs text-[#697077]">{note}</span>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
