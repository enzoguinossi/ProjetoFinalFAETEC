"use client";

import { CNPJ_MAX_CARACTERES, formatarCnpj } from "@/lib/cnpj";
import { ui } from "@/lib/ui";

interface Props {
  /** Valor controlado — dígitos ou já formatado; a exibição é sempre formatada. */
  value: string;
  onChange: (valor: string) => void;
  /** Modo visualização: mostra o CNPJ formatado (ou "—"). */
  readOnly?: boolean;
  disabled?: boolean;
  label?: string;
  /** Consulta o CNPJ na Receita; quando informado, exibe o botão "Consultar". */
  onConsultar?: () => void;
  /** Exibe o botão em espera e o desabilita durante a consulta. */
  consultando?: boolean;
}

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
}: Props) {
  if (readOnly) {
    return (
      <div className={ui.field}>
        <label className={ui.label}>{label}</label>
        <p className={`${ui.input} leading-[2.5] m-0`}>{value ? formatarCnpj(value) : "—"}</p>
      </div>
    );
  }

  return (
    <div className={ui.field}>
      <label className={ui.label}>{label}</label>
      <div className="flex gap-2">
        <input
          name="cnpj"
          value={value}
          onChange={(e) => onChange(formatarCnpj(e.target.value))}
          inputMode="numeric"
          maxLength={CNPJ_MAX_CARACTERES}
          placeholder="00.000.000/0000-00"
          disabled={disabled}
          className={ui.input}
        />
        {onConsultar && (
          <button
            type="button"
            onClick={onConsultar}
            disabled={disabled || consultando}
            title="Consultar CNPJ na Receita"
            aria-label="Consultar CNPJ na Receita"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border-input bg-white px-3 font-sans text-sm text-brand cursor-pointer disabled:cursor-wait disabled:opacity-60"
          >
            {consultando ? (
              "…"
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
            Consultar
          </button>
        )}
      </div>
    </div>
  );
}
