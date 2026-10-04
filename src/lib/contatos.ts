import { TIPO_TELEFONE } from "@/types";
import type { TelefoneEntry } from "@/components/ContatosSection";

export function normalizaTelefones(
  t: { numero: string; tipo: string; principal: boolean }[] | undefined,
): TelefoneEntry[] {
  return (t ?? []).map((x) => ({
    numero: x.numero,
    tipo: (TIPO_TELEFONE.includes(x.tipo as never) ? x.tipo : "CELULAR") as TelefoneEntry["tipo"],
    principal: x.principal,
  }));
}
