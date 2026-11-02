export const CEP_MAX_CARACTERES = 9;

/** Somente os 8 dígitos do CEP (o banco guarda sem pontuação). */
export function apenasDigitosCep(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Formata progressivamente para `00000-000`, tolerando entrada parcial
 * enquanto o usuário digita e limitando a 8 dígitos.
 */
export function formatarCep(valor: string): string {
  const digitos = apenasDigitosCep(valor).slice(0, 8);
  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

/** Valida um CEP de 8 dígitos e devolve apenas os dígitos. */
export function validarCep(
  valor: string,
): { ok: true; cep: string } | { ok: false; erro: string } {
  const cep = apenasDigitosCep(valor);
  if (cep.length !== 8) {
    return { ok: false, erro: "CEP deve conter 8 dígitos." };
  }
  return { ok: true, cep };
}
