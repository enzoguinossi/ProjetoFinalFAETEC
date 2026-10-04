import { TIPO_TELEFONE } from "@/types";
import type { TelefoneEntry } from "@/components/ContatosSection";
import { apenasDigitosTelefone } from "@/lib/telefone";

export function normalizaTelefones(
  t: { numero: string; tipo: string; principal: boolean }[] | undefined,
): TelefoneEntry[] {
  return (t ?? []).map((x) => ({
    numero: apenasDigitosTelefone(x.numero),
    tipo: (TIPO_TELEFONE.includes(x.tipo as never) ? x.tipo : "CELULAR") as TelefoneEntry["tipo"],
    principal: x.principal,
  }));
}
