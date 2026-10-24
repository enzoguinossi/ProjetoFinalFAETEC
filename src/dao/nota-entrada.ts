import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";
import { buildPagination, type PaginationParams } from "@/types";
import { estoqueDAO } from "./estoque";

export type NotaEntradaItemCriacao = {
  id_produto: number;
  fator_conversao: number;
  quantidade: number;
  quantidade_convertida: number;
  observacao?: string | null;
};

export type NotaEntradaCriacao = {
  id_fornecedor: number | null;
  data_recebimento: Date | null;
  observacao: string | null;
  chave_acesso: string | null;
  itens: NotaEntradaItemCriacao[];
};

export type NotaEntradaItemAtualizacao = {
  /** `null`/ausente = item novo (acrescentado na edição). */
  id_item_nota_entrada: number | null;
  id_produto: number;
  fator_conversao: number;
  quantidade: number;
  quantidade_convertida: number;
  observacao?: string | null;
};

export type NotaEntradaAtualizacao = {
  id_fornecedor: number | null;
  data_recebimento: Date | null;
  observacao: string | null;
  chave_acesso: string | null;
  itens: NotaEntradaItemAtualizacao[];
};

const AUDIT_ENTIDADE = "NotaEntrada";

/** Snapshot da nota usado na auditoria (antes e depois da edição). */
function snapshotNota(
  nota: {
    id_fornecedor: number | null;
    data_recebimento: Date | null;
    observacao: string | null;
    chave_acesso: string | null;
  },
  itens: {
    id_item_nota_entrada?: number | null;
    id_produto: number;
    fator_conversao: number;
    quantidade: number;
    quantidade_convertida: number;
  }[],
) {
  return {
    id_fornecedor: nota.id_fornecedor,
    data_recebimento: nota.data_recebimento?.toISOString() ?? null,
    observacao: nota.observacao,
    chave_acesso: nota.chave_acesso,
    itens: itens.map((item) => ({
      id_item_nota_entrada: item.id_item_nota_entrada,
      id_produto: item.id_produto,
      fator_conversao: item.fator_conversao,
      quantidade: item.quantidade,
      quantidade_convertida: item.quantidade_convertida,
    })),
  };
}

export class NotaEntradaDAO {
  /** Notas de entrada (tipo ENTRADA), da mais recente para a mais antiga. */
  async list(params: PaginationParams = {}) {
    const { skip, take } = buildPagination(params);
    const where = { ativo: true, tipo: "ENTRADA" as const };

    const [data, total] = await Promise.all([
      prisma.notaEntrada.findMany({
        skip,
        take,
        where,
        include: {
          fornecedor: {
            select: { pessoaJuridica: { select: { razao_social: true } } },
          },
          itens: { select: { id_item_nota_entrada: true } },
        },
        orderBy: { data_criacao: "desc" },
      }),
      prisma.notaEntrada.count({ where }),
    ]);

    return {
      data,
      total,
      page: params.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /** Nota de entrada com fornecedor, itens e o produto de cada item. */
  async getById(id: number) {
    return prisma.notaEntrada.findFirst({
      where: { id_nota_entrada: id, tipo: "ENTRADA", ativo: true },
      include: {
        fornecedor: {
          select: {
            id_fornecedor: true,
            pessoaJuridica: { select: { razao_social: true, cnpj: true } },
          },
        },
        itens: {
          include: { produto: { select: { id_produto: true, descricao: true } } },
          orderBy: { id_item_nota_entrada: "asc" },
        },
      },
    });
  }

  /**
   * Atualiza o cabeçalho da nota e seus itens em uma única transação. Para cada
   * item alterado, a diferença de `quantidade_convertida` vira uma movimentação
   * de estoque corretiva (`saldo_anterior`/`saldo_posterior`), podendo ser
   * negativa; itens novos entram como entrada cheia. Remover item é recusado —
   * não há estado de "item excluído" e apagar perderia a rastreabilidade
   * (RN004). Qualquer falha desfaz tudo.
   */
  async update(id: number, data: NotaEntradaAtualizacao, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.notaEntrada.findFirst({
        where: { id_nota_entrada: id, tipo: "ENTRADA", ativo: true },
        include: { itens: { orderBy: { id_item_nota_entrada: "asc" } } },
      });
      if (!atual) throw new Error("Nota de entrada não encontrada.");

      const itensAtuais = new Map(
        atual.itens.map((item) => [item.id_item_nota_entrada, item]),
      );
      const idsInformados = new Set<number>();

      for (const item of data.itens) {
        if (item.id_item_nota_entrada === null) continue;
        if (!itensAtuais.has(item.id_item_nota_entrada)) {
          throw new Error("Item não pertence a esta nota de entrada.");
        }
        idsInformados.add(item.id_item_nota_entrada);
      }
      for (const idAtual of itensAtuais.keys()) {
        if (!idsInformados.has(idAtual)) {
          throw new Error("Não é possível remover itens de uma nota de entrada.");
        }
      }

      await tx.notaEntrada.update({
        where: { id_nota_entrada: id },
        data: {
          id_fornecedor: data.id_fornecedor,
          data_recebimento: data.data_recebimento,
          observacao: data.observacao,
          chave_acesso: data.chave_acesso,
        },
      });

      const itensGravados: NotaEntradaItemAtualizacao[] = [];

      for (const item of data.itens) {
        const anterior =
          item.id_item_nota_entrada === null
            ? null
            : itensAtuais.get(item.id_item_nota_entrada)!;

        if (anterior) {
          await tx.itemNotaEntrada.update({
            where: { id_item_nota_entrada: anterior.id_item_nota_entrada },
            data: {
              fator_conversao: item.fator_conversao,
              quantidade: item.quantidade,
              quantidade_convertida: item.quantidade_convertida,
              observacao: item.observacao ?? null,
            },
          });
        } else {
          const criado = await tx.itemNotaEntrada.create({
            data: {
              id_nota_entrada: id,
              id_produto: item.id_produto,
              fator_conversao: item.fator_conversao,
              quantidade: item.quantidade,
              quantidade_convertida: item.quantidade_convertida,
              observacao: item.observacao ?? null,
            },
          });
          item.id_item_nota_entrada = criado.id_item_nota_entrada;
        }

        const convertidaAnterior = anterior
          ? Number(anterior.quantidade_convertida)
          : 0;
        const delta = item.quantidade_convertida - convertidaAnterior;
        // Item existente mantém o produto gravado: a edição só corrige fator e
        // quantidade.
        const idProduto = anterior?.id_produto ?? item.id_produto;

        if (delta !== 0) {
          await estoqueDAO.registrarEntrada(
            {
              id_produto: idProduto,
              id_usuario,
              id_nota_entrada: id,
              quantidade: delta,
              data_entrada: data.data_recebimento ?? new Date(),
              observacao: data.observacao,
            },
            tx,
          );
        }

        itensGravados.push({
          id_item_nota_entrada:
            anterior?.id_item_nota_entrada ?? item.id_item_nota_entrada,
          id_produto: idProduto,
          fator_conversao: item.fator_conversao,
          quantidade: item.quantidade,
          quantidade_convertida: item.quantidade_convertida,
        });
      }

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        snapshotNota(atual, atual.itens),
        snapshotNota(data, itensGravados),
        tx,
      );

      return { id_nota_entrada: id };
    });
  }

  /**
   * Cria a nota de entrada com a chave de acesso (opcional), itens, atualização
   * de estoque e movimentações em uma única transação. Qualquer falha desfaz tudo.
   */
  async create(data: NotaEntradaCriacao, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const nota = await tx.notaEntrada.create({
        data: {
          id_fornecedor: data.id_fornecedor,
          data_criacao: new Date(),
          tipo: "ENTRADA",
          data_recebimento: data.data_recebimento,
          observacao: data.observacao,
          chave_acesso: data.chave_acesso,
        },
      });

      const itensGravados: {
        id_produto: number;
        fator_conversao: number;
        quantidade: number;
        quantidade_convertida: number;
      }[] = [];

      for (const item of data.itens) {
        await tx.itemNotaEntrada.create({
          data: {
            id_nota_entrada: nota.id_nota_entrada,
            id_produto: item.id_produto,
            fator_conversao: item.fator_conversao,
            quantidade: item.quantidade,
            quantidade_convertida: item.quantidade_convertida,
            observacao: item.observacao ?? null,
          },
        });

        await estoqueDAO.registrarEntrada(
          {
            id_produto: item.id_produto,
            id_usuario,
            id_nota_entrada: nota.id_nota_entrada,
            quantidade: item.quantidade_convertida,
            data_entrada: data.data_recebimento ?? new Date(),
            observacao: data.observacao,
          },
          tx,
        );

        itensGravados.push({
          id_produto: item.id_produto,
          fator_conversao: item.fator_conversao,
          quantidade: item.quantidade,
          quantidade_convertida: item.quantidade_convertida,
        });
      }

      await registrarAuditoria(
        id_usuario,
        "CRIAR",
        AUDIT_ENTIDADE,
        nota.id_nota_entrada,
        null,
        {
          id_fornecedor: data.id_fornecedor,
          data_recebimento: data.data_recebimento?.toISOString() ?? null,
          observacao: data.observacao,
          chave_acesso: data.chave_acesso,
          itens: itensGravados,
        },
        tx,
      );

      return nota;
    });
  }
}

export const notaEntradaDAO = new NotaEntradaDAO();
