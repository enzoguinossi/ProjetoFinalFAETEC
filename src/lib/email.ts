export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarEmail(valor: string): string {
  return (valor ?? "").trim();
}

export function validarEmail(
  valor: string,
): { ok: true; endereco: string } | { ok: false; erro: string } {
  const endereco = normalizarEmail(valor);
  if (!endereco) return { ok: false, erro: "Informe um e-mail." };
  if (!EMAIL_RE.test(endereco)) return { ok: false, erro: `E-mail inválido: ${endereco}` };
  return { ok: true, endereco };
}
