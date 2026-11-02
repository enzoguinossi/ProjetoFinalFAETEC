export function formatarCodigo(id: number): string {
  return String(id).padStart(6, "0");
}

/** Quantidade exibida nos relatórios: decimal com vírgula, até 3 casas, sem unidade. */
export function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** Contagem com o singular/plural correto: `1 produto`, `2 produtos`. */
export function contagem(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Data de hoje (`YYYY-MM-DD`) no fuso de São Paulo. Não use `toISOString()`
 * puro para isso: à noite ele devolve o dia seguinte em UTC.
 */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
