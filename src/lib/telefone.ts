import type { TipoTelefone } from "@/types";

export const TELEFONE_MIN_DIGITOS = 10;
export const TELEFONE_MAX_DIGITOS = 11;
/** Comprimento máximo do valor formatado: "(00) 00000-0000". */
export const TELEFONE_MAX_CARACTERES = 15;

export const TIPO_TELEFONE_LABEL: Record<TipoTelefone, string> = {
  CELULAR: "Celular",
  FIXO: "Fixo",
  COMERCIAL: "Comercial",
};

export function apenasDigitosTelefone(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Formata progressivamente para (DD) XXXXX-XXXX / (DD) XXXX-XXXX.
 * Tolera entrada parcial (usado enquanto o usuário digita) e limita a
 * TELEFONE_MAX_DIGITOS dígitos.
 */
export function formatarTelefone(valor: string): string {
  const d = apenasDigitosTelefone(valor).slice(0, TELEFONE_MAX_DIGITOS);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Valida telefone brasileiro com DDD (TELEFONE_MIN_DIGITOS a
 * TELEFONE_MAX_DIGITOS dígitos) e retorna apenas os dígitos para persistência.
 */
export function validarTelefone(
  valor: string,
): { ok: true; numero: string } | { ok: false; erro: string } {
  const d = apenasDigitosTelefone(valor).slice(0, TELEFONE_MAX_DIGITOS);
  if (d.length === 0) return { ok: false, erro: "Informe o número do telefone." };
  if (d.length < TELEFONE_MIN_DIGITOS) {
    return {
      ok: false,
      erro: `Telefone deve conter DDD + número (${TELEFONE_MIN_DIGITOS} ou ${TELEFONE_MAX_DIGITOS} dígitos).`,
    };
  }
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return { ok: false, erro: "DDD inválido." };
  }
  return { ok: true, numero: d };
}
