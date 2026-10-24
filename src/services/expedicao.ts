import { expedicaoDAO, type ExpedicaoDados } from "@/dao/expedicao";
import { mensagemDeErro } from "@/dao/_errors";

export type ExpedicaoInput = {
  data_prevista?: unknown;
  observacao?: unknown;
  id_veiculo?: unknown;
  id_funcionario_condutor?: unknown;
  id_percurso?: unknown;
};

function idPositivo(valor: unknown): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function idOpcional(valor: unknown): number | null | "invalido" {
  if (valor === null || valor === undefined || valor === "") return null;
  const id = idPositivo(valor);
  return id ?? "invalido";
}

function dataOpcional(valor: unknown): Date | null | "invalida" {
  if (valor === null || valor === undefined || valor === "") return null;

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? "invalida" : valor;
  }

  const texto = String(valor).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return "invalida";

  const data = new Date(`${texto}T00:00:00.000Z`);
  return Number.isNaN(data.getTime()) ? "invalida" : data;
}

function textoOpcional(valor: unknown): string | null {
  const texto = String(valor ?? "").trim();
  return texto || null;
}

export class ExpedicaoService {
  /**
   * Valida e normaliza os campos da expedição. A data é aceita como
   * `YYYY-MM-DD` (valor do `<input type="date">`) e gravada como `Date`.
   */
  validar(
    input: ExpedicaoInput,
  ): { dados: ExpedicaoDados } | { error: string } {
    const data = dataOpcional(input.data_prevista);
    if (data === "invalida") return { error: "Data prevista inválida." };

    const idVeiculo = idOpcional(input.id_veiculo);
    if (idVeiculo === "invalido") return { error: "Veículo inválido." };

    const idCondutor = idOpcional(input.id_funcionario_condutor);
    if (idCondutor === "invalido") return { error: "Condutor inválido." };

    const idPercurso = idOpcional(input.id_percurso);
    if (idPercurso === "invalido") return { error: "Percurso inválido." };

    return {
      dados: {
        data_prevista: data,
        observacao: textoOpcional(input.observacao),
        id_veiculo: idVeiculo,
        id_funcionario_condutor: idCondutor,
        id_percurso: idPercurso,
      },
    };
  }

  async criar(input: ExpedicaoInput, id_usuario: number) {
    const validado = this.validar(input);
    if ("error" in validado) return validado;

    try {
      return {
        expedicao: await expedicaoDAO.create(validado.dados, id_usuario),
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  }

  async alterar(id: number, input: ExpedicaoInput, id_usuario: number) {
    const idExpedicao = idPositivo(id);
    if (!idExpedicao) return { error: "Expedição inválida." };

    const validado = this.validar(input);
    if ("error" in validado) return validado;

    try {
      return {
        expedicao: await expedicaoDAO.update(
          idExpedicao,
          validado.dados,
          id_usuario,
        ),
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  }

  async adicionarNota(
    id: number,
    id_nota_saida: number,
    id_usuario: number,
  ) {
    const idExpedicao = idPositivo(id);
    if (!idExpedicao) return { error: "Expedição inválida." };

    const idNota = idPositivo(id_nota_saida);
    if (!idNota) return { error: "Nota de saída inválida." };

    try {
      return {
        expedicao: await expedicaoDAO.adicionarNota(
          idExpedicao,
          idNota,
          id_usuario,
        ),
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  }

  async removerNota(
    id: number,
    id_nota_saida: number,
    id_usuario: number,
  ) {
    const idExpedicao = idPositivo(id);
    if (!idExpedicao) return { error: "Expedição inválida." };

    const idNota = idPositivo(id_nota_saida);
    if (!idNota) return { error: "Nota de saída inválida." };

    try {
      return {
        expedicao: await expedicaoDAO.removerNota(
          idExpedicao,
          idNota,
          id_usuario,
        ),
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  }

  async moverOrdem(id: number, ordem: number[], id_usuario: number) {
    const idExpedicao = idPositivo(id);
    if (!idExpedicao) return { error: "Expedição inválida." };

    if (!Array.isArray(ordem) || ordem.length === 0) {
      return { error: "Informe a nova ordem das notas." };
    }

    const normalizada: number[] = [];
    for (const item of ordem) {
      const idNota = idPositivo(item);
      if (!idNota) return { error: "Ordem de notas inválida." };
      normalizada.push(idNota);
    }

    if (new Set(normalizada).size !== normalizada.length) {
      return { error: "A ordem não pode repetir notas." };
    }

    try {
      return {
        expedicao: await expedicaoDAO.moverOrdem(
          idExpedicao,
          normalizada,
          id_usuario,
        ),
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  }

  async despachar(id: number, id_usuario: number) {
    const idExpedicao = idPositivo(id);
    if (!idExpedicao) return { error: "Expedição inválida." };

    try {
      return {
        expedicao: await expedicaoDAO.despachar(idExpedicao, id_usuario),
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  }

  async desativar(id: number, id_usuario: number) {
    const idExpedicao = idPositivo(id);
    if (!idExpedicao) return { error: "Expedição inválida." };

    try {
      return {
        expedicao: await expedicaoDAO.desativar(idExpedicao, id_usuario),
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  }
}

export const expedicaoService = new ExpedicaoService();
