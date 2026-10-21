import { notaSaidaDAO, STATUS_REMESSA_EDITAVEL } from "@/dao/nota-saida";
import type {
  NotaSaidaAtualizacao,
  NotaSaidaRemessaCriacao,
  RemessaItemAtualizacao,
} from "@/dao/nota-saida";

export type SaidaItemInput = {
  id_produto: number;
  quantidade_solicitada: number;
};

export type SaidaRemessaInput = {
  id_destinatario: number;
  id_funcionario_condutor?: number | null;
  id_veiculo?: number | null;
  urgente?: boolean;
  observacao?: string | null;
  itens: SaidaItemInput[];
};

export type SaidaInput = {
  observacao?: string | null;
  remessas: SaidaRemessaInput[];
};

/** Item da edição: com `id_item_remessa` = existente; sem = novo. */
export type SaidaItemAtualizacaoInput = SaidaItemInput & {
  id_item_remessa?: number | null;
};

export type AtualizacaoRemessaInput = Omit<SaidaRemessaInput, "itens"> & {
  itens: SaidaItemAtualizacaoInput[];
};

export type AtualizacaoNotaSaidaInput = {
  observacao?: string | null;
};

export type ResultadoSaida =
  | { nota: { id_nota_saida: number }; remessas: { id_remessa: number }[] }
  | { error: string };

export type ResultadoRemessa = { remessa: { id_remessa: number } } | { error: string };

export type ResultadoNotaSaida = { nota: { id_nota_saida: number } } | { error: string };

const ROTULOS_STATUS_REMESSA: Record<string, string> = {
  EM_PREPARACAO: "em preparação",
  PRONTO_PARA_ENTREGA: "pronta para entrega",
  EM_PERCURSO: "em percurso",
  PENDENTE: "pendente",
  FINALIZADO_TOTAL: "finalizada",
  FINALIZADO_PARCIAL: "finalizada parcialmente",
  CANCELADA: "cancelada",
};

function idPositivo(valor: unknown): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validarCabecalhoRemessa(
  input: Omit<SaidaRemessaInput, "itens">,
):
  | {
      id_destinatario: number;
      id_funcionario_condutor: number | null;
      id_veiculo: number | null;
      urgente: boolean;
      observacao: string | null;
    }
  | { error: string } {
  const idDestinatario = idPositivo(input.id_destinatario);
  if (!idDestinatario) {
    return { error: "Selecione o destinatário da remessa." };
  }

  const idCondutor =
    input.id_funcionario_condutor === null || input.id_funcionario_condutor === undefined
      ? null
      : idPositivo(input.id_funcionario_condutor);
  if (
    input.id_funcionario_condutor !== null &&
    input.id_funcionario_condutor !== undefined &&
    !idCondutor
  ) {
    return { error: "Condutor inválido na remessa." };
  }

  const idVeiculo =
    input.id_veiculo === null || input.id_veiculo === undefined
      ? null
      : idPositivo(input.id_veiculo);
  if (input.id_veiculo !== null && input.id_veiculo !== undefined && !idVeiculo) {
    return { error: "Veículo inválido na remessa." };
  }

  return {
    id_destinatario: idDestinatario,
    id_funcionario_condutor: idCondutor,
    id_veiculo: idVeiculo,
    urgente: input.urgente ?? false,
    observacao: input.observacao?.trim() || null,
  };
}

function validarItensRemessa(
  itens: SaidaItemAtualizacaoInput[],
): { itens: RemessaItemAtualizacao[] } | { error: string } {
  if (!Array.isArray(itens) || itens.length === 0) {
    return { error: "Informe ao menos um item na remessa." };
  }

  const validados: RemessaItemAtualizacao[] = [];
  for (const item of itens) {
    const idProduto = idPositivo(item.id_produto);
    if (!idProduto) {
      return { error: "Produto inválido em uma remessa." };
    }

    const idItem =
      item.id_item_remessa === null || item.id_item_remessa === undefined
        ? null
        : Number(item.id_item_remessa);
    if (idItem !== null && (!Number.isInteger(idItem) || idItem <= 0)) {
      return { error: "Item inválido na remessa." };
    }

    const quantidade = Number(item.quantidade_solicitada);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return { error: "A quantidade solicitada deve ser maior que zero." };
    }

    validados.push({ id_item_remessa: idItem, id_produto: idProduto, quantidade_solicitada: quantidade });
  }

  return { itens: validados };
}

export class NotaSaidaService {
  /**
   * Valida a nota de saída e grava nota, remessas, itens, reservas e auditoria
   * em uma única transação (via `notaSaidaDAO.create`). A reserva usa a
   * `quantidade_solicitada`; saldo insuficiente apenas avisa (RN001), nunca
   * bloqueia.
   */
  async registrar(input: SaidaInput, id_usuario: number): Promise<ResultadoSaida> {
    if (!Array.isArray(input.remessas) || input.remessas.length === 0) {
      return { error: "Informe ao menos uma remessa na nota de saída." };
    }

    const remessas: NotaSaidaRemessaCriacao[] = [];

    for (const remessa of input.remessas) {
      const idDestinatario = idPositivo(remessa.id_destinatario);
      if (!idDestinatario) {
        return { error: "Selecione o destinatário de cada remessa." };
      }

      const idCondutor =
        remessa.id_funcionario_condutor === null || remessa.id_funcionario_condutor === undefined
          ? null
          : idPositivo(remessa.id_funcionario_condutor);
      if (
        remessa.id_funcionario_condutor !== null &&
        remessa.id_funcionario_condutor !== undefined &&
        !idCondutor
      ) {
        return { error: "Condutor inválido na remessa." };
      }

      const idVeiculo =
        remessa.id_veiculo === null || remessa.id_veiculo === undefined
          ? null
          : idPositivo(remessa.id_veiculo);
      if (remessa.id_veiculo !== null && remessa.id_veiculo !== undefined && !idVeiculo) {
        return { error: "Veículo inválido na remessa." };
      }

      if (!Array.isArray(remessa.itens) || remessa.itens.length === 0) {
        return { error: "Informe ao menos um item em cada remessa." };
      }

      const produtos = new Set<number>();
      const itens = [];

      for (const item of remessa.itens) {
        const idProduto = idPositivo(item.id_produto);
        if (!idProduto) {
          return { error: "Produto inválido em uma remessa." };
        }
        if (produtos.has(idProduto)) {
          return { error: "O mesmo produto não pode aparecer mais de uma vez na mesma remessa." };
        }
        produtos.add(idProduto);

        const quantidade = Number(item.quantidade_solicitada);
        if (!Number.isFinite(quantidade) || quantidade <= 0) {
          return { error: "A quantidade solicitada deve ser maior que zero." };
        }

        itens.push({ id_produto: idProduto, quantidade_solicitada: quantidade });
      }

      remessas.push({
        id_destinatario: idDestinatario,
        id_funcionario_condutor: idCondutor,
        id_veiculo: idVeiculo,
        urgente: remessa.urgente ?? false,
        observacao: remessa.observacao?.trim() || null,
        itens,
      });
    }

    const resultado = await notaSaidaDAO.create(
      {
        observacao: input.observacao?.trim() || null,
        remessas,
      },
      id_usuario,
    );

    return {
      nota: { id_nota_saida: resultado.nota.id_nota_saida },
      remessas: resultado.remessas.map((r) => ({ id_remessa: r.id_remessa })),
    };
  }

  /**
   * Valida e aplica a edição de uma remessa: destinatário, condutor, veículo,
   * urgência, observação e `quantidade_solicitada` dos itens; acrescentar item
   * é permitido, remover é recusado (RN004). Só remessas em preparação ou
   * prontas para entrega são editáveis — finalizada/cancelada é histórico. A
   * correção da reserva (pelo delta) e a auditoria ficam no DAO, na mesma
   * transação.
   */
  async atualizarRemessa(
    id: number,
    input: AtualizacaoRemessaInput,
    id_usuario: number,
  ): Promise<ResultadoRemessa> {
    const idRemessa = idPositivo(id);
    if (!idRemessa) return { error: "Remessa inválida." };

    const cabecalho = validarCabecalhoRemessa(input);
    if ("error" in cabecalho) return cabecalho;

    const itens = validarItensRemessa(input.itens);
    if ("error" in itens) return itens;

    const existente = await notaSaidaDAO.getRemessa(idRemessa);
    if (!existente) return { error: "Remessa não encontrada." };

    if (!STATUS_REMESSA_EDITAVEL.includes(existente.status)) {
      const rotulo = ROTULOS_STATUS_REMESSA[existente.status] ?? existente.status;
      return {
        error: `Remessa ${rotulo} não pode ser editada. Só remessas em preparação ou prontas para entrega podem ser editadas; finalizadas e canceladas são histórico.`,
      };
    }

    const itensExistentes = new Map(
      existente.itens.map((item) => [item.id_item_remessa, item]),
    );
    const idsInformados = new Set<number>();
    for (const item of itens.itens) {
      if (item.id_item_remessa === null) continue;
      if (!itensExistentes.has(item.id_item_remessa)) {
        return { error: "Item inválido para esta remessa." };
      }
      idsInformados.add(item.id_item_remessa);
    }
    for (const idAtual of itensExistentes.keys()) {
      if (!idsInformados.has(idAtual)) {
        return { error: "Não é possível remover itens de uma remessa." };
      }
    }

    // O produto de um item existente é o gravado na remessa: a edição altera
    // apenas a quantidade solicitada, nunca o produto.
    const normalizados = itens.itens.map((item) => {
      if (item.id_item_remessa === null) return item;
      const atual = itensExistentes.get(item.id_item_remessa)!;
      return { ...item, id_produto: atual.estoque.produto.id_produto };
    });

    const produtos = new Set<number>();
    for (const item of normalizados) {
      if (produtos.has(item.id_produto)) {
        return { error: "O mesmo produto não pode aparecer mais de uma vez na mesma remessa." };
      }
      produtos.add(item.id_produto);
    }

    const remessa = await notaSaidaDAO.updateRemessa(
      idRemessa,
      { ...cabecalho, itens: normalizados },
      id_usuario,
    );

    return { remessa };
  }

  /**
   * Edita apenas a observação da nota de saída; as remessas são editadas
   * individualmente, cada uma com a sua própria reserva.
   */
  async atualizarNotaSaida(
    id: number,
    input: AtualizacaoNotaSaidaInput,
    id_usuario: number,
  ): Promise<ResultadoNotaSaida> {
    const idNota = idPositivo(id);
    if (!idNota) return { error: "Nota de saída inválida." };

    const data: NotaSaidaAtualizacao = {
      observacao: input.observacao?.trim() || null,
    };

    const nota = await notaSaidaDAO.updateNotaSaida(idNota, data, id_usuario);
    return { nota };
  }

  /**
   * Cancela a remessa e libera a reserva dos itens. A validação de estado
   * (só `EM_PREPARACAO`/`PRONTO_PARA_ENTREGA`) e a idempotência ficam na
   * transação do DAO — cancelar de novo é recusado sem debitar outra vez.
   */
  async cancelarRemessa(id_remessa: number, id_usuario: number) {
    const id = idPositivo(id_remessa);
    if (!id) return { error: "Remessa inválida." };

    return notaSaidaDAO.cancelarRemessa(id, id_usuario);
  }
}

export const notaSaidaService = new NotaSaidaService();
