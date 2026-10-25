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
    </div>
  );
}
