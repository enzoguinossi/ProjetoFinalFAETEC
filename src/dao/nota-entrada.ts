import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";
import { buildPagination, type PaginationParams } from "@/types";
import { limitesDoDiaSaoPaulo, limitesDoDiaUtc } from "@/lib/datas";
import type { Prisma } from "@prisma/client";
import { saldoDAO } from "./estoque";

export type NotaEntradaItemCriacao = {
  id_produto: number;
  /** Total já convertido que entra no estoque. */
  quantidade: number;
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
  /** Total já convertido que entra no estoque. */
  quantidade: number;
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

/** Filtros de domínio da listagem de notas de entrada. */
export type NotaEntradaListFiltros = {
  /** Início do período de `data_recebimento ?? data_criacao` (`YYYY-MM-DD`). */
  de?: string;
  /** Fim do período (`YYYY-MM-DD`, inclusivo). */
  ate?: string;
  id_fornecedor?: number[];
  /** Razão social do fornecedor ou chave de acesso. */
  search?: string;
};

/** Período de uma nota: usa `data_recebimento` ou, quando nula, `data_criacao`. */
function filtroPeriodo(
  de?: string,
  ate?: string,
): Prisma.NotaEntradaWhereInput | null {
  const recebimento = limitesDoDiaUtc(de, ate);
  const criacao = limitesDoDiaSaoPaulo(de, ate);
  if (!recebimento.inicio && !recebimento.fim) return null;

  return {
    OR: [
      {
        data_recebimento: {
          ...(recebimento.inicio ? { gte: recebimento.inicio } : {}),
          ...(recebimento.fim ? { lte: recebimento.fim } : {}),
        },
      },
      {
        data_recebimento: null,
        data_criacao: {
          ...(criacao.inicio ? { gte: criacao.inicio } : {}),
          ...(criacao.fim ? { lte: criacao.fim } : {}),
        },
      },
    ],
  };
}

function whereDe(filtros: NotaEntradaListFiltros): Prisma.NotaEntradaWhereInput {
  const where: Prisma.NotaEntradaWhereInput = {
    ativo: true,
    tipo: "ENTRADA",
  };
  const adicionais: Prisma.NotaEntradaWhereInput[] = [];

  if (filtros.id_fornecedor?.length) {
    adicionais.push({ id_fornecedor: { in: filtros.id_fornecedor } });
  }

  const periodo = filtroPeriodo(filtros.de, filtros.ate);
  if (periodo) adicionais.push(periodo);

  const busca = filtros.search?.trim();
  if (busca) {
    // `AND` mantém a busca livre independente dos demais filtros.
    adicionais.push({
      OR: [
        {
          fornecedor: {
            pessoaJuridica: { razao_social: { contains: busca } },
          },
        },
        { chave_acesso: { contains: busca } },
      ],
    });
  }

  if (adicionais.length > 0) where.AND = adicionais;
  return where;
}

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
    quantidade: number;
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
      quantidade: item.quantidade,
    })),
  };
}

export class NotaEntradaDAO {
  /** Notas de entrada (tipo ENTRADA), da mais recente para a mais antiga. */
  async list(params: PaginationParams & NotaEntradaListFiltros = {}) {
    const { skip, take } = buildPagination(params);
    const where = whereDe(params);

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
   * item alterado, a diferença do total vira uma movimentação de estoque
   * corretiva (`saldo_anterior`/`saldo_posterior`), podendo ser negativa; itens
   * novos entram como entrada cheia. Remover item é recusado — não há estado de
   * "item excluído" e apagar perderia a rastreabilidade (RN004). Qualquer falha
   * desfaz tudo.
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
              quantidade: item.quantidade,
              observacao: item.observacao ?? null,
            },
          });
        } else {
          const criado = await tx.itemNotaEntrada.create({
            data: {
              id_nota_entrada: id,
              id_produto: item.id_produto,
              quantidade: item.quantidade,
              observacao: item.observacao ?? null,
            },
          });
          item.id_item_nota_entrada = criado.id_item_nota_entrada;
        }

        const quantidadeAnterior = anterior ? Number(anterior.quantidade) : 0;
        const delta = item.quantidade - quantidadeAnterior;
        // Item existente mantém o produto gravado: a edição só corrige o total.
        const idProduto = anterior?.id_produto ?? item.id_produto;

        if (delta !== 0) {
          await saldoDAO.registrarEntrada(
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
          quantidade: item.quantidade,
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
        quantidade: number;
      }[] = [];

      for (const item of data.itens) {
        await tx.itemNotaEntrada.create({
          data: {
            id_nota_entrada: nota.id_nota_entrada,
            id_produto: item.id_produto,
            quantidade: item.quantidade,
            observacao: item.observacao ?? null,
          },
        });

        await saldoDAO.registrarEntrada(
          {
            id_produto: item.id_produto,
            id_usuario,
            id_nota_entrada: nota.id_nota_entrada,
            quantidade: item.quantidade,
            data_entrada: data.data_recebimento ?? new Date(),
            observacao: data.observacao,
          },
          tx,
        );

        itensGravados.push({
          id_produto: item.id_produto,
          quantidade: item.quantidade,
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
