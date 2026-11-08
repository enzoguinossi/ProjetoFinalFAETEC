/** Campo da barra de filtros, na parte que decide sua visibilidade. */
export type CampoVisivel = {
  id: string;
  tipo: "multi" | "periodo" | "checkbox";
  /** Checkbox de apresentação do relatório: sempre visível e sem remover. */
  fixo?: boolean;
};

/**
 * Regra de visibilidade dos chips da barra de filtros:
 * - checkbox `fixo` (apresentação do relatório) aparece sempre;
 * - os demais aparecem quando têm valor ou foram adicionados pelo usuário.
 */
export function campoVisivel(
  campo: CampoVisivel,
  temValor: boolean,
  adicionados: readonly string[],
): boolean {
  if (campo.tipo === "checkbox" && campo.fixo === true) return true;
  return temValor || adicionados.includes(campo.id);
}
