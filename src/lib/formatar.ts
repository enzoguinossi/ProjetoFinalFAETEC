export function formatarCodigo(id: number): string {
  return String(id).padStart(6, "0");
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
