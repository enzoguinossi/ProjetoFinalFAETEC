export const CPF_DIGITOS = 11;
/** Comprimento máximo do valor formatado: "000.000.000-00". */
export const CPF_MAX_CARACTERES = 14;

export function apenasDigitosCpf(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Formata progressivamente para 000.000.000-00.
 * Tolera entrada parcial (usado enquanto o usuário digita) e limita a
 * CPF_DIGITOS dígitos.
 */
export function formatarCpf(valor: string): string {
  const d = apenasDigitosCpf(valor).slice(0, CPF_DIGITOS);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function digitoVerificador(digitos: string): number {
  const soma = digitos
    .split("")
    .reduce((acc, digito, indice) => acc + Number(digito) * (digitos.length + 1 - indice), 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Valida CPF brasileiro (11 dígitos, sem sequências repetidas e com dígitos
 * verificadores corretos) e retorna apenas os dígitos para persistência.
 */
export function validarCpf(
  valor: string,
): { ok: true; cpf: string } | { ok: false; erro: string } {
  const d = apenasDigitosCpf(valor);
  if (d.length === 0) return { ok: false, erro: "Informe o CPF." };
  if (d.length !== CPF_DIGITOS) {
    return { ok: false, erro: "CPF deve conter 11 dígitos." };
  }
  if (/^(\d)\1{10}$/.test(d)) {
    return { ok: false, erro: "CPF inválido." };
  }
  const dv1 = digitoVerificador(d.slice(0, 9));
  const dv2 = digitoVerificador(d.slice(0, 10));
  if (d !== `${d.slice(0, 9)}${dv1}${dv2}`) {
    return { ok: false, erro: "CPF inválido." };
  }
  return { ok: true, cpf: d };
}
