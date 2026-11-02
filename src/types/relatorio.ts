/**
 * Tipos de exibição dos relatórios de cadastro no layout "ficha".
 *
 * São independentes do modelo do banco: o DAO entrega as linhas e os
 * adaptadores (`src/lib/fichas-relatorio.ts`) montam estes dados.
 */

/** Um par rótulo/valor dentro do corpo da ficha. */
export type CampoFicha = { rotulo: string; valor: string };

/** Código personalizado do cadastro com o rótulo do tipo. */
export type CodigoFicha = { tipo: string; codigo: string };

/** Um contato (e-mail ou telefone) listado na faixa "Contatos" da ficha. */
export type ContatoFicha = { valor: string; tipo?: string; principal: boolean };

/** Contatos completos do cadastro; `undefined` no bloco = filtro desligado. */
export type ContatosFicha = { emails: ContatoFicha[]; telefones: ContatoFicha[] };

export type FichaRelatorioDados = {
  /** Código exibido no sistema (ex.: `000123`). */
  codigo: string;
  titulo: string;
  situacao: "Ativo" | "Inativo";
  /** `undefined` = filtro de fotos desligado; `null` = filtro ligado, sem foto. */
  fotoUrl?: string | null;
  /** Cada linha vira um grid de colunas iguais. */
  linhas: CampoFicha[][];
  /** `undefined` = filtro de códigos desligado; lista vazia = sem códigos. */
  codigos?: CodigoFicha[];
  /** `undefined` = filtro de contatos desligado; lista vazia = sem contatos. */
  contatos?: ContatosFicha;
};
