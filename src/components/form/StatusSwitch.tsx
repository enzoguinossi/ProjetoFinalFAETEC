"use client";

import Switch from "@/components/Switch";

interface StatusSwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Explicação curta exibida ao lado (principalmente quando desabilitado). */
  hint?: string;
  /** Nome do campo enviado no formulário (padrão `ativo`). */
  name?: string;
}

/**
 * Status do cadastro como switch.
 *
 * O `Switch` é um `<button>` e não participa do `FormData`; por isso o valor é
 * enviado por um `<input type="hidden" name="ativo">`. Quando o switch está
 * desabilitado o input continua enviando o valor atual — assim o serviço não
 * recebe “sem ativo” e não desativa o cadastro sem permissão.
 */
export default function StatusSwitch({
  checked,
  onChange,
  disabled = false,
  hint,
  name = "ativo",
}: StatusSwitchProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      <input type="hidden" name={name} value={checked ? "on" : ""} />
      <div className="flex items-center gap-2">
        <span
          className={`font-sans text-xs font-semibold ${
            checked ? "text-brand" : "text-[#697077]"
          }`}
        >
          {checked ? "Ativo" : "Inativo"}
        </span>
        <Switch
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          label="Ativo"
          size="md"
        />
      </div>
      {hint && (
        <span className="max-w-[15rem] text-right font-sans text-xs leading-4 text-[#697077]">
          {hint}
        </span>
      )}
    </div>
  );
}
