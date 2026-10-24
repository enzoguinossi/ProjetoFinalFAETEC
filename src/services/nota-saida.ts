import {
  notaSaidaDAO,
  STATUS_NOTA_SAIDA_EDITAVEL,
  type NotaSaidaAtualizacao,
  type NotaSaidaCriacao,
  type NotaSaidaItemAtualizacao,
} from "@/dao/nota-saida";

export type SaidaItemInput = {
  id_produto: number;
  quantidade_solicitada: number;
};

/** Tipos que o formulário de saída aceita. `DESMONTAGEM` tem fluxo próprio. */
export type TipoSaida = "SAIDA" | "AVARIA" | "CONSUMO_INTERNO";

const TIPOS_SAIDA: TipoSaida[] = ["SAIDA", "AVARIA", "CONSUMO_INTERNO"];

/** Nota de saída: a entrega leva destinatário, urgência, observação e itens. */
export type SaidaInput = {
  tipo: TipoSaida;
  /** Obrigatório só em `SAIDA`; avaria/consumo interno não têm destinatário. */
  id_destinatario?: number | null;
  urgente?: boolean;
  observacao?: string | null;
  itens: SaidaItemInput[];
};

/** Item da edição: com `id_item_nota_saida` = existente; sem = novo. */
export type SaidaItemAtualizacaoInput = SaidaItemInput & {
  id_item_nota_saida?: number | null;
};

export type AtualizacaoNotaSaidaInput = {
  id_destinatario: number;
  urgente?: boolean;
  observacao?: string | null;
  itens: SaidaItemAtualizacaoInput[];
};

export type ResultadoSaida =
  | { nota: { id_nota_saida: number }; aviso: string | null }
  | { error: string };

export type ResultadoNotaSaida = { nota: { id_nota_saida: number } } | { error: string };

const ROTULOS_STATUS_NOTA_SAIDA: Record<string, string> = {
  ABERTA: "aberta",
  EM_PERCURSO: "em percurso",
  PENDENTE: "pendente",
  BAIXA_TOTAL: "com baixa total",
  BAIXA_PARCIAL: "com baixa parcial",
  BAIXA_COM_CORTE: "com baixa e corte",
  CANCELADA: "cancelada",
};

function idPositivo(valor: unknown): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validarItens(
  itens: SaidaItemAtualizacaoInput[],
): { itens: NotaSaidaItemAtualizacao[] } | { error: string } {
  if (!Array.isArray(itens) || itens.length === 0) {
    return { error: "Informe ao menos um item na nota de saída." };
  }

  const validados: NotaSaidaItemAtualizacao[] = [];
  for (const item of itens) {
    const idProduto = idPositivo(item.id_produto);
    if (!idProduto) {
      return { error: "Produto inválido em uma nota de saída." };
    }

    const idItem =
      item.id_item_nota_saida === null || item.id_item_nota_saida === undefined
        ? null
        : Number(item.id_item_nota_saida);
    if (idItem !== null && (!Number.isInteger(idItem) || idItem <= 0)) {
      return { error: "Item inválido na nota de saída." };
    }

    const quantidade = Number(item.quantidade_solicitada);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return { error: "A quantidade solicitada deve ser maior que zero." };
    }

    validados.push({
      id_item_nota_saida: idItem,
      id_produto: idProduto,
      quantidade_solicitada: quantidade,
    });
  }

  return { itens: validados };
}

/** Produtos não podem repetir dentro da mesma nota. */
function produtosUnicos(itens: { id_produto: number }[]): string | null {
  const produtos = new Set<number>();
  for (const item of itens) {
    if (produtos.has(item.id_produto)) {
      return "O mesmo produto não pode aparecer mais de uma vez na mesma nota de saída.";
    }
    produtos.add(item.id_produto);
  }
  return null;
}

export class NotaSaidaService {
  /**
   * Valida a nota de saída e grava nota, itens, reservas/baixas e auditoria em
   * uma única transação (via `notaSaidaDAO.create`). Em `SAIDA` (Remessa) a
   * reserva usa a `quantidade_solicitada`; `AVARIA` e `CONSUMO_INTERNO` não
   * reservam: dão baixa real em `quantidade_atual` na criação. Saldo
   * insuficiente apenas avisa (RN001), nunca bloqueia.
   */
  async registrar(input: SaidaInput, id_usuario: number): Promise<ResultadoSaida> {
    const tipo = input.tipo;
    if (!TIPOS_SAIDA.includes(tipo)) {
      return { error: "Tipo de saída inválido." };
    }

    const ehRemessa = tipo === "SAIDA";
    const idDestinatario = ehRemessa ? idPositivo(input.id_destinatario) : null;
    if (ehRemessa && !idDestinatario) {
      return { error: "Selecione o destinatário da nota de saída." };
    }

    const itens = validarItens(input.itens ?? []);
    if ("error" in itens) return itens;

    const repetido = produtosUnicos(itens.itens);
    if (repetido) return { error: repetido };

    const data: NotaSaidaCriacao = {
      tipo,
      id_destinatario: idDestinatario,
      urgente: ehRemessa ? (input.urgente ?? false) : false,
      observacao: input.observacao?.trim() || null,
      itens: itens.itens.map((item) => ({
        id_produto: item.id_produto,
        quantidade_solicitada: item.quantidade_solicitada,
      })),
    };

    const resultado = await notaSaidaDAO.create(data, id_usuario);

    return {
      nota: { id_nota_saida: resultado.nota.id_nota_saida },
      aviso: resultado.aviso,
    };
  }

  /**
   * Valida e aplica a edição de uma nota aberta: destinatário, urgência,
   * observação e `quantidade_solicitada` dos itens; acrescentar item é
   * permitido, remover é recusado (RN004). Só notas `ABERTA` são editáveis —
   * finalizada/cancelada é histórico. A correção da reserva (pelo delta) e a
   * auditoria ficam no DAO, na mesma transação.
   */
  async atualizar(
    id: number,
    input: AtualizacaoNotaSaidaInput,
    id_usuario: number,
  ): Promise<ResultadoNotaSaida> {
    const idNota = idPositivo(id);
    if (!idNota) return { error: "Nota de saída inválida." };

    const idDestinatario = idPositivo(input.id_destinatario);
    if (!idDestinatario) {
      return { error: "Selecione o destinatário da nota de saída." };
    }

    const itens = validarItens(input.itens ?? []);
    if ("error" in itens) return itens;

    const repetido = produtosUnicos(itens.itens);
    if (repetido) return { error: repetido };

    const existente = await notaSaidaDAO.getNotaSaida(idNota);
    if (!existente) return { error: "Nota de saída não encontrada." };

    if (existente.tipo !== "SAIDA") {
      return {
        error:
          "Notas de avaria e consumo interno são histórico e não podem ser editadas (RN004).",
      };
    }

    if (!STATUS_NOTA_SAIDA_EDITAVEL.includes(existente.status)) {
      const rotulo = ROTULOS_STATUS_NOTA_SAIDA[existente.status] ?? existente.status;
      return {
        error: `Nota de saída ${rotulo} não pode ser editada. Só notas abertas podem ser editadas; finalizadas e canceladas são histórico.`,
      };
    }

    const itensExistentes = new Map(
      existente.itens.map((item) => [item.id_item_nota_saida, item]),
    );
    const idsInformados = new Set<number>();
    for (const item of itens.itens) {
      if (item.id_item_nota_saida === null) continue;
      if (!itensExistentes.has(item.id_item_nota_saida)) {
        return { error: "Item inválido para esta nota de saída." };
      }
      idsInformados.add(item.id_item_nota_saida);
    }
    for (const idAtual of itensExistentes.keys()) {
      if (!idsInformados.has(idAtual)) {
        return { error: "Não é possível remover itens de uma nota de saída." };
      }
    }

    // O produto de um item existente é o gravado na nota: a edição altera
    // apenas a quantidade solicitada, nunca o produto.
    const normalizados = itens.itens.map((item) => {
      if (item.id_item_nota_saida === null) return item;
      const atual = itensExistentes.get(item.id_item_nota_saida)!;
      return { ...item, id_produto: atual.estoque.produto.id_produto };
    });

    const repetidoNormalizado = produtosUnicos(normalizados);
    if (repetidoNormalizado) return { error: repetidoNormalizado };

    const data: NotaSaidaAtualizacao = {
      id_destinatario: idDestinatario,
      urgente: input.urgente ?? false,
      observacao: input.observacao?.trim() || null,
      itens: normalizados,
    };

    const nota = await notaSaidaDAO.updateNotaSaida(idNota, data, id_usuario);
    return { nota };
  }

  /**
   * Cancela a nota e libera a reserva dos itens. A validação de estado (só
   * `ABERTA`) e a idempotência ficam na transação do DAO — cancelar de novo é
   * recusado sem debitar outra vez.
   */
  async cancelar(id: number, id_usuario: number) {
    const idNota = idPositivo(id);
    if (!idNota) return { error: "Nota de saída inválida." };

    return notaSaidaDAO.cancelarNotaSaida(idNota, id_usuario);
  }
}

export const notaSaidaService = new NotaSaidaService();
