"use client";

import type { MouseEvent } from "react";

export type SwitchProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Estado parcial de um grupo: visual intermediário e `aria-checked="mixed"`. */
  partial?: boolean;
  label?: string;
  ariaLabel?: string;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Switch acessível do Nexus (`role="switch"`).
 *
 * É um `<button>` nativo: Enter/Espaço funcionam sem handlers extras, o foco é
 * visível e o estado é exposto por `aria-checked`. `partial` é usado no grupo
 * com algumas permissões marcadas (visual intermediário + `aria-checked=mixed`).
 */
export default function Switch({
  checked,
  onChange,
  disabled = false,
  partial = false,
  label,
  ariaLabel,
  size = "sm",
  className = "",
}: SwitchProps) {
  const estado = partial ? "parcial" : checked ? "ligado" : "desligado";
  const dimensoes =
    size === "md"
      ? { trilho: "h-6 w-11", polegar: "h-5 w-5", ligado: "translate-x-5", parcial: "translate-x-2.5" }
      : { trilho: "h-5 w-9", polegar: "h-4 w-4", ligado: "translate-x-4", parcial: "translate-x-2" };

  function aoClicar(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onChange?.(!checked);
  }

  const trilho = disabled
    ? "bg-[#c1c7cd]"
    : partial
      ? "bg-brand/40"
      : checked
        ? "bg-brand"
        : "bg-[#c1c7cd]";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={partial ? "mixed" : checked}
      aria-label={ariaLabel ?? label}
      title={ariaLabel ?? label}
      disabled={disabled}
      onClick={aoClicar}
      data-figma="Switch"
      data-figma-state={estado}
      data-figma-label={ariaLabel ?? label ?? ""}
      className={`relative inline-flex shrink-0 items-center rounded-full border-none p-0.5 box-border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 ${dimensoes.trilho} ${trilho} ${
        disabled ? "cursor-default opacity-70" : "cursor-pointer"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none block rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-transform duration-150 ${dimensoes.polegar} ${
          partial ? dimensoes.parcial : checked ? dimensoes.ligado : "translate-x-0"
        }`}
      />
    </button>
  );
}
