"use client";

import Button from "@/components/Button";

export default function ImprimirButton() {
  return <Button label="Imprimir / Salvar PDF" onClick={() => window.print()} />;
}
