import type { ListParams, OrdenacaoTabela } from "@/types";

/**
 * Próximo estado do ciclo de ordenação de uma coluna:
 * sem ordenação/direção diferente → `asc`; `asc` → `desc`; `desc` → sem
 * ordenação (o servidor volta ao padrão).
 */
export function proximaOrdenacao(
  atual: OrdenacaoTabela | null | undefined,
  campo: string,
): OrdenacaoTabela | null {
  if (!atual || atual.campo !== campo) return { campo, direcao: "asc" };
  if (atual.direcao === "asc") return { campo, direcao: "desc" };
  return null;
}

/**
 * Compara valores de uma coluna. Números por subtração, datas por timestamp e
 * strings com `localeCompare` pt-BR (numérico, sem diferenciar caixa/acento).
 * Nulos (`null`/`undefined`) ficam por último.
 */
export function compararValores(a: unknown, b: unknown): number {
  const aNulo = a === null || a === undefined;
  const bNulo = b === null || b === undefined;
  if (aNulo || bNulo) {
    if (aNulo && bNulo) return 0;
    return aNulo ? 1 : -1;
  }

  if (typeof a === "number" && typeof b === "number") return a - b;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  return String(a).localeCompare(String(b), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

/** Parâmetros de listagem correspondentes à ordenação (ou nenhum). */
export function paramsDeOrdenacao(
  ordem: OrdenacaoTabela | null | undefined,
): Pick<ListParams, "sort" | "dir"> {
  return ordem ? { sort: ordem.campo, dir: ordem.direcao } : {};
}
