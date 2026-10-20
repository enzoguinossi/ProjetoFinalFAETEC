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
  chaves_acesso: string[];
  itens: NotaEntradaItemCriacao[];
};

const AUDIT_ENTIDADE = "NotaEntrada";

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
          chavesAcesso: { select: { chave_acesso: true } },
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

  /**
   * Cria a nota de entrada com chaves, itens, atualização de estoque e
   * movimentações em uma única transação. Qualquer falha desfaz tudo.
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
        },
      });

      if (data.chaves_acesso.length > 0) {
        await tx.notaEntradaChaveAcesso.createMany({
          data: data.chaves_acesso.map((chave_acesso) => ({
            id_nota_entrada: nota.id_nota_entrada,
            chave_acesso,
          })),
        });
      }

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
          chaves_acesso: data.chaves_acesso,
          itens: itensGravados,
        },
        tx,
      );

      return nota;
    });
  }
}

export const notaEntradaDAO = new NotaEntradaDAO();
