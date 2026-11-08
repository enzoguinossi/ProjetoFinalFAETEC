/** Opções do chip Situação dos cadastros (mesma semântica dos produtos). */
export const OPCOES_SITUACAO = [
  { valor: "ativo", rotulo: "Ativos" },
  { valor: "inativo", rotulo: "Inativos" },
];

export type SituacaoFiltro = string[] | { de: string; ate: string } | undefined;

/**
 * Traduz o chip Situação para o filtro do DAO:
 * nada → `undefined` (default: só ativos), só Ativos → `true`,
 * só Inativos → `false`, ambos → `null` (todos).
 */
export function situacaoParaAtivo(
  valores: SituacaoFiltro,
): boolean | null | undefined {
  if (!Array.isArray(valores) || valores.length === 0) return undefined;
  const soAtivos = valores.includes("ativo") && !valores.includes("inativo");
  const soInativos = valores.includes("inativo") && !valores.includes("ativo");
  return soAtivos ? true : soInativos ? false : null;
}
