import type { DirecaoOrdenacao, ListParams } from "@/types";

/**
 * Converte `params.sort`/`params.dir` em um `orderBy` do Prisma usando uma
 * **whitelist**. O mapa é a única fonte de campos ordenáveis: um `sort` fora
 * dele (inclusive chaves herdadas como `constructor`) cai no `padrao`.
 *
 * Percorre objetos e arrays aninhados trocando as folhas `"asc"`/`"desc"` pela
 * direção pedida (padrão `asc`). O DAO deve acrescentar o desempate pelo ID
 * separadamente, fora do mapa.
 */
export function ordenarPor<T>(
  params: Pick<ListParams, "sort" | "dir">,
  mapa: Record<string, T>,
  padrao: T,
): T {
  const campo = typeof params.sort === "string" ? params.sort : "";
  if (!campo || !Object.prototype.hasOwnProperty.call(mapa, campo)) return padrao;

  const direcao: DirecaoOrdenacao = params.dir === "desc" ? "desc" : "asc";
  return trocarDirecao(mapa[campo], direcao) as T;
}

/** Troca recursivamente toda folha de direção pela direção pedida. */
function trocarDirecao(valor: unknown, direcao: DirecaoOrdenacao): unknown {
  if (valor === "asc" || valor === "desc") return direcao;
  if (Array.isArray(valor)) {
    return valor.map((item) => trocarDirecao(item, direcao));
  }
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([chave, item]) => [
        chave,
        trocarDirecao(item, direcao),
      ]),
    );
  }
  return valor;
}
