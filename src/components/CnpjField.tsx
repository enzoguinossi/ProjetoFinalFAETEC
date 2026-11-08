"use client";

import { CNPJ_MAX_CARACTERES, formatarCnpj } from "@/lib/cnpj";

interface Props {
  /** Valor controlado — dígitos ou já formatado; a exibição é sempre formatada. */
  value: string;
  onChange: (valor: string) => void;
  /** Modo visualização: mostra o CNPJ formatado (vazio quando não houver). */
  readOnly?: boolean;
  disabled?: boolean;
  label?: string;
  /** Consulta o CNPJ na Receita; quando informado, exibe o botão "Consultar". */
  onConsultar?: () => void;
  /** Exibe o botão em espera e o desabilita durante a consulta. */
  consultando?: boolean;
  /** Dica discreta abaixo do campo (ex.: "Preenchido pela Receita"). */
  hint?: string;
}

const INPUT_CLASS =
  "h-10 w-full box-border rounded-lg border border-border-input bg-white px-4 font-sans text-base outline-none transition-[border-color] duration-[120ms] focus:border-brand focus:shadow-[0_0_0_2px_rgba(27,153,86,0.12)]";
const labelClass = "font-sans text-sm font-medium leading-5 text-ink-strong";

/**
 * Campo de CNPJ compartilhado: máscara 00.000.000/0000-00 ao digitar, só dígitos
 * no valor enviado e exibição formatada no modo visualização.
 */
export default function CnpjField({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  label = "CNPJ",
  onConsultar,
  consultando = false,
  hint,
}: Props) {
  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>{label}</label>
        <p className="flex h-10 w-full items-center rounded-lg border border-border-input px-4 font-sans text-base">
          {value ? formatarCnpj(value) : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <input
          name="cnpj"
          value={value}
          onChange={(e) => onChange(formatarCnpj(e.target.value))}
          inputMode="numeric"
          maxLength={CNPJ_MAX_CARACTERES}
          placeholder="00.000.000/0000-00"
          disabled={disabled}
          className={INPUT_CLASS}
        />
        {onConsultar && (
          <button
            type="button"
            onClick={onConsultar}
            disabled={disabled || consultando}
            title="Consultar CNPJ na Receita"
            aria-label="Consultar CNPJ na Receita"
            className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border-input bg-white px-3 font-sans text-sm text-brand transition-colors hover:bg-[rgba(27,153,86,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-wait disabled:opacity-60"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {consultando ? "Consultando…" : "Consultar"}
          </button>
        )}
      </div>
      {hint && (
        <span className="font-sans text-xs text-[#697077]">{hint}</span>
      )}
    </div>
  );
}
