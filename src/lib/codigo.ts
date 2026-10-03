export const TIPOS_CODIGO = [
  "DIGITACAO",
  "EAN12",
  "EAN13",
  "COD_FORNECEDOR",
  "COD_ESCOLA",
  "MATRICULA",
] as const;

export type NomeTipoCodigo = (typeof TIPOS_CODIGO)[number];

export const ENTIDADES_CODIGO = [
  "PRODUTO",
  "DESTINATARIO",
  "FUNCIONARIO",
  "FORNECEDOR",
  "VEICULO",
] as const;

export type EntidadeCodigo = (typeof ENTIDADES_CODIGO)[number];

export const TIPOS_POR_ENTIDADE: Record<EntidadeCodigo, NomeTipoCodigo[]> = {
  PRODUTO: ["DIGITACAO", "EAN12", "EAN13", "COD_FORNECEDOR"],
  DESTINATARIO: ["DIGITACAO", "COD_ESCOLA"],
  FUNCIONARIO: ["DIGITACAO", "MATRICULA"],
  FORNECEDOR: ["DIGITACAO"],
  VEICULO: ["DIGITACAO"],
};

export type CodigoInput = { id_tipo_codigo: number; codigo: string };

export function tiposPermitidosPara(entidade: EntidadeCodigo): NomeTipoCodigo[] {
  return TIPOS_POR_ENTIDADE[entidade];
}

export function tipoPermitido(entidade: EntidadeCodigo, nome: string): boolean {
  return (TIPOS_POR_ENTIDADE[entidade] as readonly string[]).includes(nome);
}

export type ResultadoValidacaoCodigo =
  | { ok: true; valor: string }
  | { ok: false; erro: string };

/**
 * Valida o valor de um código conforme o tipo.
 * EAN12/EAN13: apenas dígitos, com exatamente 12/13 caracteres.
 * Demais tipos: texto livre (trim + não vazio).
 */
export function validarCodigo(
  nome: string,
  valor: string,
): ResultadoValidacaoCodigo {
  const codigo = (valor ?? "").trim();
  if (!codigo) return { ok: false, erro: "Código é obrigatório." };

  if (nome === "EAN12" || nome === "EAN13") {
    const tamanho = nome === "EAN12" ? 12 : 13;
    if (!new RegExp(`^\\d{${tamanho}}$`).test(codigo)) {
      return {
        ok: false,
        erro: `${nome} deve conter exatamente ${tamanho} dígitos numéricos.`,
      };
    }
  }

  return { ok: true, valor: codigo };
}
