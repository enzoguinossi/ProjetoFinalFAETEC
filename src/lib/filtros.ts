/**
 * Texto de busca vindo do payload de uma Server Action: só `string` vira
 * filtro (número, objeto e array são ignorados), já sem espaços nas pontas.
 * Vazio ou só espaços → `undefined` (nenhum filtro).
 */
export function textoFiltro(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  return valor.trim() || undefined;
}
