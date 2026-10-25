export const CNPJ_DIGITOS = 14;
/** Comprimento máximo do valor formatado: "00.000.000/0000-00". */
export const CNPJ_MAX_CARACTERES = 18;

export function apenasDigitosCnpj(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Formata progressivamente para 00.000.000/0000-00.
 * Tolera entrada parcial (usado enquanto o usuário digita) e limita a
 * CNPJ_DIGITOS dígitos.
 */
export function formatarCnpj(valor: string): string {
  const d = apenasDigitosCnpj(valor).slice(0, CNPJ_DIGITOS);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function digitoVerificador(digitos: string): number {
  const pesos =
    digitos.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = digitos
    .split("")
    .reduce((acc, digito, indice) => acc + Number(digito) * pesos[indice], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Valida CNPJ brasileiro (14 dígitos, sem sequências repetidas e com dígitos
 * verificadores corretos) e retorna apenas os dígitos para persistência.
 */
export function validarCnpj(
  valor: string,
): { ok: true; cnpj: string } | { ok: false; erro: string } {
  const d = apenasDigitosCnpj(valor);
  if (d.length === 0) return { ok: false, erro: "Informe o CNPJ." };
  if (d.length !== CNPJ_DIGITOS) {
    return { ok: false, erro: "CNPJ deve conter 14 dígitos." };
  }
  if (/^(\d)\1{13}$/.test(d)) {
    return { ok: false, erro: "CNPJ inválido." };
  }
  const dv1 = digitoVerificador(d.slice(0, 12));
  const dv2 = digitoVerificador(d.slice(0, 13));
  if (d !== `${d.slice(0, 12)}${dv1}${dv2}`) {
    return { ok: false, erro: "CNPJ inválido." };
  }
  return { ok: true, cnpj: d };
}
