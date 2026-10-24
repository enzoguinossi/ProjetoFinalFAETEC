import {
  expedicaoDAO,
  type EntregaItem,
  type ExpedicaoDados,
} from "@/dao/expedicao";
import { mensagemDeErro } from "@/dao/_errors";
import { hojeISO } from "@/lib/formatar";

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

function dataPrevista(valor: unknown): Date | "invalida" {
  // Vazio/nulo → hoje no fuso de São Paulo.
  if (valor === null || valor === undefined || valor === "") {
    return new Date(`${hojeISO()}T00:00:00.000Z`);
  }

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? "invalida" : valor;
  }

  const texto = String(valor).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return "invalida";

  const data = new Date(`${texto}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime())) return "invalida";
  // Rejeita datas que o JS normaliza (ex.: 2026-02-31 → 03/03).
  if (data.toISOString().slice(0, 10) !== texto) return "invalida";
  return data;
}

function textoOpcional(valor: unknown): string | null {
  const texto = String(valor ?? "").trim();
  return texto || null;
}

function booleano(valor: unknown): boolean {
  return valor === true || valor === "true" || valor === "on" || valor === 1;
}

function normalizarItensEntrega(
  valor: unknown,
): { itens: EntregaItem[] } | { error: string } {
  if (!Array.isArray(valor)) {
    return { error: "Itens da entrega inválidos." };
  }

  const vistos = new Set<number>();
  const itens: EntregaItem[] = [];

  for (const bruto of valor) {
    if (!bruto || typeof bruto !== "object") {
      return { error: "Item de entrega inválido." };
    }

    const registro = bruto as Record<string, unknown>;
    const idItem = idPositivo(registro.id_item_nota_saida);
    if (!idItem) return { error: "Item de entrega inválido." };
    if (vistos.has(idItem)) {
      return { error: "Cada item da nota deve ser informado uma única vez." };
    }
    vistos.add(idItem);

    const quantidade = Number(registro.qtd_entregue ?? 0);
    if (!Number.isFinite(quantidade) || quantidade < 0) {
      return { error: "Informe uma quantidade entregue válida." };
    }

    itens.push({ id_item_nota_saida: idItem, qtd_entregue: quantidade });
  }

  return { itens };
}

export class ExpedicaoService {
  /**
   * Valida e normaliza os campos da expedição. A data é aceita como
   * `YYYY-MM-DD` (valor do `<input type="date">`) e gravada como `Date`;
   * vazia vira hoje. Veículo e condutor são obrigatórios.
   */
  validar(
    input: ExpedicaoInput,
  ): { dados: ExpedicaoDados } | { error: string } {
    const data = dataPrevista(input.data_prevista);
    if (data === "invalida") return { error: "Data prevista inválida." };

    if (
      input.id_veiculo === null ||
      input.id_veiculo === undefined ||
      input.id_veiculo === ""
    ) {
      return { error: "Selecione o veículo." };
    }
    const idVeiculo = idPositivo(input.id_veiculo);
    if (!idVeiculo) return { error: "Veículo inválido." };

    if (
      input.id_funcionario_condutor === null ||
      input.id_funcionario_condutor === undefined ||
      input.id_funcionario_condutor === ""
    ) {
      return { error: "Selecione o condutor." };
    }
    const idCondutor = idPositivo(input.id_funcionario_condutor);
    if (!idCondutor) return { error: "Condutor inválido." };

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

  /**
   * Registra a entrega de uma nota em `EM_PERCURSO`. `qtd_entregue` é o total
   * por item (o DAO calcula o delta) e `cortar_restante` libera o que sobrou.
   */
  async registrarEntrega(
    id: number,
    id_nota_saida: number,
    input: { itens?: unknown; cortar_restante?: unknown },
    id_usuario: number,
  ) {
    const idExpedicao = idPositivo(id);
    if (!idExpedicao) return { error: "Expedição inválida." };

    const idNota = idPositivo(id_nota_saida);
    if (!idNota) return { error: "Nota de saída inválida." };

    const itens = normalizarItensEntrega(input.itens);
    if ("error" in itens) return itens;

    try {
      return {
        entrega: await expedicaoDAO.registrarEntrega(
          idExpedicao,
          idNota,
          itens.itens,
          booleano(input.cortar_restante),
          id_usuario,
        ),
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  }

  /** Atalho de "não entregue": zero entregue, sem corte e sem mexer no estoque. */
  async marcarNaoEntregue(
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
        entrega: await expedicaoDAO.marcarNaoEntregue(
          idExpedicao,
          idNota,
          id_usuario,
        ),
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  }

  /** Conclui a expedição em percurso (notas restantes viram pendentes). */
  async concluir(id: number, id_usuario: number) {
    const idExpedicao = idPositivo(id);
    if (!idExpedicao) return { error: "Expedição inválida." };

    try {
      return {
        expedicao: await expedicaoDAO.concluir(idExpedicao, id_usuario),
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
