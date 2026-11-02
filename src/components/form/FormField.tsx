import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  /** Dica abaixo do controle. */
  hint?: ReactNode;
  /** Mensagem de erro (substitui a dica). */
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/** Campo padrão da ficha: rótulo, controle, dica e erro. */
export default function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="font-sans text-sm font-medium leading-5 text-ink-strong"
      >
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <span className="font-sans text-xs text-danger">{error}</span>
      ) : (
        hint && <span className="font-sans text-xs text-[#697077]">{hint}</span>
      )}
    </div>
  );
}

interface FormGridProps {
  /** Colunas da grade (padrão 2). */
  columns?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}

/** Grade de campos da ficha (desktop). */
export function FormGrid({
  columns = 2,
  children,
  className = "",
}: FormGridProps) {
  const colunas =
    columns === 3
      ? "grid-cols-3"
      : columns === 2
        ? "grid-cols-2"
        : "grid-cols-1";

  return (
    <div className={`grid gap-4 ${colunas} ${className}`}>
      {children}
    </div>
  );
}
