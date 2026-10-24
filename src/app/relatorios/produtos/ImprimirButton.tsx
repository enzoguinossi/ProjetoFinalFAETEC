"use client";

import Button from "@/components/Button";

/** A impressão é do próprio navegador (`window.print()`), com o CSS A4 do módulo. */
export default function ImprimirButton() {
  return (
    <Button
      label="Imprimir / Salvar PDF"
      onClick={() => window.print()}
    />
  );
}
